/**
 * complete-trips.cron.ts
 * ======================
 * Cron quotidien qui termine les trajets dont le voyage est fini.
 *
 * Emplacement : apps/trip-service/src/cron/complete-trips.cron.ts
 *
 * Règle métier (validée) :
 * - Règle 1 (MVP, sans Booking) : PUBLISHED/PAUSED dont l'arrivée
 *   (fallback départ si arrivalAt absent) est passée depuis 24h,
 *   sans réservation active → COMPLETED.
 * - Règle 2 (chantier Booking) : viendra GRATUITEMENT via le stub
 *   hasActiveBookings — quand il sera branché, les trips avec deals
 *   en cours seront simplement sautés jusqu'à ce que tous les deals
 *   soient en état terminal logistique (litiges NON bloquants).
 * - Filet de sécurité J+7 : au chantier Booking, on ajoutera un log
 *   d'alerte pour les trips qui traînent avec un deal zombie.
 *
 * Prérequis :
 *   npm install node-cron
 *   npm install -D @types/node-cron
 *
 * Enregistrement dans apps/trip-service/src/main.ts :
 *   import { startCompleteTripsCron } from "./cron/complete-trips.cron";
 *   // ... après app.listen(...) :
 *   startCompleteTripsCron();
 */

import cron from "node-cron";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
import { withHeartbeat } from "@packages/libs/redis/cron-heartbeat";

import {
  canPerform,
  getCarrierStatDeltas,
  type TripStatus,
} from "../services/trip-state-machine";
import { hasActiveBookings, hasBookingsInProgress } from "../services/booking-queries";

/** Délai de grâce après l'arrivée avant de terminer le trajet. */
const GRACE_HOURS = 24;

/** Tous les jours à 03:15 (heure serveur) — hors pics de trafic. */
const SCHEDULE = "15 3 * * *";

/**
 * Une passe de complétion. Exportée séparément pour :
 * - les tests (horloge injectable)
 * - un déclenchement manuel en dev (ex: script one-shot)
 */
export async function runCompleteTripsOnce(now: Date = new Date()): Promise<{
  scanned: number;
  completed: number;
  skipped: number;
}> {
  const cutoff = new Date(now.getTime() - GRACE_HOURS * 60 * 60 * 1000);

  // Candidats : trips du pool public dont le voyage est terminé depuis
  // GRACE_HOURS. Fallback departureAt pour les trips sans arrivalAt
  // (publishTrip n'exige que departureAt).
  const candidates = await prisma.trip.findMany({
    where: {
      status: { in: ["PUBLISHED", "PAUSED"] },
      isDeleted: false,
      OR: [
        { arrivalAt: { lt: cutoff } },
        { arrivalAt: null, departureAt: { lt: cutoff } },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      isDeleted: true,
      departureAt: true,
      arrivalAt: true,
    },
  });

  let completed = 0;
  let skipped = 0;

  for (const trip of candidates) {
    try {
      const ctx = {
        hasActiveBookings: await hasActiveBookings(trip.id),
        // A20 : la complétion ignore les DISPUTED (payout gelé, voyage fini)
        hasBookingsInProgress: await hasBookingsInProgress(trip.id),
        now,
      };

      // La machine reste la source de vérité, même pour le cron.
      const check = canPerform(trip, "complete", ctx);
      if (!check.allowed) {
        skipped++;
        continue;
      }

      await prisma.trip.update({
        where: { id: trip.id },
        data: { status: "COMPLETED" },
      });

      // PUBLISHED/PAUSED → COMPLETED : sort du pool public → -1 published.
      const deltas = getCarrierStatDeltas(trip.status as TripStatus, "COMPLETED");
      if (deltas) {
        const carrierPage = await prisma.carrierPage.findUnique({
          where: { userId: trip.userId },
          select: { id: true },
        });
        if (carrierPage) {
          await prisma.carrierPage.update({
            where: { id: carrierPage.id },
            data: deltas,
          });
        }
      }

      completed++;
    } catch (err: any) {
      // Un trip en échec ne doit pas bloquer la passe entière.
      skipped++;
      console.error(
        `[complete-trips] Failed to complete trip ${trip.id}:`,
        err?.message ?? err
      );
    }
  }

  console.log(
    `[complete-trips] scanned=${candidates.length} completed=${completed} skipped=${skipped}`
  );

  return { scanned: candidates.length, completed, skipped };
}

let started = false;

/** Démarre le cron quotidien. Idempotent (safe si appelé deux fois). */
export function startCompleteTripsCron(): void {
  if (started) return;
  started = true;

  cron.schedule(SCHEDULE, () => {
    withHeartbeat(redis, { service: "trip-service", name: "complete-trips", schedule: SCHEDULE }, () => runCompleteTripsOnce(), (r) => `${r.completed} terminé(s), ${r.skipped} ignoré(s) sur ${r.scanned}`).catch((err) => {
      console.error("[complete-trips] Run failed:", err?.message ?? err);
    });
  });

  console.log(`[cron] complete-trips scheduled (${SCHEDULE})`);
}

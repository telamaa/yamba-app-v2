/**
 * booking-write.ts — le socle d'ÉCRITURE partagé des transitions (B2-PR2 → B3-PR1)
 * ==================================================================================
 * Emplacement : apps/deal-service/src/services/booking-write.ts
 *
 * Extrait de deal-lifecycle.service.ts au moment où le deal-transport
 * (B3) en avait besoin à son tour (règle du chapitre 34 : une lib naît
 * au deuxième usage, jamais par clonage). Deux briques :
 *   - `loadBookingForWrite`  : charge le booking (404 si absent/effacé)
 *     avec TOUT ce que les writers lisent (snapshots, paiement, code,
 *     compteurs, jalons de tracking) ;
 *   - `applyBookingTransition` : UNE transaction Mongo — updateMany
 *     CONDITIONNEL sur le statut attendu (deux clics concurrents : un
 *     seul gagne), restitution des kg (CAP-02) si demandée, événements
 *     outbox validés au CONTRAT avant écriture (D2).
 *
 * Rien de métier ici : la machine décide, le provider bouge l'argent,
 * ce module écrit.
 */

import prisma from "@packages/libs/prisma";
import { NotFoundError } from "@packages/error-handler";
import { BookingDomainEventSchema } from "@packages/api-contracts";
import type { BookingStatus } from "./booking-state-machine";
import { BookingLifecycleError, kgReservedBySnapshot, type BookingSnapshotsForLifecycle } from "./booking-lifecycle";

/* ══ Chargement ═══════════════════════════════════════════════ */

export const BOOKING_WRITE_SELECT = {
  id: true,
  tripId: true,
  shipperId: true,
  carrierId: true,
  status: true,
  isDeleted: true,
  expiresAt: true,
  acceptedAt: true,
  pickedUpAt: true,
  paymentIntentId: true,
  trip: true,
  pricing: true,
  parcel: true,
  pickup: true,
  trackingEvents: true,
  deliveryCodeHash: true,
  deliveryAttempts: true,
  deliveryLockedUntil: true,
  codeRegenerations: true,
  // B4 — versement et litige
  deliveredAt: true,
  payoutDueAt: true,
  payoutStatus: true,
  payoutAttempts: true,
  payoutAmountCents: true,
  chargeId: true,
  updatedAt: true,
  transferId: true,
  retentionCents: true,
  retentionDisposition: true,
} as const;

export type BookingForWrite = {
  id: string;
  tripId: string;
  shipperId: string;
  carrierId: string;
  status: string;
  isDeleted: boolean;
  expiresAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  paymentIntentId: string | null;
  pickup: { confirmedAt: Date; photoUrls: string[]; notes: string | null; checklist?: string[] } | null;
  trackingEvents: { step: string; confirmedAt: Date }[];
  deliveryCodeHash: string | null;
  deliveryAttempts: number;
  deliveryLockedUntil: Date | null;
  codeRegenerations: number;
  // B4 — absents sur les enregistrements antérieurs (mocks, seed) : tolérés
  deliveredAt?: Date | null;
  payoutDueAt?: Date | null;
  payoutStatus?: string | null;
  payoutAttempts?: number | null;
  /** Montant à verser quand il diffère du net (compensation ANN-01, A79). */
  payoutAmountCents?: number | null;
  chargeId?: string | null;
  /** Verrou optimiste (A85) : les gardes conditionnelles qui portaient sur une liste composite passent par lui. */
  updatedAt?: Date | null;
  transferId?: string | null;
  retentionCents?: number | null;
  retentionDisposition?: string | null;
} & BookingSnapshotsForLifecycle;

/** Normalise un enregistrement Prisma (ou un mock de test) en BookingForWrite. */
export function toBookingForWrite(raw: Record<string, unknown>): BookingForWrite {
  const r = raw as BookingForWrite & { parcel: { category: unknown; categoryFamily?: string | null } };
  return {
    ...r,
    status: String(r.status),
    acceptedAt: r.acceptedAt ?? null,
    pickedUpAt: r.pickedUpAt ?? null,
    pickup: r.pickup ?? null,
    trackingEvents: r.trackingEvents ?? [],
    deliveryCodeHash: r.deliveryCodeHash ?? null,
    deliveryAttempts: r.deliveryAttempts ?? 0,
    deliveryLockedUntil: r.deliveryLockedUntil ?? null,
    codeRegenerations: r.codeRegenerations ?? 0,
    parcel: {
      category: String(r.parcel.category),
      categoryFamily: r.parcel.categoryFamily ?? null,
    },
  };
}

export async function loadBookingForWrite(id: string): Promise<BookingForWrite> {
  const booking = await prisma.booking.findUnique({ where: { id }, select: BOOKING_WRITE_SELECT });
  if (!booking || booking.isDeleted) throw new NotFoundError("Deal not found.");
  return toBookingForWrite(booking as unknown as Record<string, unknown>);
}

/* ══ Transaction commune (transition + kg + outbox) ═══════════ */

export type OutboxEventInput = { eventType: string; payload: Record<string, unknown> };

export function makeEnvelope(bookingId: string, now: Date) {
  return {
    aggregateType: "booking" as const,
    aggregateId: bookingId,
    occurredAt: now.toISOString(),
    correlationId: null,
    schemaVersion: 1 as const,
  };
}

/**
 * UNE transaction Mongo : transition conditionnelle (0 ligne = un
 * concurrent a gagné → TRANSITION_NOT_ALLOWED), kg restitués si
 * demandé, outbox validée au contrat AVANT écriture (payload invalide
 * = bug de writer ⇒ 500 ici, jamais un poison pour le relay).
 *
 * `where` permet à un writer d'ajouter ses propres gardes optimistes
 * (compteur de tentatives, absence d'un jalon…) à la condition de statut.
 */
export async function applyBookingTransition(args: {
  booking: Pick<BookingForWrite, "id" | "tripId" | "pricing">;
  from: BookingStatus;
  where?: Record<string, unknown>;
  data: Record<string, unknown>;
  releaseKg: boolean;
  events: OutboxEventInput[];
  now: Date;
  /** Message du 409 quand la condition ne matche plus (défaut : « changé entre-temps »). */
  conflictMessage?: string;
  /** Écritures supplémentaires DANS la même transaction, après la transition
   *  conditionnelle (ex. création du dossier `Dispute`, B4/D51). */
  within?: (tx: typeof prisma) => Promise<void>;
}): Promise<void> {
  const { booking, from, where, data, releaseKg, events, now, within } = args;
  const envelope = makeEnvelope(booking.id, now);
  const parsed = events.map((e) => BookingDomainEventSchema.parse({ ...envelope, ...e }));

  await prisma.$transaction(async (tx) => {
    const updated = await tx.booking.updateMany({
      where: { id: booking.id, status: from as never, ...(where ?? {}) } as never,
      data: data as never,
    });
    if (updated.count === 0) {
      throw new BookingLifecycleError(
        "TRANSITION_NOT_ALLOWED",
        args.conflictMessage ?? "This deal changed in the meantime — please refresh."
      );
    }

    if (releaseKg) {
      // CAP-02 — la transition conditionnelle ci-dessus garantit UNE
      // exécution : le décrément est sûr (le gte pare un état corrompu).
      const kg = kgReservedBySnapshot(booking.pricing);
      await tx.trip.updateMany({
        where: { id: booking.tripId, reservedKg: { gte: kg } },
        data: { reservedKg: { decrement: kg } },
      });
    }

    if (within) await within(tx as typeof prisma);

    for (const e of parsed) {
      await tx.outboxEvent.create({
        data: {
          aggregateType: "booking",
          aggregateId: booking.id,
          eventType: e.eventType,
          payload: e as never,
          occurredAt: now,
        // Explicite : sur Mongo, absent ≠ null pour le relay (A49)
        publishedAt: null,
        },
      });
    }
  });
}

/**
 * deal-rating.service.ts — notation mutuelle double-aveugle (B5, D53)
 * ===================================================================
 * Emplacement : apps/deal-service/src/services/deal-rating.service.ts
 *
 * Même rituel que le règlement : charger, machine (`canRate`), UNE
 * transaction (Review + marquage du Booking, verrou optimiste `updatedAt`
 * — jamais une garde sur un champ peut-être absent, A85) + outbox.
 *
 * Double-aveugle : un avis naît avec `revealedAt = null`. Il est révélé
 * quand l'AUTRE partie a noté (dans la même transaction) ou par le cron à
 * la fin de la fenêtre de 14 jours (`revealElapsed`). Seuls les avis
 * révélés comptent dans la réputation (reputation.service).
 * Relances : J+5 puis J+7 après COMPLETED aux rôles qui n'ont pas noté,
 * puis silence (`ratingRemindersSent`).
 */

import prisma from "@packages/libs/prisma";
import { ForbiddenError, NotFoundError } from "@packages/error-handler";
import {
  CARRIER_RATING_CRITERIA,
  RATING_REMINDER_DAYS,
  RATING_WINDOW_DAYS,
  SHIPPER_RATING_CRITERIA,
  type RatingContextResponse,
  type SubmitRatingRequest,
  type SubmitRatingResponse,
} from "@packages/api-contracts";
import { canRate, type BookingStatus } from "./booking-state-machine";
import { BookingLifecycleError, baseEventPayload } from "./booking-lifecycle";
import { BOOKING_WRITE_SELECT, applyBookingTransition, toBookingForWrite, type BookingForWrite } from "./booking-write";
import { recomputeBookingParties } from "./reputation.service";

export type RequestingUser = { id: string };
type Role = "SHIPPER" | "CARRIER";

const RATING_SELECT = {
  ...BOOKING_WRITE_SELECT,
  completedAt: true,
  ratingWindowEndsAt: true,
  shipperRatedAt: true,
  carrierRatedAt: true,
  ratingsRevealedAt: true,
  ratingRemindersSent: true,
} as const;

type RatingBooking = BookingForWrite & {
  completedAt?: Date | null;
  ratingWindowEndsAt?: Date | null;
  shipperRatedAt?: Date | null;
  carrierRatedAt?: Date | null;
  ratingsRevealedAt?: Date | null;
  ratingRemindersSent?: number | null;
};

export type RatingLogger = { info(o: Record<string, unknown>, m: string): void; error(o: Record<string, unknown>, m: string): void };
const silent: RatingLogger = { info() {}, error() {} };

function roleOf(booking: { shipperId: string; carrierId: string }, userId: string): Role | null {
  if (booking.shipperId === userId) return "SHIPPER";
  if (booking.carrierId === userId) return "CARRIER";
  return null;
}

/** Ne garde que les critères du rôle NOTÉ (le contrat accepte l'union). */
export function filterCriteria(ratedRole: Role, criteria: SubmitRatingRequest["criteria"]): Record<string, "UP" | "DOWN"> | null {
  if (!criteria) return null;
  const allowed: readonly string[] = ratedRole === "CARRIER" ? CARRIER_RATING_CRITERIA : SHIPPER_RATING_CRITERIA;
  const kept = Object.fromEntries(Object.entries(criteria).filter(([k]) => allowed.includes(k)));
  return Object.keys(kept).length ? (kept as Record<string, "UP" | "DOWN">) : null;
}

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

export function makeDealRatingService(clock: () => Date = () => new Date(), logger: RatingLogger = silent) {
  async function loadRatingBooking(dealId: string): Promise<RatingBooking> {
    const raw = await prisma.booking.findUnique({ where: { id: dealId }, select: RATING_SELECT });
    if (!raw || (raw as { isDeleted?: boolean }).isDeleted) throw new NotFoundError("Deal not found.");
    return toBookingForWrite(raw as unknown as Record<string, unknown>) as RatingBooking;
  }

  function machineView(b: RatingBooking) {
    return {
      status: b.status as BookingStatus,
      isDeleted: b.isDeleted,
      expiresAt: b.expiresAt,
      ratingWindowEndsAt: b.ratingWindowEndsAt ?? null,
      shipperRatedAt: b.shipperRatedAt ?? null,
      carrierRatedAt: b.carrierRatedAt ?? null,
    };
  }

  async function reviewsOf(bookingId: string) {
    return prisma.review.findMany({
      where: { bookingId },
      select: { authorUserId: true, subjectUserId: true, rating: true, comment: true, criteria: true, createdAt: true, revealedAt: true },
    });
  }

  return {
    /* ── GET /deals/:id/rating ──────────────────────────────── */
    async getContext(user: RequestingUser, dealId: string): Promise<RatingContextResponse> {
      const now = clock();
      const booking = await loadRatingBooking(dealId);
      const viewerRole = roleOf(booking, user.id);
      if (!viewerRole) throw new ForbiddenError("You are not a party to this deal.");
      const ratedRole: Role = viewerRole === "SHIPPER" ? "CARRIER" : "SHIPPER";
      const personId = ratedRole === "CARRIER" ? booking.carrierId : booking.shipperId;
      const [person, reviews] = await Promise.all([
        prisma.user.findUnique({ where: { id: personId }, select: { id: true, firstName: true, lastName: true, avatar: { select: { url: true } } } }),
        reviewsOf(booking.id),
      ]);
      const mine = reviews.find((r) => r.authorUserId === user.id) ?? null;
      const theirs = reviews.find((r) => r.authorUserId === personId) ?? null;
      const revealed = booking.ratingsRevealedAt ?? null;
      const check = canRate(machineView(booking), viewerRole, now);
      const toMy = (r: NonNullable<typeof mine>) => ({
        rating: Math.round(r.rating),
        criteria: (r.criteria as Record<string, "UP" | "DOWN"> | null) ?? null,
        comment: r.comment,
        submittedAt: r.createdAt.toISOString(),
      });
      return {
        bookingId: booking.id,
        viewerRole,
        ratedRole,
        person: {
          id: personId,
          firstName: person?.firstName ?? "",
          lastInitial: person?.lastName ? `${person.lastName.charAt(0).toUpperCase()}.` : "",
          avatarUrl: person?.avatar?.url ?? null,
        },
        corridor: { originCity: booking.trip.originCity, destinationCity: booking.trip.destinationCity },
        completedAt: iso(booking.completedAt),
        windowEndsAt: iso(booking.ratingWindowEndsAt),
        canRate: check.allowed,
        cannotRateReason: check.allowed ? null : check.reason,
        myRating: mine ? toMy(mine) : null,
        counterpartHasRated: theirs !== null,
        revealedAt: iso(revealed),
        // Double-aveugle : la note de l'autre n'existe pour moi qu'une fois révélée.
        counterpartRating: theirs && revealed ? toMy(theirs) : null,
      };
    },

    /* ── POST /deals/:id/rating ─────────────────────────────── */
    async submit(user: RequestingUser, dealId: string, input: SubmitRatingRequest): Promise<SubmitRatingResponse> {
      const now = clock();
      const booking = await loadRatingBooking(dealId);
      const viewerRole = roleOf(booking, user.id);
      if (!viewerRole) throw new ForbiddenError("You are not a party to this deal.");
      const check = canRate(machineView(booking), viewerRole, now);
      if (!check.allowed) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", check.reason);

      const ratedRole: Role = viewerRole === "SHIPPER" ? "CARRIER" : "SHIPPER";
      const subjectUserId = ratedRole === "CARRIER" ? booking.carrierId : booking.shipperId;
      const otherRated = viewerRole === "SHIPPER" ? !!booking.carrierRatedAt : !!booking.shipperRatedAt;
      const revealNow = otherRated; // les deux ont noté → révélation immédiate (D53)
      const ratedField = viewerRole === "SHIPPER" ? "shipperRatedAt" : "carrierRatedAt";

      await applyBookingTransition({
        booking,
        from: "COMPLETED",
        // A85 — verrou optimiste : jamais une garde sur un champ peut-être absent.
        where: booking.updatedAt ? { updatedAt: booking.updatedAt } : {},
        data: { [ratedField]: now, ...(revealNow ? { ratingsRevealedAt: now } : {}) },
        releaseKg: false,
        events: revealNow
          ? [{ eventType: "booking.rating_revealed", payload: { ...baseEventPayload(booking, viewerRole), revealedReason: "BOTH_RATED" } }]
          : [],
        now,
        conflictMessage: "This deal changed in the meantime — please refresh.",
        within: async (tx) => {
          // Une note par rôle et par deal (bookingId nullable → unicité de service, A9).
          const existing = await tx.review.findFirst({ where: { bookingId: booking.id, authorUserId: user.id }, select: { id: true } });
          if (existing) throw new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "You have already rated this deal.");
          await tx.review.create({
            data: {
              subjectUserId,
              authorUserId: user.id,
              kind: ratedRole === "CARRIER" ? "AS_CARRIER" : "AS_SHIPPER",
              bookingId: booking.id,
              rating: input.rating,
              comment: input.comment?.trim() ? input.comment.trim() : null,
              criteria: filterCriteria(ratedRole, input.criteria) ?? undefined,
              revealedAt: revealNow ? now : null,
            },
          });
          if (revealNow) {
            await tx.review.updateMany({ where: { bookingId: booking.id, revealedAt: null }, data: { revealedAt: now } });
          }
        },
      });

      if (revealNow) await recomputeBookingParties(booking);
      return { bookingId: booking.id, submittedAt: now.toISOString(), revealed: revealNow, revealedAt: revealNow ? now.toISOString() : null };
    },

    /* ── Cron : relances J+5 / J+7 (spec §3.7) ──────────────── */

    async sendRatingReminders(batchSize = 50): Promise<number> {
      const now = clock();
      let sent = 0;
      for (const [index, days] of RATING_REMINDER_DAYS.entries()) {
        const before = new Date(now.getTime() - days * 86_400_000);
        const due = await prisma.booking.findMany({
          where: {
            status: "COMPLETED",
            isDeleted: false,
            completedAt: { lte: before },
            ratingWindowEndsAt: { gt: now },
            ratingRemindersSent: index, // 0 → 1re relance, 1 → 2e
          },
          select: RATING_SELECT,
          take: batchSize,
          orderBy: { completedAt: "asc" },
        });
        for (const raw of due) {
          const booking = toBookingForWrite(raw as unknown as Record<string, unknown>) as RatingBooking;
          const targets: Role[] = [];
          if (!booking.shipperRatedAt) targets.push("SHIPPER");
          if (!booking.carrierRatedAt) targets.push("CARRIER");
          try {
            await applyBookingTransition({
              booking,
              from: "COMPLETED",
              where: { ratingRemindersSent: index },
              data: { ratingRemindersSent: index + 1 },
              releaseKg: false,
              events: targets.map((targetRole) => ({
                eventType: "booking.rating_reminder",
                payload: { ...baseEventPayload(booking, "SYSTEM"), reminderNumber: (index + 1) as 1 | 2, targetRole },
              })),
              now,
              conflictMessage: "Reminder already sent.",
            });
            sent += targets.length;
          } catch (err) {
            logger.info({ bookingId: booking.id, err: err instanceof Error ? err.message : err }, "Rating reminder skipped");
          }
        }
      }
      return sent;
    },

    /* ── Cron : révélation à 14 jours (D53) ─────────────────── */

    async revealElapsed(batchSize = 50): Promise<number> {
      const now = clock();
      const due = await prisma.booking.findMany({
        where: {
          status: "COMPLETED",
          isDeleted: false,
          ratingWindowEndsAt: { lte: now },
          OR: [{ ratingsRevealedAt: null }, { ratingsRevealedAt: { isSet: false } }],
        },
        select: RATING_SELECT,
        take: batchSize,
        orderBy: { ratingWindowEndsAt: "asc" },
      });
      let revealed = 0;
      for (const raw of due) {
        const booking = toBookingForWrite(raw as unknown as Record<string, unknown>) as RatingBooking;
        const anyRating = !!booking.shipperRatedAt || !!booking.carrierRatedAt;
        try {
          await applyBookingTransition({
            booking,
            from: "COMPLETED",
            where: booking.updatedAt ? { updatedAt: booking.updatedAt } : {},
            data: { ratingsRevealedAt: now },
            releaseKg: false,
            // Sans aucune note, rien à révéler : on ferme la fenêtre sans bruit.
            events: anyRating
              ? [{ eventType: "booking.rating_revealed", payload: { ...baseEventPayload(booking, "SYSTEM"), revealedReason: "WINDOW_ELAPSED" } }]
              : [],
            now,
            conflictMessage: "Already revealed.",
            within: async (tx) => {
              await tx.review.updateMany({ where: { bookingId: booking.id, revealedAt: null }, data: { revealedAt: now } });
            },
          });
          revealed += 1;
          if (anyRating) await recomputeBookingParties(booking);
        } catch (err) {
          logger.info({ bookingId: booking.id, err: err instanceof Error ? err.message : err }, "Rating reveal skipped");
        }
      }
      return revealed;
    },
  };
}

export type DealRatingService = ReturnType<typeof makeDealRatingService>;
export { RATING_WINDOW_DAYS };

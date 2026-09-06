/**
 * tracking-link.service.ts — page destinataire (D69)
 * ===================================================
 * `issue` : l'Expéditeur obtient (ou crée) le lien de suivi de sa réservation — jeton CSPRNG,
 * un seul par réservation. `publicView` : ce que le destinataire lit, sans session, contenu minimal.
 * 404 uniforme : lien inconnu, révoqué, réservation supprimée ou tiers effacé (D63 5A).
 */
import { randomBytes } from "crypto";
import prisma from "@packages/libs/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@packages/error-handler";
import type { PublicTrackingResponse, TrackingLinkResponse } from "@packages/api-contracts";
import { canIssueTrackingLink, isTrackingVisible, publicMilestones } from "../lib/tracking-link.rules";

type Row = Record<string, unknown>;
export type TrackingDb = {
  booking: { findUnique(args: Row): Promise<Row | null> };
  trackingLink: { findUnique(args: Row): Promise<Row | null>; create(args: Row): Promise<Row> };
  user: { findMany(args: Row): Promise<Row[]> };
  trip: { findUnique(args: Row): Promise<Row | null> };
};

export const TRACKING_PATH_PREFIX = "/track/";
const iso = (d: unknown) => (d && typeof (d as Date).toISOString === "function" ? (d as Date).toISOString() : null);

export function makeTrackingLinkService(deps: { db?: TrackingDb; token?: () => string } = {}) {
  const db = deps.db ?? (prisma as unknown as TrackingDb);
  const newToken = deps.token ?? (() => randomBytes(32).toString("base64url"));

  return {
    /** POST /deals/:id/tracking-link — Expéditeur seul (403 Voyageur), 409 TRACKING_NOT_AVAILABLE hors statuts. */
    async issue(userId: string, bookingId: string): Promise<TrackingLinkResponse> {
      const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, shipperId: true, carrierId: true, status: true, isDeleted: true, recipient: true } });
      if (!booking || booking.isDeleted) throw new NotFoundError("Deal not found.");
      if (booking.shipperId !== userId) {
        if (booking.carrierId === userId) throw new ForbiddenError("Only the shipper shares the tracking link.");
        throw new ForbiddenError("You are not a party to this deal.");
      }
      if (!canIssueTrackingLink(booking.status as string)) throw new AppError("Tracking is not available for this deal.", 409, true, { type: "booking", code: "TRACKING_NOT_AVAILABLE" });
      let link = await db.trackingLink.findUnique({ where: { bookingId: booking.id }, select: { token: true, revokedAt: true } });
      if (!link) link = await db.trackingLink.create({ data: { bookingId: booking.id, token: newToken(), revokedAt: null }, select: { token: true, revokedAt: true } });
      const recipient = (booking.recipient as { firstName?: string; phoneE164?: string | null } | null) ?? {};
      return { token: link.token as string, path: `${TRACKING_PATH_PREFIX}${link.token as string}`, recipientFirstName: recipient.firstName ?? "", recipientPhoneE164: recipient.phoneE164 ?? null };
    },

    /** GET /track/:token — sans session. Contenu minimal, 404 uniforme. */
    async publicView(token: string): Promise<PublicTrackingResponse> {
      const link = await db.trackingLink.findUnique({ where: { token }, select: { bookingId: true, revokedAt: true } });
      if (!link) throw new NotFoundError("Tracking link not found.");
      const booking = await db.booking.findUnique({
        where: { id: link.bookingId as string },
        select: { id: true, status: true, isDeleted: true, recipientRedactedAt: true, recipient: true, shipperId: true, carrierId: true, tripId: true, acceptedAt: true, pickedUpAt: true, deliveredAt: true, closedAt: true, cancelledAt: true, trackingEvents: true },
      });
      if (!booking || !isTrackingVisible({ isDeleted: !!booking.isDeleted, recipientRedactedAt: (booking.recipientRedactedAt as Date | null) ?? null, revokedAt: (link.revokedAt as Date | null) ?? null })) {
        throw new NotFoundError("Tracking link not found.");
      }
      const [users, trip] = await Promise.all([
        db.user.findMany({ where: { id: { in: [booking.shipperId as string, booking.carrierId as string] } }, select: { id: true, firstName: true, lastName: true } }),
        db.trip.findUnique({ where: { id: booking.tripId as string }, select: { originCity: true, destinationCity: true, departureAt: true, arrivalAt: true } }),
      ]);
      const byId = new Map(users.map((u) => [u.id as string, u]));
      const shipper = byId.get(booking.shipperId as string);
      const carrier = byId.get(booking.carrierId as string);
      const steps = publicMilestones({
        status: booking.status as string,
        acceptedAt: (booking.acceptedAt as Date | null) ?? null,
        pickedUpAt: (booking.pickedUpAt as Date | null) ?? null,
        deliveredAt: (booking.deliveredAt as Date | null) ?? null,
        closedAt: (booking.closedAt as Date | null) ?? null,
        cancelledAt: (booking.cancelledAt as Date | null) ?? null,
        trackingEvents: ((booking.trackingEvents as { step: string; confirmedAt: Date }[] | null) ?? []),
      });
      const recipient = (booking.recipient as { firstName?: string } | null) ?? {};
      return {
        milestone: steps.length ? steps[steps.length - 1].key : "ACCEPTED",
        steps: steps.map((s) => ({ key: s.key, at: s.at.toISOString() })),
        recipientFirstName: recipient.firstName ?? "",
        shipperFirstName: (shipper?.firstName as string) ?? "",
        carrier: { firstName: (carrier?.firstName as string) ?? "", lastInitial: ((carrier?.lastName as string) ?? "").charAt(0).toUpperCase() },
        corridor: { originCity: (trip?.originCity as string) ?? "", destinationCity: (trip?.destinationCity as string) ?? "" },
        departureAt: iso(trip?.departureAt),
        arrivalAt: iso(trip?.arrivalAt),
      };
    },
  };
}
export type TrackingLinkService = ReturnType<typeof makeTrackingLinkService>;

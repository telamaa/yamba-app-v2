/**
 * admin-dispute.service.ts — file « à arbitrer » + dossier (chantier C-PR1, D54)
 * ==============================================================================
 * Lecture seule en PR1. Deux sources dans UNE file (7A) :
 *   - DISPUTE   : Booking DISPUTED + Dispute OPEN ;
 *   - RETENTION : Booking CANCELLED, retentionDisposition HELD_FOR_MEDIATION (A81).
 * Le mapper est pur (testé) ; le service charge et journalise la consultation
 * d'un dossier (DISPUTE_VIEWED — l'admin voit des photos et des identités).
 */
import prisma from "@packages/libs/prisma";
import { NotFoundError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { AdminDisputeFile, ArbitrationQueueItem, ArbitrationQueueResponse } from "@packages/api-contracts";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export type AdminBookingRecord = {
  id: string;
  status: string;
  shipperId: string;
  carrierId: string;
  trip: { originCity: string; destinationCity: string; departureAt: Date; transportMode: string | null };
  pricing: { weightKg: number; transportCents: number; commissionCents: number; premiumCents: number; totalShipperCents: number; currencyCode: string };
  parcel: { category: string; description: string; declaredValueCents: number; photoUrls: string[] };
  recipient: { firstName: string; lastName: string };
  requestedAt: Date;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  disputedAt: Date | null;
  closedAt: Date | null;
  closedBy: string | null;
  cancelReason: string | null;
  capturedAt: Date | null;
  refundedAt: Date | null;
  refundAmountCents: number | null;
  payoutStatus: string | null;
  payoutAmountCents: number | null;
  retentionCents: number | null;
  retentionDisposition: string | null;
  disputeTicket: string | null;
  pickup: { confirmedAt: Date; photoUrls: string[]; checklist: string[]; notes: string | null } | null;
  trackingEvents: Array<{ step: string; confirmedAt: Date }>;
  deliveryPhotoUrls: string[];
};

export type AdminDisputeRecord = {
  ticketNumber: string;
  category: string;
  description: string;
  desiredOutcome: string | null;
  photoUrls: string[];
  pledgeAcceptedAt: Date;
  status: string;
  createdAt: Date;
};

export type AdminPartyRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  shipperRatingsAvg: number;
  shipperRatingsCount: number;
  shipperCompletedDealsCount: number;
  shipperLateCancellationsCount: number;
  carrierPage: { ratingsAvg: number; ratingsCount: number; completedDealsCount: number; lateCancellationsCount: number } | null;
};

export function arbitrationKindOf(b: Pick<AdminBookingRecord, "status" | "retentionDisposition">): "DISPUTE" | "RETENTION" | null {
  if (b.status === "DISPUTED") return "DISPUTE";
  if (b.status === "CANCELLED" && b.retentionDisposition === "HELD_FOR_MEDIATION") return "RETENTION";
  return null;
}

/** Pur : une ligne de la file. */
export function toQueueItem(
  b: AdminBookingRecord,
  dispute: Pick<AdminDisputeRecord, "ticketNumber" | "category"> | null,
  names: { shipperFirstName: string; carrierFirstName: string }
): ArbitrationQueueItem | null {
  const kind = arbitrationKindOf(b);
  if (!kind) return null;
  return {
    bookingId: b.id,
    kind,
    ticketNumber: kind === "DISPUTE" ? (dispute?.ticketNumber ?? b.disputeTicket) : null,
    category: kind === "DISPUTE" ? ((dispute?.category as ArbitrationQueueItem["category"]) ?? null) : null,
    openedAt: (kind === "DISPUTE" ? (b.disputedAt ?? b.requestedAt) : (b.closedAt ?? b.requestedAt)).toISOString(),
    originCity: b.trip.originCity,
    destinationCity: b.trip.destinationCity,
    amountCents: kind === "DISPUTE" ? b.pricing.totalShipperCents : (b.retentionCents ?? 0),
    currencyCode: b.pricing.currencyCode,
    shipperFirstName: names.shipperFirstName,
    carrierFirstName: names.carrierFirstName,
  };
}

function toParty(u: AdminPartyRecord, role: "SHIPPER" | "CARRIER"): AdminDisputeFile["shipper"] {
  const asCarrier = role === "CARRIER" && u.carrierPage;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    completedDealsCount: asCarrier ? u.carrierPage!.completedDealsCount : u.shipperCompletedDealsCount,
    lateCancellationsCount: asCarrier ? u.carrierPage!.lateCancellationsCount : u.shipperLateCancellationsCount,
    ratingsAvg: asCarrier ? u.carrierPage!.ratingsAvg : u.shipperRatingsAvg,
    ratingsCount: asCarrier ? u.carrierPage!.ratingsCount : u.shipperRatingsCount,
  };
}

/** Pur : le dossier complet — JAMAIS le code de livraison (D43). */
export function toDisputeFile(b: AdminBookingRecord, dispute: AdminDisputeRecord | null, shipper: AdminPartyRecord, carrier: AdminPartyRecord): AdminDisputeFile | null {
  const kind = arbitrationKindOf(b);
  if (!kind) return null;
  return {
    bookingId: b.id,
    kind,
    status: b.status,
    timeline: {
      requestedAt: b.requestedAt.toISOString(),
      acceptedAt: iso(b.acceptedAt),
      departureAt: b.trip.departureAt.toISOString(),
      pickedUpAt: iso(b.pickedUpAt),
      deliveredAt: iso(b.deliveredAt),
      disputedAt: iso(b.disputedAt),
      closedAt: iso(b.closedAt),
      closedBy: b.closedBy,
      cancelReason: b.cancelReason,
    },
    corridor: { originCity: b.trip.originCity, destinationCity: b.trip.destinationCity, transportMode: b.trip.transportMode },
    parcel: {
      category: b.parcel.category,
      description: b.parcel.description,
      declaredValueCents: b.parcel.declaredValueCents,
      weightKg: b.pricing.weightKg,
      photoUrls: b.parcel.photoUrls ?? [],
    },
    recipient: { firstName: b.recipient.firstName, lastName: b.recipient.lastName },
    money: {
      totalShipperCents: b.pricing.totalShipperCents,
      transportCents: b.pricing.transportCents,
      commissionCents: b.pricing.commissionCents,
      premiumCents: b.pricing.premiumCents,
      currencyCode: b.pricing.currencyCode,
      capturedAt: iso(b.capturedAt),
      refundedAt: iso(b.refundedAt),
      refundAmountCents: b.refundAmountCents,
      payoutStatus: b.payoutStatus,
      payoutAmountCents: b.payoutAmountCents,
      retentionCents: b.retentionCents,
      retentionDisposition: b.retentionDisposition,
    },
    shipper: toParty(shipper, "SHIPPER"),
    carrier: toParty(carrier, "CARRIER"),
    pickup: b.pickup
      ? { confirmedAt: b.pickup.confirmedAt.toISOString(), photoUrls: b.pickup.photoUrls ?? [], checklist: b.pickup.checklist ?? [], notes: b.pickup.notes }
      : null,
    trackingEvents: (b.trackingEvents ?? []).map((e) => ({ step: e.step, confirmedAt: e.confirmedAt.toISOString() })),
    deliveryPhotoUrls: b.deliveryPhotoUrls ?? [],
    dispute:
      kind === "DISPUTE" && dispute
        ? {
            ticketNumber: dispute.ticketNumber,
            category: dispute.category as AdminDisputeFile["dispute"] extends infer D ? (D extends { category: infer C } ? C : never) : never,
            description: dispute.description,
            desiredOutcome: dispute.desiredOutcome as AdminDisputeFile["dispute"] extends infer D ? (D extends { desiredOutcome: infer O } ? O : never) : never,
            photoUrls: dispute.photoUrls ?? [],
            pledgeAcceptedAt: dispute.pledgeAcceptedAt.toISOString(),
            status: dispute.status,
          }
        : null,
  };
}

/* ── Chargement ─────────────────────────────────────────────── */
const partySelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  shipperRatingsAvg: true,
  shipperRatingsCount: true,
  shipperCompletedDealsCount: true,
  shipperLateCancellationsCount: true,
  carrierPage: { select: { ratingsAvg: true, ratingsCount: true, completedDealsCount: true, lateCancellationsCount: true } },
} as const;

export function makeAdminDisputeService() {
  return {
    async listQueue(): Promise<ArbitrationQueueResponse> {
      const bookings = (await prisma.booking.findMany({
        where: {
          isDeleted: false,
          OR: [{ status: "DISPUTED" }, { status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION" }],
        },
        orderBy: { updatedAt: "asc" },
      })) as unknown as AdminBookingRecord[];
      if (bookings.length === 0) return { items: [], counts: { disputes: 0, retentions: 0 } };

      const ids = bookings.map((b) => b.id);
      const userIds = [...new Set(bookings.flatMap((b) => [b.shipperId, b.carrierId]))];
      const [disputes, users] = await Promise.all([
        prisma.dispute.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true, ticketNumber: true, category: true } }),
        prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true } }),
      ]);
      const disputeBy = new Map(disputes.map((d) => [d.bookingId, d]));
      const nameBy = new Map(users.map((u) => [u.id, u.firstName]));

      const items = bookings
        .map((b) =>
          toQueueItem(b, disputeBy.get(b.id) ?? null, {
            shipperFirstName: nameBy.get(b.shipperId) ?? "—",
            carrierFirstName: nameBy.get(b.carrierId) ?? "—",
          })
        )
        .filter((x): x is ArbitrationQueueItem => x !== null)
        // Les plus anciens d'abord : un dossier qui attend est prioritaire.
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
      return {
        items,
        counts: { disputes: items.filter((i) => i.kind === "DISPUTE").length, retentions: items.filter((i) => i.kind === "RETENTION").length },
      };
    },

    async getFile(admin: { id: string; ip?: string | null; userAgent?: string | null }, bookingId: string): Promise<AdminDisputeFile> {
      const booking = (await prisma.booking.findFirst({ where: { id: bookingId, isDeleted: false } })) as unknown as AdminBookingRecord | null;
      if (!booking || !arbitrationKindOf(booking)) throw new NotFoundError("No arbitration file for this deal.");
      const [dispute, shipper, carrier] = await Promise.all([
        prisma.dispute.findUnique({ where: { bookingId } }),
        prisma.user.findUnique({ where: { id: booking.shipperId }, select: partySelect }),
        prisma.user.findUnique({ where: { id: booking.carrierId }, select: partySelect }),
      ]);
      if (!shipper || !carrier) throw new NotFoundError("No arbitration file for this deal.");
      const file = toDisputeFile(booking, dispute as unknown as AdminDisputeRecord | null, shipper as AdminPartyRecord, carrier as AdminPartyRecord);
      if (!file) throw new NotFoundError("No arbitration file for this deal.");
      // Journal : l'admin a ouvert un dossier (identités, photos, montants).
      await recordAdminAction(prisma, {
        adminUserId: admin.id,
        action: "DISPUTE_VIEWED",
        targetType: "BOOKING",
        targetId: bookingId,
        after: { kind: file.kind, ticketNumber: file.dispute?.ticketNumber ?? null },
        ip: admin.ip,
        userAgent: admin.userAgent,
      });
      return file;
    },
  };
}
export type AdminDisputeService = ReturnType<typeof makeAdminDisputeService>;

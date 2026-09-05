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
import { DISPUTE_RESPONSE_DELAY_HOURS, type AdminDisputeFile, type ArbitrationQueueItem, type ArbitrationQueueQuery, type ArbitrationQueueResponse } from "@packages/api-contracts";
import { computeLateCancellationCompensationCents } from "./booking-lifecycle";
import { platformSettings } from "@packages/libs/settings/default";
import type { SettingsReader } from "@packages/libs/settings";

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
  retentionDecisionReason?: string | null;
  retentionDecidedAt?: Date | null;
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
  // C-PR2 (D55)
  carrierStatement?: string | null;
  carrierStatementPhotoUrls?: string[] | null;
  carrierRespondedAt?: Date | null;
  resolutionOutcome?: string | null;
  resolutionRefundCents?: number | null;
  resolutionCarrierPayoutCents?: number | null;
  resolutionReason?: string | null;
  resolvedAt?: Date | null;
};

/* ── C-PR7a (D60 2A) — filtre PUR de la file « à arbitrer » (sur les items déjà calculés) ── */
export function filterQueueItems(items: ArbitrationQueueItem[], q: ArbitrationQueueQuery, now: Date): ArbitrationQueueItem[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return items.filter((it) => {
    if (q.kind && it.kind !== q.kind) return false;
    if (q.originCity && !norm(it.originCity).includes(norm(q.originCity))) return false;
    if (q.destinationCity && !norm(it.destinationCity).includes(norm(q.destinationCity))) return false;
    if (q.olderThanDays != null && new Date(it.openedAt).getTime() > now.getTime() - q.olderThanDays * 86_400_000) return false;
    if (q.decidable === "1" && new Date(it.decidableAt).getTime() > now.getTime()) return false;
    if (q.decidable === "0" && new Date(it.decidableAt).getTime() <= now.getTime()) return false;
    return true;
  });
}
/** Export opérationnel : identifiants des parties, jamais un nom, un email ni un téléphone (D60 2A). */
export const ARBITRATION_CSV_COLUMNS = ["bookingId", "kind", "ticketNumber", "category", "openedAt", "originCity", "destinationCity", "amountCents", "currencyCode", "shipperId", "carrierId", "carrierResponded", "decidableAt"] as const;

function responseDeadline(disputedAt: Date, delayHours: number = DISPUTE_RESPONSE_DELAY_HOURS): Date {
  return new Date(disputedAt.getTime() + delayHours * 3_600_000);
}

export type AdminPartyRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  shipperRatingsAvg: number;
  shipperRatingsCount: number;
  shipperCompletedDealsCount: number;
  shipperLateCancellationsCount: number;
  shipperDisputesLostCount?: number | null;
  carrierPage: { ratingsAvg: number; ratingsCount: number; completedDealsCount: number; lateCancellationsCount: number; disputesLostCount?: number | null } | null;
};

export function arbitrationKindOf(b: Pick<AdminBookingRecord, "status" | "retentionDisposition">): "DISPUTE" | "RETENTION" | null {
  if (b.status === "DISPUTED") return "DISPUTE";
  if (b.status === "CANCELLED" && b.retentionDisposition === "HELD_FOR_MEDIATION") return "RETENTION";
  return null;
}

/** Pur : une ligne de la file. */
export function toQueueItem(
  b: AdminBookingRecord,
  dispute: Pick<AdminDisputeRecord, "ticketNumber" | "category" | "carrierRespondedAt"> | null,
  names: { shipperFirstName: string; carrierFirstName: string },
  delayHours: number = DISPUTE_RESPONSE_DELAY_HOURS
): ArbitrationQueueItem | null {
  const kind = arbitrationKindOf(b);
  if (!kind) return null;
  const responded = kind === "DISPUTE" && !!dispute?.carrierRespondedAt;
  const decidableAt =
    kind === "RETENTION" || responded || !b.disputedAt ? (b.closedAt ?? b.disputedAt ?? b.requestedAt) : responseDeadline(b.disputedAt, delayHours);
  return {
    carrierResponded: responded,
    decidableAt: decidableAt.toISOString(),
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
    disputesLostCount: (asCarrier ? u.carrierPage!.disputesLostCount : u.shipperDisputesLostCount) ?? 0,
    ratingsAvg: asCarrier ? u.carrierPage!.ratingsAvg : u.shipperRatingsAvg,
    ratingsCount: asCarrier ? u.carrierPage!.ratingsCount : u.shipperRatingsCount,
  };
}

/** Pur : le dossier complet — JAMAIS le code de livraison (D43). */
export function toDisputeFile(
  b: AdminBookingRecord,
  dispute: AdminDisputeRecord | null,
  shipper: AdminPartyRecord,
  carrier: AdminPartyRecord,
  now: Date = new Date(),
  delayHours: number = DISPUTE_RESPONSE_DELAY_HOURS
): AdminDisputeFile | null {
  const kind = arbitrationKindOf(b);
  if (!kind) return null;
  const resolution =
    dispute?.resolvedAt && dispute.resolutionOutcome
      ? {
          outcome: dispute.resolutionOutcome as NonNullable<NonNullable<AdminDisputeFile["dispute"]>["resolution"]>["outcome"],
          refundCents: dispute.resolutionRefundCents ?? 0,
          carrierPayoutCents: dispute.resolutionCarrierPayoutCents ?? 0,
          reason: dispute.resolutionReason ?? "",
          resolvedAt: dispute.resolvedAt.toISOString(),
        }
      : null;
  const retentionDecision =
    b.retentionDecidedAt && (b.retentionDisposition === "CARRIER" || b.retentionDisposition === "SHIPPER")
      ? { outcome: (b.retentionDisposition === "CARRIER" ? "COMPENSATE_CARRIER" : "RESTITUTE_SHIPPER") as "COMPENSATE_CARRIER" | "RESTITUTE_SHIPPER", reason: b.retentionDecisionReason ?? "", decidedAt: b.retentionDecidedAt.toISOString() }
      : null;
  const decidableAt =
    kind === "DISPUTE" && b.disputedAt ? (dispute?.carrierRespondedAt ? b.disputedAt : responseDeadline(b.disputedAt, delayHours)) : null;
  const canDecide =
    kind === "RETENTION"
      ? b.retentionDisposition === "HELD_FOR_MEDIATION"
      : !resolution && !!b.disputedAt && (!!dispute?.carrierRespondedAt || now.getTime() >= responseDeadline(b.disputedAt, delayHours).getTime());
  const retentionCents = b.retentionCents ?? 0;
  return {
    retentionDecision,
    canDecide,
    decidableAt: decidableAt ? decidableAt.toISOString() : null,
    proposedAmounts: {
      rejectedCarrierPayoutCents: b.pricing.transportCents,
      fullRefundCents: b.pricing.totalShipperCents,
      compensateCarrierCents:
        kind === "RETENTION" && retentionCents > 0
          ? computeLateCancellationCompensationCents({ retentionCents, transportCents: b.pricing.transportCents, totalShipperCents: b.pricing.totalShipperCents })
          : null,
      restituteShipperCents: kind === "RETENTION" && retentionCents > 0 ? retentionCents : null,
    },
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
            carrierStatement:
              dispute.carrierRespondedAt && dispute.carrierStatement
                ? { statement: dispute.carrierStatement, photoUrls: dispute.carrierStatementPhotoUrls ?? [], respondedAt: dispute.carrierRespondedAt.toISOString() }
                : null,
            responseDeadlineAt: responseDeadline(b.disputedAt ?? b.requestedAt, delayHours).toISOString(),
            resolution,
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
  shipperDisputesLostCount: true,
  carrierPage: { select: { ratingsAvg: true, ratingsCount: true, completedDealsCount: true, lateCancellationsCount: true, disputesLostCount: true } },
} as const;

export function makeAdminDisputeService(settings: SettingsReader = platformSettings()) {
  return {
    /** C-PR7a — lignes d'export (ids des parties) : mêmes filtres que la file. */
    async exportRows(q: ArbitrationQueueQuery, now = new Date()): Promise<Array<Record<(typeof ARBITRATION_CSV_COLUMNS)[number], unknown>>> {
      const { items } = await this.listQueue(q, now);
      const ids = items.map((i) => i.bookingId);
      const parties = ids.length ? await prisma.booking.findMany({ where: { id: { in: ids } }, select: { id: true, shipperId: true, carrierId: true } }) : [];
      const byId = new Map(parties.map((p) => [p.id, p]));
      return items.map((i) => ({
        bookingId: i.bookingId, kind: i.kind, ticketNumber: i.ticketNumber, category: i.category, openedAt: i.openedAt, originCity: i.originCity, destinationCity: i.destinationCity,
        amountCents: i.amountCents, currencyCode: i.currencyCode, shipperId: byId.get(i.bookingId)?.shipperId ?? "", carrierId: byId.get(i.bookingId)?.carrierId ?? "", carrierResponded: i.carrierResponded, decidableAt: i.decidableAt,
      }));
    },

    async listQueue(q: ArbitrationQueueQuery = {}, now = new Date()): Promise<ArbitrationQueueResponse> {
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
        prisma.dispute.findMany({ where: { bookingId: { in: ids } }, select: { bookingId: true, ticketNumber: true, category: true, carrierRespondedAt: true } }),
        prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true } }),
      ]);
      const disputeBy = new Map(disputes.map((d) => [d.bookingId, d]));
      const nameBy = new Map(users.map((u) => [u.id, u.firstName]));

      const delayHours = (await settings.get())["dispute.responseDelayHours"]; // D62
      const items = bookings
        .map((b) =>
          toQueueItem(b, disputeBy.get(b.id) ?? null, {
            shipperFirstName: nameBy.get(b.shipperId) ?? "—",
            carrierFirstName: nameBy.get(b.carrierId) ?? "—",
          }, delayHours)
        )
        .filter((x): x is ArbitrationQueueItem => x !== null)
        // Les plus anciens d'abord : un dossier qui attend est prioritaire.
        .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
      const filtered = filterQueueItems(items, q, now); // C-PR7a — les compteurs restent ceux de la file entière
      return {
        items: filtered,
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
      const file = toDisputeFile(booking, dispute as unknown as AdminDisputeRecord | null, shipper as AdminPartyRecord, carrier as AdminPartyRecord, new Date(), (await settings.get())["dispute.responseDelayHours"]);
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

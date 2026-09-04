/**
 * admin-trips.rules.ts — règles PURES trajets / billets côté admin (C-PR4, D57)
 * ============================================================================
 */
import type { AdminTripsQuery, TicketQueueQuery, TicketRejectionReason } from "@packages/api-contracts";

/** Filtre Prisma « pas masqué par Yamba » — matche aussi les trajets SANS le champ (pitfall Mongo). */
export function notHiddenFilter(): { OR: Array<{ hiddenByAdminAt: null } | { hiddenByAdminAt: { isSet: false } }> } {
  return { OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }] };
}

export type TicketReviewOutcome = {
  documentStatus: "VERIFIED" | "REJECTED";
  tripTicketStatus: "VERIFIED" | "REJECTED";
  rejectionReason: TicketRejectionReason | null;
};

/** Décision → statuts du document ET du trajet (une seule source). */
export function ticketReviewOutcome(decision: "VERIFY" | "REJECT", reason?: TicketRejectionReason | null): TicketReviewOutcome {
  if (decision === "VERIFY") return { documentStatus: "VERIFIED", tripTicketStatus: "VERIFIED", rejectionReason: null };
  if (!reason) throw new Error("A rejection needs a reason.");
  return { documentStatus: "REJECTED", tripTicketStatus: "REJECTED", rejectionReason: reason };
}

/** Un billet en attente sur un trajet déjà parti n'a plus rien à prouver (8A). */
export function isTicketExpired(trip: { departureAt: Date | null }, now: Date): boolean {
  return !!trip.departureAt && trip.departureAt.getTime() < now.getTime();
}

export const TICKET_REJECTION_LABELS: Record<"fr" | "en", Record<TicketRejectionReason, string>> = {
  fr: {
    ILLEGIBLE: "document illisible",
    DATES_MISMATCH: "les dates ne correspondent pas au trajet",
    NAME_MISMATCH: "le nom ne correspond pas au compte",
    SUSPICIOUS: "document non recevable",
  },
  en: {
    ILLEGIBLE: "unreadable document",
    DATES_MISMATCH: "dates do not match the trip",
    NAME_MISMATCH: "name does not match the account",
    SUSPICIOUS: "document not acceptable",
  },
};

/* ══ C-PR7a (D60 2A) — filtres serveur des trajets et des billets, purs ═══ */

export function buildTripsWhere(q: AdminTripsQuery): Record<string, unknown> {
  const where: Record<string, unknown> = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.hidden === "1") where.hiddenByAdminAt = { not: null };
  if (q.hidden === "0") where.OR = notHiddenFilter().OR;
  if (q.ticketPending === "1") where.ticketVerificationStatus = "PENDING";
  if (q.hideProposed === "1") { where.hideProposedAt = { not: null }; if (!where.OR) where.OR = notHiddenFilter().OR; }
  if (q.carrierId) where.userId = q.carrierId;
  if (q.from || q.to) where.departureAt = { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lt: new Date(q.to) } : {}) };
  if (q.originCity) where.originCity = { contains: q.originCity, mode: "insensitive" };
  if (q.destinationCity) where.destinationCity = { contains: q.destinationCity, mode: "insensitive" };
  const term = (q.q ?? "").trim();
  if (term) {
    if (/^[a-f0-9]{24}$/i.test(term)) where.id = term;
    else {
      const or = [{ originCity: { contains: term, mode: "insensitive" } }, { destinationCity: { contains: term, mode: "insensitive" } }];
      if (where.OR) { where.AND = [{ OR: where.OR }, { OR: or }]; delete where.OR; } else where.OR = or;
    }
  }
  return where;
}
export function buildTripsOrderBy(q: AdminTripsQuery): Array<Record<string, "asc" | "desc">> {
  return [{ [q.sort]: q.dir }, { id: q.dir }];
}
export function buildTicketsWhere(q: TicketQueueQuery, now: Date): Record<string, unknown> {
  const where: Record<string, unknown> = { type: "TICKET_PROOF", status: "PENDING" };
  const created: Record<string, Date> = {};
  if (q.submittedFrom) created.gte = new Date(q.submittedFrom);
  if (q.submittedTo) created.lt = new Date(q.submittedTo);
  if (q.olderThanDays != null) created.lt = new Date(Math.min(created.lt?.getTime() ?? Infinity, now.getTime() - q.olderThanDays * 86_400_000));
  if (Object.keys(created).length) where.createdAt = created;
  const trip: Record<string, unknown> = {};
  if (q.originCity) trip.originCity = { contains: q.originCity, mode: "insensitive" };
  if (q.destinationCity) trip.destinationCity = { contains: q.destinationCity, mode: "insensitive" };
  if (Object.keys(trip).length) where.trip = { is: trip };
  return where;
}
/** Exports opérationnels : identifiants seulement, jamais un email ni un téléphone (D60 2A). */
export const TRIPS_CSV_COLUMNS = ["id", "status", "originCity", "originCountryCode", "destinationCity", "destinationCountryCode", "departureAt", "publishedAt", "cancelledAt", "carrierId", "transportMode", "capacityKg", "reservedKg", "pricePerKgCents", "ticketVerificationStatus", "hiddenByAdminAt", "createdAt"] as const;
export const TICKETS_CSV_COLUMNS = ["documentId", "tripId", "originCity", "destinationCity", "departureAt", "carrierId", "originalName", "mimeType", "status", "submittedAt"] as const;

/**
 * admin-trips.rules.ts — règles PURES trajets / billets côté admin (C-PR4, D57)
 * ============================================================================
 */
import type { AdminTripsQuery, TicketQueueQuery, TicketRejectionReason } from "@packages/api-contracts";
import { containsText } from "@packages/libs/prisma/text-search";

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

/**
 * ANO-ADM-16 (recette § 5.7) — « billet à vérifier » ne vaut que pour un trajet PAS ENCORE PARTI : la file des billets
 * expire les pièces des trajets partis (8A, `isTicketExpired`) sans toucher au statut du trajet, qui restait `PENDING`.
 * Mesuré : `ticketPending=1` rendait 6 trajets, dont 5 partis depuis des mois aux pièces toutes `EXPIRED`.
 */
export function effectiveTicketStatus(trip: { ticketVerificationStatus: string; departureAt: Date | null }, now: Date): string {
  return trip.ticketVerificationStatus === "PENDING" && isTicketExpired(trip, now) ? "EXPIRED" : trip.ticketVerificationStatus;
}

export function buildTripsWhere(q: AdminTripsQuery, now: Date = new Date()): Record<string, unknown> {
  const where: Record<string, unknown> = { isDeleted: false };
  if (q.status) where.status = q.status;
  if (q.hidden === "1") where.hiddenByAdminAt = { not: null };
  if (q.hidden === "0") where.OR = notHiddenFilter().OR;
  if (q.hideProposed === "1") { where.hideProposedAt = { not: null }; if (!where.OR) where.OR = notHiddenFilter().OR; }
  if (q.carrierId) where.userId = q.carrierId;
  const departure: Record<string, Date> = {};
  if (q.from) departure.gte = new Date(q.from);
  if (q.to) departure.lt = new Date(q.to);
  if (q.ticketPending === "1") {
    where.ticketVerificationStatus = "PENDING";
    // ANO-ADM-16 — le trajet n'est pas parti : la borne la plus haute des deux gagne.
    departure.gte = new Date(Math.max(departure.gte?.getTime() ?? 0, now.getTime()));
  }
  if (Object.keys(departure).length) where.departureAt = departure;
  if (q.originCity) where.originCity = containsText(q.originCity);
  if (q.destinationCity) where.destinationCity = containsText(q.destinationCity);
  const term = (q.q ?? "").trim();
  if (term) {
    if (/^[a-f0-9]{24}$/i.test(term)) where.id = term;
    else {
      // ANO-ADM-15 — le terme est cherché à la lettre (`containsText` échappe la regex que Prisma construit).
      const or = [{ originCity: containsText(term) }, { destinationCity: containsText(term) }];
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
  if (q.originCity) trip.originCity = containsText(q.originCity);
  if (q.destinationCity) trip.destinationCity = containsText(q.destinationCity);
  if (Object.keys(trip).length) where.trip = { is: trip };
  return where;
}
/** Exports opérationnels : identifiants seulement, jamais un email ni un téléphone (D60 2A). */
export const TRIPS_CSV_COLUMNS = ["id", "status", "originCity", "originCountryCode", "destinationCity", "destinationCountryCode", "departureAt", "publishedAt", "cancelledAt", "carrierId", "transportMode", "capacityKg", "reservedKg", "pricePerKgCents", "ticketVerificationStatus", "hiddenByAdminAt", "createdAt"] as const;
/** ANO-ADM-12 (A156) — `originalName` est un texte libre du membre (un nom de facture porte son numéro) : jamais exporté. */
export const TICKETS_CSV_COLUMNS = ["documentId", "tripId", "originCity", "destinationCity", "departureAt", "carrierId", "fileExtension", "mimeType", "status", "submittedAt"] as const;

/** L'extension d'un nom de fichier, en minuscules, 1 à 5 caractères alphanumériques — sinon vide. Rien d'autre du nom ne sort. */
export function fileExtensionOf(name: string | null | undefined): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec((name ?? "").trim());
  return m ? m[1].toLowerCase() : "";
}

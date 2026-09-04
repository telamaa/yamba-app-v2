/**
 * admin-trips.rules.ts — règles PURES trajets / billets côté admin (C-PR4, D57)
 * ============================================================================
 */
import type { TicketRejectionReason } from "@packages/api-contracts";

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

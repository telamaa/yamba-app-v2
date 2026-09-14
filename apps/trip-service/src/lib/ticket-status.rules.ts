/**
 * ticket-status.rules.ts — le statut « billet » d'un trajet, SYNTHÈSE de ses billets (recette 02-ADMIN § 5.8)
 * =========================================================================================================
 * Le badge public « Billet vérifié » lit `Trip.ticketVerificationStatus`. Ce champ était ÉCRIT par chaque geste, sans
 * regarder les autres billets du trajet :
 *  - ANO-ADM-19 — un second billet rejeté passait le trajet en REJECTED alors que le premier restait vérifié ; supprimer
 *    le billet vérifié laissait le badge tant qu'un autre billet existait ;
 *  - ANO-ADM-21 (A158) — la vérification atteste des FAITS (date, villes) : les changer laissait le badge.
 * Désormais le statut se DÉDUIT des documents, et un changement des faits vérifiés rouvre la vérification.
 */

export type TripTicketStatus = "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "REJECTED";

/**
 * Un billet vérifié suffit au badge ; sinon un billet en attente (ou expiré, dont le trajet est parti) fait « en
 * attente » ; sinon un rejet fait « rejeté » ; sans billet, « non soumis ». Les autres types de documents ne comptent pas.
 */
export function tripTicketStatusFromDocuments(documents: ReadonlyArray<{ type: string; status: string }>): TripTicketStatus {
  const billets = documents.filter((d) => d.type === "TICKET_PROOF");
  if (billets.some((d) => d.status === "VERIFIED")) return "VERIFIED";
  if (billets.some((d) => d.status === "PENDING" || d.status === "EXPIRED")) return "PENDING";
  if (billets.some((d) => d.status === "REJECTED")) return "REJECTED";
  return "NOT_SUBMITTED";
}

/** Ce qu'un administrateur compare en validant un billet (sous-titre de `/tickets`) — le nom se lit sur le compte. */
export const TICKET_FACT_FIELDS = ["departureAt", "originCity", "destinationCity"] as const;
export type TicketFactField = (typeof TICKET_FACT_FIELDS)[number];

const ville = (v: unknown) => (typeof v === "string" ? v.trim().toLocaleLowerCase("fr") : v == null ? null : String(v));
const instant = (v: unknown) => (v == null ? null : new Date(v as string | Date).getTime());

/**
 * Les faits vérifiés que la modification CHANGE réellement (champ absent du patch = inchangé ; casse et espaces des
 * villes ignorés ; même instant = inchangé).
 */
export function changedTicketFacts(
  before: { departureAt: Date | null; originCity: string | null; destinationCity: string | null },
  patch: Record<string, unknown>
): TicketFactField[] {
  const out: TicketFactField[] = [];
  if ("departureAt" in patch && patch.departureAt !== undefined && instant(patch.departureAt) !== instant(before.departureAt)) out.push("departureAt");
  for (const k of ["originCity", "destinationCity"] as const) {
    if (k in patch && patch[k] !== undefined && ville(patch[k]) !== ville(before[k])) out.push(k);
  }
  return out;
}

/** Un billet ne se décide que sur un trajet encore à venir et vivant : parti, annulé, terminé, archivé ou supprimé → non. */
export const REVIEWABLE_TRIP_STATUSES = ["DRAFT", "PUBLISHED", "PAUSED"] as const;
export function ticketNotReviewableReason(trip: { status: string; isDeleted: boolean; departureAt: Date | null }, now: Date): "TICKET_TRIP_DEPARTED" | "TICKET_TRIP_CLOSED" | null {
  if (trip.isDeleted || !(REVIEWABLE_TRIP_STATUSES as readonly string[]).includes(trip.status)) return "TICKET_TRIP_CLOSED";
  if (trip.departureAt && trip.departureAt.getTime() < now.getTime()) return "TICKET_TRIP_DEPARTED";
  return null;
}

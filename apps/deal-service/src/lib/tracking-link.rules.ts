/**
 * tracking-link.rules.ts — règles pures de la page destinataire (D69)
 * ====================================================================
 * - `canIssueTrackingLink` : un lien existe dès l'acceptation et tant que le deal n'est pas fini
 *   sans livraison (DECLINED / EXPIRED / CANCELLED) — avant l'acceptation il n'y a rien à suivre ;
 * - `isTrackingVisible` : un seul interrupteur, aligné sur l'effacement du tiers (D63 5A) ;
 * - `publicMilestones` : la progression lisible par le destinataire, calculée du statut et des jalons
 *   de transit (jamais l'adresse, le code, les photos).
 */
import type { TrackingMilestone } from "@packages/api-contracts";

export const TRACKING_ISSUABLE_STATUSES = ["ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED", "DISPUTED"] as const;

export function canIssueTrackingLink(status: string): boolean {
  return (TRACKING_ISSUABLE_STATUSES as readonly string[]).includes(status);
}

export function isTrackingVisible(input: { isDeleted: boolean; recipientRedactedAt: Date | null; revokedAt: Date | null }): boolean {
  return !input.isDeleted && !input.recipientRedactedAt && !input.revokedAt;
}

export type TrackingSource = {
  status: string;
  acceptedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  closedAt?: Date | null;
  cancelledAt?: Date | null;
  trackingEvents: { step: string; confirmedAt: Date }[];
};

/** Jalons atteints dans l'ordre ; le dernier est le jalon courant. */
export function publicMilestones(b: TrackingSource): { key: TrackingMilestone; at: Date }[] {
  const steps: { key: TrackingMilestone; at: Date }[] = [];
  if (b.acceptedAt) steps.push({ key: "ACCEPTED", at: b.acceptedAt });
  if (b.pickedUpAt) steps.push({ key: "PICKED_UP", at: b.pickedUpAt });
  const departed = b.trackingEvents.find((e) => e.step === "FLIGHT_DEPARTED");
  const arrived = b.trackingEvents.find((e) => e.step === "FLIGHT_ARRIVED");
  if (departed) steps.push({ key: "IN_TRANSIT", at: departed.confirmedAt });
  if (arrived) steps.push({ key: "ARRIVED", at: arrived.confirmedAt });
  if (b.deliveredAt) steps.push({ key: "DELIVERED", at: b.deliveredAt });
  if (["DECLINED", "EXPIRED", "CANCELLED"].includes(b.status)) {
    const at = b.cancelledAt ?? b.closedAt ?? b.acceptedAt ?? new Date(0);
    steps.push({ key: "CLOSED", at });
  }
  return steps;
}

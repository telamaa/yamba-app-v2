/**
 * refund-idempotency.ts — une clé d'idempotence par geste de remboursement (recette 02-ADMIN § 5.15, A165)
 * =======================================================================================================
 * D39 : l'argent part AVANT la base. Entre les deux, tout peut arriver — un double clic, un second onglet, un processus qui
 * meurt après `provider.refund` et avant la transaction. Sans clé, rejouer le geste émet un SECOND remboursement (mesuré en
 * recette : trois « Rembourser maintenant » simultanés → trois remboursements chez le fournisseur, un seul en base).
 *
 * La clé décrit le geste, pas l'instant : le deal, la nature du remboursement et ce qui le rend unique. Pour les gestes qui
 * n'arrivent qu'une fois par deal (annulation, refus au pickup, décision de litige, restitution de retenue), le montant
 * suffit. Le remboursement manuel peut se répéter sur un même deal : sa clé porte le CUMUL lu avant le geste — le même
 * geste rejoué sur le même état rend le même remboursement ; un nouveau geste, après écriture du premier, a une autre clé.
 * Le montant est dans chaque clé : Stripe refuse une clé réutilisée avec d'autres paramètres, et deux montants différents
 * sont deux gestes différents.
 */
export type RefundGesture = "manual" | "dispute" | "retention" | "pickup-refused" | "cancel" | "capture-rollback";

export function refundIdempotencyKey(gesture: RefundGesture, dealId: string, amountCents: number | "full", previousRefundedCents?: number): string {
  const parts = ["yamba", "refund", gesture, dealId];
  if (gesture === "manual") parts.push(`after-${previousRefundedCents ?? 0}`);
  parts.push(String(amountCents));
  return parts.join(":");
}

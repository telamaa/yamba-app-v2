/**
 * booking-refunds.ts — réexportation (A167, recette 02-ADMIN § 5.17)
 * ==================================================================
 * La règle vit dans `@packages/api-contracts` (booking/booking-refunds.ts) : le pilotage d'auth-service la lit aussi.
 */
export { refundEntries, refundedTotalCents, refundListExcessCents, withRefund, type BookingRefundEntry, type RefundHistorySource, type RefundKind } from "@packages/api-contracts";

/**
 * report.rules.ts — qui peut signaler quoi (D68, SIG-01…03)
 * ==========================================================
 * Règles pures, sans Prisma : le service charge la cible, la règle tranche.
 * - on ne signale pas sa propre cible (son trajet, soi-même) ;
 * - un motif doit appartenir à la liste de la cible ;
 * - un doublon OUVERT du même auteur sur la même cible est refusé ;
 * - à partir de `threshold` signalements ouverts, la revue est prioritaire (SIG-03 : jamais de sanction automatique).
 */
import { REPORT_REASONS_BY_TARGET, REPORT_REVIEW_THRESHOLD, type ReportReason, type ReportTargetType } from "@packages/api-contracts";

export type ReportVerdict = { allowed: true; reason: null } | { allowed: false; reason: "OWN_TARGET" | "REASON_NOT_ALLOWED" | "ALREADY_REPORTED" };

export function canReport(input: { reporterId: string; targetType: ReportTargetType; targetOwnerId: string; reason: ReportReason; alreadyOpen: boolean }): ReportVerdict {
  if (input.targetOwnerId === input.reporterId) return { allowed: false, reason: "OWN_TARGET" };
  if (!REPORT_REASONS_BY_TARGET[input.targetType].includes(input.reason)) return { allowed: false, reason: "REASON_NOT_ALLOWED" };
  if (input.alreadyOpen) return { allowed: false, reason: "ALREADY_REPORTED" };
  return { allowed: true, reason: null };
}

/** SIG-03 — la constante reste l'argument par défaut (classe C du catalogue D62 tant qu'un seul consommateur). */
export function needsPriorityReview(openCountOnTarget: number, threshold: number = REPORT_REVIEW_THRESHOLD): boolean {
  return openCountOnTarget >= threshold;
}

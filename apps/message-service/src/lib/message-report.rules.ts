/**
 * message-report.rules.ts — qui peut signaler quoi (F-PR3, D61 7A)
 * ==================================================================
 * On signale un message TEXTE de l'AUTRE partie, jamais le sien, jamais un message système
 * ou un rendez-vous (ce sont des objets, pas des propos). Le doublon est refusé : un même
 * lecteur ne signale pas deux fois le même message.
 */
export type ReportableMessage = { kind: string; authorRole: string };

export type ReportVerdict = { allowed: true; reason: null } | { allowed: false; reason: "OWN_MESSAGE" | "NOT_A_TEXT" | "ALREADY_REPORTED" };

export function canReportMessage(reporterRole: "SHIPPER" | "CARRIER", message: ReportableMessage, alreadyReported: boolean): ReportVerdict {
  if (message.kind !== "TEXT") return { allowed: false, reason: "NOT_A_TEXT" };
  if (message.authorRole === reporterRole) return { allowed: false, reason: "OWN_MESSAGE" };
  if (alreadyReported) return { allowed: false, reason: "ALREADY_REPORTED" };
  return { allowed: true, reason: null };
}

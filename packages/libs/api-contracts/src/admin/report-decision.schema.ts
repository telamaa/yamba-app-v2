/**
 * report-decision.schema.ts — qui a décidé un signalement, quand, avec quelle note (décision du 15/09/2026, recette § 5.19)
 * ======================================================================================================================
 * Sous les onglets « traité » et « sans suite » des deux files (trajets et membres : auth-service ; messages :
 * message-service), la carte montre la décision. La source est la ligne de journal écrite dans la MÊME transaction que la
 * décision (`REPORT_REVIEWED` / `MESSAGE_REPORT_REVIEWED`, `after.note`) : lecture seule, aucune seconde vérité à tenir à
 * jour. Un signalement ouvert, ou une décision antérieure au journal, n'a pas de décision lisible : `null`, jamais une
 * erreur. Pur, sans dépendance (partagé par deux services).
 */
import { z } from "zod";

export const ReportDecisionSchema = z
  .object({
    /** L'administrateur qui a décidé (prénom seul) ; null si son compte n'est plus lisible. */
    by: z.object({ id: z.string(), firstName: z.string() }).nullable(),
    at: z.string().datetime(),
    note: z.string().nullable(),
  })
  .meta({ id: "ReportDecision", description: "Decision taken on a report, read from the audit line written in the same transaction" });
export type ReportDecision = z.infer<typeof ReportDecisionSchema>;

export type ReportDecisionLine = { targetId: string | null; adminUserId: string; createdAt: Date; after: unknown };

/**
 * Projette les lignes de journal (une par signalement décidé ; la plus récente gagne si l'historique en compte plusieurs)
 * en décisions indexées par identifiant de signalement. `firstNameOf` résout le prénom de l'administrateur.
 */
export function reportDecisionsFrom(lines: readonly ReportDecisionLine[], firstNameOf: (adminId: string) => string | null | undefined): Map<string, ReportDecision> {
  const out = new Map<string, ReportDecision>();
  const sorted = [...lines].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const l of sorted) {
    if (!l.targetId) continue;
    const note = (l.after as { note?: unknown } | null)?.note;
    const firstName = firstNameOf(l.adminUserId);
    out.set(l.targetId, {
      by: firstName ? { id: l.adminUserId, firstName } : null,
      at: l.createdAt.toISOString(),
      note: typeof note === "string" && note.trim() ? note : null,
    });
  }
  return out;
}

/**
 * Versions actuelles des documents légaux Yamba.
 *
 * ⚠️ IMPORTANT : à chaque modification d'un document légal, bumper la version
 * correspondante. Format recommandé : YYYY-MM-DD (ISO 8601).
 *
 * Quand une version change :
 * - Les nouveaux utilisateurs accepteront la nouvelle version
 * - Les utilisateurs existants devront ré-accepter (à implémenter via modal)
 */
export const LEGAL_VERSIONS = {
  terms: "2026-04-26",
  privacy: "2026-04-26",
  cookies: "2026-04-26",
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_VERSIONS;

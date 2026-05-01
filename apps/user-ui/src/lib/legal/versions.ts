/**
 * Versions actuelles des documents légaux Yamba (mirror frontend).
 *
 * ⚠️ DOIT ÊTRE SYNCHRONISÉ avec packages/libs/legal/versions.ts
 * À chaque changement de version backend, mettre à jour ici aussi.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-04-26",
  privacy: "2026-04-26",
  cookies: "2026-04-26",
} as const;

export type LegalDocumentKey = keyof typeof LEGAL_VERSIONS;

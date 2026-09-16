/**
 * write-conflict-retry.ts — ré-export (recette 02-ADMIN § 5.5) : l'implémentation vit désormais dans
 * `packages/libs/prisma/write-conflict-retry.ts`, partagée avec auth-service. Voir l'en-tête de ce fichier (ANO-API-19).
 */
export { withWriteConflictRetry } from "@packages/libs/prisma/write-conflict-retry";

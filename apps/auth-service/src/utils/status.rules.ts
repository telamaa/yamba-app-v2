/**
 * status.rules.ts — règles pures de la page « État des services » (recette 02-ADMIN § 5.22)
 */
import type { AdminStatusResponse } from "@packages/api-contracts";

/**
 * A177 (recette 02-ADMIN § 5.22, ANO-ADM-61) — le webhook du fournisseur (D35) fait passer un email `SENT` à `DELIVERED`,
 * `BOUNCED` ou `COMPLAINED` : ne compter que `SENT` faisait retomber « envoyés » vers zéro à mesure que les remises
 * arrivaient, et un rebond ne se voyait nulle part. Envoyé = accepté par le fournisseur ; en échec = refusé avant lui.
 */
export function emailCounters(groups: Array<{ status: string; count: number }>): AdminStatusResponse["emails"] {
  const n = (...statuses: string[]) => groups.filter((g) => statuses.includes(g.status)).reduce((t, g) => t + g.count, 0);
  return { sentLast24h: n("SENT", "DELIVERED", "BOUNCED", "COMPLAINED"), deliveredLast24h: n("DELIVERED"), bouncedLast24h: n("BOUNCED", "COMPLAINED"), failedLast24h: n("FAILED") };
}


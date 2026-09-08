/**
 * write-conflict-retry.ts — un conflit d'écriture est un accident, pas une réponse (ANO-API-19)
 * ==============================================================================================
 * Recette API du 08/09/2026, fiche API-IDEM-07. Deux Expéditeurs réservent en même temps les
 * derniers kilos d'un trajet — situation **normale** d'une place de marché. La garde de
 * capacité fait son travail : une seule réservation est comptée, la capacité reste juste.
 * Mais le perdant recevait **500** « Something went wrong », parce que MongoDB avait rejeté
 * sa transaction :
 *
 *     Transaction failed due to a write conflict or a deadlock. Please retry your transaction
 *
 * C'est un **conflit d'infrastructure**, pas une décision métier — et la base dit elle-même
 * quoi en faire : réessayer. Au second essai, la capacité est à jour : soit la place existe
 * encore et la réservation passe, soit la règle métier répond proprement `CAPACITY_EXCEEDED`.
 * Dans les deux cas, l'Expéditeur reçoit une réponse qu'il peut comprendre.
 *
 * Le code Prisma **P2034** est le seul rattrapé : tout le reste remonte intact, car réessayer
 * une erreur qu'on ne comprend pas est le meilleur moyen de doubler un effet de bord.
 */

/** Prisma : « Transaction failed due to a write conflict or a deadlock ». */
const WRITE_CONFLICT = "P2034";

const estConflitEcriture = (e: unknown): boolean =>
  typeof e === "object" && e !== null && (e as { code?: string }).code === WRITE_CONFLICT;

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Exécute une transaction en la rejouant si — et seulement si — la base signale un conflit
 * d'écriture. Les délais sont courts et légèrement aléatoires : deux perdants simultanés ne
 * doivent pas se retrouver à nouveau au coude à coude au réessai.
 */
export async function withWriteConflictRetry<T>(
  operation: () => Promise<T>,
  { tentatives = 3, delaiBaseMs = 25 }: { tentatives?: number; delaiBaseMs?: number } = {}
): Promise<T> {
  let derniere: unknown;
  for (let essai = 0; essai < tentatives; essai++) {
    try {
      return await operation();
    } catch (e) {
      if (!estConflitEcriture(e)) throw e;
      derniere = e;
      if (essai < tentatives - 1) {
        await attendre(delaiBaseMs * (essai + 1) + Math.floor(Math.random() * delaiBaseMs));
      }
    }
  }
  // Épuisé : on laisse remonter le conflit d'origine plutôt qu'une erreur inventée.
  throw derniere;
}

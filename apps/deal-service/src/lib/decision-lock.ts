/**
 * decision-lock.ts — un seul geste d'argent à la fois sur un même deal (ANO-ADM-22, A159)
 * ======================================================================================
 * La médiation suit D39 : « l'argent d'abord » — le remboursement part chez le fournisseur AVANT la transaction qui
 * enregistre la décision. Le verrou optimiste de la transaction protège la BASE, pas l'ARGENT : deux administrateurs qui
 * valident au même instant passaient tous deux les vérifications, émettaient chacun leur remboursement, et seul le second
 * `updateMany` échouait — deux remboursements chez le fournisseur, un seul en base (mesuré en recette, ADM-MED-7).
 *
 * Le verrou est posé AVANT toute lecture : celui qui l'obtient relit le deal et voit l'état à jour ; l'autre est refusé
 * tout de suite (409 `DECISION_IN_PROGRESS`), sans rien émettre. Redis `SET NX PX` avec un jeton, libéré par un
 * compare-and-delete (on ne libère jamais le verrou d'un autre si le nôtre a expiré). Le TTL borne une panne : un
 * processus qui meurt en plein geste ne bloque le dossier que quelques dizaines de secondes.
 */
import { randomUUID } from "node:crypto";
import { BookingLifecycleError } from "../services/booking-lifecycle";

/** Le sous-ensemble Redis utilisé — un Map suffit en test. */
export type DecisionLockStore = {
  set(key: string, value: string, mode: "PX", ttlMs: number, flag: "NX"): Promise<unknown>;
  eval(script: string, numKeys: number, key: string, token: string): Promise<unknown>;
};

export const DECISION_LOCK_TTL_MS = 60_000;
export const decisionLockKey = (dealId: string) => `yamba:deal:decision:${dealId}`;

const RELEASE = 'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

export async function withDecisionLock<T>(store: DecisionLockStore, dealId: string, fn: () => Promise<T>, ttlMs: number = DECISION_LOCK_TTL_MS): Promise<T> {
  const key = decisionLockKey(dealId);
  const token = randomUUID();
  const acquired = await store.set(key, token, "PX", ttlMs, "NX");
  if (acquired !== "OK") {
    throw new BookingLifecycleError("DECISION_IN_PROGRESS", "Another decision is being recorded on this deal: reload it in a few seconds.");
  }
  try {
    return await fn();
  } finally {
    await store.eval(RELEASE, 1, key, token).catch(() => undefined);
  }
}

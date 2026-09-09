/**
 * broker-errors.ts — « est-ce le courtier qui est injoignable ? » (ANO-CRON-06)
 * =============================================================================
 * Volontairement SANS aucun import : ce module ne parle que de **formes d'erreur**, pas de
 * transport. Il est donc importable partout — y compris depuis un test qui remplace le reste de
 * `@packages/messaging` (et donc kafkajs) par un faux.
 *
 * Recette n° 4, CRON-RELAIS-7. Le relais des réservations excluait DEUX noms
 * (`KafkaJSNumberOfRetriesExceeded`, `KafkaJSConnectionError`) ; courtier arrêté, kafkajs lève en
 * réalité **`KafkaJSNonRetriableError: Connection error`** — un troisième nom, non exclu. Le relais
 * de la messagerie, lui, ne classait rien : mesuré, sur un événement parfaitement sain,
 * **2 → 5 → 7 → 10 tentatives en 100 secondes**, puis parqué.
 *
 * Énumérer les noms est une course perdue : kafkajs en ajoute à chaque version, et il enveloppe
 * volontiers une panne de connexion dans un nom générique. On classe donc par **cause**, en
 * suivant la chaîne `cause` / `originalError`.
 *
 * `KafkaJSNonRetriableError` n'est **pas** exclu en bloc : il enveloppe aussi de vrais poisons
 * (message plus gros que `max.message.bytes`). Il ne l'est que si son message ou sa cause parle
 * de connexion — sinon il reste un poison, ce qui est le comportement voulu.
 */

const NOMS_PANNE = new Set([
  "KafkaJSNumberOfRetriesExceeded",
  "KafkaJSConnectionError",
  "KafkaJSBrokerNotFound",
  "KafkaJSRequestTimeoutError",
]);

const SIGNATURE_PANNE =
  /connection error|connection refused|connection timeout|econnrefused|enotfound|eai_again|not connected|broker not found|no broker|coordinator is not available|request timed? out/i;

/** Vrai si l'erreur dit « le courtier est injoignable » — donc transitoire, jamais un poison. */
export function isBrokerUnavailable(err: unknown): boolean {
  let courant: unknown = err;
  const vus = new Set<unknown>();
  for (let profondeur = 0; courant && profondeur < 5; profondeur++) {
    if (typeof courant !== "object" || vus.has(courant)) break;
    vus.add(courant);
    const e = courant as { name?: string; message?: string; cause?: unknown; originalError?: unknown };
    if (e.name && NOMS_PANNE.has(e.name)) return true;
    if (typeof e.message === "string" && SIGNATURE_PANNE.test(e.message)) return true;
    courant = e.cause ?? e.originalError;
  }
  return false;
}

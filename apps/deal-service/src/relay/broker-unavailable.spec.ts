import { isBrokerUnavailable } from "../../../../packages/libs/messaging/src/broker-errors";

/**
 * ANO-CRON-06 (recette n° 4, CRON-RELAIS-7) — « une panne de courtier n'incrémente jamais
 * `attempts` » est une garantie écrite du cahier. Elle ne tenait pas.
 *
 * Le relais des réservations excluait DEUX noms d'erreur. Courtier arrêté, kafkajs lève en réalité
 * `KafkaJSNonRetriableError: Connection error` — un troisième nom. Le relais de la messagerie, lui,
 * ne classait rien : mesuré, 2 → 5 → 7 → **10 tentatives en 100 secondes**, et un événement
 * parfaitement sain était parqué.
 *
 * La leçon est dans la forme du correctif : **énumérer les noms est une course perdue**, kafkajs en
 * ajoute à chaque version. On classe par CAUSE, en suivant la chaîne `cause` / `originalError`.
 * Et `KafkaJSNonRetriableError` n'est PAS exclu en bloc — il enveloppe aussi de vrais poisons —
 * seulement quand sa cause parle de connexion.
 */
describe("isBrokerUnavailable — un courtier injoignable n'est jamais un poison", () => {
  it("reconnaît les noms historiques déjà exclus", () => {
    expect(isBrokerUnavailable({ name: "KafkaJSNumberOfRetriesExceeded", message: "x" })).toBe(true);
    expect(isBrokerUnavailable({ name: "KafkaJSConnectionError", message: "x" })).toBe(true);
  });

  it("reconnaît la forme RÉELLEMENT observée en recette, courtier éteint", () => {
    // Relevé tel quel dans `lastError` : c'est ce cas précis qui parquait des événements sains.
    expect(isBrokerUnavailable({ name: "KafkaJSNonRetriableError", message: "Connection error: " })).toBe(true);
    expect(isBrokerUnavailable(new Error("Connection error: connect ECONNREFUSED 127.0.0.1:9092"))).toBe(true);
  });

  it("suit la chaîne des causes, pas seulement le message de surface", () => {
    expect(isBrokerUnavailable({ name: "KafkaJSNonRetriableError", message: "publish failed", cause: { name: "KafkaJSConnectionError" } })).toBe(true);
    expect(isBrokerUnavailable({ name: "Wrapper", message: "nope", originalError: { message: "connect ENOTFOUND redpanda" } })).toBe(true);
  });

  it("ne prend PAS un vrai poison pour une panne — sinon il serait rejoué sans fin", () => {
    expect(isBrokerUnavailable({ name: "KafkaJSNonRetriableError", message: "The message is 3145728 bytes, larger than max.message.bytes" })).toBe(false);
    expect(isBrokerUnavailable({ name: "KafkaJSProtocolError", message: "Invalid topic" })).toBe(false);
    expect(isBrokerUnavailable(new Error("ZodError: invalid payload"))).toBe(false);
  });

  it("ne boucle pas sur une chaîne de causes circulaire", () => {
    const a: Record<string, unknown> = { name: "A", message: "x" };
    a.cause = a;
    expect(isBrokerUnavailable(a)).toBe(false);
  });

  it("tolère n'importe quelle entrée", () => {
    expect(isBrokerUnavailable(null)).toBe(false);
    expect(isBrokerUnavailable("Connection error")).toBe(false);
    expect(isBrokerUnavailable(42)).toBe(false);
  });
});

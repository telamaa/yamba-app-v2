/** retention.spec.ts — D64 6A : notifications, traces d'emails, événements consommés, outbox publié — jamais un événement parqué. */
import { cutoffFor, isConsumedEventPurgeable, isEmailDeliveryPurgeable, isNotificationPurgeable, isOutboxEventPurgeable } from "@packages/libs/retention";

const now = new Date("2026-09-05T04:00:00.000Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("règles de conservation (D64 6A)", () => {
  it("notification : 366 j → purgée, 364 j → gardée (365 par défaut)", () => {
    expect(isNotificationPurgeable({ createdAt: days(366) }, now, 365)).toBe(true);
    expect(isNotificationPurgeable({ createdAt: days(364) }, now, 365)).toBe(false);
  });
  it("trace d'email et registre consommé : par claimedAt", () => {
    expect(isEmailDeliveryPurgeable({ claimedAt: days(400) }, now, 365)).toBe(true);
    expect(isConsumedEventPurgeable({ claimedAt: days(91) }, now, 90)).toBe(true);
    expect(isConsumedEventPurgeable({ claimedAt: days(89) }, now, 90)).toBe(false);
  });
  it("outbox : publié depuis 91 j → purgé ; parqué (jamais publié) → jamais, même très ancien", () => {
    expect(isOutboxEventPurgeable({ publishedAt: days(91), occurredAt: days(92) }, now, 90)).toBe(true);
    expect(isOutboxEventPurgeable({ publishedAt: days(10), occurredAt: days(400) }, now, 90)).toBe(false);
    expect(isOutboxEventPurgeable({ publishedAt: null, occurredAt: days(400) }, now, 90)).toBe(false);
  });
  it("le paramètre change le résultat : 30 j purge ce que 365 j gardait", () => {
    expect(isNotificationPurgeable({ createdAt: days(40) }, now, 365)).toBe(false);
    expect(isNotificationPurgeable({ createdAt: days(40) }, now, 30)).toBe(true);
    expect(cutoffFor(now, 30)).toEqual(days(30));
  });
});

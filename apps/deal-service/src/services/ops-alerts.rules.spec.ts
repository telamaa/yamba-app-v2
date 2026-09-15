import { ALERT_THRESHOLDS, alertSentKey, countUndecidedDisputes, evaluateAlerts, type OpsSnapshot } from "./ops-alerts.rules";
import { isOutboxLagging, outboxLagMinutes } from "@packages/api-contracts";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const calm = (): OpsSnapshot => ({ failedPayoutsOverThreshold: 0, undecidedDisputesOverThreshold: 0, heldRetentionsOverThreshold: 0, openReversalsOverThreshold: 0, parkedOutbox: 0, oldestUnpublishedAt: null, failedEmailsInWindow: 0, lastTripPublishedAt: new Date("2026-09-03T10:00:00Z"), requestsInWindow: 10, acceptedInWindow: 8 });

describe("ops-alerts.rules (C-PR6b, D59 3A)", () => {
  it("plateforme calme → aucune alerte", () => {
    expect(evaluateAlerts(calm(), NOW)).toEqual([]);
  });
  it("chaque compteur au-dessus de son seuil produit une alerte typée, avec un lien où agir", () => {
    const a = evaluateAlerts({ ...calm(), failedPayoutsOverThreshold: 2, undecidedDisputesOverThreshold: 1, heldRetentionsOverThreshold: 3, openReversalsOverThreshold: 1, parkedOutbox: 4, failedEmailsInWindow: 5 }, NOW);
    expect(a.map((x) => x.rule)).toEqual(["PAYOUT_FAILED_48H", "DISPUTE_UNDECIDED_72H", "RETENTION_HELD_7D", "REVERSAL_OPEN_48H", "OUTBOX_PARKED", "EMAILS_FAILED_24H"]);
    expect(a[0]).toMatchObject({ severity: "critical", count: 2, href: "/finances?kind=FAILED" });
    expect(a[4].detail).toContain(String(ALERT_THRESHOLDS.outboxParkedAttempts));
  });
  it("relais en retard : plus ancien non publié > 15 min ; à 10 min, rien", () => {
    expect(evaluateAlerts({ ...calm(), oldestUnpublishedAt: new Date(NOW.getTime() - 20 * 60_000) }, NOW).map((x) => x.rule)).toEqual(["OUTBOX_LAGGING_15MIN"]);
    expect(evaluateAlerts({ ...calm(), oldestUnpublishedAt: new Date(NOW.getTime() - 10 * 60_000) }, NOW)).toEqual([]);
  });
  it("liquidité : aucun trajet depuis 7 j (ou jamais) ; taux d'acceptation < 30 % avec au moins 5 demandes", () => {
    expect(evaluateAlerts({ ...calm(), lastTripPublishedAt: new Date("2026-08-20T00:00:00Z") }, NOW).map((x) => x.rule)).toEqual(["NO_TRIP_PUBLISHED_7D"]);
    expect(evaluateAlerts({ ...calm(), lastTripPublishedAt: null }, NOW)[0].detail).toContain("jamais");
    expect(evaluateAlerts({ ...calm(), requestsInWindow: 10, acceptedInWindow: 2 }, NOW).map((x) => x.rule)).toEqual(["ACCEPTANCE_RATE_LOW_7D"]);
    expect(evaluateAlerts({ ...calm(), requestsInWindow: 4, acceptedInWindow: 0 }, NOW)).toEqual([]); // trop peu de demandes pour juger
  });
  it("alertSentKey : une clé par règle et par jour UTC", () => {
    expect(alertSentKey("OUTBOX_PARKED", NOW)).toBe("yamba:alerts:sent:OUTBOX_PARKED:2026-09-04");
  });
});

describe("countUndecidedDisputes (ANO-ADM-24) — la décidabilité de l'écran de médiation, pas 72 h en dur", () => {
  const h = (n: number) => new Date(NOW.getTime() - n * 3_600_000);
  it("délai de réponse abaissé à 24 h : un litige ouvert il y a 100 h est décidable depuis 76 h → compté au seuil de 72 h", () => {
    expect(countUndecidedDisputes([{ openedAt: h(100), carrierRespondedAt: null }], NOW, 24, 72)).toBe(1);
    // l'ancien calcul (ouverture + 72 h) le voyait décidable depuis 28 h seulement : pas d'alerte
    expect(countUndecidedDisputes([{ openedAt: h(100), carrierRespondedAt: null }], NOW, 72, 72)).toBe(0);
  });
  it("version du Voyageur reçue : décidable dès sa réponse, quel que soit le délai", () => {
    expect(countUndecidedDisputes([{ openedAt: h(80), carrierRespondedAt: h(73) }], NOW, 336, 72)).toBe(1);
    expect(countUndecidedDisputes([{ openedAt: h(80), carrierRespondedAt: h(71) }], NOW, 336, 72)).toBe(0);
  });
  it("borne exclusive : décidable depuis exactement le seuil → pas encore", () => {
    expect(countUndecidedDisputes([{ openedAt: h(144), carrierRespondedAt: null }], NOW, 72, 72)).toBe(0);
  });
});
describe("countUndecidedDisputes — ANO-ADM-52 : l'échéance figée à l'ouverture gagne", () => {
  const h = (n: number) => new Date(NOW.getTime() - n * 3_600_000);
  it("délai abaissé à 24 h après l'ouverture : un dossier figé à 72 h n'est décidable qu'à son échéance d'origine", () => {
    // ouvert il y a 100 h, échéance figée = ouverture + 72 h = il y a 28 h → pas au seuil de 72 h
    expect(countUndecidedDisputes([{ openedAt: h(100), carrierRespondedAt: null, responseDueAt: h(28) }], NOW, 24, 72)).toBe(0);
    expect(countUndecidedDisputes([{ openedAt: h(100), carrierRespondedAt: null, responseDueAt: null }], NOW, 24, 72)).toBe(1);
  });
});

describe("isOutboxLagging / outboxLagMinutes — recette § 5.23 : UNE règle pour l'alerte et la page « État des services »", () => {
  it("strictement au-delà du seuil ; absent → 0 ; date illisible → 0", () => {
    const il = (min: number) => new Date(NOW.getTime() - min * 60_000);
    expect(outboxLagMinutes(null, NOW)).toBe(0);
    expect(outboxLagMinutes("pas une date", NOW)).toBe(0);
    expect(outboxLagMinutes(il(20).toISOString(), NOW)).toBe(20);
    expect(isOutboxLagging(il(15), NOW, 15)).toBe(false);
    expect(isOutboxLagging(il(15.5), NOW, 15)).toBe(true);
    // L'alerte et la page tranchent pareil, sur le seuil lu dans les paramètres.
    for (const minutes of [4, 6, 16]) {
      const alerte = evaluateAlerts({ ...calm(), oldestUnpublishedAt: il(minutes) }, NOW, { ...ALERT_THRESHOLDS, outboxLagMinutes: 5 }).some((a) => a.rule === "OUTBOX_LAGGING_15MIN");
      expect(alerte).toBe(isOutboxLagging(il(minutes), NOW, 5));
    }
  });
});


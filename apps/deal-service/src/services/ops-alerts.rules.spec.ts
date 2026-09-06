import { ALERT_THRESHOLDS, alertSentKey, evaluateAlerts, type OpsSnapshot } from "./ops-alerts.rules";

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

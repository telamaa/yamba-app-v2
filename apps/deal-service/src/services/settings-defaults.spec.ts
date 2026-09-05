/** settings-defaults.spec.ts — D62 : les défauts du catalogue SONT les constantes du code (une base vide ne change rien). */
import { SETTINGS_DEFAULTS, REPUTATION_PARAMS, alertThresholdsFromSettings, pricingParamsFromSettings, reputationParamsFromSettings } from "@packages/api-contracts";
import { PRICING_PARAMS } from "@packages/pricing";
import { ALERT_THRESHOLDS, evaluateAlerts, type OpsSnapshot } from "./ops-alerts.rules";
import { DEFAULT_CANCELLATION_PARAMS, cancellationParamsFromSettings, computeCancellationRefundCents } from "./booking-lifecycle";
import { DEFAULT_VIEW_PARAMS, viewParamsFromSettings } from "./booking-view.mapper";
import { computeReputationLevel } from "./reputation.service";

describe("D62 — défauts du catalogue = constantes du code", () => {
  it("prix, alertes, annulation, litige, réputation", () => {
    expect(pricingParamsFromSettings(SETTINGS_DEFAULTS)).toEqual(PRICING_PARAMS);
    expect(alertThresholdsFromSettings(SETTINGS_DEFAULTS)).toEqual(ALERT_THRESHOLDS);
    expect(cancellationParamsFromSettings(SETTINGS_DEFAULTS)).toEqual(DEFAULT_CANCELLATION_PARAMS);
    expect(viewParamsFromSettings(SETTINGS_DEFAULTS)).toEqual(DEFAULT_VIEW_PARAMS);
    expect(reputationParamsFromSettings(SETTINGS_DEFAULTS)).toEqual(REPUTATION_PARAMS);
  });
});

describe("D62 — la constante n'est plus lue : changer le paramètre change le résultat", () => {
  const departureAt = new Date("2026-09-10T10:00:00Z");
  it("annulation : 24 h / 30 % au lieu de 48 h / 50 %", () => {
    const now = new Date("2026-09-09T00:00:00Z"); // 34 h avant le départ
    expect(computeCancellationRefundCents({ totalShipperCents: 3000, departureAt, now })).toBe(1500);
    expect(computeCancellationRefundCents({ totalShipperCents: 3000, departureAt, now, params: { fullRefundUntilHours: 24, lateRetentionPct: 30 } })).toBe(3000);
    expect(computeCancellationRefundCents({ totalShipperCents: 3000, departureAt, now: new Date("2026-09-10T00:00:00Z"), params: { fullRefundUntilHours: 24, lateRetentionPct: 30 } })).toBe(2100);
  });
  it("réputation : un Voyageur à 5 deals est TOP si le seuil passe à 5", () => {
    const f = { ratingsAvg: 4.9, ratingsCount: 4, completedDealsCount: 5, lateCancellationsCount: 0 };
    expect(computeReputationLevel("CARRIER", f)).toBe("CONFIRMED");
    expect(computeReputationLevel("CARRIER", f, { ...REPUTATION_PARAMS, carrier: { ...REPUTATION_PARAMS.carrier, topMinDeals: 5 } })).toBe("TOP");
  });
  it("alertes : le retard du relais se déclenche à 5 min si le seuil est abaissé", () => {
    const now = new Date("2026-09-05T10:00:00Z");
    const s: OpsSnapshot = { failedPayoutsOverThreshold: 0, undecidedDisputesOverThreshold: 0, heldRetentionsOverThreshold: 0, openReversalsOverThreshold: 0, parkedOutbox: 0, oldestUnpublishedAt: new Date(now.getTime() - 8 * 60_000), failedEmailsInWindow: 0, lastTripPublishedAt: now, requestsInWindow: 0, acceptedInWindow: 0 };
    expect(evaluateAlerts(s, now).map((a) => a.rule)).not.toContain("OUTBOX_LAGGING_15MIN");
    expect(evaluateAlerts(s, now, { ...ALERT_THRESHOLDS, outboxLagMinutes: 5 }).map((a) => a.rule)).toContain("OUTBOX_LAGGING_15MIN");
  });
});

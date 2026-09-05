/** analytics.spec.ts — D66 4A : liste blanche, consentement, dédoublonnage, envoi inerte sans clé. */
import { analyticsConfigFromEnv, analyticsEventsFor, batchPayload, captureServerEvents, isAnalyticsEnabled, uuidFrom } from "@packages/libs/analytics";

const event = {
  eventId: "6f0000000000000000000001",
  eventType: "booking.accepted",
  occurredAt: "2026-09-05T10:00:00.000Z",
  payload: { bookingId: "b1", tripId: "t1", shipperId: "s1", carrierId: "c1", corridor: { originCity: "Paris", originCountryCode: "FR", destinationCity: "Dakar", destinationCountryCode: "SN" }, category: "DOCUMENTS", weightKg: 2, totalShipperCents: 2500, currencyCode: "EUR", actor: "CARRIER", recipient: { firstName: "Moussa", phoneE164: "+221" }, deliveryCode: "742891", shipperEmail: "x@y.z" },
};

describe("analyticsEventsFor", () => {
  it("un événement par partie CONSENTANTE, propriétés sur liste blanche, jamais le destinataire ni le code ni un email", () => {
    const out = analyticsEventsFor(event, ["s1"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ distinctId: "s1", event: "booking.accepted", timestamp: "2026-09-05T10:00:00.000Z", properties: { bookingId: "b1", corridor: "Paris → Dakar", originCountryCode: "FR", totalShipperCents: 2500, role: "SHIPPER", source: "outbox" } });
    const json = JSON.stringify(out);
    expect(json).not.toContain("Moussa");
    expect(json).not.toContain("742891");
    expect(json).not.toContain("x@y.z");
    expect(json).not.toContain("+221");
  });
  it("personne n'a consenti → rien ; les deux → deux événements avec leur rôle et un uuid stable", () => {
    expect(analyticsEventsFor(event, [])).toEqual([]);
    const both = analyticsEventsFor(event, ["s1", "c1"]);
    expect(both.map((e) => e.properties?.role)).toEqual(["SHIPPER", "CARRIER"]);
    expect(both[0].uuid).toBe(analyticsEventsFor(event, ["s1"])[0].uuid);
    expect(both[0].uuid).not.toBe(both[1].uuid);
    expect(uuidFrom("a")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("captureServerEvents", () => {
  it("inerte sans clé ; avec clé : POST /batch avec api_key, uuid, $lib", async () => {
    expect(isAnalyticsEnabled(analyticsConfigFromEnv({}))).toBe(false);
    expect(await captureServerEvents(analyticsEventsFor(event, ["s1"]), { cfg: analyticsConfigFromEnv({}) })).toBe(false);
    const calls: Array<{ url: string; body: string }> = [];
    const ok = await captureServerEvents(analyticsEventsFor(event, ["s1"]), { cfg: analyticsConfigFromEnv({ POSTHOG_API_KEY: "phc_x", POSTHOG_HOST: "https://eu.i.posthog.com/" }), fetchImpl: async (url, init) => { calls.push({ url, body: init.body }); return { ok: true, status: 200 }; } });
    expect(ok).toBe(true);
    expect(calls[0].url).toBe("https://eu.i.posthog.com/batch");
    const body = JSON.parse(calls[0].body);
    expect(body.api_key).toBe("phc_x");
    expect(body.batch[0]).toMatchObject({ event: "booking.accepted", distinct_id: "s1", properties: { $lib: "yamba-server" } });
    expect(typeof body.batch[0].uuid).toBe("string");
  });
  it("une erreur réseau ou HTTP ne remonte jamais : false + onError", async () => {
    const onError = jest.fn();
    const cfg = analyticsConfigFromEnv({ POSTHOG_API_KEY: "k" });
    expect(await captureServerEvents([{ distinctId: "s1", event: "x" }], { cfg, fetchImpl: async () => { throw new Error("down"); }, onError })).toBe(false);
    expect(await captureServerEvents([{ distinctId: "s1", event: "x" }], { cfg, fetchImpl: async () => ({ ok: false, status: 500 }), onError })).toBe(false);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(batchPayload(cfg, []).batch).toEqual([]);
  });
});

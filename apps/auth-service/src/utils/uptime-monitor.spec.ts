/** uptime-monitor.spec.ts — règles pures du moniteur externe (D70) : agrégation de la sonde, battement externe. */
import { aggregateStatus, probeService, serviceEntries, toPublicBody } from "@packages/libs/health";
import { pingExternalHeartbeat, resolveHeartbeatPingUrl } from "@packages/libs/redis/cron-heartbeat";

const ok = (name: string) => ({ name, reachable: true, status: "ok" as const, ms: 5 });

describe("aggregateStatus (D70 1A) — le code HTTP porte l'alerte", () => {
  it("tous ok → ok 200 ; maintenance planifiée → maintenance 200 même si un service manque", () => {
    expect(aggregateStatus([ok("a"), ok("b")], false)).toEqual({ status: "ok", httpStatus: 200 });
    expect(aggregateStatus([ok("a"), { name: "b", reachable: false, status: null, ms: 2000 }], true)).toEqual({ status: "maintenance", httpStatus: 200 });
  });
  it("un service muet → down 503 ; un service sans Mongo ou Redis → degraded 503 (down l'emporte)", () => {
    expect(aggregateStatus([ok("a"), { name: "b", reachable: true, status: "degraded", ms: 9 }], false)).toEqual({ status: "degraded", httpStatus: 503 });
    expect(aggregateStatus([{ name: "a", reachable: false, status: null, ms: 2000 }, { name: "b", reachable: true, status: "degraded", ms: 9 }], false)).toEqual({ status: "down", httpStatus: 503 });
  });
  it("le corps public ne porte ni URL ni erreur brute", async () => {
    const failing = await probeService({ name: "x", url: "http://127.0.0.1:1", path: "/health" }, 200, async () => { throw new Error("ECONNREFUSED 127.0.0.1:1"); });
    expect(failing.reachable).toBe(false);
    const body = toPublicBody("down", [failing], new Date("2026-09-05T12:00:00.000Z"));
    expect(body).toEqual({ status: "down", services: [{ name: "x", reachable: false, status: null, ms: expect.any(Number) }], at: "2026-09-05T12:00:00.000Z" });
    expect(JSON.stringify(body)).not.toMatch(/127\.0\.0\.1|ECONNREFUSED|url/);
  });
  it("probeService lit le statut du /health (ok / degraded) et tolère un corps vide", async () => {
    const asResponse = (status: number, json: unknown) => ({ ok: status < 400, status, json: async () => json }) as unknown as globalThis.Response;
    const fetchOk = async () => asResponse(200, { status: "degraded", service: "deal-service" });
    expect((await probeService({ name: "deal-service", url: "http://h", path: "/health" }, 100, fetchOk)).status).toBe("degraded");
    const fetchEmpty = async () => ({ ok: true, status: 200, json: async () => { throw new Error("no body"); } }) as unknown as globalThis.Response;
    expect((await probeService({ name: "d", url: "http://h", path: "/health" }, 100, fetchEmpty))).toMatchObject({ reachable: true, status: null });
    expect(serviceEntries({ DEAL_SERVICE_URL: "http://deal.internal" } as NodeJS.ProcessEnv).find((e) => e.name === "deal-service")?.url).toBe("http://deal.internal");
  });
});

describe("battement externe des crons (D70 3A)", () => {
  const map = JSON.stringify({ "deal-service:payout-bookings": "https://uptime.example/api/v1/heartbeat/abc", "auth-service:x": "ftp://nope" });
  it("resolveHeartbeatPingUrl : la clé <service>:<cron>, http(s) seulement, JSON invalide → aucune", () => {
    expect(resolveHeartbeatPingUrl(map, "deal-service", "payout-bookings")).toBe("https://uptime.example/api/v1/heartbeat/abc");
    expect(resolveHeartbeatPingUrl(map, "deal-service", "expire-bookings")).toBeNull();
    expect(resolveHeartbeatPingUrl(map, "auth-service", "x")).toBeNull();
    expect(resolveHeartbeatPingUrl("{not json", "a", "b")).toBeNull();
    expect(resolveHeartbeatPingUrl(undefined, "a", "b")).toBeNull();
  });
  it("pingExternalHeartbeat : GET vers l'URL déclarée, false sans URL, jamais d'exception", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => { calls.push(String(url)); return { ok: true } as globalThis.Response; }) as unknown as typeof fetch;
    expect(await pingExternalHeartbeat("deal-service", "payout-bookings", fetchImpl, map)).toBe(true);
    expect(calls).toEqual(["https://uptime.example/api/v1/heartbeat/abc"]);
    expect(await pingExternalHeartbeat("deal-service", "expire-bookings", fetchImpl, map)).toBe(false);
    const boom = (async () => { throw new Error("network"); }) as unknown as typeof fetch;
    expect(await pingExternalHeartbeat("deal-service", "payout-bookings", boom, map)).toBe(false);
  });
});

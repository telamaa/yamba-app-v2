/** trip-stats.spec.ts — compteurs Redis de demande (D5 / C-PR6, D59) : clés pures, dédoublonnage, agrégats */
import { corridorKey, corridorStats, dayKey, dayKeysBack, normalizeCity, recordSearch, recordTripView, searchedCorridors, tripViews, viewerKey, type StatsRedis } from "@packages/libs/redis/trip-stats";

/** Faux Redis : un Map, les seules commandes utilisées. */
function fakeRedis(): StatsRedis & { store: Map<string, string>; sets: Map<string, Set<string>> } {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  return {
    store, sets,
    async set(key, value, _mode, _seconds, flag) { if (flag === "NX" && store.has(key)) return null; store.set(key, value); return "OK"; },
    async incr(key) { const n = (Number(store.get(key) ?? 0) || 0) + 1; store.set(key, String(n)); return n; },
    async expire() { return 1; },
    async mget(...keys) { return keys.map((k) => store.get(k) ?? null); },
    async sadd(key, ...members) { const s = sets.get(key) ?? new Set(); members.forEach((m) => s.add(m)); sets.set(key, s); return members.length; },
    async smembers(key) { return [...(sets.get(key) ?? [])]; },
  };
}
const NOW = new Date("2026-09-04T10:00:00.000Z");

describe("trip-stats (D5 / C-PR6)", () => {
  it("normalizeCity / corridorKey : accents, casse, espaces ; vide → null", () => {
    expect(normalizeCity("  Brazzaville ")).toBe("brazzaville");
    expect(normalizeCity("Saint-Étienne")).toBe("saint-etienne");
    expect(corridorKey("Paris", "Brazzaville")).toBe("paris>brazzaville");
    expect(corridorKey("Paris", "")).toBeNull();
    expect(corridorKey(null, "x")).toBeNull();
  });
  it("viewerKey : id utilisateur en clair, sinon empreinte tronquée (jamais l'IP)", () => {
    expect(viewerKey("u1", "1.2.3.4", "ua")).toBe("u:u1");
    const anon = viewerKey(null, "1.2.3.4", "ua");
    expect(anon).toMatch(/^a:[0-9a-f]{16}$/);
    expect(anon).not.toContain("1.2.3.4");
    expect(viewerKey(null, "1.2.3.4", "ua")).toBe(anon);
    expect(viewerKey(null, "1.2.3.5", "ua")).not.toBe(anon);
  });
  it("recordTripView : une vue par visiteur et par jour, total + corridor du jour", async () => {
    const r = fakeRedis();
    const base = { tripId: "t1", originCity: "Paris", destinationCity: "Brazzaville", now: NOW };
    expect(await recordTripView(r, { ...base, viewer: "u:a" })).toBe(true);
    expect(await recordTripView(r, { ...base, viewer: "u:a" })).toBe(false);
    expect(await recordTripView(r, { ...base, viewer: "u:b" })).toBe(true);
    expect(await recordTripView(r, { ...base, viewer: "u:a", now: new Date("2026-09-05T10:00:00Z") })).toBe(true);
    expect((await tripViews(r, ["t1", "t2"])).get("t1")).toBe(3);
    expect((await tripViews(r, ["t1", "t2"])).get("t2")).toBe(0);
    expect(r.store.get("yamba:stats:views:corridor:paris>brazzaville:20260904")).toBe("2");
  });
  it("recordSearch : recherches et sans-résultat par corridor et par jour, corridor mémorisé", async () => {
    const r = fakeRedis();
    expect(await recordSearch(r, { from: "Paris", to: "Brazzaville", hadResults: true, now: NOW })).toBe(true);
    expect(await recordSearch(r, { from: "Paris", to: "Kinshasa", hadResults: false, now: NOW })).toBe(true);
    expect(await recordSearch(r, { from: "Paris", to: null, hadResults: false, now: NOW })).toBe(false);
    expect(r.store.get("yamba:stats:search:corridor:paris>kinshasa:20260904")).toBe("1");
    expect(r.store.get("yamba:stats:search:noresult:paris>kinshasa:20260904")).toBe("1");
    expect(r.store.get("yamba:stats:search:noresult:paris>brazzaville:20260904")).toBeUndefined();
    expect((await searchedCorridors(r)).sort()).toEqual(["paris>brazzaville", "paris>kinshasa"]);
  });
  it("dayKeysBack / corridorStats : N jours, un seul MGET, sommes par corridor", async () => {
    expect(dayKey(NOW)).toBe("20260904");
    expect(dayKeysBack(NOW, 3)).toEqual(["20260902", "20260903", "20260904"]);
    const r = fakeRedis();
    await recordSearch(r, { from: "Paris", to: "Kinshasa", hadResults: false, now: new Date("2026-09-02T10:00:00Z") });
    await recordSearch(r, { from: "Paris", to: "Kinshasa", hadResults: true, now: NOW });
    await recordTripView(r, { tripId: "t", originCity: "Paris", destinationCity: "Kinshasa", viewer: "u:a", now: NOW });
    const s = await corridorStats(r, ["paris>kinshasa", "x>y"], NOW, 7);
    expect(s.get("paris>kinshasa")).toEqual({ views: 1, searches: 2, noResult: 1 });
    expect(s.get("x>y")).toEqual({ views: 0, searches: 0, noResult: 0 });
    const old = await corridorStats(r, ["paris>kinshasa"], NOW, 1);
    expect(old.get("paris>kinshasa")).toEqual({ views: 1, searches: 1, noResult: 0 });
  });
});

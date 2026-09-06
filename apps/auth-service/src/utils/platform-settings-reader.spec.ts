/** platform-settings-reader.spec.ts — le lecteur partagé (@packages/libs/settings, D62 4A) : fusion, cache, repli sûr. */
import { SETTINGS_DEFAULTS } from "@packages/api-contracts";
import { DEFAULT_SNAPSHOT, loadPlatformSettings, makeSettingsReader, type SettingsDb } from "@packages/libs/settings";

function dbWith(row: { values: unknown; version: number } | null | Error) {
  const findUnique = jest.fn(async () => {
    if (row instanceof Error) throw row;
    return row ? { ...row, updatedAt: new Date("2026-09-05T10:00:00Z"), updatedByAdminId: "sa1" } : null;
  });
  return { db: { platformSettings: { findUnique } } as unknown as SettingsDb, findUnique };
}

describe("loadPlatformSettings", () => {
  it("document absent → défauts, version 0, stored=false", async () => {
    expect(await loadPlatformSettings(dbWith(null).db)).toEqual(DEFAULT_SNAPSHOT);
  });
  it("fusionne : clé inconnue ignorée, valeur non numérique → défaut, valeur stockée conservée", async () => {
    const snap = await loadPlatformSettings(dbWith({ values: { "pricing.commissionPct": 15, "pricing.minTransportCents": "800", ancienne: 1 }, version: 4 }).db);
    expect(snap.version).toBe(4);
    expect(snap.values["pricing.commissionPct"]).toBe(15);
    expect(snap.values["pricing.minTransportCents"]).toBe(SETTINGS_DEFAULTS["pricing.minTransportCents"]);
    expect((snap.values as Record<string, unknown>).ancienne).toBeUndefined();
  });
  it("base injoignable → défauts, l'erreur est signalée, jamais levée", async () => {
    const onError = jest.fn();
    expect(await loadPlatformSettings(dbWith(new Error("ECONNREFUSED")).db, onError)).toEqual(DEFAULT_SNAPSHOT);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

describe("makeSettingsReader — cache 30 s et repli", () => {
  it("une seule lecture par TTL, relecture après expiration ou invalidate()", async () => {
    let t = 0;
    const { db, findUnique } = dbWith({ values: { "pricing.commissionPct": 15 }, version: 1 });
    const reader = makeSettingsReader({ db, ttlMs: 30_000, clock: () => t });
    expect(reader.peek()).toEqual(SETTINGS_DEFAULTS); // avant toute lecture
    expect((await reader.get())["pricing.commissionPct"]).toBe(15);
    await reader.get();
    await reader.snapshot();
    expect(findUnique).toHaveBeenCalledTimes(1);
    t = 29_999;
    await reader.get();
    expect(findUnique).toHaveBeenCalledTimes(1);
    t = 30_000;
    await reader.get();
    expect(findUnique).toHaveBeenCalledTimes(2);
    reader.invalidate();
    await reader.get();
    expect(findUnique).toHaveBeenCalledTimes(3);
    expect(reader.peek()["pricing.commissionPct"]).toBe(15);
  });
  it("lectures concurrentes → une seule requête", async () => {
    const { db, findUnique } = dbWith({ values: {}, version: 1 });
    const reader = makeSettingsReader({ db });
    await Promise.all([reader.get(), reader.get(), reader.snapshot()]);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
  it("panne après une lecture réussie → la dernière valeur connue est servie ; panne d'emblée → défauts", async () => {
    let fail = false;
    const findUnique = jest.fn(async () => { if (fail) throw new Error("down"); return { values: { "pricing.commissionPct": 15 }, version: 1, updatedAt: new Date(), updatedByAdminId: null }; });
    const onError = jest.fn();
    let t = 0;
    const reader = makeSettingsReader({ db: { platformSettings: { findUnique } } as unknown as SettingsDb, ttlMs: 10, clock: () => t, onError });
    expect((await reader.get())["pricing.commissionPct"]).toBe(15);
    fail = true; t = 20;
    expect((await reader.get())["pricing.commissionPct"]).toBe(15);
    expect(onError).toHaveBeenCalledTimes(1);
    const fresh = makeSettingsReader({ db: { platformSettings: { findUnique } } as unknown as SettingsDb, onError });
    expect(await fresh.get()).toEqual(SETTINGS_DEFAULTS);
  });
});

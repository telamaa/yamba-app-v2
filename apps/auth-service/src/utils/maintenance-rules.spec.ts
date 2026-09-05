/** maintenance-rules.spec.ts — D64 2A : ce qui est bloqué, ce qui passe, l'environnement qui l'emporte (règles pures du gateway). */
import { envOverride, isBlocked, snapshotFrom, type MaintenanceSnapshot } from "@packages/libs/maintenance";

const on: MaintenanceSnapshot = { enabled: true, message: { fr: "m", en: "m" }, scheduledAt: null, source: "db" };
const off: MaintenanceSnapshot = { ...on, enabled: false };

describe("isBlocked", () => {
  it("hors maintenance : rien n'est bloqué", () => {
    expect(isBlocked("POST", "/api/deals", off)).toBe(false);
  });
  it("en maintenance : les écritures sont bloquées, les lectures passent", () => {
    expect(isBlocked("POST", "/api/deals", on)).toBe(true);
    expect(isBlocked("PATCH", "/api/messages/conversations/1/read", on)).toBe(true);
    expect(isBlocked("DELETE", "/api/trips/1", on)).toBe(true);
    expect(isBlocked("GET", "/api/trips/search", on)).toBe(false);
  });
  it("connexion, rafraîchissement et back-office restent ouverts", () => {
    expect(isBlocked("POST", "/api/auth/login", on)).toBe(false);
    expect(isBlocked("POST", "/api/auth/refresh", on)).toBe(false);
    expect(isBlocked("PUT", "/api/admin/maintenance", on)).toBe(false);
    expect(isBlocked("POST", "/api/auth/admin/login", on)).toBe(false);
  });
});

describe("snapshotFrom / envOverride", () => {
  it("valeurs manquantes → défauts ; environnement → l'emporte avec ses messages", () => {
    expect(snapshotFrom(null)).toMatchObject({ enabled: false, message: { fr: "", en: "" }, scheduledAt: null });
    expect(snapshotFrom({ enabled: true, messageFr: "ce soir", scheduledAt: "2026-09-05T21:00:00.000Z" })).toMatchObject({ enabled: true, message: { fr: "ce soir", en: "" }, scheduledAt: "2026-09-05T21:00:00.000Z" });
    expect(envOverride({})).toBeNull();
    expect(envOverride({ MAINTENANCE_MODE: "on", MAINTENANCE_MESSAGE_FR: "panne" })).toMatchObject({ enabled: true, source: "env", message: { fr: "panne" } });
  });
});

/** maintenance-rules.spec.ts — D64 2A : ce qui est bloqué, ce qui passe, l'environnement qui l'emporte (règles pures du gateway). */
import { envOverride, isBlocked, isExemptPath, maintenancePollMs, MAINTENANCE_POLL_ACTIVE_MS, MAINTENANCE_POLL_IDLE_MS, isForcedByEnvironment, MAINTENANCE_ENV_CHECK_ERROR, maintenanceCheckError, snapshotFrom, type MaintenanceSnapshot } from "@packages/libs/maintenance";

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
  it("lot c (recette § 5.24) — l'exemption se compare par segment : un chemin qui commence comme un préfixe n'est pas exempté", () => {
    expect(isBlocked("POST", "/api/maintenanceX", on)).toBe(true);
    expect(isBlocked("POST", "/api/maintenance-hack/1", on)).toBe(true);
    expect(isBlocked("POST", "/api/authentic/deals", on)).toBe(true);
    expect(isBlocked("POST", "/api/administration", on)).toBe(true);
    expect(isBlocked("POST", "/api/maintenance", on)).toBe(false);
    expect(isBlocked("POST", "/api/maintenance/ack", on)).toBe(false);
    expect(isBlocked("POST", "/api/auth", on)).toBe(false);
    expect(isBlocked("PUT", "/api/admin", on)).toBe(false);
    expect(isExemptPath("/API/AUTH/login")).toBe(true); // Express route sans la casse : même route, même exemption
    expect(isExemptPath("//api/auth/login")).toBe(false); // ce qui ne ressemble pas exactement à un préfixe reste bloqué
    expect(isExemptPath("/api/deals")).toBe(false);
  });
});

describe("maintenancePollMs (lot b, recette § 5.24)", () => {
  const now = Date.parse("2026-09-15T12:00:00.000Z");
  it("15 s quand la maintenance est active ou annoncée, 60 s sinon", () => {
    expect(MAINTENANCE_POLL_ACTIVE_MS).toBe(15_000);
    expect(MAINTENANCE_POLL_IDLE_MS).toBe(60_000);
    expect(maintenancePollMs({ enabled: true, scheduledAt: null }, now)).toBe(15_000);
    expect(maintenancePollMs({ enabled: false, scheduledAt: "2026-09-15T14:00:00.000Z" }, now)).toBe(15_000);
    expect(maintenancePollMs({ enabled: false, scheduledAt: "2026-09-15T10:00:00.000Z" }, now)).toBe(60_000); // annonce passée
    expect(maintenancePollMs({ enabled: false, scheduledAt: null }, now)).toBe(60_000);
    expect(maintenancePollMs({ enabled: false, scheduledAt: "pas une date" }, now)).toBe(60_000);
    expect(maintenancePollMs(null, now)).toBe(60_000); // état pas encore lu : le rythme courant
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

describe("A182 — l'interrupteur d'environnement se lit dans la santé du gateway", () => {
  it("maintenanceCheckError / isForcedByEnvironment", () => {
    expect(maintenanceCheckError(off)).toBeNull();
    expect(maintenanceCheckError(on)).toBe("maintenance (db)");
    const env = envOverride({ MAINTENANCE_MODE: "on" }) as MaintenanceSnapshot;
    expect(maintenanceCheckError(env)).toBe(MAINTENANCE_ENV_CHECK_ERROR);
    expect(isForcedByEnvironment({ checks: { maintenance: { error: maintenanceCheckError(env) } } })).toBe(true);
    expect(isForcedByEnvironment({ checks: { maintenance: { error: maintenanceCheckError(on) } } })).toBe(false);
    expect(isForcedByEnvironment({ checks: {} })).toBe(false);
    expect(isForcedByEnvironment(null)).toBe(false);
  });
});

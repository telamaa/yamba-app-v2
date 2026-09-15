/**
 * status.rules.spec.ts — page « État des services » (recette 02-ADMIN § 5.22)
 *  - A177 / ANO-ADM-61 : les compteurs d'emails suivent le webhook du fournisseur ;
 *  - A178 : le catalogue des crons est le miroir exact des fichiers `apps/<service>/src/cron/*.cron.ts` ;
 *  - A176 / ANO-ADM-62 : le seuil d'alerte « parqué » ne dépasse jamais le parking réel du relais.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { CRON_CATALOGUE, OUTBOX_MAX_RELAY_ATTEMPTS, SETTINGS_DEFAULTS, isCronLate, mergeSettingsValues, missingCrons, settingDefinition } from "@packages/api-contracts";
import { emailCounters } from "./status.rules";

const APPS = join(__dirname, "../../..");

describe("emailCounters (A177, ANO-ADM-61)", () => {
  it("un email remis, rebondi ou en plainte a été envoyé ; seul FAILED est un échec", () => {
    expect(emailCounters([{ status: "SENT", count: 3 }, { status: "DELIVERED", count: 5 }, { status: "BOUNCED", count: 1 }, { status: "COMPLAINED", count: 1 }, { status: "FAILED", count: 2 }, { status: "PENDING", count: 4 }])).toEqual({ sentLast24h: 10, deliveredLast24h: 5, bouncedLast24h: 2, failedLast24h: 2 });
  });
  it("avant le correctif, « envoyés » retombait à zéro quand toutes les remises étaient arrivées", () => {
    expect(emailCounters([{ status: "DELIVERED", count: 7 }]).sentLast24h).toBe(7);
    expect(emailCounters([])).toEqual({ sentLast24h: 0, deliveredLast24h: 0, bouncedLast24h: 0, failedLast24h: 0 });
  });
});

describe("CRON_CATALOGUE (A178) — miroir des fichiers de cron", () => {
  const fichiers = readdirSync(APPS).flatMap((app) => {
    const dir = join(APPS, app, "src/cron");
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".cron.ts")).map((f) => ({ service: app, source: readFileSync(join(dir, f), "utf-8") })) : [];
  });
  const declares = fichiers.flatMap(({ service, source }) => {
    if (!source.includes("withHeartbeat(")) return [{ service, name: "<cron sans battement>", schedule: "" }];
    const name = /withHeartbeat\([^{]*\{[^}]*name: "([a-z-]+)"/.exec(source)?.[1] ?? "<nom introuvable>";
    const schedule = /SCHEDULE = "([^"]+)"/.exec(source)?.[1] ?? "<expression introuvable>";
    return [{ service, name, schedule }];
  });

  it("chaque fichier de cron laisse un battement et figure au catalogue avec la même expression", () => {
    expect(declares.length).toBeGreaterThanOrEqual(13);
    for (const d of declares) expect(CRON_CATALOGUE.map((c) => ({ service: c.service, name: c.name, schedule: c.schedule }))).toContainEqual(d);
  });
  it("aucune entrée du catalogue sans fichier de cron", () => {
    for (const c of CRON_CATALOGUE) expect(declares).toContainEqual({ service: c.service, name: c.name, schedule: c.schedule });
  });
  it("les absents et les retards se calculent sur le catalogue", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const presents = CRON_CATALOGUE.filter((c) => c.name !== "complete-trips");
    expect(missingCrons(presents)).toEqual([expect.objectContaining({ service: "trip-service", name: "complete-trips" })]);
    expect(missingCrons([])).toHaveLength(CRON_CATALOGUE.length);
    expect(isCronLate({ service: "deal-service", name: "expire-bookings", ranAt: "2026-09-15T11:51:00Z" }, now)).toBe(false); // 9 min < 10
    expect(isCronLate({ service: "deal-service", name: "expire-bookings", ranAt: "2026-09-15T11:49:00Z" }, now)).toBe(true); // 11 min > 2 × 5
    expect(isCronLate({ service: "deal-service", name: "ops-digest", ranAt: "2026-09-14T08:00:00Z" }, now)).toBe(false); // 28 h < 48 h
    expect(isCronLate({ service: "autre", name: "inconnu", ranAt: "2020-01-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("seuil « parqué » (A176, ANO-ADM-62)", () => {
  it("borné par le parking réel du relais, et le relais lit la même constante", () => {
    const def = settingDefinition("alerts.outboxParkedAttempts")!;
    expect(def.max).toBe(OUTBOX_MAX_RELAY_ATTEMPTS);
    expect(SETTINGS_DEFAULTS["alerts.outboxParkedAttempts"]).toBe(OUTBOX_MAX_RELAY_ATTEMPTS);
    for (const relais of ["deal-service/src/relay/outbox-relay.ts", "message-service/src/relay/messaging-relay.ts"]) {
      expect(readFileSync(join(APPS, relais), "utf-8")).toContain("export const MAX_RELAY_ATTEMPTS = OUTBOX_MAX_RELAY_ATTEMPTS;");
    }
  });
  it("une valeur stockée hors bornes est ramenée dans ses bornes à la lecture (20 → 10, 0 → 1)", () => {
    expect(mergeSettingsValues({ "alerts.outboxParkedAttempts": 20 })["alerts.outboxParkedAttempts"]).toBe(10);
    expect(mergeSettingsValues({ "alerts.outboxParkedAttempts": 0 })["alerts.outboxParkedAttempts"]).toBe(1);
    expect(mergeSettingsValues({ "alerts.outboxParkedAttempts": 3 })["alerts.outboxParkedAttempts"]).toBe(3);
  });
});

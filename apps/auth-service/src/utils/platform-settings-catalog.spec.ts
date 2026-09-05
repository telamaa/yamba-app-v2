/** platform-settings-catalog.spec.ts — intégrité du catalogue (D62 1A/2A) : clés uniques, défauts dans les bornes, textes présents, classes cohérentes. */
import { FIXED_PARAMETERS, PLANNED_PARAMETERS, PlatformSettingsValuesSchema, SETTINGS_CATALOG, SETTINGS_DEFAULTS, mergeSettingsValues, settingsCoherenceIssues } from "@packages/api-contracts";

describe("SETTINGS_CATALOG", () => {
  it("clés uniques, sans point interdit ni espace, avec groupe, règle, texte et au moins un consommateur", () => {
    const keys = SETTINGS_CATALOG.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of SETTINGS_CATALOG) {
      expect(d.key).toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
      expect(d.description.length).toBeGreaterThan(20);
      expect(d.rule.length).toBeGreaterThan(2);
      expect(d.consumers.length).toBeGreaterThan(0);
      expect(d.min).toBeLessThan(d.max);
      expect(d.default).toBeGreaterThanOrEqual(d.min);
      expect(d.default).toBeLessThanOrEqual(d.max);
      expect(d.step).toBeGreaterThan(0);
    }
  });
  it("les défauts passent les bornes Zod et les règles de cohérence (une base vide = le comportement d'aujourd'hui)", () => {
    expect(PlatformSettingsValuesSchema.safeParse(SETTINGS_DEFAULTS).success).toBe(true);
    expect(settingsCoherenceIssues(SETTINGS_DEFAULTS)).toEqual([]);
    expect(mergeSettingsValues(null)).toEqual(SETTINGS_DEFAULTS);
  });
  it("les clés d'argent sont en cents entiers, les clés métier contractuelles sont marquées", () => {
    for (const d of SETTINGS_CATALOG) {
      if (d.unit === "cents") expect(Number.isInteger(d.default)).toBe(true);
    }
    expect(SETTINGS_CATALOG.find((d) => d.key === "cancellation.lateRetentionPct")?.contractual).toBe(true);
    expect(SETTINGS_CATALOG.find((d) => d.key === "pricing.commissionPct")?.scope).toBe("BUSINESS");
    expect(SETTINGS_CATALOG.find((d) => d.key === "alerts.outboxLagMinutes")?.scope).toBe("OPERATIONS");
  });
  it("classes B et C : nommées, jamais présentes dans la classe A", () => {
    const a = new Set(SETTINGS_CATALOG.map((d) => d.key));
    for (const f of FIXED_PARAMETERS) expect(a.has(f.key as never)).toBe(false);
    for (const p of PLANNED_PARAMETERS) expect(a.has(p.key as never)).toBe(false);
    expect(PLANNED_PARAMETERS.some((p) => p.key === "WEIGHT_TOLERANCE_PCT")).toBe(true);
  });
});

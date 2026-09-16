/** admin-audit.query.spec.ts — filtres du journal d'audit (A149). */
import { appliedAuditFilters, buildAuditWhere } from "./admin-audit.query";

const OID = "aaaaaaaaaaaaaaaaaaaaaaaa";

describe("buildAuditWhere (A149)", () => {
  it("aucun filtre → aucun where : la lecture reste celle de toute la page", () => {
    expect(buildAuditWhere({})).toEqual({});
  });
  it("période : « jusqu'au 12 » inclut le 12 en entier, un instant précis est pris tel quel", () => {
    const jour = buildAuditWhere({ from: "2026-09-01", to: "2026-09-12" }).createdAt as { gte: Date; lte: Date };
    expect(jour.gte.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(jour.lte.toISOString()).toBe("2026-09-12T23:59:59.999Z");
    const instant = buildAuditWhere({ to: "2026-09-12T10:00:00.000Z" }).createdAt as { lte: Date };
    expect(instant.lte.toISOString()).toBe("2026-09-12T10:00:00.000Z");
  });
  it("qui, action, cible et IP passent quand ils sont bien formés", () => {
    expect(buildAuditWhere({ adminUserId: OID, action: "SETTING_CHANGED", targetType: "USER", targetId: OID, ip: " 10.0.0.1 " })).toEqual({
      adminUserId: OID,
      action: "SETTING_CHANGED",
      targetType: "USER",
      targetId: OID,
      ip: "10.0.0.1",
    });
  });
  it("une valeur mal formée est IGNORÉE, jamais une erreur : le journal reste lisible", () => {
    expect(buildAuditWhere({ adminUserId: "pas-un-id", action: "select * from", targetType: "user", targetId: "{ $ne: 1 }", ip: "  ", from: "hier" })).toEqual({});
    expect(buildAuditWhere({ targetId: "a b" })).toEqual({});
    expect(buildAuditWhere({ targetId: "x".repeat(101) })).toEqual({});
  });
  it("ANO-ADM-74 — l'identifiant de cible accepte une clé de paramètre, `maintenance` et l'identifiant d'une session admin", () => {
    expect(buildAuditWhere({ targetId: "pricing.commissionPct" })).toEqual({ targetId: "pricing.commissionPct" });
    expect(buildAuditWhere({ targetId: " maintenance " })).toEqual({ targetId: "maintenance" });
    expect(buildAuditWhere({ targetId: "7f543d7e65fc5841f2fbe4e6bb7fb4a5" })).toEqual({ targetId: "7f543d7e65fc5841f2fbe4e6bb7fb4a5" });
    expect(appliedAuditFilters({ targetType: "SETTINGS", targetId: "alerts.outboxLagMinutes" })).toEqual(["targetType", "targetId"]);
  });
  it("appliedAuditFilters nomme les filtres retenus, pour que l'écran n'en affiche pas un ignoré", () => {
    expect(appliedAuditFilters({ adminUserId: OID, action: "nope" })).toEqual(["adminUserId"]);
    expect(appliedAuditFilters({})).toEqual([]);
  });
});

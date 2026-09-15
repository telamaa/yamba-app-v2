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

/* ── Recette 02-ADMIN § 5.25, lots du § 5.24 (A187) ─────────────────────────────────────────────── */
import { AUDIT_CSV_COLUMNS, appliedAuditFilterValues, auditAuthors, auditCsvRow, auditQueryFrom } from "./admin-audit.query";
import { buildCsv } from "@packages/libs/csv";

describe("A187 — export du journal filtré, auteurs du filtre", () => {
  it("auditQueryFrom ne lit que des chaînes ; appliedAuditFilterValues n'écrit au journal que les filtres RETENUS", () => {
    const q = auditQueryFrom({ from: "2026-09-15T00:00:00.000Z", adminUserId: "pas-un-id", action: "ADMIN_REVOKED", ip: ["10.0.0.1"], targetId: "pricing.commissionPct" });
    expect(q.ip).toBeUndefined();
    expect(appliedAuditFilterValues(q)).toEqual({ from: "2026-09-15T00:00:00.000Z", action: "ADMIN_REVOKED", targetId: "pricing.commissionPct" });
  });
  it("une ligne CSV : ISO, auteur nommé, détail JSON fidèle, IP et navigateur ; une cellule piégée est neutralisée", () => {
    const row = auditCsvRow({ createdAt: new Date("2026-09-15T10:00:00Z"), adminUserId: "a1", action: "ADMIN_ROLE_CHANGED", targetType: "USER", targetId: "u1", before: { adminRoles: ["SUPPORT"] }, after: null, ip: "10.0.0.1", userAgent: "=HYPERLINK(\"x\")" }, "Sacha Superviseur");
    expect(row).toMatchObject({ at: "2026-09-15T10:00:00.000Z", admin: "Sacha Superviseur", before: '{"adminRoles":["SUPPORT"]}', after: "", targetId: "u1" });
    const csv = buildCsv(AUDIT_CSV_COLUMNS, [row]);
    expect(csv.split("\r\n")[0]).toBe(AUDIT_CSV_COLUMNS.join(","));
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
  });
  it("auteurs : tout auteur d'une ligne, admin retiré compris (active: false), compte disparu nommé, tri par nom", () => {
    const out = auditAuthors(["a3", "a1", "a2"], [
      { id: "a1", firstName: "Sacha", lastName: "Superviseur", adminRole: "SUPER_ADMIN", adminRoles: ["SUPER_ADMIN"] },
      { id: "a2", firstName: "Anaïs", lastName: "Retirée", adminRole: null, adminRoles: [] },
    ]);
    expect(out).toEqual([
      { id: "a2", name: "Anaïs Retirée", active: false },
      { id: "a3", name: "Compte introuvable", active: false },
      { id: "a1", name: "Sacha Superviseur", active: true },
    ]);
  });
});

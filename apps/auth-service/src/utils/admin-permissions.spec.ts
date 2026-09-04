/** Matrice route → profil (C-PR3, D56 1A) — source unique dans le contrat. */
import { ADMIN_PERMISSIONS, adminRoleAllows, type AdminPermission } from "@packages/api-contracts";

describe("adminRoleAllows (D56)", () => {
  const perms = Object.keys(ADMIN_PERMISSIONS) as AdminPermission[];
  it("SUPER_ADMIN passe partout, y compris admins.manage réservé", () => {
    for (const p of perms) expect(adminRoleAllows("SUPER_ADMIN", p)).toBe(true);
  });
  it("aucun profil → rien", () => {
    for (const p of perms) expect(adminRoleAllows(null, p)).toBe(false);
  });
  it("MEDIATOR tranche et sanctionne, ne gère ni les admins ni le journal", () => {
    expect(adminRoleAllows("MEDIATOR", "disputes.decide")).toBe(true);
    expect(adminRoleAllows("MEDIATOR", "users.suspension.apply")).toBe(true);
    expect(adminRoleAllows("MEDIATOR", "admins.manage")).toBe(false);
    expect(adminRoleAllows("MEDIATOR", "audit.read")).toBe(false);
  });
  it("SUPPORT lit et propose, n'exécute pas", () => {
    expect(adminRoleAllows("SUPPORT", "users.read")).toBe(true);
    expect(adminRoleAllows("SUPPORT", "users.suspension.propose")).toBe(true);
    expect(adminRoleAllows("SUPPORT", "users.suspension.apply")).toBe(false);
    expect(adminRoleAllows("SUPPORT", "disputes.decide")).toBe(false);
  });
  it("FINANCE lit dossiers, fiches et journal, ne décide rien", () => {
    expect(adminRoleAllows("FINANCE", "disputes.read")).toBe(true);
    expect(adminRoleAllows("FINANCE", "audit.read")).toBe(true);
    expect(adminRoleAllows("FINANCE", "disputes.decide")).toBe(false);
    expect(adminRoleAllows("FINANCE", "users.suspension.propose")).toBe(false);
  });
  it("C-PR4 (D57 6A) : SUPPORT vérifie les billets et propose un masquage, MEDIATOR masque, FINANCE lit seulement", () => {
    expect(adminRoleAllows("SUPPORT", "tickets.review")).toBe(true);
    expect(adminRoleAllows("SUPPORT", "trips.hide.propose")).toBe(true);
    expect(adminRoleAllows("SUPPORT", "trips.hide.apply")).toBe(false);
    expect(adminRoleAllows("MEDIATOR", "trips.hide.apply")).toBe(true);
    expect(adminRoleAllows("FINANCE", "trips.read")).toBe(true);
    expect(adminRoleAllows("FINANCE", "tickets.review")).toBe(false);
    expect(adminRoleAllows("FINANCE", "trips.hide.propose")).toBe(false);
  });
  it("C-PR4 : kpi.read pour tous les profils, chaque compteur restant filtré par sa propre permission", () => {
    for (const r of ["MEDIATOR", "SUPPORT", "FINANCE"] as const) expect(adminRoleAllows(r, "kpi.read")).toBe(true);
  });
  it("C-PR5 (D58 6A) : FINANCE et MEDIATOR lisent les finances et agissent sur les versements ; SUPPORT non", () => {
    for (const r of ["FINANCE", "MEDIATOR"] as const) {
      expect(adminRoleAllows(r, "finances.read")).toBe(true);
      expect(adminRoleAllows(r, "payouts.retry")).toBe(true);
      expect(adminRoleAllows(r, "payouts.resolve")).toBe(true);
    }
    expect(adminRoleAllows("SUPPORT", "finances.read")).toBe(false);
    expect(adminRoleAllows("SUPPORT", "payouts.retry")).toBe(false);
  });
  it("C-PR5b (D58) : l'export est FINANCE seul, le remboursement manuel est proposé par FINANCE / SUPPORT et appliqué par SUPER_ADMIN seul", () => {
    expect(adminRoleAllows("FINANCE", "finances.export")).toBe(true);
    expect(adminRoleAllows("MEDIATOR", "finances.export")).toBe(false);
    expect(adminRoleAllows("FINANCE", "refunds.manual.propose")).toBe(true);
    expect(adminRoleAllows("SUPPORT", "refunds.manual.propose")).toBe(true);
    for (const r of ["FINANCE", "MEDIATOR", "SUPPORT"] as const) expect(adminRoleAllows(r, "refunds.manual.apply")).toBe(false);
    expect(adminRoleAllows("SUPER_ADMIN", "refunds.manual.apply")).toBe(true);
  });
  it("C-PR6 (D59 7A) : pilotage pour FINANCE et MEDIATOR ; chronologie d'un deal pour les trois profils", () => {
    expect(adminRoleAllows("FINANCE", "pilotage.read")).toBe(true);
    expect(adminRoleAllows("MEDIATOR", "pilotage.read")).toBe(true);
    expect(adminRoleAllows("SUPPORT", "pilotage.read")).toBe(false);
    for (const r of ["FINANCE", "MEDIATOR", "SUPPORT"] as const) expect(adminRoleAllows(r, "deals.history.read")).toBe(true);
  });
});

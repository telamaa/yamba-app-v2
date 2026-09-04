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
});

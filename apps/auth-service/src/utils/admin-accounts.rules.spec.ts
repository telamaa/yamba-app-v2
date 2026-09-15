/**
 * admin-accounts.rules.spec.ts — règles pures des comptes admin (recette 02-ADMIN § 5.25, A185, A186).
 */
import { inServiceSuperAdminsWhere, inviteMode, isUniqueViolation, removesSuperAdmin } from "./admin-accounts.rules";

describe("inviteMode — que faire de l'adresse invitée (A185)", () => {
  it("adresse inconnue → nouveau compte", () => expect(inviteMode(null)).toEqual({ kind: "NEW" }));
  it("membre avec mot de passe → « accès accordé »", () => expect(inviteMode({ passwordHash: "h", adminRole: null, adminRoles: [] })).toEqual({ kind: "GRANT_ACCESS" }));
  it("ANO-ADM-75 — compte SANS mot de passe (invité retiré avant d'accepter, compte social) → lien pour en poser un", () => {
    expect(inviteMode({ passwordHash: null, adminRole: null, adminRoles: [] })).toEqual({ kind: "PASSWORD_LINK" });
    expect(inviteMode({ adminRole: null })).toEqual({ kind: "PASSWORD_LINK" }); // champs absents (Mongo)
  });
  it("profil admin déjà posé (liste OU profil principal d'avant la reprise) → 400 ADMIN_ALREADY_GRANTED", () => {
    expect(inviteMode({ passwordHash: "h", adminRole: "SUPPORT", adminRoles: ["SUPPORT"] })).toMatchObject({ kind: "REFUSED", code: "ADMIN_ALREADY_GRANTED" });
    expect(inviteMode({ passwordHash: "h", adminRole: null, adminRoles: ["OPS"] })).toMatchObject({ kind: "REFUSED", code: "ADMIN_ALREADY_GRANTED" });
    expect(inviteMode({ passwordHash: "h", adminRole: "MEDIATOR" })).toMatchObject({ kind: "REFUSED", code: "ADMIN_ALREADY_GRANTED" });
  });
  it("compte supprimé → jamais promu (400 ACCOUNT_DELETED), avant tout autre examen", () => {
    expect(inviteMode({ isDeleted: true, passwordHash: "h", adminRole: "SUPPORT" })).toMatchObject({ kind: "REFUSED", code: "ACCOUNT_DELETED" });
  });
});

describe("removesSuperAdmin / inServiceSuperAdminsWhere (A186)", () => {
  it("rétrograder ou retirer un SUPER_ADMIN est un retrait ; ajouter ou garder ne l'est pas", () => {
    expect(removesSuperAdmin(["SUPER_ADMIN"], ["SUPPORT"])).toBe(true);
    expect(removesSuperAdmin(["SUPER_ADMIN", "FINANCE"], null)).toBe(true);
    expect(removesSuperAdmin(["SUPER_ADMIN"], ["SUPER_ADMIN", "FINANCE"])).toBe(false);
    expect(removesSuperAdmin(["SUPPORT"], ["SUPER_ADMIN"])).toBe(false);
    expect(removesSuperAdmin(["SUPPORT"], null)).toBe(false);
  });
  it("« en service » = autre que la cible, non supprimé, mot de passe posé, 2FA activée, SUPER_ADMIN par la liste ou le profil principal", () => {
    expect(inServiceSuperAdminsWhere("u-cible")).toEqual({
      id: { not: "u-cible" },
      isDeleted: false,
      passwordHash: { not: null },
      totpEnabledAt: { not: null },
      OR: [{ adminRole: "SUPER_ADMIN" }, { adminRoles: { has: "SUPER_ADMIN" } }],
    });
  });
  it("isUniqueViolation ne reconnaît que P2002", () => {
    expect(isUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isUniqueViolation({ code: "P2034" })).toBe(false);
    expect(isUniqueViolation(new Error("x"))).toBe(false);
  });
});

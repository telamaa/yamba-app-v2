import { activeSanctionFilter, effectiveAccountStatus, notSuspendedOwnerFilter, sanctionExpired } from "@packages/middleware/account-status";

/**
 * ANO-ADM-07 (recette 02-ADMIN § 5.4) — la date de fin d'une sanction était enregistrée et annoncée au membre
 * (« jusqu'au … »), mais aucune garde ne la lisait : le compte restait refusé pour toujours.
 */
describe("effectiveAccountStatus (ANO-ADM-07)", () => {
  const now = new Date("2026-09-14T10:00:00Z");

  it("sans date de fin, la sanction s'applique", () => {
    expect(effectiveAccountStatus({ accountStatus: "RESTRICTED", suspensionUntil: null }, now)).toBe("RESTRICTED");
    expect(effectiveAccountStatus({ accountStatus: "SUSPENDED" }, now)).toBe("SUSPENDED");
  });

  it("date de fin à venir : la sanction s'applique ; atteinte ou passée : le compte est actif", () => {
    expect(effectiveAccountStatus({ accountStatus: "SUSPENDED", suspensionUntil: new Date("2026-09-14T10:00:01Z") }, now)).toBe("SUSPENDED");
    expect(effectiveAccountStatus({ accountStatus: "SUSPENDED", suspensionUntil: new Date("2026-09-14T10:00:00Z") }, now)).toBe("ACTIVE");
    expect(effectiveAccountStatus({ accountStatus: "RESTRICTED", suspensionUntil: "2026-09-01T00:00:00Z" }, now)).toBe("ACTIVE");
  });

  it("un compte actif, ou sans statut (document antérieur), est actif", () => {
    expect(effectiveAccountStatus({ accountStatus: "ACTIVE", suspensionUntil: new Date("2020-01-01") }, now)).toBe("ACTIVE");
    expect(effectiveAccountStatus({}, now)).toBe("ACTIVE");
    expect(sanctionExpired({ accountStatus: "ACTIVE", suspensionUntil: new Date("2020-01-01") }, now)).toBe(false);
  });

  it("les filtres de lecture disent la même chose que la règle", () => {
    expect(notSuspendedOwnerFilter(now)).toEqual({ OR: [{ accountStatus: { not: "SUSPENDED" } }, { suspensionUntil: { lte: now, gt: new Date(0) } }] });
    expect(activeSanctionFilter("RESTRICTED", now)).toEqual({ accountStatus: "RESTRICTED", OR: [{ suspensionUntil: null }, { suspensionUntil: { isSet: false } }, { suspensionUntil: { gt: now } }] });
  });
});

import { withWriteConflictRetry } from "./write-conflict-retry";

/**
 * ANO-API-19 (recette API 08/09/2026, fiche API-IDEM-07) — deux Expéditeurs sur les derniers
 * kilos : la capacité restait juste (une seule réservation comptée), mais le perdant recevait
 * 500 parce que MongoDB rejetait sa transaction (P2034), un conflit d'infrastructure que la
 * base elle-même demande de rejouer.
 */
const conflit = () => Object.assign(new Error("write conflict"), { code: "P2034" });

describe("withWriteConflictRetry (ANO-API-19)", () => {
  it("laisse passer un succès sans rien rejouer", async () => {
    const op = jest.fn().mockResolvedValue("ok");
    await expect(withWriteConflictRetry(op)).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("rejoue un conflit d'écriture et rend le résultat du second essai", async () => {
    const op = jest.fn().mockRejectedValueOnce(conflit()).mockResolvedValue("ok");
    await expect(withWriteConflictRetry(op, { delaiBaseMs: 1 })).resolves.toBe("ok");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("ne rejoue JAMAIS une autre erreur — rejouer ce qu'on ne comprend pas double les effets de bord", async () => {
    const metier = Object.assign(new Error("CAPACITY_EXCEEDED"), { code: "BUSINESS" });
    const op = jest.fn().mockRejectedValue(metier);
    await expect(withWriteConflictRetry(op, { delaiBaseMs: 1 })).rejects.toBe(metier);
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("s'arrête après le nombre de tentatives et remonte le conflit d'origine", async () => {
    const dernier = conflit();
    const op = jest.fn().mockRejectedValue(dernier);
    await expect(withWriteConflictRetry(op, { tentatives: 3, delaiBaseMs: 1 })).rejects.toBe(dernier);
    expect(op).toHaveBeenCalledTimes(3);
  });
});

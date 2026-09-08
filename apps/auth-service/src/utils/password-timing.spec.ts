import { comparePasswordConstantTime } from "./password-timing";
import bcrypt from "bcryptjs";

/**
 * ANO-API-18 (recette API 08/09/2026, fiche API-SEC-14, bloquante) — la connexion mesurait
 * 168,6 ms pour une adresse connue contre 20,4 ms pour une inconnue : le corps était
 * identique, mais le chronomètre disait tout. Cause : `if (!user) return` AVANT
 * `bcrypt.compare`, donc seul un compte existant payait le hachage.
 */
describe("comparePasswordConstantTime (ANO-API-18)", () => {
  const hash = bcrypt.hashSync("Yamba-Dev-2026!", 10);

  it("accepte le bon mot de passe d'un compte existant", async () => {
    await expect(comparePasswordConstantTime("Yamba-Dev-2026!", hash)).resolves.toBe(true);
  });

  it("refuse un mauvais mot de passe", async () => {
    await expect(comparePasswordConstantTime("mauvais", hash)).resolves.toBe(false);
  });

  it.each([null, undefined, ""])("refuse quand il n'y a pas de hachage (%p)", async (absent) => {
    await expect(comparePasswordConstantTime("n'importe quoi", absent)).resolves.toBe(false);
  });

  it("le compte ABSENT paie le même prix que le compte existant", async () => {
    // C'est tout l'objet du correctif : sans le hachage leurre, ce chemin coûtait ~10 fois
    // moins cher et l'écart suffisait à énumérer les comptes.
    const chrono = async (h: string | null) => {
      const t0 = process.hrtime.bigint();
      await comparePasswordConstantTime("un-mot-de-passe-quelconque", h);
      return Number(process.hrtime.bigint() - t0) / 1e6;
    };
    const existant = await chrono(hash);
    const absent = await chrono(null);
    const rapport = Math.max(existant, absent) / Math.max(1, Math.min(existant, absent));
    expect(rapport).toBeLessThan(3); // large : on refuse l'ordre de grandeur, pas le bruit
  });
});

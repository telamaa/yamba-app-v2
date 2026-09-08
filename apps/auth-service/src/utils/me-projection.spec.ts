import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ME_EXCLUDED_FIELDS, ME_RELATION_FIELDS, ME_USER_SELECT } from "./me-projection";

/**
 * ANO-API-06 (recette API 08/09/2026, fiche API-AUTH-09, bloquante).
 *
 * Le défaut n'était pas qu'un champ précis fuyait : c'était que la réponse suivait le
 * modèle Prisma. Un test qui vérifierait seulement l'absence de `totpSecretEncrypted`
 * raterait le prochain champ sensible ajouté au modèle. Celui-ci lit donc le schéma et
 * exige que CHAQUE champ de `User` soit classé — renvoyé ou explicitement exclu.
 */
describe("ME_USER_SELECT — la réponse de /auth/me est une liste blanche, pas une soustraction", () => {
  const champsDuModele = (): string[] => {
    const schema = readFileSync(join(__dirname, "../../../../prisma/schema.prisma"), "utf-8");
    const bloc = /^model User \{(.*?)^\}/ms.exec(schema);
    if (!bloc) throw new Error("modèle User introuvable dans prisma/schema.prisma");
    return bloc[1]
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
      .map((l) => l.split(/\s+/)[0]);
  };

  it("tout champ du modèle User est soit renvoyé, soit explicitement exclu", () => {
    const connus = new Set<string>([
      ...Object.keys(ME_USER_SELECT),
      ...Object.keys(ME_EXCLUDED_FIELDS),
      ...ME_RELATION_FIELDS,
      // relations de collection, jamais chargées par /auth/me
      "addresses", "trips", "reviewsReceived", "reviewsGiven", "following", "followers",
      "savedRoutes", "tripFavorites", "identities", "consentLogs",
    ]);
    const nonClasses = champsDuModele().filter((c) => !connus.has(c));
    expect(nonClasses).toEqual([]); // ← un champ ajouté au modèle doit être classé ici
  });

  it("aucun secret ne peut être renvoyé par mégarde", () => {
    const renvoyes = Object.keys(ME_USER_SELECT);
    for (const motif of [/passwordHash/i, /totpSecret/i, /BackupCode/i, /Encrypted$/i, /deliveryCode/i]) {
      expect(renvoyes.filter((c) => motif.test(c))).toEqual([]);
    }
  });

  it("la modération INTERNE reste interne (D56) : rien de `suspensionProposed*` ne sort", () => {
    expect(Object.keys(ME_USER_SELECT).filter((c) => c.startsWith("suspensionProposed"))).toEqual([]);
    expect(Object.keys(ME_USER_SELECT)).not.toContain("suspendedByAdminId");
  });

  it("une sanction PRONONCÉE reste lisible par le membre qui la subit", () => {
    expect(ME_USER_SELECT).toHaveProperty("suspendedAt");
    expect(ME_USER_SELECT).toHaveProperty("suspensionReason");
    expect(ME_USER_SELECT).toHaveProperty("suspensionUntil");
  });

  it("chaque exclusion porte sa raison, en clair", () => {
    for (const [champ, raison] of Object.entries(ME_EXCLUDED_FIELDS)) {
      expect(typeof raison).toBe("string");
      expect(raison.length).toBeGreaterThan(10);
      expect(ME_USER_SELECT).not.toHaveProperty(champ);
    }
  });
});

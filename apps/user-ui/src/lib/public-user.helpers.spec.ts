/**
 * public-user.helpers.spec.ts — le profil public (A224 lot 4).
 * ==============================================================
 * Ce module décide de ce qu'un inconnu lit sur quelqu'un à qui il
 * s'apprête à confier un colis : son ancienneté, sa note globale, ses
 * initiales.
 *
 * Il portait la TROISIÈME copie du défaut de D88 — et c'est la découverte
 * du lot : le 08/11, le téléphone a été corrigé ; ce matin, le lot 3 a
 * corrigé `public-trip.helpers.ts` en croyant traiter « le jumeau ». Il y en
 * avait DEUX, et le troisième servait la page la plus publique du produit.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import {
  calculateGlobalRating,
  formatMemberSince,
  formatRelativeDate,
  formatRouteLabel,
  getInitials,
  getTripDetailHref,
  getUserProfileHref,
} from "@/lib/public-user.helpers";
import type { PublicUser } from "@/lib/public-user.types";

const SRC = resolve(__dirname, "..");

describe("getInitials — le défaut de D88, troisième copie", () => {
  it("ne garde qu’une lettre de chaque, même sur un nom complet", () => {
    expect(getInitials("Marven", "MABIALA")).toBe("MM");
  });

  it("met en capitale et ignore les espaces de tête", () => {
    expect(getInitials("  marven", "  mabiala")).toBe("MM");
  });

  it("rend « ? » plutôt que rien", () => {
    expect(getInitials("", "")).toBe("?");
  });

  it("il n’existe qu’UNE implémentation à deux arguments par front", () => {
    // La fiche qui aurait évité les trois copies. On compte, on ne se fie
    // pas à la mémoire — même méthode que D105 pour les flèches de retour.
    const fichiers = (function balaie(d: string): string[] {
      return readdirSync(d).flatMap((e) => {
        const p = join(d, e);
        if (statSync(p).isDirectory()) return balaie(p);
        return /\.tsx?$/.test(p) && !p.endsWith(".spec.ts") ? [p] : [];
      });
    })(SRC);

    const implementations = fichiers.filter((f) =>
      /function getInitials\(\s*\w+\s*:\s*string\s*,/.test(readFileSync(f, "utf8"))
    );
    expect(implementations.map((f) => relative(SRC, f))).toEqual([
      "lib/public-trip.helpers.ts",
    ]);
  });

  it("la variante à UN argument reste, et c’est une décision", () => {
    // `TripPublicPreview` reçoit un nom d'affichage complet (« Marven M. »)
    // et le découpe lui-même : signature différente, besoin différent. On la
    // NOMME plutôt que de la laisser passer pour un oubli.
    const apercu = readFileSync(
      join(SRC, "components/trips/create/TripPublicPreview.tsx"),
      "utf8"
    );
    expect(apercu).toMatch(/function getInitials\(name\?:/);
  });
});

describe("calculateGlobalRating — une note qui n’invente rien", () => {
  const user = (p: Partial<PublicUser>): PublicUser => p as PublicUser;
  const note = (average: number, count: number) => ({ average, count });

  it("rend null quand la personne n’a aucune note", () => {
    // Afficher « 0 étoile » accuserait quelqu'un qui n'a simplement pas
    // encore voyagé — même doctrine que D99 2A sur « Nouveau Voyageur ».
    expect(calculateGlobalRating(user({ shipperRating: note(0, 0) }))).toBeNull();
  });

  it("ne TOMBE pas quand un rôle manque — les deux sont traités pareil", () => {
    // Le défaut trouvé ici : `tripperRating` était lu avec précaution et
    // `shipperRating` sans. Un profil servi sans ce champ faisait tomber la
    // page publique.
    expect(() => calculateGlobalRating(user({}))).not.toThrow();
    expect(calculateGlobalRating(user({}))).toBeNull();
    expect(() => calculateGlobalRating(user({ tripperRating: note(4, 2) }))).not.toThrow();
  });

  it("une seule note suffit à produire une moyenne", () => {
    const r = calculateGlobalRating(user({ tripperRating: note(4.5, 2) }));
    expect(r).not.toBeNull();
    expect((r as { average: number }).average).toBeCloseTo(4.5, 2);
  });

  it("elle PONDÈRE par le nombre de votes, elle ne moyenne pas les moyennes", () => {
    // 5,0 sur un seul avis et 3,0 sur quatre-vingt-dix-neuf ne font pas 4,0 :
    // ce serait offrir une réputation à qui n'en a pas encore.
    const r = calculateGlobalRating(
      user({ tripperRating: note(5, 1), shipperRating: note(3, 99) })
    );
    expect((r as { average: number }).average).toBeLessThan(3.2);
  });

  it("le total des votes est la SOMME des deux rôles", () => {
    const r = calculateGlobalRating(
      user({ tripperRating: note(4, 3), shipperRating: note(5, 7) })
    );
    expect((r as { count: number }).count).toBe(10);
  });
});

describe("les dates du profil ne disent jamais « Invalid Date »", () => {
  it("l’ancienneté s’écrit dans la langue", () => {
    const fr = formatMemberSince("2026-03-15T10:00:00.000Z", "fr");
    const en = formatMemberSince("2026-03-15T10:00:00.000Z", "en");
    expect(fr).toMatch(/2026/);
    expect(fr).not.toBe(en);
  });

  it("une date illisible produit le silence", () => {
    for (const brut of ["", "pas une date", "2026-13-45"]) {
      const rendu = formatMemberSince(brut, "fr");
      expect(rendu).not.toContain("Invalid");
      expect(rendu).not.toContain("NaN");
    }
  });

  it("une date relative illisible aussi", () => {
    for (const brut of ["", "pas une date"]) {
      const rendu = formatRelativeDate(brut, "fr");
      expect(rendu).not.toContain("Invalid");
      expect(rendu).not.toContain("NaN");
    }
  });
});

describe("les liens du profil restent INTERNES", () => {
  it("ils commencent par « / » et ne sortent jamais du site", () => {
    // Un identifiant venu de l'API se retrouve dans une URL : si rien ne le
    // contraint, une valeur hostile fabrique un lien vers ailleurs.
    expect(getTripDetailHref("abc123")).toMatch(/^\//);
    expect(getUserProfileHref("marven-m")).toMatch(/^\//);
  });

  it("ils n’acceptent pas de se faire détourner", () => {
    for (const hostile of ["//evil.com", "https://evil.com"]) {
      const href = getUserProfileHref(hostile);
      expect(href.startsWith("//")).toBe(false);
      expect(href).not.toMatch(/^https?:/);
    }
  });
});

describe("formatRouteLabel — le corridor se lit d’un coup d’œil", () => {
  it("met la flèche entre les deux villes", () => {
    const label = formatRouteLabel({
      originCity: "Paris",
      destinationCity: "Brazzaville",
    } as never);
    expect(label).toContain("Paris");
    expect(label).toContain("Brazzaville");
  });
});

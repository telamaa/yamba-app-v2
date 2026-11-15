/**
 * public-trip.helpers.spec.ts — ce que la page publique d'un trajet affiche (A224 lot 3).
 * ========================================================================================
 * 247 lignes, le plus gros fichier pur du site, et il décide de trois choses
 * qu'un Expéditeur lit avant de réserver : un **prix**, une **date**, et
 * l'**identité** de la personne à qui il confierait son colis.
 *
 * La fiche la plus utile de ce fichier est la dernière : elle a trouvé une
 * divergence avec le téléphone sur une fonction que D88 avait corrigée là-bas
 * trois jours plus tôt, sans que personne regarde le jumeau du site.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  calculateDistanceKm,
  formatMemberSince,
  formatPrice,
  formatPriceShort,
  getInitials,
} from "@/lib/public-trip.helpers";

describe("formatPrice — un prix porte toujours ses centimes", () => {
  it("écrit deux décimales, dans la langue", () => {
    expect(formatPrice(2485, "EUR", "fr")).toContain("24,85");
    expect(formatPrice(2485, "EUR", "en")).toContain("24.85");
  });

  it("complète un montant rond plutôt que de le raccourcir", () => {
    // Même règle que D99 1A : « 25 » et « 25,00 » ne disent pas la même chose
    // quand le second sera comparé au prix définitif du paiement.
    expect(formatPrice(2500, "EUR", "fr")).toContain("25,00");
  });

  it("un prix ABSENT se lit comme absent, jamais comme zéro", () => {
    // « 0,00 € » annoncerait la gratuité. Le tiret dit qu'on ne sait pas.
    expect(formatPrice(null)).toBe("-");
    expect(formatPrice(undefined)).toBe("-");
  });

  it("zéro reste zéro — c'est une information, pas une absence", () => {
    expect(formatPrice(0, "EUR", "fr")).not.toBe("-");
  });

  it("une devise inconnue ne fait pas tomber la page", () => {
    // `Intl.NumberFormat` lève sur un code de devise invalide : le repli
    // doit rendre un texte lisible plutôt qu'une page blanche.
    const rendu = formatPrice(2485, "XXXX" as string, "fr");
    expect(typeof rendu).toBe("string");
    expect(rendu.length).toBeGreaterThan(0);
  });
});

describe("formatPriceShort — court, mais jamais trompeur", () => {
  it("laisse tomber les décimales d'un montant rond", () => {
    expect(formatPriceShort(2500, "EUR", "fr")).not.toContain("00");
  });

  it("les garde dès qu'il y a des centimes", () => {
    expect(formatPriceShort(2485, "EUR", "fr")).toContain("24,85");
  });

  it("ne raccourcit jamais au point de changer le montant", () => {
    // Le piège d'un format « court » : arrondir 24,85 en « 25 € ».
    expect(formatPriceShort(2485, "EUR", "en")).toContain("24.85");
  });

  it("une absence reste une absence", () => {
    expect(formatPriceShort(null)).toBe("-");
  });
});

describe("calculateDistanceKm — une distance, ou rien", () => {
  it("mesure un corridor connu dans le bon ordre de grandeur", () => {
    const km = calculateDistanceKm(48.8566, 2.3522, -4.2634, 15.2429);
    expect(km).not.toBeNull();
    expect(km as number).toBeGreaterThan(5700);
    expect(km as number).toBeLessThan(6100);
  });

  it("rend null plutôt que NaN quand une coordonnée manque", () => {
    // NaN se propagerait jusqu'à l'affichage et s'écrirait tel quel.
    expect(calculateDistanceKm(null, 2.35, 48.85, 2.35)).toBeNull();
    expect(calculateDistanceKm(undefined, undefined, undefined, undefined)).toBeNull();
  });
});

describe("formatMemberSince — une date d'ancienneté, ou le silence", () => {
  it("écrit le mois et l'année dans la langue", () => {
    expect(formatMemberSince("2026-03-15T10:00:00.000Z", "fr")).toMatch(/2026/);
    expect(formatMemberSince("2026-03-15T10:00:00.000Z", "en")).toMatch(/2026/);
    expect(formatMemberSince("2026-03-15T10:00:00.000Z", "fr")).not.toBe(
      formatMemberSince("2026-03-15T10:00:00.000Z", "en")
    );
  });

  it("une date absente ou illisible rend une chaîne VIDE", () => {
    // Pas « Invalid Date » sur une fiche publique — c'est le genre de texte
    // qui arrive jusqu'en production parce qu'il faut un compte abîmé pour
    // le voir.
    expect(formatMemberSince(null)).toBe("");
    expect(formatMemberSince("pas une date")).toBe("");
    expect(formatMemberSince("")).toBe("");
  });
});

describe("getInitials — le défaut de D88, rejoué sur le site", () => {
  // D88 (08/11) : `getInitials` recevait un NOM COMPLET de `/auth/me` là où sa
  // signature attendait une initiale déjà tronquée, et « Marven MABIALA »
  // donnait « MMABIALA » dans la pastille d'identité. Corrigé sur le
  // téléphone. **Personne n'a regardé le jumeau du site**, qui portait le
  // même nom de fonction et recopiait son second argument TEL QUEL.
  it("ne garde qu'une lettre de chaque, même si on lui donne un nom complet", () => {
    expect(getInitials("Marven", "MABIALA")).toBe("MM");
    expect(getInitials("Marven", "Mabiala")).toBe("MM");
  });

  it("met en capitale ce qu'on lui donne en minuscule", () => {
    expect(getInitials("marven", "mabiala")).toBe("MM");
  });

  it("ignore les espaces de tête, qui produisaient une initiale vide", () => {
    expect(getInitials("  Marven", "  Mabiala")).toBe("MM");
    expect(getInitials(" ", " ")).toBe("?");
  });

  it("tient sur un prénom ou un nom composé", () => {
    expect(getInitials("Jean-Pierre", "Da Silva")).toBe("JD");
  });

  it("met l'accent en capitale", () => {
    expect(getInitials("Élodie", "Évrard")).toBe("ÉÉ");
  });

  it("rend « ? » plutôt que rien quand il n'y a rien", () => {
    // Une pastille vide se lit comme un défaut d'affichage.
    expect(getInitials("", "")).toBe("?");
  });

  it("les DEUX fronts appliquent désormais la même règle", () => {
    // La fiche qui aurait trouvé la divergence : on compare le CORPS des deux
    // implémentations, pas leur sortie — c'est la règle qui doit être la
    // même, et c'est elle qui avait divergé.
    const WEB = resolve(__dirname, "..", "..");
    const MOBILE = resolve(WEB, "../mobile");
    const corps = (source: string) => {
      const debut = source.indexOf("export function getInitials");
      expect(debut).toBeGreaterThanOrEqual(0);
      const fin = source.indexOf("\n}", debut);
      expect(fin).toBeGreaterThan(debut);
      return source
        .slice(debut, fin)
        .replace(/["']/g, "'")
        .replace(/\s+/g, " ")
        .replace(/lastNameOrInitial|lastInitial/g, "nom");
    };
    const duSite = corps(readFileSync(join(WEB, "src/lib/public-trip.helpers.ts"), "utf8"));
    const duTel = corps(readFileSync(join(MOBILE, "src/lib/trip-format.ts"), "utf8"));
    expect(duSite).toBe(duTel);
  });
});

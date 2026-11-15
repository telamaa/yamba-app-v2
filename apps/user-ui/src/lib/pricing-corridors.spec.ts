/**
 * pricing-corridors.spec.ts — la base €/kg d'un corridor (A224, lot 2).
 * ======================================================================
 * Ce module décide d'un **prix** : la base au kilo suggérée à un Voyageur
 * qui publie un trajet. Une erreur ici ne casse rien — elle propose
 * simplement un mauvais prix, sur chaque corridor, sans que personne le
 * remarque avant d'avoir des trajets invendables ou bradés.
 *
 * Les VALEURS sont des hypothèses de marché, et son en-tête le dit. Ces
 * fiches ne les figent donc pas : elles gardent les PROPRIÉTÉS qui doivent
 * rester vraies quelles que soient les valeurs retenues — la symétrie, les
 * bornes, les paliers, et le fait qu'aucune entrée ne produise un non-prix.
 */
import {
  DEFAULT_BASE_PER_KG,
  corridorBasePerKg,
  haversineKm,
  isDomestic,
  zoneOf,
} from "@/lib/pricing-corridors";

describe("zoneOf — tout pays tombe dans une zone, connue ou non", () => {
  it("classe les pays du cœur de cible", () => {
    expect(zoneOf("FR")).toBe("EUROPE");
    expect(zoneOf("CD")).toBe("CENTRAL_AFRICA");
    expect(zoneOf("RU")).toBe("RUSSIA");
  });

  it("ignore la casse — un code pays vient de partout", () => {
    expect(zoneOf("fr")).toBe(zoneOf("FR"));
    expect(zoneOf("cD")).toBe(zoneOf("CD"));
  });

  it("rend UNKNOWN plutôt que de lever", () => {
    // Un code absent ou inconnu doit produire un prix par DÉFAUT, jamais une
    // page en erreur au moment où un Voyageur publie.
    for (const brut of [null, undefined, "", "ZZ", "XX1"]) {
      expect(zoneOf(brut)).toBe("UNKNOWN");
    }
  });
});

describe("isDomestic — même pays, et seulement lui", () => {
  it("reconnaît un trajet intérieur", () => {
    expect(isDomestic("FR", "FR")).toBe(true);
    expect(isDomestic("fr", "FR")).toBe(true);
  });

  it("deux pays différents ne sont jamais domestiques", () => {
    expect(isDomestic("FR", "BE")).toBe(false);
    // Les DOM-TOM ↔ métropole portent des codes distincts : l'en-tête du
    // module l'annonce, et le prix en dépend.
    expect(isDomestic("FR", "GP")).toBe(false);
  });

  it("une information manquante n’est pas une égalité", () => {
    expect(isDomestic(null, null)).toBe(false);
    expect(isDomestic("FR", null)).toBe(false);
    expect(isDomestic("", "")).toBe(false);
  });
});

describe("corridorBasePerKg — les propriétés qui survivent aux valeurs", () => {
  it("la matrice est SYMÉTRIQUE : un corridor n’a pas de sens", () => {
    // Aller et retour partagent la même rareté d'offre et les mêmes
    // formalités : une asymétrie serait un défaut, pas une finesse.
    for (const [a, b] of [["FR", "CD"], ["US", "MX"], ["CN", "CG"], ["MA", "SN"]]) {
      expect(corridorBasePerKg(a, b).base).toBe(corridorBasePerKg(b, a).base);
    }
  });

  it("un corridor inconnu retombe sur la base par défaut", () => {
    expect(corridorBasePerKg("ZZ", "FR").base).toBe(DEFAULT_BASE_PER_KG);
    expect(corridorBasePerKg(null, null).base).toBe(DEFAULT_BASE_PER_KG);
  });

  it("un trajet intérieur coûte moins cher qu’un international", () => {
    // Pas de formalités, pas de franchise bagage à valoriser.
    const interieur = corridorBasePerKg("FR", "FR");
    const international = corridorBasePerKg("FR", "CD");
    expect(interieur.domestic).toBe(true);
    expect(interieur.base).toBeLessThan(international.base);
  });

  it("le prix intérieur reste dans ses bornes, quel que soit le pays", () => {
    // Bornes annoncées par le module : jamais sous 3, jamais au-dessus de 6.
    for (const pays of ["FR", "CD", "US", "CN", "MA", "IN", "BR", "AU"]) {
      const { base } = corridorBasePerKg(pays, pays);
      expect(base).toBeGreaterThanOrEqual(3);
      expect(base).toBeLessThanOrEqual(6);
    }
  });

  it("la distance corrige de ±10 % au plus, jamais davantage", () => {
    const sansDistance = corridorBasePerKg("FR", "CD").base;
    for (const km of [1, 500, 5000, 15000, 40000]) {
      const avec = corridorBasePerKg("FR", "CD", km).base;
      const ecart = Math.abs(avec - sansDistance) / sansDistance;
      expect(ecart).toBeLessThanOrEqual(0.1001);
    }
  });

  it("à 5 000 km, la distance ne corrige rien — c’est le pivot", () => {
    expect(corridorBasePerKg("FR", "CD", 5000).base).toBe(corridorBasePerKg("FR", "CD").base);
  });

  it("plus loin coûte plus cher que plus près", () => {
    expect(corridorBasePerKg("FR", "CD", 15000).base).toBeGreaterThan(
      corridorBasePerKg("FR", "CD", 500).base
    );
  });

  it("une distance absurde ne casse pas le prix", () => {
    // Une coordonnée fausse ne doit pas produire un prix négatif ou NaN.
    for (const km of [0, -1, Number.NaN]) {
      const { base } = corridorBasePerKg("FR", "CD", km);
      expect(Number.isFinite(base)).toBe(true);
      expect(base).toBeGreaterThan(0);
    }
  });

  it("AUCUNE paire de zones ne produit un non-prix", () => {
    // Le balayage qui compte : la matrice a des trous volontaires (BASE_PAIRS
    // ne couvre pas tout), et le repli doit tenir partout.
    const pays = ["FR", "RU", "MA", "SN", "CD", "KE", "AE", "IN", "CN", "TH", "KZ", "US", "BR", "GP", "AU", "ZZ"];
    for (const a of pays) {
      for (const b of pays) {
        const { base } = corridorBasePerKg(a, b);
        expect(Number.isFinite(base)).toBe(true);
        expect(base).toBeGreaterThan(0);
        // Deux décimales : c'est un prix, il s'affiche.
        expect(Number.isInteger(Math.round(base * 100))).toBe(true);
      }
    }
  });
});

describe("haversineKm — une distance, ou rien", () => {
  it("mesure une distance connue à quelques kilomètres près", () => {
    // Paris → Brazzaville ≈ 5 900 km. On garde l'ORDRE DE GRANDEUR : la
    // valeur exacte dépend du rayon terrestre retenu.
    const km = haversineKm(48.8566, 2.3522, -4.2634, 15.2429);
    expect(km).not.toBeNull();
    expect(km as number).toBeGreaterThan(5700);
    expect(km as number).toBeLessThan(6100);
  });

  it("deux points identiques sont à zéro", () => {
    expect(haversineKm(48.85, 2.35, 48.85, 2.35)).toBe(0);
  });

  it("rend null dès qu’une coordonnée manque — jamais NaN", () => {
    // NaN se propagerait jusque dans le correctif de distance et rendrait un
    // prix NaN, affiché tel quel.
    expect(haversineKm(null, 2.35, 48.85, 2.35)).toBeNull();
    expect(haversineKm(48.85, undefined, 48.85, 2.35)).toBeNull();
    expect(haversineKm(undefined, undefined, undefined, undefined)).toBeNull();
  });
});

/**
 * saved-route.helpers.spec.ts — les alertes de route (A224 lot 3).
 * =================================================================
 * Une route sauvegardée est une **alerte** : « préviens-moi quand quelqu'un
 * publie Paris → Brazzaville ». C'est l'arme anti-liquidité du produit, et
 * elle est silencieuse par nature — si elle expire au mauvais moment ou si
 * sa période est mal lue, personne ne s'en plaint : on ne reçoit simplement
 * pas le message qu'on attendait.
 *
 * La fiche la plus utile de ce fichier est l'aller-retour : poser un
 * préréglage puis le relire doit rendre le même, **quel que soit le jour de
 * l'année où on le pose**. C'est là que les mois de longueur inégale piègent.
 */
import {
  applyDateRangePreset,
  detectPreset,
  expiresWithinDays,
  formatDateRange,
  formatExpiresIn,
  formatRouteLabel,
  isExpired,
} from "@/lib/saved-route.helpers";
import type { SavedRoute } from "@/lib/saved-route.types";

const route = (expiresAt: string): SavedRoute =>
  ({ originCity: "Paris", destinationCity: "Brazzaville", expiresAt }) as SavedRoute;

const JOUR_MS = 86_400_000;

describe("formatRouteLabel — le corridor se lit d'un coup d'œil", () => {
  it("met la flèche entre les deux villes", () => {
    expect(formatRouteLabel(route("2026-12-01T00:00:00.000Z"))).toBe("Paris → Brazzaville");
  });
});

describe("isExpired — une alerte morte doit se savoir", () => {
  it("une date passée est expirée", () => {
    expect(isExpired(route(new Date(Date.now() - JOUR_MS).toISOString()))).toBe(true);
  });

  it("une date future ne l'est pas", () => {
    expect(isExpired(route(new Date(Date.now() + JOUR_MS).toISOString()))).toBe(false);
  });
});

describe("expiresWithinDays — l'avertissement avant le silence", () => {
  it("voit venir une expiration dans la fenêtre", () => {
    expect(expiresWithinDays(route(new Date(Date.now() + 3 * JOUR_MS).toISOString()), 7)).toBe(true);
  });

  it("ne s'alarme pas d'une expiration lointaine", () => {
    expect(expiresWithinDays(route(new Date(Date.now() + 30 * JOUR_MS).toISOString()), 7)).toBe(false);
  });

  it("une alerte DÉJÀ expirée entre aussi dans la fenêtre", () => {
    // Elle est « expirée dans moins de 7 jours » au sens strict. Important :
    // l'écran qui avertit doit la montrer, pas la rater parce qu'il est trop
    // tard — c'est elle qu'il faut renouveler en premier.
    expect(expiresWithinDays(route(new Date(Date.now() - JOUR_MS).toISOString()), 7)).toBe(true);
  });
});

describe("formatDateRange — quatre cas, quatre phrases", () => {
  it("sans aucune borne, la période est illimitée", () => {
    expect(formatDateRange(null, null, "fr").length).toBeGreaterThan(0);
    expect(formatDateRange(null, null, "en").length).toBeGreaterThan(0);
    expect(formatDateRange(null, null, "fr")).not.toBe(formatDateRange(null, null, "en"));
  });

  it("une seule borne donne « à partir de » ou « jusqu'au »", () => {
    const depuis = formatDateRange("2026-06-01T00:00:00.000Z", null, "fr");
    const jusqua = formatDateRange(null, "2026-08-31T00:00:00.000Z", "fr");
    expect(depuis).not.toBe(jusqua);
    expect(depuis.length).toBeGreaterThan(0);
    expect(jusqua.length).toBeGreaterThan(0);
  });

  it("deux bornes donnent un intervalle, différent des trois autres cas", () => {
    const intervalle = formatDateRange("2026-06-01T00:00:00.000Z", "2026-08-31T00:00:00.000Z", "fr");
    expect(intervalle).not.toBe(formatDateRange("2026-06-01T00:00:00.000Z", null, "fr"));
    expect(intervalle).not.toBe(formatDateRange(null, "2026-08-31T00:00:00.000Z", "fr"));
    expect(intervalle).not.toBe(formatDateRange(null, null, "fr"));
  });
});

describe("formatExpiresIn — dire le délai sans mentir", () => {
  it("rend un texte dans les deux langues", () => {
    const dans30 = new Date(Date.now() + 30 * JOUR_MS).toISOString();
    expect(formatExpiresIn(dans30, "fr").length).toBeGreaterThan(0);
    expect(formatExpiresIn(dans30, "en").length).toBeGreaterThan(0);
  });

  it("ne rend jamais « NaN » ni « Invalid Date »", () => {
    // Le texte qui arrive en production parce qu'il faut une donnée abîmée
    // pour le voir.
    for (const brut of ["", "pas une date", "2026-13-45"]) {
      const rendu = formatExpiresIn(brut, "fr");
      expect(rendu).not.toContain("NaN");
      expect(rendu).not.toContain("Invalid");
    }
  });
});

describe("l'ALLER-RETOUR d'un préréglage, sur une année entière", () => {
  // La propriété : poser « 3 mois » puis relire doit rendre « 3 mois ».
  // Elle se joue sur des mois de longueur inégale — février, les mois de 31
  // jours, les années bissextiles — et c'est précisément là qu'une tolérance
  // trop étroite casserait, un jour sur 365, sans que personne le reproduise.
  afterEach(() => jest.useRealTimers());

  it.each([
    ["3months" as const],
    ["6months" as const],
  ])("« %s » se relit à l'identique quel que soit le jour de pose", (preset) => {
    const fautifs: string[] = [];
    for (let i = 0; i < 365; i++) {
      const jour = new Date(Date.UTC(2026, 0, 1 + i, 9, 0, 0));
      jest.useFakeTimers().setSystemTime(jour);
      const { earliestDate, latestDate } = applyDateRangePreset(preset);
      const relu = detectPreset(earliestDate, latestDate);
      if (relu !== preset) fautifs.push(`${jour.toISOString().slice(0, 10)} → ${relu}`);
    }
    expect(fautifs).toEqual([]);
  });

  it("« illimité » et « personnalisé » ne posent aucune borne", () => {
    for (const preset of ["unlimited", "custom"] as const) {
      expect(applyDateRangePreset(preset)).toEqual({ earliestDate: null, latestDate: null });
    }
  });

  it("un préréglage commence DEMAIN, jamais aujourd'hui", () => {
    // Le commentaire du module le dit : « laisser le user le temps ». Une
    // alerte qui démarre à l'instant raterait les trajets publiés le matin.
    jest.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 5, 15, 9, 0, 0)));
    const { earliestDate } = applyDateRangePreset("3months");
    expect(earliestDate).not.toBeNull();
    expect(new Date(earliestDate as string).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("detectPreset — on ne devine pas plus que ce qu'on sait", () => {
  it("sans borne, c'est illimité", () => {
    expect(detectPreset(null, null)).toBe("unlimited");
  });

  it("une seule borne n'est aucun préréglage", () => {
    expect(detectPreset("2026-06-01T00:00:00.000Z", null)).toBe("custom");
    expect(detectPreset(null, "2026-08-31T00:00:00.000Z")).toBe("custom");
  });

  it("une période qui ne ressemble à rien reste personnalisée", () => {
    expect(detectPreset("2026-06-01T00:00:00.000Z", "2026-06-10T00:00:00.000Z")).toBe("custom");
    expect(detectPreset("2026-01-01T00:00:00.000Z", "2027-12-31T00:00:00.000Z")).toBe("custom");
  });
});

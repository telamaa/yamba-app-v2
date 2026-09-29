import {
  FEED_PARAMS,
  PROXIMITY_RINGS,
  departurePlayability,
  pricePercentiles,
  qualityScore,
  rankFeedWindow,
  remainingKgOf,
  ringFor,
  type FeedAnchor,
  type FeedTripInput,
} from "./feed-ranking";

/**
 * D80 — le classement du flux d'atterrissage localisé, en vecteurs purs.
 * Les propriétés non négociables : le PLEIN coule mais n'est JAMAIS exclu (ANO-API-11),
 * l'ANNEAU domine le score, le sans-note reçoit un prior neutre, l'ordre est déterministe
 * (A199) et la diversité du flux découverte DÉMEUT sans jamais retirer.
 */

const NOW = new Date("2026-09-29T12:00:00Z");
const inDays = (d: number) => new Date(NOW.getTime() + d * 86_400_000);

/** Douala, notre ancrage de référence. */
const DOUALA: FeedAnchor = { lat: 4.0511, lng: 9.7679, city: "Douala", countryCode: "CM", source: "ip" };

let seq = 0;
function trip(overrides: Partial<FeedTripInput> = {}): FeedTripInput {
  seq += 1;
  return {
    id: String(seq).padStart(24, "0"),
    departureAt: inDays(3),
    createdAt: inDays(-1),
    capacityKg: 20,
    reservedKg: 0,
    comparablePriceCents: 2_000,
    carrierRatingSnapshot: null,
    instantBooking: false,
    ticketVerificationStatus: "NOT_SUBMITTED",
    originLat: 4.0511, // Douala
    originLng: 9.7679,
    originCity: "Douala",
    originCountryCode: "CM",
    destinationCity: "Paris",
    destinationCountryCode: "FR",
    carrierPage: null,
    ...overrides,
  };
}

beforeEach(() => {
  seq = 0;
});

describe("ringFor — les anneaux de proximité", () => {
  it("même ville : le départ à moins de 25 km de l'ancrage", () => {
    expect(ringFor(trip(), DOUALA)).toBe("SAME_CITY");
  });

  it("proche : Édéa (~55 km de Douala)", () => {
    expect(ringFor(trip({ originLat: 3.8, originLng: 10.13, originCity: "Édéa" }), DOUALA)).toBe("NEARBY");
  });

  it("proche reste PUREMENT métrique : 80 km transfrontaliers SONT à proximité", () => {
    const frontiere = trip({ originLat: 4.05, originLng: 9.05, originCountryCode: "GQ" }); // ~80 km, autre pays
    expect(ringFor(frontiere, DOUALA)).toBe("NEARBY");
  });

  it("région : Yaoundé (~210 km, même pays)", () => {
    expect(ringFor(trip({ originLat: 3.87, originLng: 11.52, originCity: "Yaoundé" }), DOUALA)).toBe("REGION");
  });

  it("région exige le MÊME pays : 210 km au-delà d'une frontière → international", () => {
    expect(ringFor(trip({ originLat: 3.87, originLng: 11.52, originCountryCode: "GA" }), DOUALA)).toBe("ELSEWHERE");
  });

  it("pays : Garoua (~830 km, même pays)", () => {
    expect(ringFor(trip({ originLat: 9.3, originLng: 13.4, originCity: "Garoua" }), DOUALA)).toBe("COUNTRY");
  });

  it("international : Paris", () => {
    expect(ringFor(trip({ originLat: 48.85, originLng: 2.35, originCountryCode: "FR" }), DOUALA)).toBe("ELSEWHERE");
  });

  it("sans coordonnées, dégrade sur le pays — jamais un trou", () => {
    expect(ringFor(trip({ originLat: null, originLng: null }), DOUALA)).toBe("COUNTRY");
    expect(ringFor(trip({ originLat: null, originLng: null, originCountryCode: "FR" }), DOUALA)).toBe("ELSEWHERE");
    expect(ringFor(trip({ originLat: null, originLng: null, originCountryCode: null }), DOUALA)).toBe("ELSEWHERE");
  });
});

describe("departurePlayability — la fenêtre idéale J+1..J+7", () => {
  it("plateau plein de J+1 à J+7", () => {
    expect(departurePlayability(inDays(1), NOW)).toBe(1);
    expect(departurePlayability(inDays(7), NOW)).toBe(1);
  });

  it("un départ dans 2 h est difficilement réservable, mais jamais zéro", () => {
    const dans2h = departurePlayability(new Date(NOW.getTime() + 2 * 3_600_000), NOW);
    expect(dans2h).toBeGreaterThan(0);
    expect(dans2h).toBeLessThan(0.35);
  });

  it("décroît après J+7, avec un plancher (jamais zéro)", () => {
    const j10 = departurePlayability(inDays(10), NOW);
    const j30 = departurePlayability(inDays(30), NOW);
    expect(j10).toBeLessThan(1);
    expect(j30).toBeLessThan(j10);
    expect(j30).toBeGreaterThanOrEqual(0.25);
    expect(departurePlayability(inDays(365), NOW)).toBe(0.25);
  });

  it("sans date de départ : neutre bas, pas un crash", () => {
    expect(departurePlayability(null, NOW)).toBe(0.2);
  });
});

describe("remainingKgOf — le PLEIN se mesure, le legacy jamais", () => {
  it("capacité déclarée : le reste est capacité − réservé", () => {
    expect(remainingKgOf({ capacityKg: 20, reservedKg: 15 })).toBe(5);
    expect(remainingKgOf({ capacityKg: 20, reservedKg: 20 })).toBe(0);
  });

  it("un reservedKg ABSENT (piège Mongo des champs absents) vaut zéro réservé", () => {
    expect(remainingKgOf({ capacityKg: 20, reservedKg: null })).toBe(20);
  });

  it("legacy sans capacité : null — un trajet en slots n'est jamais « plein » au sens kg", () => {
    expect(remainingKgOf({ capacityKg: null, reservedKg: 0 })).toBeNull();
    expect(remainingKgOf({ capacityKg: 0, reservedKg: 0 })).toBeNull();
  });
});

describe("qualityScore — les cinq facteurs", () => {
  const ctx = { now: NOW, pricePercentile: 0.5 as number | null };

  it("le sans-note reçoit un PRIOR NEUTRE : ni enterré, ni favorisé face à un 5★", () => {
    const sansNote = qualityScore(trip({ carrierRatingSnapshot: null }), ctx);
    const troisEtoiles = qualityScore(trip({ carrierRatingSnapshot: 3 }), ctx);
    const cinqEtoiles = qualityScore(trip({ carrierRatingSnapshot: 5 }), ctx);
    expect(sansNote).toBeGreaterThan(troisEtoiles);
    expect(sansNote).toBeLessThan(cinqEtoiles);
  });

  it("les signaux vérifiables s'additionnent (Super Voyageur, vérifié, billet, instantané)", () => {
    const nu = qualityScore(trip(), ctx);
    const pare = qualityScore(
      trip({
        carrierPage: { isSuperCarrier: true, isVerified: true },
        ticketVerificationStatus: "VERIFIED",
        instantBooking: true,
      }),
      ctx
    );
    expect(pare - nu).toBeCloseTo(12, 9); // 5 + 3 + 2 + 2
  });

  it("le prix joue en percentile : moins cher > médian > plus cher, sans prix = neutre", () => {
    const cher = qualityScore(trip(), { now: NOW, pricePercentile: 1 });
    const median = qualityScore(trip(), { now: NOW, pricePercentile: 0.5 });
    const moinsCher = qualityScore(trip(), { now: NOW, pricePercentile: 0 });
    const sansPrix = qualityScore(trip(), { now: NOW, pricePercentile: null });
    expect(moinsCher).toBeGreaterThan(median);
    expect(median).toBeGreaterThan(cher);
    expect(sansPrix).toBeCloseTo(median, 9);
  });

  it("la fraîcheur est la chance des nouveaux : pleine 48 h, éteinte à J+14", () => {
    const neuf = qualityScore(trip({ createdAt: inDays(-1) }), ctx);
    const vieux = qualityScore(trip({ createdAt: inDays(-20) }), ctx);
    expect(neuf - vieux).toBeCloseTo(FEED_PARAMS.weights.freshness, 9);
  });

  it("presque plein (< 2 kg restants) pénalise — le PLEIN, lui, coule via le classement", () => {
    const large = qualityScore(trip({ capacityKg: 20, reservedKg: 5 }), ctx);
    const serre = qualityScore(trip({ capacityKg: 20, reservedKg: 19 }), ctx);
    expect(large - serre).toBeCloseTo(10, 9);
  });
});

describe("pricePercentiles — le rang dans la fenêtre, aucune médiane à maintenir", () => {
  it("le moins cher vaut 0, le plus cher 1, les ex-aequo partagent le rang", () => {
    const a = trip({ comparablePriceCents: 1_000 });
    const b = trip({ comparablePriceCents: 2_000 });
    const b2 = trip({ comparablePriceCents: 2_000 });
    const c = trip({ comparablePriceCents: 3_000 });
    const p = pricePercentiles([c, a, b, b2]);
    expect(p.get(a.id)).toBe(0);
    expect(p.get(c.id)).toBe(1);
    expect(p.get(b.id)).toBe(p.get(b2.id));
  });

  it("les sans-prix n'ont pas de rang (neutres au score), un seul prix vaut 0", () => {
    const seul = trip({ comparablePriceCents: 1_000 });
    const sans = trip({ comparablePriceCents: null });
    const p = pricePercentiles([seul, sans]);
    expect(p.get(seul.id)).toBe(0);
    expect(p.has(sans.id)).toBe(false);
  });
});

describe("rankFeedWindow — l'assemblage", () => {
  it("l'ANNEAU domine le score : un proche modeste passe devant un lointain excellent", () => {
    const lointainExcellent = trip({
      originLat: 48.85, originLng: 2.35, originCountryCode: "FR",
      carrierRatingSnapshot: 5, carrierPage: { isSuperCarrier: true, isVerified: true },
    });
    const procheModeste = trip({ originLat: 3.8, originLng: 10.13, carrierRatingSnapshot: 3.2 });
    const ranked = rankFeedWindow([lointainExcellent, procheModeste], DOUALA, NOW);
    expect(ranked.map((r) => r.trip.id)).toEqual([procheModeste.id, lointainExcellent.id]);
    expect(ranked[0].ring).toBe("NEARBY");
    expect(ranked[1].ring).toBe("ELSEWHERE");
  });

  it("le PLEIN coule sous TOUT — même même-ville face à international — mais n'est JAMAIS exclu (ANO-API-11)", () => {
    const pleinMemeVille = trip({ capacityKg: 10, reservedKg: 10 });
    const paris = trip({ originLat: 48.85, originLng: 2.35, originCountryCode: "FR" });
    const ranked = rankFeedWindow([pleinMemeVille, paris], DOUALA, NOW);
    expect(ranked).toHaveLength(2);
    expect(ranked.map((r) => r.trip.id)).toEqual([paris.id, pleinMemeVille.id]);
  });

  it("dans un même anneau, le score départage, puis l'id (déterminisme A199)", () => {
    const bienNote = trip({ carrierRatingSnapshot: 4.9 });
    const malNote = trip({ carrierRatingSnapshot: 3.1 });
    const clone1 = trip();
    const clone2 = trip();
    const ranked = rankFeedWindow([malNote, clone2, bienNote, clone1], DOUALA, NOW);
    expect(ranked[0].trip.id).toBe(bienNote.id);
    expect(ranked[ranked.length - 1].trip.id).toBe(malNote.id);
    const clones = ranked.filter((r) => [clone1.id, clone2.id].includes(r.trip.id)).map((r) => r.trip.id);
    expect(clones).toEqual([clone1.id, clone2.id].sort());
  });

  it("le classement est STABLE : deux appels, le même ordre", () => {
    const trips = Array.from({ length: 30 }, (_, i) =>
      trip({ carrierRatingSnapshot: 3 + (i % 5) * 0.4, comparablePriceCents: 1_000 + (i % 7) * 500 })
    );
    const once = rankFeedWindow(trips, DOUALA, NOW).map((r) => r.trip.id);
    const twice = rankFeedWindow([...trips].reverse(), DOUALA, NOW).map((r) => r.trip.id);
    expect(twice).toEqual(once);
  });

  it("sans ancrage : aucun anneau, et la DIVERSITÉ démeut le 4e trajet d'un même corridor", () => {
    const corridorA = Array.from({ length: 5 }, () => trip({ carrierRatingSnapshot: 5 }));
    const autreCorridor = trip({ originCity: "Yaoundé", destinationCity: "Bruxelles", carrierRatingSnapshot: 3.2 });
    const ranked = rankFeedWindow([...corridorA, autreCorridor], null, NOW);
    expect(ranked).toHaveLength(6); // démis, jamais retiré
    expect(ranked.every((r) => r.ring === null)).toBe(true);
    const positionAutre = ranked.findIndex((r) => r.trip.id === autreCorridor.id);
    expect(positionAutre).toBe(FEED_PARAMS.diversityCap); // juste après le cap du corridor dominant
  });

  it("la diversité ne repêche jamais un PLEIN : il reste sous les démus", () => {
    const corridorA = Array.from({ length: 5 }, () => trip());
    const plein = trip({ originCity: "Yaoundé", destinationCity: "Bruxelles", capacityKg: 5, reservedKg: 5 });
    const ranked = rankFeedWindow([...corridorA, plein], null, NOW);
    expect(ranked[ranked.length - 1].trip.id).toBe(plein.id);
  });

  it("avec ancrage, PAS de diversité : la proximité est déjà la personnalisation", () => {
    const corridorA = Array.from({ length: 5 }, () => trip({ carrierRatingSnapshot: 5 }));
    const autre = trip({ originCity: "Yaoundé", originLat: 3.87, originLng: 11.52, destinationCity: "Bruxelles" });
    const ranked = rankFeedWindow([...corridorA, autre], DOUALA, NOW);
    expect(ranked[ranked.length - 1].trip.id).toBe(autre.id); // REGION derrière 5× SAME_CITY
  });

  it("PROXIMITY_RINGS est l'ordre de tri lui-même (garde-fou de constante)", () => {
    expect(PROXIMITY_RINGS).toEqual(["SAME_CITY", "NEARBY", "REGION", "COUNTRY", "ELSEWHERE"]);
  });
});

/**
 * feed-ranking.ts — le classement du flux d'atterrissage localisé (D80)
 * =====================================================================
 * Tout est PUR : trajets + ancrage + horloge en entrée, ordre en sortie. Calculé en LECTURE
 * sur une fenêtre bornée (le patron D33 du même contrôleur), jamais stocké, jamais servi à un
 * client — le client reçoit un ORDRE et un anneau par carte, pas un score (précédent D71).
 *
 * La clé de tri, dans l'ordre de domination (D80 2A) :
 *   1. un trajet PLEIN coule sous tout le reste — mais n'est JAMAIS exclu (ANO-API-11 :
 *      un classement change l'ordre, jamais le nombre) ;
 *   2. l'ANNEAU de proximité à l'ancrage (même ville → proche → région → pays → international) ;
 *   3. le SCORE QUALITÉ (départ jouable, place, confiance, prix, fraîcheur) ;
 *   4. l'`id` — départage déterministe (doctrine A199, stabilité du curseur-offset).
 *
 * Sans ancrage : pas d'anneaux, score qualité seul + contrainte de DIVERSITÉ par corridor
 * (flux découverte, D80 3A). Les pondérations restent des ARGUMENTS PAR DÉFAUT (règle D62) :
 * pas de clé PlatformSettings sans consommateur réel.
 */
import { haversineKm, hasValidCoords } from "../utils/geo.helper";

// ─── Types d'entrée (structurels : le Trip Prisma les satisfait) ─────────────

export type FeedTripInput = {
  id: string;
  departureAt: Date | null;
  createdAt: Date;
  capacityKg: number | null;
  reservedKg: number | null;
  comparablePriceCents: number | null;
  carrierRatingSnapshot: number | null;
  instantBooking: boolean | null;
  ticketVerificationStatus: string | null;
  originLat: number | null;
  originLng: number | null;
  originCity: string | null;
  originCountryCode: string | null;
  destinationCity: string | null;
  destinationCountryCode: string | null;
  carrierPage?: { isSuperCarrier?: boolean | null; isVerified?: boolean | null } | null;
};

/** L'ancrage résolu par le contrôleur (query `near` ou IP) — jamais journalisé. */
export type FeedAnchor = {
  lat: number;
  lng: number;
  countryCode: string | null;
  city: string | null;
  source: "query" | "ip";
};

/** Du plus proche au plus lointain — l'ordre du tableau EST l'ordre de tri. */
export const PROXIMITY_RINGS = ["SAME_CITY", "NEARBY", "REGION", "COUNTRY", "ELSEWHERE"] as const;
export type ProximityRing = (typeof PROXIMITY_RINGS)[number];

// ─── Paramètres (🚪↔ D80 : rayons, poids, fenêtre, cap de diversité) ─────────

export type FeedParams = {
  rings: { sameCityKm: number; nearbyKm: number; regionKm: number };
  /** Fenêtre du calcul en mémoire (patron D33). */
  windowSize: number;
  /** Flux découverte : nombre max de trajets d'un même corridor avant démotion. */
  diversityCap: number;
  weights: {
    departure: number; // max — départ jouable
    trust: number; //     max — confiance
    price: number; //     max — prix compétitif
    freshness: number; // max — fraîcheur
  };
  /** Note prior d'un Voyageur sans note — neutre, le « Nouveau Voyageur » n'est pas enterré. */
  ratingPrior: number;
};

export const FEED_PARAMS: FeedParams = {
  rings: { sameCityKm: 25, nearbyKm: 100, regionKm: 300 },
  windowSize: 200,
  diversityCap: 3,
  weights: { departure: 30, trust: 30, price: 20, freshness: 10 },
  ratingPrior: 3.9,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ─── Anneaux ─────────────────────────────────────────────────────────────────

/**
 * Pur : l'anneau d'un trajet vis-à-vis de l'ancrage.
 * Sans coordonnées sur le trajet, on dégrade sur le pays (COUNTRY / ELSEWHERE) — jamais un trou.
 * REGION exige le MÊME pays (300 km au-delà d'une frontière n'est pas « ta région ») ;
 * SAME_CITY et NEARBY sont purement métriques (80 km transfrontaliers SONT « à proximité »).
 */
export function ringFor(trip: FeedTripInput, anchor: FeedAnchor, p: FeedParams = FEED_PARAMS): ProximityRing {
  const sameCountry =
    anchor.countryCode !== null && trip.originCountryCode !== null && anchor.countryCode === trip.originCountryCode;
  if (!hasValidCoords(trip.originLat, trip.originLng)) return sameCountry ? "COUNTRY" : "ELSEWHERE";
  const km = haversineKm(anchor.lat, anchor.lng, trip.originLat as number, trip.originLng as number);
  if (km <= p.rings.sameCityKm) return "SAME_CITY";
  if (km <= p.rings.nearbyKm) return "NEARBY";
  if (km <= p.rings.regionKm && sameCountry) return "REGION";
  return sameCountry ? "COUNTRY" : "ELSEWHERE";
}

// ─── Score qualité (étage 2) ─────────────────────────────────────────────────

/** Pur : 0..1 — jouabilité du départ. Plateau J+1..J+7, montée douce avant, décroissance après, jamais zéro. */
export function departurePlayability(departureAt: Date | null, now: Date): number {
  if (!departureAt) return 0.2;
  const hours = (departureAt.getTime() - now.getTime()) / 3_600_000;
  if (hours <= 0) return 0.2; // le `where` exclut le passé ; robustesse pure
  if (hours < 24) return 0.2 + 0.8 * (hours / 24); // dans 2 h : difficilement réservable
  if (hours <= 24 * 7) return 1; // la fenêtre idéale
  const daysPast7 = hours / 24 - 7;
  return Math.max(0.25, 1 - daysPast7 * (0.75 / 23)); // décroît jusqu'à 0.25 vers J+30, plancher
}

/** Pur : kg restants — null quand la capacité n'est pas déclarée (legacy slots : jamais « plein »). */
export function remainingKgOf(trip: Pick<FeedTripInput, "capacityKg" | "reservedKg">): number | null {
  if (typeof trip.capacityKg !== "number" || trip.capacityKg <= 0) return null;
  return trip.capacityKg - (trip.reservedKg ?? 0);
}

export type QualityContext = {
  now: Date;
  /** Rang percentile 0..1 du prix comparable DANS la fenêtre (0 = le moins cher), null si sans prix. */
  pricePercentile: number | null;
};

/** Pur : le score qualité 0..100 d'un trajet. Les VUES n'y entrent jamais (boucle de rétroaction). */
export function qualityScore(trip: FeedTripInput, ctx: QualityContext, p: FeedParams = FEED_PARAMS): number {
  const w = p.weights;
  let score = w.departure * departurePlayability(trip.departureAt, ctx.now);

  // Confiance : note snapshot (prior neutre sans note) + signaux vérifiables
  const rating = trip.carrierRatingSnapshot ?? p.ratingPrior;
  score += (w.trust - 12) * clamp01((rating - 3) / 2); // 18 pts : 3★ → 0, 5★ → plein
  if (trip.carrierPage?.isSuperCarrier) score += 5;
  if (trip.carrierPage?.isVerified) score += 3;
  if (trip.ticketVerificationStatus === "VERIFIED") score += 2;
  if (trip.instantBooking) score += 2;

  // Prix : percentile dans la fenêtre — aucune médiane à maintenir, neutre sans prix
  score += w.price * (ctx.pricePercentile === null ? 0.5 : 1 - ctx.pricePercentile);

  // Fraîcheur : la chance des nouveaux — pleine 48 h, éteinte à J+14
  const ageDays = (ctx.now.getTime() - trip.createdAt.getTime()) / 86_400_000;
  score += w.freshness * clamp01(1 - Math.max(0, ageDays - 2) / 12);

  // Place : un peu de marge rassure, presque plein pénalise (le PLEIN coule via le bucket, pas ici)
  const remaining = remainingKgOf(trip);
  if (remaining !== null && remaining > 0 && remaining < 2) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// ─── L'assemblage ────────────────────────────────────────────────────────────

export type RankedTrip<T extends FeedTripInput> = {
  trip: T;
  /** null = classement sans ancrage (découverte, ou recherche avec `from`). */
  ring: ProximityRing | null;
  score: number;
};

/** Pur : rang percentile 0..1 de chaque prix comparable de la fenêtre (ex-aequo : même rang). */
export function pricePercentiles(trips: ReadonlyArray<FeedTripInput>): Map<string, number> {
  const priced = trips
    .filter((t) => typeof t.comparablePriceCents === "number" && (t.comparablePriceCents as number) > 0)
    .sort((a, b) => (a.comparablePriceCents as number) - (b.comparablePriceCents as number));
  const out = new Map<string, number>();
  if (priced.length <= 1) {
    for (const t of priced) out.set(t.id, 0);
    return out;
  }
  for (let i = 0; i < priced.length; i++) {
    const price = priced[i].comparablePriceCents as number;
    // Premier index de ce prix : les ex-aequo partagent le percentile (déterminisme A199)
    let first = i;
    while (first > 0 && (priced[first - 1].comparablePriceCents as number) === price) first--;
    out.set(priced[i].id, first / (priced.length - 1));
  }
  return out;
}

/**
 * Pur : la fenêtre entière, classée. `anchor: null` → score seul + diversité par corridor
 * (flux découverte). La diversité DÉMEUT (vers la fin du bucket non-plein), elle n'exclut pas.
 */
export function rankFeedWindow<T extends FeedTripInput>(
  trips: ReadonlyArray<T>,
  anchor: FeedAnchor | null,
  now: Date,
  p: FeedParams = FEED_PARAMS
): Array<RankedTrip<T>> {
  const percentiles = pricePercentiles(trips);
  const ranked: Array<RankedTrip<T> & { full: boolean }> = trips.map((trip) => {
    const remaining = remainingKgOf(trip);
    return {
      trip,
      ring: anchor ? ringFor(trip, anchor, p) : null,
      score: qualityScore(trip, { now, pricePercentile: percentiles.get(trip.id) ?? null }, p),
      full: remaining !== null && remaining <= 0,
    };
  });

  ranked.sort((a, b) => {
    if (a.full !== b.full) return a.full ? 1 : -1; // le plein coule sous tout
    if (a.ring !== b.ring) return PROXIMITY_RINGS.indexOf(a.ring as ProximityRing) - PROXIMITY_RINGS.indexOf(b.ring as ProximityRing);
    if (a.score !== b.score) return b.score - a.score;
    return a.trip.id < b.trip.id ? -1 : a.trip.id > b.trip.id ? 1 : 0;
  });

  const diversified = anchor === null ? applyDiversity(ranked, p) : ranked;
  return diversified.map(({ trip, ring, score }) => ({ trip, ring, score }));
}

/** Corridor d'un trajet — la clé de diversité du flux découverte. */
function corridorKey(t: FeedTripInput): string {
  return `${t.originCity ?? t.originCountryCode ?? "?"}→${t.destinationCity ?? t.destinationCountryCode ?? "?"}`;
}

/**
 * Pur, stable : au-delà de `diversityCap` trajets d'un même corridor, les suivants sont démus
 * en queue de LEUR bucket (non-plein / plein), dans leur ordre relatif — jamais retirés.
 */
function applyDiversity<T extends { trip: FeedTripInput; full: boolean }>(ranked: ReadonlyArray<T>, p: FeedParams): T[] {
  const result: T[] = [];
  const overflow: T[] = [];
  const seen = new Map<string, number>();
  const bucketEnd = ranked.findIndex((r) => r.full); // début du bucket « plein » (-1 : aucun)
  const head = bucketEnd === -1 ? ranked.slice() : ranked.slice(0, bucketEnd);
  const tail = bucketEnd === -1 ? [] : ranked.slice(bucketEnd);
  for (const r of head) {
    const key = corridorKey(r.trip);
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    (count > p.diversityCap ? overflow : result).push(r);
  }
  return [...result, ...overflow, ...tail];
}

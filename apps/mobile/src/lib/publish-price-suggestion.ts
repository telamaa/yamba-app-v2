/**
 * publish-price-suggestion.ts — la fourchette du marché, sur le téléphone.
 * =========================================================================
 * D111 ter. Le site affiche depuis D15 une fourchette « basse / médiane /
 * haute » par corridor sous le curseur de prix ; le téléphone, lui, n'avait
 * RIEN — et c'est l'écran qui décide du revenu du Voyageur. Sans repère, un
 * tarif est posé trop bas (on laisse de l'argent) ou trop haut (on ne reçoit
 * aucune demande), et dans les deux cas personne ne le dit.
 *
 * CE QUI MANQUAIT N'ÉTAIT PAS LE CALCUL, C'ÉTAIT SA MATIÈRE : le corridor se
 * lit sur deux CODES PAYS et une distance, que le relais Places ne rendait
 * pas (il ne servait que deux chaînes). `GET /places/details` les rend
 * désormais, une fois par ville retenue — d'où ce fichier.
 *
 * Les NOMBRES sont ceux du site (`PRICE_SUGGESTION_V1` dans
 * `create-trip.config.ts`) et une fiche les y confronte, le fichier lu à
 * l'exécution. Pas une copie à l'octet près cette fois — le fichier du site
 * porte aussi sa validation et ses familles, il n'est pas duplicable — mais
 * la même exigence : deux fronts ne peuvent pas s'accorder sur des nombres
 * qu'aucun des deux ne nomme (D101).
 *
 * Zéro import hors du moteur de corridors, lui-même pur : le harnais doit
 * pouvoir jouer la règle.
 */
import { DEFAULT_BASE_PER_KG, corridorBasePerKg, haversineKm, type Zone } from '@/lib/pricing-corridors';

/** Les mêmes modificateurs que le site, D15 V1. */
export const SUGGESTION_V1 = {
  /** Base de repli quand le corridor est inconnu (code pays absent). */
  baseParDefaut: DEFAULT_BASE_PER_KG,
  basPct: 10,
  hautPct: 15,
  volDirectMod: 0.05,
  departSous3JoursMod: -0.05,
  departSous7JoursMod: -0.02,
} as const;

export type Fourchette = {
  bas: number;
  mediane: number;
  haut: number;
  /** Les zones du corridor retenu — pour dire D'OÙ vient le chiffre. */
  corridor: { depart: Zone; arrivee: Zone; domestique: boolean };
  /** Faux quand aucun code pays n'est connu : la base de repli a servi. */
  precis: boolean;
};

export type VillePourLePrix = {
  countryCode: string | null;
  lat: number | null;
  lng: number | null;
};

/** Le jour, sans l'heure — deux dates se comparent en JOURS, pas en instants. */
function jourSeul(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * La fourchette pour ce trajet.
 *
 * `maintenant` est REÇU et non lu : une règle qui appelle `new Date()` se
 * teste à la seconde près, donc ne se teste pas.
 *
 * Le sens du modificateur de délai est celui du site, et il surprend si on
 * ne le dit pas : côté OFFRE, un départ imminent laisse moins de temps pour
 * vendre ses kilos, donc la suggestion BAISSE. (La prime d'urgence existe,
 * mais côté demande.)
 */
export function fourchetteDuCorridor(
  depart: VillePourLePrix | null,
  arrivee: VillePourLePrix | null,
  options: { volDirect: boolean; dateDepart: string | null; maintenant: Date }
): Fourchette {
  const distanceKm = haversineKm(depart?.lat, depart?.lng, arrivee?.lat, arrivee?.lng);
  const corridor = corridorBasePerKg(depart?.countryCode, arrivee?.countryCode, distanceKm);

  let mediane = corridor.base;
  if (options.volDirect) mediane *= 1 + SUGGESTION_V1.volDirectMod;

  if (options.dateDepart !== null) {
    const jour = new Date(`${options.dateDepart}T12:00:00`);
    if (!Number.isNaN(jour.getTime())) {
      const jours = (jourSeul(jour) - jourSeul(options.maintenant)) / 86_400_000;
      const mod =
        jours <= 3
          ? SUGGESTION_V1.departSous3JoursMod
          : jours <= 7
            ? SUGGESTION_V1.departSous7JoursMod
            : 0;
      if (mod !== 0) mediane *= 1 + mod;
    }
  }

  const arrondi = (n: number) => Math.round(n * 100) / 100;
  return {
    bas: arrondi(mediane * (1 - SUGGESTION_V1.basPct / 100)),
    mediane: arrondi(mediane),
    haut: arrondi(mediane * (1 + SUGGESTION_V1.hautPct / 100)),
    corridor: {
      depart: corridor.fromZone,
      arrivee: corridor.toZone,
      domestique: corridor.domestic,
    },
    // Sans AUCUN code pays, la matrice n'a rien lu : le chiffre est une base
    // de repli, pas un corridor. L'écran doit pouvoir le dire au lieu de
    // présenter une médiane qui a l'air mesurée (le défaut de D100).
    precis: (depart?.countryCode ?? null) !== null || (arrivee?.countryCode ?? null) !== null,
  };
}

export type VerdictDePrix = 'bas' | 'juste' | 'haut';

/** Où tombe le tarif choisi dans la fourchette — la règle du site, mot pour mot. */
export function verdictDePrix(prix: number, fourchette: Fourchette): VerdictDePrix {
  if (prix < fourchette.bas) return 'bas';
  if (prix > fourchette.haut) return 'haut';
  return 'juste';
}

/** Arrondi commercial au demi-euro : les Voyageurs affichent 11,50 — pas 11,47. */
export function arrondiCommercial(valeur: number): number {
  return Math.round(valeur * 2) / 2;
}

/* ── La jauge ─────────────────────────────────────────────────────────── */

/**
 * Les bornes VISIBLES de la jauge.
 *
 * Pas la fourchette elle-même : si la piste commençait à « bas » et finissait
 * à « haut », un tarif hors fourchette serait collé à un bord sans qu'on voie
 * DE COMBIEN il dépasse. On laisse donc une marge d'une demi-fourchette de
 * chaque côté — assez pour que « très au-dessus » se distingue de « un peu
 * au-dessus ».
 */
export function bornesDeLaJauge(fourchette: Fourchette): { min: number; max: number } {
  const marge = Math.max((fourchette.haut - fourchette.bas) / 2, 0.5);
  return { min: Math.max(fourchette.bas - marge, 0), max: fourchette.haut + marge };
}

/**
 * Où poser le repère, entre 0 et 1.
 *
 * Toujours DANS [0, 1] : un tarif très au-delà des bornes se pose sur le
 * bord, il ne sort pas de la piste (et il ne rend pas `NaN` quand la
 * fourchette est plate — le cas d'une base de repli sans distance).
 */
export function positionSurLaJauge(prix: number, fourchette: Fourchette): number {
  const { min, max } = bornesDeLaJauge(fourchette);
  if (!(max > min)) return 0.5;
  return Math.min(Math.max((prix - min) / (max - min), 0), 1);
}

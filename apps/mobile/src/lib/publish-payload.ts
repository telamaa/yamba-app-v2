/**
 * publish-payload.ts — du brouillon au corps de requête, et rien d'autre.
 * ========================================================================
 * Zéro import : c'est la dernière règle avant le réseau, celle qui décide ce
 * que le serveur reçoit — donc celle qu'une fiche doit pouvoir exécuter.
 *
 * Le jumeau du site (`create-trip.mapper.ts`, 318 lignes) fait DEUX choses :
 * il traduit un vocabulaire (« plane » → `PLANE`) et il met en forme. Ici il
 * n'en fait qu'une : le brouillon parle déjà la langue du contrat
 * (`publish-trip.ts`), il ne reste que la MISE EN FORME — cents, dates ISO,
 * listes filtrées. Une table de traduction en moins est une table de moins où
 * se tromper.
 *
 * TROIS RÈGLES NON NÉGOCIABLES PASSENT PAR ICI :
 *   • les montants sont des CENTS entiers (jamais un flottant monétaire) ;
 *   • une famille ACCEPTÉE ne voyage PAS — le serveur lit « liste vide » comme
 *     « tout accepté », et envoyer les huit familles pour dire « rien de
 *     spécial » ferait d'une annonce ouverte une annonce bavarde ;
 *   • un forfait SUSPENDU (franchise > capacité, RG-B-29) ne part pas : il est
 *     mémorisé à l'écran, mais le serveur le refuserait.
 */

import {
  FAMILLES,
  sousTypePourLApi,
  type LieuBrouillon,
  type PublishDraft,
} from '@/lib/publish-trip';

/* ── Ce que le serveur attend (miroir de `createTripSchema`) ───────────── */

export type ConditionFamilleApi = {
  familyKey: string;
  mode: 'SURCHARGE' | 'REFUSE';
  surchargePct?: number;
};

export type LieuApi = {
  kind: string;
  details: string | null;
  flexibility: string;
  radiusKm: number | null;
};

export type CorpsDeTrajet = {
  transportMode: string;
  tripType: string;

  originLabel: string | null;
  originPlaceId: string | null;
  originCity: string;
  originCountry: string | null;
  originCountryCode: string | null;
  originLat: number | null;
  originLng: number | null;

  destinationLabel: string | null;
  destinationPlaceId: string | null;
  destinationCity: string;
  destinationCountry: string | null;
  destinationCountryCode: string | null;
  destinationLat: number | null;
  destinationLng: number | null;

  departureDateLocal: string | null;
  arrivalDateLocal: string | null;
  departureTimeLocal: string | null;
  arrivalTimeLocal: string | null;
  departureAt: string | null;
  arrivalAt: string | null;

  flightType: string | null;
  trainTripType: string | null;
  carTripFlexibility: string | null;
  flightLayoverCities: string[];
  trainStopCities: string[];
  travelReference: string | null;

  pricePerKgCents: number | null;
  capacityKg: number | null;
  checkedBag23PriceCents: number | null;
  cabinBag12PriceCents: number | null;
  familyConditions: ConditionFamilleApi[];

  pickupLocations: LieuApi[];
  deliveryLocations: LieuApi[];

  handDeliveryOnly: boolean;
  instantBooking: boolean;
  currencyCode: string;
  notes: string | null;

  publish: boolean;
};

/* ── Mise en forme ─────────────────────────────────────────────────────── */

/**
 * `2026-11-25` + `21:00` → l'instant ISO, dans le fuseau de l'APPAREIL.
 *
 * C'est volontairement le fuseau du téléphone et non celui de la ville de
 * départ : l'app ne connaît pas le fuseau d'une ville (le relais Places ne
 * rend pas de coordonnées), et le site fait exactement la même chose. Un
 * Voyageur qui publie depuis chez lui pour un vol de chez lui a raison ;
 * celui qui publie depuis l'étranger décale son heure — dette connue,
 * commune aux deux fronts, que seule une résolution de fuseau côté serveur
 * peut lever.
 */
export function instantIso(date: string | null, heure: string): string | null {
  if (date === null) return null;
  const [annee, mois, jour] = date.split('-').map(Number);
  if (!annee || !mois || !jour) return null;
  const [h, m] = heure.split(':').map(Number);
  const quand = new Date(annee, mois - 1, jour, Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return Number.isNaN(quand.getTime()) ? null : quand.toISOString();
}

/** « Istanbul, Doha » → ['Istanbul', 'Doha'] ; «  » → []. */
export function villesTraversees(saisie: string): string[] {
  return saisie
    .split(',')
    .map((ville) => ville.trim())
    .filter((ville) => ville.length > 0);
}

/** Des euros saisis → des cents entiers, ou `null` si rien de positif. */
export function centsOuNull(euros: number | null): number | null {
  if (euros === null || !Number.isFinite(euros) || euros <= 0) return null;
  return Math.round(euros * 100);
}

/** Un texte facultatif : vide ou blanc ⇒ `null`, jamais la chaîne vide. */
export function texteOuNull(valeur: string): string | null {
  const propre = valeur.trim();
  return propre.length === 0 ? null : propre;
}

/* ── Le corps complet ──────────────────────────────────────────────────── */

/** Les lieux ALLUMÉS, débarrassés de ce qui n'appartient qu'à l'écran. */
export function lieuxPourLApi(lieux: LieuBrouillon[]): LieuApi[] {
  return lieux
    .filter((lieu) => lieu.actif)
    .map((lieu) => ({
      kind: lieu.kind,
      details: texteOuNull(lieu.details),
      flexibility: lieu.flexibility,
      // Un rayon n'a de sens qu'avec `RADIUS` : ailleurs il part à `null`,
      // même si l'écran en gardait un en mémoire.
      radiusKm: lieu.flexibility === 'RADIUS' ? (lieu.radiusKm ?? null) : null,
    }));
}

/** Seules les familles qui S'ÉCARTENT du « j'accepte » voyagent (D14). */
export function famillesPourLApi(familles: PublishDraft['familles']): ConditionFamilleApi[] {
  return FAMILLES.filter((famille) => familles[famille].mode !== 'ACCEPT').map((famille) => {
    const condition = familles[famille];
    return condition.mode === 'SURCHARGE'
      ? { familyKey: famille, mode: 'SURCHARGE' as const, surchargePct: condition.surchargePct }
      : { familyKey: famille, mode: 'REFUSE' as const };
  });
}

/**
 * Le corps de `POST /trips`.
 *
 * @param publier `true` publie, `false` enregistre un brouillon côté serveur.
 *   La validation du serveur est plus stricte à la publication (lieux, date
 *   future, sous-type du mode) : le tunnel réclame donc tout AVANT, pour que
 *   ce refus-là n'arrive jamais.
 */
export function construireCorps(draft: PublishDraft, publier: boolean): CorpsDeTrajet {
  const sousTypes = sousTypePourLApi(draft.mode, draft.sousType);
  const capacite = draft.capaciteKg !== null && draft.capaciteKg > 0 ? draft.capaciteKg : null;
  const soutePossible = capacite !== null && capacite >= 23;
  const cabinePossible = capacite !== null && capacite >= 12;

  return {
    transportMode: draft.mode ?? '',
    // Un seul trajet, un seul sens — « aller-retour » n'existe pas dans ce
    // tunnel (il n'ajoutait qu'un mot sur la fiche, jamais un second trajet).
    tripType: 'ONE_WAY',

    // D111 ter — le téléphone sait désormais émettre ce que seul le SDK
    // Google donnait au site : l'identifiant du lieu, son code pays ISO et
    // ses coordonnées. Ils servent au serveur (recherche par pays, distance)
    // autant qu'à la fourchette de prix affichée dans le tunnel.
    originLabel: draft.depart === null ? null : texteOuNull(draft.depart.libelle),
    originPlaceId: draft.depart === null ? null : texteOuNull(draft.depart.placeId),
    originCity: draft.depart?.ville.trim() ?? '',
    originCountry: draft.depart === null ? null : texteOuNull(draft.depart.pays),
    originCountryCode: draft.depart?.countryCode ?? null,
    originLat: draft.depart?.lat ?? null,
    originLng: draft.depart?.lng ?? null,

    destinationLabel: draft.arrivee === null ? null : texteOuNull(draft.arrivee.libelle),
    destinationPlaceId: draft.arrivee === null ? null : texteOuNull(draft.arrivee.placeId),
    destinationCity: draft.arrivee?.ville.trim() ?? '',
    destinationCountry: draft.arrivee === null ? null : texteOuNull(draft.arrivee.pays),
    destinationCountryCode: draft.arrivee?.countryCode ?? null,
    destinationLat: draft.arrivee?.lat ?? null,
    destinationLng: draft.arrivee?.lng ?? null,

    departureDateLocal: draft.dateDepart,
    arrivalDateLocal: draft.dateArrivee,
    departureTimeLocal: texteOuNull(draft.heureDepart),
    arrivalTimeLocal: texteOuNull(draft.heureArrivee),
    departureAt: instantIso(draft.dateDepart, draft.heureDepart),
    arrivalAt: instantIso(draft.dateArrivee, draft.heureArrivee),

    flightType: sousTypes.flightType,
    trainTripType: sousTypes.trainTripType,
    carTripFlexibility: sousTypes.carTripFlexibility,
    // Les villes traversées ne partent que dans le champ du MODE : un train
    // n'a pas d'escale, un avion n'a pas d'arrêt intermédiaire.
    flightLayoverCities: draft.mode === 'PLANE' ? villesTraversees(draft.escales) : [],
    trainStopCities: draft.mode === 'TRAIN' ? villesTraversees(draft.escales) : [],
    travelReference: texteOuNull(draft.reference),

    pricePerKgCents: centsOuNull(draft.prixParKiloEur),
    capacityKg: capacite,
    // RG-B-29 — un forfait que la capacité ne peut pas contenir ne part pas.
    checkedBag23PriceCents: soutePossible ? centsOuNull(draft.forfaitSouteEur) : null,
    cabinBag12PriceCents: cabinePossible ? centsOuNull(draft.forfaitCabineEur) : null,
    familyConditions: famillesPourLApi(draft.familles),

    pickupLocations: lieuxPourLApi(draft.lieuxRemise),
    deliveryLocations: lieuxPourLApi(draft.lieuxLivraison),

    handDeliveryOnly: draft.remiseEnMainPropre,
    instantBooking: draft.reservationInstantanee,
    currencyCode: 'EUR',
    notes: texteOuNull(draft.notes),

    publish: publier,
  };
}

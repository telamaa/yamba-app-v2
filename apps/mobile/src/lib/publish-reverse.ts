/**
 * publish-reverse.ts — relire un brouillon SERVEUR dans le tunnel.
 * =================================================================
 * D111 quater. Le brouillon de publication vivait en mémoire de processus :
 * l'app tuée, le trajet était perdu. Pour un Voyageur qui commence sa saisie
 * à l'aéroport et embarque, c'est le pire moment pour tout reperdre.
 *
 * Le serveur sait enregistrer un trajet `DRAFT` depuis toujours (c'est le
 * bouton « Brouillon » du site) : ce fichier fait le chemin INVERSE de
 * `publish-payload.ts` — du trajet rendu par `GET /trips/my` au brouillon
 * que les six écrans savent remplir.
 *
 * ZÉRO IMPORT RÉSEAU, et une lecture DÉFENSIVE de bout en bout : la réponse
 * vient d'une base où des trajets ont été écrits par le site, par des
 * versions antérieures de l'app, et par des seeds. Tout champ peut manquer,
 * tout type peut surprendre — un brouillon à demi relu vaut mieux qu'un
 * écran blanc.
 */
import {
  FAMILLES,
  SOUS_TYPES,
  SURCHARGE_PAR_DEFAUT,
  famillesParDefaut,
  lieuxParDefaut,
  type ConditionFamille,
  type LieuBrouillon,
  type LocationFlexibility,
  type LocationKind,
  type ParcelFamily,
  type PublishDraft,
  type SousType,
  type TransportMode,
} from '@/lib/publish-trip';

/** Un trajet tel que l'API le rend : rien n'est garanti. */
export type TrajetRelu = Record<string, unknown>;

/* ── Lectures défensives ──────────────────────────────────────────────── */

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

function texteOuNull(valeur: unknown): string | null {
  return typeof valeur === 'string' && valeur.trim().length > 0 ? valeur : null;
}

function nombreOuNull(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}

/** Des cents en euros — la division ne doit pas rouvrir des 9.500000000001. */
function eurosDepuisCents(valeur: unknown): number | null {
  const cents = nombreOuNull(valeur);
  if (cents === null || cents <= 0) return null;
  return Math.round(cents) / 100;
}

function liste(valeur: unknown): unknown[] {
  return Array.isArray(valeur) ? valeur : [];
}

function objet(valeur: unknown): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : {};
}

/* ── Pièces ───────────────────────────────────────────────────────────── */

function modeRelu(valeur: unknown): TransportMode | null {
  return valeur === 'PLANE' || valeur === 'TRAIN' || valeur === 'CAR' ? valeur : null;
}

/**
 * Le sous-type vit dans TROIS champs côté serveur ; on lit celui du mode, et
 * on vérifie qu'il appartient bien à ce mode. Un `flightType` traîné sur un
 * trajet en voiture (brouillon modifié, ancienne version) est ignoré plutôt
 * que recopié.
 */
function sousTypeRelu(trajet: TrajetRelu, mode: TransportMode | null): SousType | null {
  if (mode === null) return null;
  const brut =
    mode === 'PLANE'
      ? trajet.flightType
      : mode === 'TRAIN'
        ? trajet.trainTripType
        : trajet.carTripFlexibility;
  const valeur = texte(brut) as SousType;
  return SOUS_TYPES[mode].includes(valeur) ? valeur : null;
}

/** Les villes traversées, telles qu'on les a saisies : séparées par une virgule. */
function escalesRelues(trajet: TrajetRelu, mode: TransportMode | null): string {
  const champ = mode === 'TRAIN' ? trajet.trainStopCities : trajet.flightLayoverCities;
  return liste(champ)
    .filter((ville): ville is string => typeof ville === 'string' && ville.trim().length > 0)
    .join(', ');
}

function villeRelue(trajet: TrajetRelu, prefixe: 'origin' | 'destination') {
  const ville = texte(trajet[`${prefixe}City`]);
  if (ville.trim().length === 0) return null;
  const pays = texte(trajet[`${prefixe}Country`]);
  const libelle = texteOuNull(trajet[`${prefixe}Label`]);
  return {
    ville,
    pays,
    libelle: libelle ?? (pays.length > 0 ? `${ville}, ${pays}` : ville),
    placeId: texte(trajet[`${prefixe}PlaceId`]),
    countryCode: texteOuNull(trajet[`${prefixe}CountryCode`]),
    lat: nombreOuNull(trajet[`${prefixe}Lat`]),
    lng: nombreOuNull(trajet[`${prefixe}Lng`]),
  };
}

/**
 * Les familles : le serveur ne garde que les ÉCARTS (une liste vide veut dire
 * « tout accepté »). On repart donc de huit familles acceptées et on applique
 * ce qui diverge — l'exact inverse de `famillesPourLApi`.
 */
function famillesRelues(valeur: unknown): Record<ParcelFamily, ConditionFamille> {
  const familles = famillesParDefaut();
  for (const brute of liste(valeur)) {
    const condition = objet(brute);
    const cle = texte(condition.familyKey) as ParcelFamily;
    if (!FAMILLES.includes(cle)) continue;
    const mode = texte(condition.mode);
    if (mode === 'REFUSE') {
      familles[cle] = { mode: 'REFUSE', surchargePct: SURCHARGE_PAR_DEFAUT };
    } else if (mode === 'SURCHARGE') {
      familles[cle] = {
        mode: 'SURCHARGE',
        surchargePct: nombreOuNull(condition.surchargePct) ?? SURCHARGE_PAR_DEFAUT,
      };
    }
  }
  return familles;
}

/**
 * Les lieux : le serveur ne garde que les lieux ACTIFS, l'écran a besoin des
 * cartes ÉTEINTES aussi (c'est ce qui permet d'en rallumer une d'un geste).
 *
 * On repart donc des cartes par défaut du mode, on allume celles que le
 * serveur connaît et on leur rend leurs précisions ; une carte inconnue du
 * jeu par défaut (un aéroport sur un trajet en voiture, saisi depuis le
 * site) est AJOUTÉE plutôt qu'ignorée — perdre un lieu que le Voyageur a
 * saisi serait pire qu'afficher une carte inattendue.
 */
export function lieuxRelus(valeur: unknown, mode: TransportMode | null): LieuBrouillon[] {
  const cartes = mode === null ? [] : lieuxParDefaut(mode).map((lieu) => ({ ...lieu, actif: false }));

  for (const brut of liste(valeur)) {
    const lieu = objet(brut);
    const kind = texte(lieu.kind) as LocationKind;
    if (kind !== 'AIRPORT' && kind !== 'TRAIN_STATION' && kind !== 'CITY_AREA') continue;

    const flexibilite = texte(lieu.flexibility) as LocationFlexibility;
    const rempli: LieuBrouillon = {
      kind,
      actif: true,
      details: texte(lieu.details),
      flexibility:
        flexibilite === 'EXACT' || flexibilite === 'RADIUS' || flexibilite === 'CITY_WIDE'
          ? flexibilite
          : 'EXACT',
      radiusKm: nombreOuNull(lieu.radiusKm),
    };

    const existante = cartes.findIndex((carte) => carte.kind === kind);
    if (existante === -1) cartes.push(rempli);
    else cartes[existante] = rempli;
  }

  return cartes;
}

/* ── Le brouillon complet ─────────────────────────────────────────────── */

/**
 * Un trajet `DRAFT` relu en brouillon de tunnel.
 *
 * CE QUI NE REVIENT PAS : le billet (`billet`). Ses documents sont déjà
 * attachés au trajet côté serveur — les re-téléverser en créerait des
 * doublons. La RÉFÉRENCE, elle, revient : c'est un texte du trajet.
 */
export function brouillonDepuisLeTrajet(trajet: TrajetRelu): PublishDraft {
  const mode = modeRelu(trajet.transportMode);

  return {
    tripId: texteOuNull(trajet.id),

    mode,
    sousType: sousTypeRelu(trajet, mode),
    escales: escalesRelues(trajet, mode),

    depart: villeRelue(trajet, 'origin'),
    arrivee: villeRelue(trajet, 'destination'),

    // Les dates LOCALES du serveur sont des chaînes « yyyy-mm-dd » : on les
    // relit telles quelles. Absentes, elles restent nulles plutôt que d'être
    // déduites de `departureAt`, qui est un instant UTC — en déduire un jour
    // local décalerait d'une journée près de minuit, et publier un trajet à
    // la mauvaise date est pire que redemander la date.
    dateDepart: texteOuNull(trajet.departureDateLocal),
    heureDepart: texte(trajet.departureTimeLocal),
    dateArrivee: texteOuNull(trajet.arrivalDateLocal),
    heureArrivee: texte(trajet.arrivalTimeLocal),

    reference: texte(trajet.travelReference),
    billet: null,

    prixParKiloEur: eurosDepuisCents(trajet.pricePerKgCents),
    capaciteKg: nombreOuNull(trajet.capacityKg),
    forfaitSouteEur: eurosDepuisCents(trajet.checkedBag23PriceCents),
    forfaitCabineEur: eurosDepuisCents(trajet.cabinBag12PriceCents),
    familles: famillesRelues(trajet.familyConditions),

    lieuxRemise: lieuxRelus(trajet.pickupLocations, mode),
    lieuxLivraison: lieuxRelus(trajet.deliveryLocations, mode),

    remiseEnMainPropre: trajet.handDeliveryOnly === true,
    reservationInstantanee: trajet.instantBooking === true,
    notes: texte(trajet.notes),
  };
}

/** Ce qu'on montre d'un brouillon sur l'écran de seuil, sans rien inventer. */
export function resumeDuBrouillon(trajet: TrajetRelu): { depart: string; arrivee: string } | null {
  const depart = texte(trajet.originCity).trim();
  const arrivee = texte(trajet.destinationCity).trim();
  if (depart.length === 0 || arrivee.length === 0) return null;
  return { depart, arrivee };
}

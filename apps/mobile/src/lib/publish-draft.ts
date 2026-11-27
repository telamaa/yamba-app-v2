/**
 * publish-draft.ts — le trajet en cours d'écriture, en mémoire de PROCESSUS.
 * ===========================================================================
 * Même dispositif que `booking-draft.ts`, `search-draft.ts` et
 * `auth-flow-state.ts` : un objet de module, un `Set` d'abonnés, zéro
 * contexte React. La raison est la même : le tunnel est une PILE de pages
 * poussées, et une page poussée ne rend pas de valeur à celle qui l'a
 * poussée — chaque écran écrit donc dans un brouillon partagé.
 *
 * Il meurt avec le processus, et c'est VOULU : un trajet non publié
 * n'engage rien. Le jour où il devra survivre (brouillon serveur, le site a
 * déjà le bouton « Brouillon »), ce sera un trajet en base avec son id, pas
 * un objet persisté sur le téléphone — deux brouillons pour une même chose
 * divergeraient le premier jour.
 *
 * Il est aussi effacé à la DÉCONNEXION : un trajet à demi écrit appartient à
 * celui qui l'écrivait (D106, `welcome-state`).
 *
 * Rien ici ne valide : les règles vivent dans `publish-trip.ts`, le serveur
 * reste seul juge (RG-MOB-1).
 */
import { useSyncExternalStore } from 'react';

import {
  famillesParDefaut,
  lieuxParDefaut,
  preparerLeRetour,
  retourPossible,
  type PublishDraft,
  type TransportMode,
} from '@/lib/publish-trip';

/**
 * Le brouillon neuf. Les dates ne sont PAS préremplies ici : ce fichier ne
 * lit pas l'horloge (les règles reçoivent `maintenant`), et c'est l'écran des
 * dates qui pose ses valeurs d'office à l'ouverture.
 */
const VIDE: PublishDraft = {
  tripId: null,
  mode: null,
  sousType: null,
  escales: '',

  depart: null,
  arrivee: null,

  dateDepart: null,
  heureDepart: '',
  dateArrivee: null,
  heureArrivee: '',

  reference: '',
  billet: null,

  prixParKiloEur: null,
  capaciteKg: null,
  forfaitSouteEur: null,
  forfaitCabineEur: null,
  familles: famillesParDefaut(),
  lieuxRemise: [],
  lieuxLivraison: [],
  remiseEnMainPropre: false,
  reservationInstantanee: false,
  notes: '',
};

let brouillon: PublishDraft = VIDE;
const abonnes = new Set<() => void>();

function prevenir() {
  abonnes.forEach((abonne) => abonne());
}

/** La MÊME référence tant que rien n'a changé — contrat de `useSyncExternalStore`. */
export function getPublishDraft(): PublishDraft {
  return brouillon;
}

export function subscribePublishDraft(abonne: () => void): () => void {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
}

export function setPublishDraft(patch: Partial<PublishDraft>): void {
  brouillon = { ...brouillon, ...patch };
  prevenir();
}

/**
 * Remplace TOUT le brouillon — c'est ce que fait la reprise d'un brouillon
 * serveur. Distinct de `setPublishDraft`, qui fusionne : reprendre un
 * trajet ne doit pas laisser traîner les miettes de celui d'avant.
 */
export function remplacerLeBrouillon(nouveau: PublishDraft): void {
  brouillon = nouveau;
  prevenir();
}

export function clearPublishDraft(): void {
  brouillon = { ...VIDE, familles: famillesParDefaut(), lieuxRemise: [], lieuxLivraison: [] };
  prevenir();
}

/** Tout oublier, retour compris — c'est ce que fait la DÉCONNEXION. */
export function clearPublishMemory(): void {
  retour = null;
  clearPublishDraft();
}

/**
 * Le mode décide des LIEUX proposés (aéroport, gare, ville) : les changer
 * d'un coup serait effacer ce que le Voyageur a déjà précisé sur les
 * anciennes cartes. On ne les repose donc QUE si le mode change vraiment.
 */
export function choisirMode(mode: TransportMode): void {
  if (brouillon.mode === mode) return;
  brouillon = {
    ...brouillon,
    mode,
    // Un sous-type d'avion n'a aucun sens pour une voiture : il repart à zéro.
    sousType: null,
    escales: '',
    lieuxRemise: lieuxParDefaut(mode),
    lieuxLivraison: lieuxParDefaut(mode),
  };
  prevenir();
}

/**
 * LE RETOUR EN ATTENTE — une mémoire à part, et c'est voulu.
 *
 * À la publication, le brouillon est EFFACÉ : le laisser vivrait ferait
 * proposer « Reprendre » pour un trajet déjà en ligne, c'est-à-dire un
 * mensonge au prochain lancement. Mais l'écran de fin doit encore pouvoir
 * proposer le retour, avec tout ce que l'aller portait. On garde donc le
 * retour À PART, et il ne survit pas plus loin : le reprendre le consomme.
 */
let retour: PublishDraft | null = null;

/** Appelée juste avant d'effacer le brouillon publié. */
export function memoriserLeRetour(aller: PublishDraft): void {
  retour = retourPossible(aller) ? preparerLeRetour(aller) : null;
}

export function retourEnAttente(): PublishDraft | null {
  return retour;
}

/** Reprend le retour comme brouillon courant. Rend `false` s'il n'y en a pas. */
export function reprendreLeRetour(): boolean {
  if (retour === null) return false;
  brouillon = retour;
  retour = null;
  prevenir();
  return true;
}

export function oublierLeRetour(): void {
  retour = null;
}

/** Y a-t-il quelque chose à reprendre ? (la carte « Reprendre » de l'écran d'entrée) */
export function brouillonCommence(draft: PublishDraft): boolean {
  return (
    draft.mode !== null ||
    draft.depart !== null ||
    draft.arrivee !== null ||
    draft.dateDepart !== null ||
    draft.prixParKiloEur !== null
  );
}

export function usePublishDraft(): PublishDraft {
  return useSyncExternalStore(subscribePublishDraft, getPublishDraft, getPublishDraft);
}

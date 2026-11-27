/**
 * mes-envois.ts — la liste des envois de l'Expéditeur, côté règles.
 * ==================================================================
 * D112. UN SEUL import, et il est PUR (`trip-local-dates`) : le harnais sait
 * le charger (frontière A223), et redériver la date localement serait la
 * règle recopiée une fois de plus — le défaut que D110 a corrigé.
 *
 * LE CLIENT NE DÉCIDE JAMAIS CE QU'IL PEUT FAIRE. Chaque envoi arrive avec
 * ses `allowedActions`, calculées par la machine à états de deal-service.
 * Lui seul connaît le barème d'annulation (ANN-01) et l'instant du départ :
 * déduire « on peut encore annuler » côté app, c'est promettre un geste
 * qu'il refusera.
 *
 * ── CE QUI CHANGE PAR RAPPORT AU SITE, ET POURQUOI ──────────────────────
 * Le site range un envoi par une TABLE DE STATUTS (`getShipmentPresentation`),
 * qui met `PICKED_UP` sans événement de suivi dans « À traiter », en urgent.
 * Or à ce stade l'Expéditeur n'a AUCUNE action qui fasse avancer l'envoi :
 * ses seuls gestes sont `dispute` (escalader) et, plus tôt, `cancel`
 * (défaire). Celui qui doit agir, c'est le Voyageur — il doit déclarer son
 * passage à l'aéroport. **Une tâche posée sur le bureau de quelqu'un qui ne
 * peut rien faire n'est pas un rappel, c'est un reproche.**
 *
 * Ici « À traiter » se DÉDUIT de ce que le serveur accorde vraiment :
 *   • `confirmEarly` autorisé   → confirmer la réception ;
 *   • la notation ouverte       → noter le Voyageur.
 * Rien d'autre. Si un jour la machine à états ouvre un troisième geste à
 * l'Expéditeur, il entrera ici sans qu'on touche à une table.
 */
import { localDateTime } from '@/lib/trip-local-dates';

/** Les neuf statuts de la machine de deal-service. */
export type StatutEnvoi =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

const STATUTS: readonly StatutEnvoi[] = [
  'PENDING',
  'ACCEPTED',
  'PICKED_UP',
  'DELIVERED',
  'COMPLETED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
  'DISPUTED',
];

/** Les gestes que la machine à états accorde à l'EXPÉDITEUR. */
export type ActionEnvoi = 'cancel' | 'dispute' | 'confirmEarly';

export type EnvoiDeLaListe = {
  id: string;
  statut: StatutEnvoi;
  depart: string;
  arrivee: string;
  /** `yyyy-mm-dd` dans le fuseau du lieu de DÉPART, ou `null`. */
  dateDepart: string | null;
  heureDepart: string;
  /** « Thomas N. » — le prénom et l'initiale, tels que le serveur les sert. */
  voyageur: string;
  /** Ce que l'Expéditeur a payé, gelé (D17). */
  totalCents: number | null;
  devise: string;
  /** Ce que le SERVEUR autorise. Lu, jamais déduit. */
  actions: ActionEnvoi[];
  /** La notation est ouverte ET pas encore faite. */
  peutNoter: boolean;
  /** PENDING : l'instant où la demande tombe (DEA-01), sinon `null`. */
  expireLe: string | null;
};

/* ── Projection défensive ─────────────────────────────────────────────── */

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

function nombreOuNull(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}

function objet(valeur: unknown): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : {};
}

/**
 * « Thomas N. » depuis `{ firstName, lastInitial }`. Les deux peuvent
 * manquer : un envoi dont on a perdu le Voyageur reste LISIBLE — c'est le
 * colis de quelqu'un, pas une ligne de base.
 */
function nomDuVoyageur(carrier: Record<string, unknown>): string {
  const prenom = texte(carrier.firstName).trim();
  const initiale = texte(carrier.lastInitial).trim();
  if (prenom.length === 0) return initiale;
  return initiale.length === 0 ? prenom : `${prenom} ${initiale}.`;
}

/**
 * Un envoi de l'API, ou `null` s'il n'a ni identifiant ni statut connu —
 * une ligne qu'on ne sait pas nommer ne s'affiche pas.
 */
export function envoiDeLApi(brut: unknown): EnvoiDeLaListe | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const envoi = brut as Record<string, unknown>;

  const id = texte(envoi.id);
  const statut = texte(envoi.status) as StatutEnvoi;
  if (id.length === 0 || !STATUTS.includes(statut)) return null;

  const trip = objet(envoi.trip);
  const pricing = objet(envoi.pricing);
  const rating = objet(envoi.rating);

  // La date de départ se lit dans le fuseau du LIEU (D24) : un vol qui part
  // à 00 h 30 à Dubaï ne part pas « la veille » parce que le téléphone est
  // à Paris. Sans fuseau, repli sur l'appareil — jamais rien.
  const local = localDateTime(texte(trip.departureAt) || null, texte(trip.originTimezone) || null);

  const actions = Array.isArray(envoi.allowedActions)
    ? (envoi.allowedActions.filter(
        (a): a is ActionEnvoi => a === 'cancel' || a === 'dispute' || a === 'confirmEarly'
      ) as ActionEnvoi[])
    : [];

  return {
    id,
    statut,
    depart: texte(trip.originCity),
    arrivee: texte(trip.destinationCity),
    dateDepart: local?.date ?? null,
    heureDepart: local?.time ?? '',
    voyageur: nomDuVoyageur(objet(envoi.carrier)),
    totalCents: nombreOuNull(pricing.totalShipperCents),
    devise: texte(pricing.currencyCode) || 'EUR',
    actions,
    peutNoter: rating.canRate === true && rating.ratedByMe !== true,
    expireLe: statut === 'PENDING' ? texte(envoi.expiresAt) || null : null,
  };
}

/** Le serveur autorise-t-il ce geste sur cet envoi ? */
export function peut(envoi: EnvoiDeLaListe, action: ActionEnvoi): boolean {
  return envoi.actions.includes(action);
}

/* ── Les trois sections ───────────────────────────────────────────────── */

export type SectionDesEnvois = 'aTraiter' | 'enCours' | 'passes';

export const SECTIONS: readonly SectionDesEnvois[] = ['aTraiter', 'enCours', 'passes'];

/** Les statuts qui ne bougeront plus. */
const TERMINES: readonly StatutEnvoi[] = ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'];

/**
 * La section d'un envoi — déduite de ce que le SERVEUR accorde, pas d'une
 * table de statuts (voir l'en-tête).
 *
 * « À traiter » ne contient que ce que l'Expéditeur peut faire AVANCER.
 * `cancel` et `dispute` n'y entrent pas : défaire et escalader sont des
 * sorties de secours, pas des tâches en attente — les mettre en tête
 * transformerait la liste en liste de regrets.
 */
export function sectionDeLEnvoi(envoi: EnvoiDeLaListe): SectionDesEnvois {
  if (peut(envoi, 'confirmEarly') || envoi.peutNoter) return 'aTraiter';
  return TERMINES.includes(envoi.statut) ? 'passes' : 'enCours';
}

/**
 * Les envois groupés, dans l'ordre des sections, les vides retirées.
 *
 * L'ordre du serveur est conservé DANS chaque section : `GET /me/bookings`
 * trie par date de création décroissante, c'est-à-dire le plus récent
 * d'abord, ce qui est le bon ordre pour une liste d'envois (on suit le
 * dernier colis parti, on ne planifie rien).
 */
export function grouperLesEnvois(
  envois: EnvoiDeLaListe[]
): { section: SectionDesEnvois; envois: EnvoiDeLaListe[] }[] {
  return SECTIONS.map((section) => ({
    section,
    envois: envois.filter((envoi) => sectionDeLEnvoi(envoi) === section),
  })).filter((groupe) => groupe.envois.length > 0);
}

/* ── L'action mise en avant ───────────────────────────────────────────── */

/**
 * UNE action par carte. La carte entière mène au suivi : le bouton n'est là
 * que lorsqu'un geste fait AVANCER l'envoi.
 *
 * Confirmer passe avant noter : tant que la réception n'est pas confirmée,
 * l'argent du Voyageur est bloqué. Noter peut attendre, pas être payé.
 */
export type ActionMiseEnAvant = 'confirmer' | 'noter' | null;

export function actionMiseEnAvant(envoi: EnvoiDeLaListe): ActionMiseEnAvant {
  if (peut(envoi, 'confirmEarly')) return 'confirmer';
  return envoi.peutNoter ? 'noter' : null;
}

/** Le compte annoncé en tête : ce qui n'est pas encore derrière soi. */
export function compteEnCours(envois: EnvoiDeLaListe[]): number {
  return envois.filter((envoi) => sectionDeLEnvoi(envoi) !== 'passes').length;
}

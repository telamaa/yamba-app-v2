/**
 * rendez-vous.ts — se retrouver, côté règles (D118).
 * ====================================================
 * Zéro import : le harnais (A223) doit pouvoir jouer ces règles sous Node.
 *
 * ── UN CONTRÔLE EST UNE GRAMMAIRE ───────────────────────────────────────
 * Le serveur pose trois bornes sur un créneau (`meetup.rules.ts`) : au moins
 * trente minutes d'avance, douze heures de fenêtre au plus, quatre-vingt-dix
 * jours au plus. Le site demande DEUX `datetime-local` — donc il peut
 * exprimer « fin avant début », et il doit l'expliquer après coup.
 *
 * Ici on compose un JOUR, une HEURE et une DURÉE. La durée vient d'une liste
 * de paliers, donc `END_BEFORE_START` et `WINDOW_TOO_LONG` sont
 * **inatteignables** ; les jours proposés s'arrêtent avant la borne, donc
 * `TOO_FAR` aussi ; les heures déjà passées ou trop proches ne sont pas
 * offertes, donc `TOO_SOON` disparaît du vocabulaire de l'écran.
 *
 * **On ne recopie pas les bornes pour DÉCIDER — on compose un contrôle dont
 * la sortie est toujours dans leur domaine.** Elles restent ici pour que les
 * fiches puissent les confronter au contrat, jamais pour trancher un refus.
 *
 * ── CE QUE LE SERVEUR A DÉJÀ TRANCHÉ, ON NE LE RECALCULE PAS ────────────
 * Lequel des rendez-vous compte (le confirmé à venir, ou la contre-proposition
 * plus récente que l'acceptation) est une règle du serveur, servie dans
 * `conversation.nextMeetup`. La refaire ici donnerait deux vérités, et le
 * jour où ANO-WEB-47 se rejoue, l'une des deux serait fausse.
 */

/* ── Les bornes du contrat, pour les FICHES et pour composer ──────────── */
export const AVANCE_MINIMALE_MINUTES = 30;
export const FENETRE_MAX_HEURES = 12;
export const JOURS_MAX = 90;
export const LIEU_MIN = 3;
export const LIEU_MAX = 160;
export const DETAIL_MAX = 500;

/** Les jours offerts d'emblée. Au-delà, on en déroule d'autres — jamais 90. */
export const JOURS_PROPOSES = 14;

/**
 * Les durées offertes, en minutes. Toutes sous les douze heures du contrat :
 * c'est ce qui rend `WINDOW_TOO_LONG` inatteignable.
 *
 * Trois heures est le plus long qu'on propose pour un rendez-vous d'aéroport.
 * Vouloir plus large n'est pas une durée, c'est une indisponibilité — et cela
 * se dit dans le fil, pas dans un créneau.
 */
export const DUREES_MINUTES = [30, 60, 120, 180] as const;
export type DureeMinutes = (typeof DUREES_MINUTES)[number];

/** Le pas des heures offertes : un quart d'heure. */
export const PAS_DES_HEURES_MINUTES = 15;

export type GenreDeRendezVous = 'PICKUP' | 'DELIVERY';
export type StatutDeRendezVous = 'PROPOSED' | 'ACCEPTED' | 'CANCELLED';
export type RoleDuFil = 'SHIPPER' | 'CARRIER';

export type RendezVous = {
  id: string;
  genre: GenreDeRendezVous;
  statut: StatutDeRendezVous;
  proposePar: RoleDuFil;
  lieu: string;
  detail: string | null;
  debutA: string;
  finA: string;
};

export type FenetreDuNumero = {
  /** Le numéro est déjà ouvert pour moi. */
  revele: boolean;
  /** Le numéro, quand il est révélé. */
  numero: string | null;
  /** Quand la porte s'ouvre, ISO — `null` si aucune ancre n'existe encore. */
  ouvreA: string | null;
};

/* ══ Lecture défensive ════════════════════════════════════════════════ */

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

function objet(valeur: unknown): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : {};
}

function texteOuNull(valeur: unknown): string | null {
  const t = texte(valeur).trim();
  return t.length > 0 ? t : null;
}

const GENRES: readonly GenreDeRendezVous[] = ['PICKUP', 'DELIVERY'];
const STATUTS: readonly StatutDeRendezVous[] = ['PROPOSED', 'ACCEPTED', 'CANCELLED'];

/** Un rendez-vous de l'API, ou `null` s'il n'a ni identité ni créneau. */
export function rendezVousDeLApi(brut: unknown): RendezVous | null {
  const m = objet(brut);
  const id = texte(m.id).trim();
  const debutA = texte(m.startAt).trim();
  if (id.length === 0 || debutA.length === 0) return null;

  const genre = texte(m.kind).trim().toUpperCase();
  const statut = texte(m.status).trim().toUpperCase();
  const propose = texte(m.proposedByRole).trim().toUpperCase();
  // Un rendez-vous dont on ne sait pas QUI l'a proposé ne peut pas décider
  // du bouton « Accepter » : on ne l'affiche pas plutôt que de l'offrir au
  // mauvais côté.
  if (propose !== 'SHIPPER' && propose !== 'CARRIER') return null;

  return {
    id,
    genre: (GENRES.find((g) => g === genre) ?? 'PICKUP') as GenreDeRendezVous,
    statut: (STATUTS.find((s) => s === statut) ?? 'PROPOSED') as StatutDeRendezVous,
    proposePar: propose,
    lieu: texte(m.placeLabel).trim(),
    detail: texteOuNull(m.placeDetails),
    debutA,
    finA: texte(m.endAt).trim() || debutA,
  };
}

/**
 * La fenêtre du numéro, telle que le serveur la sert.
 *
 * `opensAt` à `null` ne veut pas dire « jamais » : il veut dire **aucune
 * ancre** — ni rendez-vous de prise en charge accepté, ni date de départ
 * lisible. L'écran dit alors qu'il faut d'abord convenir d'un rendez-vous,
 * ce qui est l'action utile, plutôt que d'afficher une heure absente.
 */
export function fenetreDuNumero(brut: unknown): FenetreDuNumero {
  const p = objet(brut);
  const revele = p.revealed === true;
  return {
    revele,
    numero: revele ? texteOuNull(p.phoneE164) : null,
    ouvreA: texteOuNull(p.opensAt),
  };
}

/** La porte est-elle ouverte MAINTENANT ? L'heure vient du serveur. */
export function numeroOuvrable(fenetre: FenetreDuNumero, maintenantMs: number): boolean {
  if (fenetre.revele) return true;
  if (fenetre.ouvreA === null) return false;
  const ouvre = new Date(fenetre.ouvreA).getTime();
  return !Number.isNaN(ouvre) && maintenantMs >= ouvre;
}

/**
 * Ce que l'écran dit du numéro. Jamais un bouton mort : les quatre états
 * sont nommés, et trois d'entre eux portent une suite.
 */
export type EtatDuNumero = 'revele' | 'ouvrable' | 'trop-tot' | 'sans-ancre';

export function etatDuNumero(fenetre: FenetreDuNumero, maintenantMs: number): EtatDuNumero {
  if (fenetre.revele) return 'revele';
  if (fenetre.ouvreA === null) return 'sans-ancre';
  return numeroOuvrable(fenetre, maintenantMs) ? 'ouvrable' : 'trop-tot';
}

/* ══ Accepter ═════════════════════════════════════════════════════════ */

/**
 * Puis-je accepter ce rendez-vous ?
 *
 * Miroir exact de `canAcceptMeetup` côté serveur : seule une proposition
 * OUVERTE, et seulement par l'AUTRE partie. On n'accepte pas la sienne —
 * l'écran ne doit donc pas offrir un bouton que le serveur refusera
 * (`OWN_PROPOSAL`), il doit dire qu'on attend une réponse.
 */
export function peutAccepter(
  rdv: RendezVous | null,
  monRole: RoleDuFil,
  peutEcrire: boolean
): boolean {
  if (rdv === null || !peutEcrire) return false;
  return rdv.statut === 'PROPOSED' && rdv.proposePar !== monRole;
}

/** J'ai proposé et j'attends : l'autre moitié de la question précédente. */
export function attendUneReponse(rdv: RendezVous | null, monRole: RoleDuFil): boolean {
  return rdv !== null && rdv.statut === 'PROPOSED' && rdv.proposePar === monRole;
}

/* ══ Composer un créneau ══════════════════════════════════════════════ */

/** Une journée offerte : sa clé stable, et l'instant de son minuit local. */
export type JourProposable = { cle: string; minuitMs: number };

function cleDuJour(instant: Date): string {
  const mois = `${instant.getMonth() + 1}`.padStart(2, '0');
  const jour = `${instant.getDate()}`.padStart(2, '0');
  return `${instant.getFullYear()}-${mois}-${jour}`;
}

/**
 * Les journées offertes, à partir d'aujourd'hui.
 *
 * Bornées à `JOURS_MAX` : la bande ne peut pas proposer un jour que le
 * serveur refuserait (`TOO_FAR`). C'est la borne qui limite le contrôle, et
 * non le contrôle qui explique la borne.
 */
export function joursProposables(maintenantMs: number, combien = JOURS_PROPOSES): JourProposable[] {
  const depart = new Date(maintenantMs);
  if (Number.isNaN(depart.getTime())) return [];
  const minuit = new Date(depart.getFullYear(), depart.getMonth(), depart.getDate());
  const jours: JourProposable[] = [];
  for (let i = 0; i < Math.min(combien, JOURS_MAX); i += 1) {
    const j = new Date(minuit.getFullYear(), minuit.getMonth(), minuit.getDate() + i);
    jours.push({ cle: cleDuJour(j), minuitMs: j.getTime() });
  }
  return jours;
}

/**
 * Les heures offertes pour une journée, par quarts d'heure.
 *
 * Aujourd'hui, on saute tout ce qui est passé ou à moins de trente minutes :
 * le serveur refuserait (`TOO_SOON`), donc l'écran ne le propose pas. Les
 * autres jours sont offerts en entier.
 *
 * Rend des minutes depuis minuit — l'écran les met en forme dans la langue
 * du lecteur (D108), ces nombres ne s'affichent jamais tels quels.
 */
export function heuresProposables(jour: JourProposable, maintenantMs: number): number[] {
  const plancher = maintenantMs + AVANCE_MINIMALE_MINUTES * 60_000;
  const heures: number[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += PAS_DES_HEURES_MINUTES) {
    if (jour.minuitMs + minutes * 60_000 >= plancher) heures.push(minutes);
  }
  return heures;
}

export type CreneauChoisi = {
  jour: JourProposable | null;
  minutes: number | null;
  duree: DureeMinutes;
  lieu: string;
  detail: string;
  genre: GenreDeRendezVous;
};

/** Le créneau en instants, ou `null` si le jour ou l'heure manquent. */
export function creneauDe(choix: CreneauChoisi): { debutA: string; finA: string } | null {
  if (choix.jour === null || choix.minutes === null) return null;
  const debut = choix.jour.minuitMs + choix.minutes * 60_000;
  return {
    debutA: new Date(debut).toISOString(),
    finA: new Date(debut + choix.duree * 60_000).toISOString(),
  };
}

/* ══ Ce qui retient la proposition ════════════════════════════════════ */

export type ManqueDuRendezVous =
  | { quoi: 'ferme' }
  | { quoi: 'jour' }
  | { quoi: 'heure' }
  | { quoi: 'lieu'; caracteres: number }
  | { quoi: 'lieu-trop-long'; dePlus: number }
  | { quoi: 'detail-trop-long'; dePlus: number }
  | { quoi: 'envoi' };

/**
 * Ce qui retient, dans l'ordre où l'écran le lit — jamais un booléen
 * (D115 2A). La fermeture passe devant : dire « choisis un jour » à
 * quelqu'un dont la conversation est close est exact et hors sujet.
 */
export function manquesDuRendezVous({
  choix,
  peutEcrire,
  envoiEnCours,
}: {
  choix: CreneauChoisi;
  peutEcrire: boolean;
  envoiEnCours: boolean;
}): ManqueDuRendezVous[] {
  const manques: ManqueDuRendezVous[] = [];
  if (!peutEcrire) manques.push({ quoi: 'ferme' });
  if (choix.jour === null) manques.push({ quoi: 'jour' });
  if (choix.minutes === null) manques.push({ quoi: 'heure' });

  const lieu = choix.lieu.trim();
  if (lieu.length < LIEU_MIN) manques.push({ quoi: 'lieu', caracteres: LIEU_MIN - lieu.length });
  if (choix.lieu.length > LIEU_MAX)
    manques.push({ quoi: 'lieu-trop-long', dePlus: choix.lieu.length - LIEU_MAX });
  if (choix.detail.length > DETAIL_MAX)
    manques.push({ quoi: 'detail-trop-long', dePlus: choix.detail.length - DETAIL_MAX });

  if (envoiEnCours) manques.push({ quoi: 'envoi' });
  return manques;
}

/** Le corps accepté par le contrat, ou `null` si quelque chose retient. */
export function corpsDuRendezVous(etat: {
  choix: CreneauChoisi;
  peutEcrire: boolean;
  envoiEnCours: boolean;
}): {
  kind: GenreDeRendezVous;
  placeLabel: string;
  placeDetails?: string;
  startAt: string;
  endAt: string;
} | null {
  if (manquesDuRendezVous(etat).length > 0) return null;
  const creneau = creneauDe(etat.choix);
  if (creneau === null) return null;
  const detail = etat.choix.detail.trim();
  return {
    kind: etat.choix.genre,
    placeLabel: etat.choix.lieu.trim(),
    ...(detail.length > 0 ? { placeDetails: detail } : {}),
    startAt: creneau.debutA,
    endAt: creneau.finA,
  };
}

/**
 * La clé de phrase d'un refus serveur.
 *
 * Les trois bornes de créneau ne devraient JAMAIS arriver ici — le contrôle
 * ne sait pas les exprimer. Elles restent traduites parce qu'un serveur peut
 * durcir ses bornes sans prévenir l'app : ce jour-là, le Voyageur lira une
 * phrase plutôt qu'un code.
 */
export function cleDuRefusDuRendezVous(code: unknown, raison: unknown): string {
  const c = texte(code).trim().toUpperCase();
  const r = texte(raison).trim().toUpperCase();
  if (c === 'CONVERSATION_READ_ONLY') return 'ferme';
  if (c === 'MEETUP_CHANGED') return 'change';
  if (c === 'MEETUP_NOT_ACCEPTABLE') return r === 'OWN_PROPOSAL' ? 'sienne' : 'change';
  if (c === 'MEETUP_NOT_FOUND') return 'introuvable';
  if (c === 'INVALID_MEETUP_SLOT') {
    if (r === 'TOO_SOON') return 'tropTot';
    if (r === 'TOO_FAR') return 'tropLoin';
    if (r === 'WINDOW_TOO_LONG') return 'tropLong';
    return 'creneau';
  }
  return 'echec';
}

/** La clé de phrase d'un refus de révélation du numéro. */
export function cleDuRefusDuNumero(code: unknown): 'tropTot' | 'sansAncre' | 'echec' {
  const c = texte(code).trim().toUpperCase();
  if (c === 'TOO_EARLY') return 'tropTot';
  if (c === 'NO_ANCHOR') return 'sansAncre';
  return 'echec';
}

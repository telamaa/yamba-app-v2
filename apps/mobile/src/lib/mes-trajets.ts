/**
 * mes-trajets.ts — la liste des trajets du Voyageur, côté règles.
 * ================================================================
 * D111 quinquies. Zéro import : le harnais doit pouvoir jouer ces règles
 * (frontière A223), et il n'y a rien ici qui ait besoin d'un écran.
 *
 * LE CLIENT NE DÉCIDE JAMAIS CE QU'IL PEUT FAIRE. Le serveur rend
 * `allowedActions` avec chaque trajet (`getMyTrips`), calculé par sa machine
 * à états — qui connaît, elle, les réservations en cours. Ce fichier ne fait
 * que LIRE cette liste : réimplémenter « on peut annuler un trajet publié »
 * côté app, c'est promettre un bouton que le serveur refusera (D72 : un
 * trajet avec une réservation vivante ne s'annule pas).
 *
 * La projection est DÉFENSIVE pour la même raison que `publish-reverse.ts` :
 * la base contient des trajets écrits par le site, par d'anciennes versions
 * de l'app et par des seeds.
 */

export type StatutTrajet =
  | 'DRAFT'
  | 'PUBLISHED'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ARCHIVED';

const STATUTS: readonly StatutTrajet[] = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
];

/** Les actions que la machine à états du serveur sait nommer. */
export type ActionTrajet =
  | 'publish'
  | 'pause'
  | 'resume'
  | 'unpublish'
  | 'restore'
  | 'cancel'
  | 'delete'
  | 'archive'
  | 'edit'
  | 'view'
  | 'viewPublic'
  | 'duplicate';

export type TrajetDeLaListe = {
  id: string;
  statut: StatutTrajet;
  depart: string;
  arrivee: string;
  /** `yyyy-mm-dd`, ou `null` — un brouillon peut n'avoir aucune date. */
  dateDepart: string | null;
  heureDepart: string;
  prixParKiloCents: number | null;
  capaciteKg: number | null;
  /** Ce que le SERVEUR autorise. Lu, jamais déduit. */
  actions: ActionTrajet[];
};

/* ── Projection défensive ─────────────────────────────────────────────── */

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

function nombreOuNull(valeur: unknown): number | null {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : null;
}

/**
 * Un trajet de l'API, ou `null` s'il n'a même pas d'identifiant ou de
 * statut connu — une ligne qu'on ne sait pas nommer ne s'affiche pas.
 */
export function trajetDeLApi(brut: unknown): TrajetDeLaListe | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const trajet = brut as Record<string, unknown>;

  const id = texte(trajet.id);
  const statut = texte(trajet.status) as StatutTrajet;
  if (id.length === 0 || !STATUTS.includes(statut)) return null;

  const actions = Array.isArray(trajet.allowedActions)
    ? (trajet.allowedActions.filter((a) => typeof a === 'string') as ActionTrajet[])
    : [];

  return {
    id,
    statut,
    depart: texte(trajet.originCity),
    arrivee: texte(trajet.destinationCity),
    dateDepart: texte(trajet.departureDateLocal) || null,
    heureDepart: texte(trajet.departureTimeLocal),
    prixParKiloCents: nombreOuNull(trajet.pricePerKgCents),
    capaciteKg: nombreOuNull(trajet.capacityKg),
    actions,
  };
}

/** Le serveur autorise-t-il cette action sur ce trajet ? */
export function peut(trajet: TrajetDeLaListe, action: ActionTrajet): boolean {
  return trajet.actions.includes(action);
}

/* ── Les trois sections ───────────────────────────────────────────────── */

export type SectionDesTrajets = 'aFinaliser' | 'enLigne' | 'passes';

export const SECTIONS: readonly SectionDesTrajets[] = ['aFinaliser', 'enLigne', 'passes'];

/**
 * Trois sections, et pas de filtre à choisir.
 *
 * Des pastilles de filtre donneraient un écran VIDE dès qu'on en tape une
 * qui ne correspond à rien — et un écran vide qu'on a provoqué soi-même se
 * lit comme une panne. Des sections montrent tout d'un coup d'œil, et celles
 * qui n'ont rien disparaissent.
 */
export function sectionDuStatut(statut: StatutTrajet): SectionDesTrajets {
  if (statut === 'DRAFT') return 'aFinaliser';
  if (statut === 'PUBLISHED' || statut === 'PAUSED') return 'enLigne';
  return 'passes';
}

/**
 * Les trajets groupés, dans l'ordre des sections, les vides retirées.
 *
 * Tri INTERNE : « en ligne » par date de départ CROISSANTE (le prochain
 * voyage d'abord — c'est celui qui demande une décision), les autres dans
 * l'ordre du serveur (le plus récemment créé d'abord). Un trajet sans date
 * passe en dernier plutôt que de s'intercaler au hasard.
 */
export function grouperLesTrajets(
  trajets: TrajetDeLaListe[]
): { section: SectionDesTrajets; trajets: TrajetDeLaListe[] }[] {
  return SECTIONS.map((section) => {
    const dedans = trajets.filter((trajet) => sectionDuStatut(trajet.statut) === section);
    if (section === 'enLigne') {
      dedans.sort((a, b) => {
        if (a.dateDepart === null) return b.dateDepart === null ? 0 : 1;
        if (b.dateDepart === null) return -1;
        return a.dateDepart.localeCompare(b.dateDepart);
      });
    }
    return { section, trajets: dedans };
  }).filter((groupe) => groupe.trajets.length > 0);
}

/* ── L'action mise en avant ───────────────────────────────────────────── */

/**
 * UNE action par carte, et c'est délibéré : une liste n'est pas un tableau
 * de bord. Celle qu'on met en avant est celle qui fait AVANCER le trajet —
 * finir un brouillon, remettre en ligne une pause. Les autres (annuler,
 * supprimer) vivent en second, et les plus rares pas du tout : elles
 * appartiennent à la fiche du trajet, pas à sa ligne de liste.
 */
export type ActionMiseEnAvant = 'continuer' | 'pause' | 'remettre' | 'restaurer' | null;

export function actionMiseEnAvant(trajet: TrajetDeLaListe): ActionMiseEnAvant {
  if (trajet.statut === 'DRAFT') return peut(trajet, 'edit') ? 'continuer' : null;
  if (trajet.statut === 'PUBLISHED') return peut(trajet, 'pause') ? 'pause' : null;
  if (trajet.statut === 'PAUSED') return peut(trajet, 'resume') ? 'remettre' : null;
  if (trajet.statut === 'CANCELLED') return peut(trajet, 'restore') ? 'restaurer' : null;
  return null;
}

/** Le compte affiché en tête d'écran : ce que le Voyageur a en cours. */
export function compteEnCours(trajets: TrajetDeLaListe[]): number {
  return trajets.filter((trajet) => sectionDuStatut(trajet.statut) !== 'passes').length;
}

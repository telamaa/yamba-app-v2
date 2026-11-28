/**
 * mes-demandes.ts — les demandes reçues par le Voyageur, côté règles.
 * =====================================================================
 * D113. Un seul import, et il est PUR (`trip-local-dates`).
 *
 * LE TEMPS EST LE SUJET. Une demande meurt en 24 h (DEA-01) : c'est la
 * SEULE liste de l'app où attendre coûte quelque chose à quelqu'un d'autre.
 * D'où un tri par échéance CROISSANTE — celle qui expire en premier se
 * répond en premier — là où « Mes envois » garde l'ordre du serveur, parce
 * qu'on y suit un colis plutôt qu'on ne répond à quelqu'un.
 *
 * L'APP NE DÉCIDE RIEN, ni sur les gestes (`allowedActions`), ni sur ce
 * qu'elle a le droit de MONTRER : le destinataire est minimisé côté serveur
 * (`recipientForCarrier` — nom à l'acceptation, téléphone à la prise en
 * charge, jamais l'email, ANO-API-15). L'écran affiche ce qu'on lui sert.
 * Filtrer ici créerait une SECONDE règle de confidentialité, et l'une des
 * deux serait fausse un jour.
 *
 * LE GAIN, JAMAIS LE TOTAL : la vue Voyageur ne porte que `transportCents`
 * (A13). Ce que l'app ne reçoit pas, elle ne le recompose pas.
 */
import { localDateTime } from '@/lib/trip-local-dates';

/** Les statuts qu'une demande peut porter, vus du Voyageur. */
export type StatutDemande =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'DISPUTED';

const STATUTS: readonly StatutDemande[] = [
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

/** Les gestes que la machine à états accorde au VOYAGEUR. */
export type ActionDemande =
  | 'accept'
  | 'decline'
  | 'cancel'
  | 'pickup'
  | 'refusePickup'
  | 'deliver';

const ACTIONS: readonly ActionDemande[] = [
  'accept',
  'decline',
  'cancel',
  'pickup',
  'refusePickup',
  'deliver',
];

/**
 * D'où vient le mot qui décrit le colis. Les deux dictionnaires sont
 * différents : `famille` = les huit familles D14, `categorie` = les douze
 * codes legacy du site.
 */
export type FamilleDuColis =
  | { source: 'famille'; code: string }
  | { source: 'categorie'; code: string }
  | null;

export type DemandeDeLaListe = {
  id: string;
  statut: StatutDemande;
  depart: string;
  arrivee: string;
  /** `yyyy-mm-dd` dans le fuseau du lieu de DÉPART, ou `null`. */
  dateDepart: string | null;
  heureDepart: string;
  /** « Aminata D. » — ce que le serveur sert, pas davantage. */
  expediteur: string;
  /**
   * CE QU'IL Y A DANS LE COLIS — un CODE, et d'où il vient. La règle ne
   * traduit pas : elle dit quel dictionnaire lire.
   *
   * Deux populations cohabitent en base, comme pour les dates (D112) :
   * les réservations récentes portent une famille D14 (`categoryFamily`,
   * écrite par `booking-request.ts`), les anciennes n'ont qu'une catégorie
   * legacy (`category`, A29). Mesuré sur la base de recette : `categoryFamily`
   * est null sur les treize réservations du seed.
   *
   * `null` quand on ne sait rien — afficher « OTHER_ELECTRONICS » à un
   * Voyageur serait lui faire lire un identifiant technique (défaut D83).
   */
  colis: FamilleDuColis;
  poidsKg: number | null;
  /** CE QUE LE VOYAGEUR GAGNE. Jamais le total payé par l'Expéditeur. */
  gainCents: number | null;
  devise: string;
  /** PENDING : l'instant où la demande tombe (DEA-01), sinon `null`. */
  expireLe: string | null;
  /** Ce que le SERVEUR autorise. Lu, jamais déduit. */
  actions: ActionDemande[];
  /**
   * LA REMISE (D116) — ce que le serveur annonce de la saisie du code (A38).
   * `essaisRestants` vaut `null` quand le champ n'est pas servi : on ne
   * suppose pas trois essais, on ne montre rien.
   */
  essaisRestants: number | null;
  verrouJusqua: string | null;
  /** Les jalons déjà confirmés, bruts — `lib/jalons.ts` les ordonne. */
  jalons: unknown;
  /**
   * LE DESTINATAIRE, tel que le serveur le MINIMISE (ANO-API-15) : prénom à
   * l'acceptation, téléphone à partir de la prise en charge, jamais l'email.
   *
   * D113 ne le projetait pas, et avait raison : ni la liste ni la fiche de
   * demande n'en ont l'usage. La REMISE, elle, en a besoin — c'est lui qui
   * dicte le code, et c'est lui qu'on appelle quand on ne le trouve pas.
   * L'app n'ajoute AUCUN filtre : elle affiche ce qu'on lui sert, sans quoi
   * il existerait deux règles de confidentialité et l'une serait fausse.
   */
  destinataire: { prenom: string; telephone: string | null };
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

function nomCourt(personne: Record<string, unknown>): string {
  const prenom = texte(personne.firstName).trim();
  const initiale = texte(personne.lastInitial).trim();
  if (prenom.length === 0) return initiale;
  return initiale.length === 0 ? prenom : `${prenom} ${initiale}.`;
}

/**
 * Une demande de l'API, ou `null` si elle n'a ni identifiant ni statut
 * connu — une ligne qu'on ne sait pas nommer ne s'affiche pas.
 */
export function demandeDeLApi(brut: unknown): DemandeDeLaListe | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const demande = brut as Record<string, unknown>;

  const id = texte(demande.id);
  const statut = texte(demande.status) as StatutDemande;
  if (id.length === 0 || !STATUTS.includes(statut)) return null;

  const trip = objet(demande.trip);
  const parcel = objet(demande.parcel);
  const pricing = objet(demande.pricing);

  const local = localDateTime(texte(trip.departureAt) || null, texte(trip.originTimezone) || null);

  const actions = Array.isArray(demande.allowedActions)
    ? (demande.allowedActions.filter(
        (a): a is ActionDemande => typeof a === 'string' && ACTIONS.includes(a as ActionDemande)
      ) as ActionDemande[])
    : [];

  return {
    id,
    statut,
    depart: texte(trip.originCity),
    arrivee: texte(trip.destinationCity),
    dateDepart: local?.date ?? null,
    heureDepart: local?.time ?? '',
    expediteur: nomCourt(objet(demande.shipper)),
    colis: colisDuParcel(parcel),
    poidsKg: nombreOuNull(pricing.weightKg),
    gainCents: nombreOuNull(pricing.transportCents),
    devise: texte(pricing.currencyCode) || 'EUR',
    expireLe: statut === 'PENDING' ? texte(demande.expiresAt) || null : null,
    actions,
    essaisRestants: nombreOuNull(demande.deliveryAttemptsLeft),
    verrouJusqua: texte(demande.deliveryLockedUntil) || null,
    jalons: demande.trackingEvents,
    destinataire: destinataireDuServeur(objet(demande.recipient)),
  };
}

/**
 * Le destinataire : ce que le serveur sert, pas davantage. Un champ absent
 * devient une chaîne vide ou `null` — jamais un « — » ni un nom inventé.
 */
function destinataireDuServeur(recipient: Record<string, unknown>): {
  prenom: string;
  telephone: string | null;
} {
  // `phoneE164`, le NOM EXACT du contrat (`CarrierRecipientView`) — pas
  // `phone`. Un champ mal nommé est silencieux : il traverse le réseau et
  // disparaît au `JSON.parse`, et l'écran affiche simplement « pas de
  // numéro » (le défaut D102, cinq compteurs perdus de la même façon).
  return {
    prenom: texte(recipient.firstName).trim(),
    telephone: texte(recipient.phoneE164).trim() || null,
  };
}

/**
 * La famille D14 d'abord, la catégorie legacy ensuite, rien sinon.
 * Jamais de code brut vers l'écran : c'est l'écran qui ira chercher le mot.
 */
function colisDuParcel(parcel: Record<string, unknown>): FamilleDuColis {
  const famille = texte(parcel.categoryFamily).trim();
  if (famille.length > 0) return { source: 'famille', code: famille };
  const categorie = texte(parcel.category).trim();
  return categorie.length > 0 ? { source: 'categorie', code: categorie } : null;
}

/** Le serveur autorise-t-il ce geste sur cette demande ? */
export function peut(demande: DemandeDeLaListe, action: ActionDemande): boolean {
  return demande.actions.includes(action);
}

/* ── Les trois sections ───────────────────────────────────────────────── */

export type SectionDesDemandes = 'aRepondre' | 'enCours' | 'passees';

export const SECTIONS: readonly SectionDesDemandes[] = ['aRepondre', 'enCours', 'passees'];

const TERMINEES: readonly StatutDemande[] = ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED'];

/**
 * « À répondre » = ce que le serveur attend encore de moi, et rien d'autre.
 * Déduit de `accept`, comme D112 déduit « à traiter » de `confirmEarly` :
 * une table de statuts dirait la même chose aujourd'hui et mentirait le jour
 * où la machine change.
 */
export function sectionDeLaDemande(demande: DemandeDeLaListe): SectionDesDemandes {
  if (peut(demande, 'accept')) return 'aRepondre';
  return TERMINEES.includes(demande.statut) ? 'passees' : 'enCours';
}

/**
 * Les demandes groupées, les sections vides retirées.
 *
 * « À répondre » est triée par ÉCHÉANCE CROISSANTE : celle qui tombe en
 * premier se répond en premier. Une demande sans échéance lisible passe en
 * dernier plutôt que de s'intercaler au hasard. Les deux autres sections
 * gardent l'ordre du serveur (création décroissante) — on n'y court pas
 * après une horloge.
 */
export function grouperLesDemandes(
  demandes: DemandeDeLaListe[]
): { section: SectionDesDemandes; demandes: DemandeDeLaListe[] }[] {
  return SECTIONS.map((section) => {
    const dedans = demandes.filter((demande) => sectionDeLaDemande(demande) === section);
    if (section === 'aRepondre') {
      dedans.sort((a, b) => {
        const ta = echeance(a);
        const tb = echeance(b);
        if (ta === null) return tb === null ? 0 : 1;
        if (tb === null) return -1;
        return ta - tb;
      });
    }
    return { section, demandes: dedans };
  }).filter((groupe) => groupe.demandes.length > 0);
}

/** L'échéance en millisecondes, ou `null` si elle est absente ou illisible. */
function echeance(demande: DemandeDeLaListe): number | null {
  if (demande.expireLe === null) return null;
  const t = new Date(demande.expireLe).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * L'urgence d'une demande, pour la mettre en évidence SANS crier.
 *
 * Trois crans et pas davantage : au-delà, c'est un nuancier que personne ne
 * décode. `null` quand il n'y a pas d'horloge — une demande déjà acceptée
 * n'est pas « calme », elle est hors sujet.
 */
export type Urgence = 'bientot' | 'aujourdhui' | 'calme';

/** Moins de 3 h : « bientôt ». Moins de 12 h : « aujourd'hui ». */
const BIENTOT_MS = 3 * 3_600_000;
const AUJOURDHUI_MS = 12 * 3_600_000;

export function urgenceDeLaDemande(demande: DemandeDeLaListe, maintenantMs: number): Urgence | null {
  const t = echeance(demande);
  if (t === null) return null;
  const reste = t - maintenantMs;
  // Échue : plus d'urgence à signaler, le serveur l'aura expirée.
  if (reste <= 0) return null;
  if (reste <= BIENTOT_MS) return 'bientot';
  return reste <= AUJOURDHUI_MS ? 'aujourdhui' : 'calme';
}

/** Le compte annoncé en tête : ce que le Voyageur doit encore répondre. */
export function compteARepondre(demandes: DemandeDeLaListe[]): number {
  return demandes.filter((demande) => sectionDeLaDemande(demande) === 'aRepondre').length;
}

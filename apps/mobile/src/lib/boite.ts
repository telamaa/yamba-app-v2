/**
 * boite.ts — la boîte aux lettres, côté règles (D119).
 * ======================================================
 * Zéro import : le harnais (A223) doit pouvoir jouer ces règles sous Node.
 *
 * ── UNE UNION FERMÉE SE COUVRE EN ENTIER ────────────────────────────────
 * `NotificationType` est une union FERMÉE de vingt-cinq clés (20 `booking.*`,
 * 4 `conversation.*`, 1 système). C'est la leçon d'ANO-API-16, qui fut
 * BLOQUANTE : l'union ne couvrait pas `conversation.*` et **toute la boîte
 * répondait 500**. Elle a été complétée côté serveur ; côté client, personne
 * n'avait compté — neuf types n'avaient aucun libellé sur le site, dont les
 * quatre `conversation.*` que D117 et D118 viennent de rendre quotidiens.
 *
 * Le REPLI reste (un client ne doit jamais rester muet sur un type que le
 * serveur a déployé avant lui), mais une fiche confronte la table des
 * libellés à l'union Zod RÉELLE : il cesse d'être l'endroit où neuf
 * événements vont mourir.
 *
 * ── LES TITRES SONT NEUTRES, PARCE QU'ILS SONT SANS RÔLE ────────────────
 * Le même événement se lit des deux côtés : « ta demande a été acceptée »
 * (Expéditeur) est « tu as accepté » (Voyageur). Le site tient DEUX tables,
 * une par rôle. Ici on tient la table courte de la cloche — un titre par
 * type, rédigé NEUTRE — et on y ajoute le prénom servi par le DTO. Une
 * phrase neutre est moins riche ; une phrase au mauvais rôle est fausse.
 *
 * ── CE QUI N'EST PAS ICI ────────────────────────────────────────────────
 * Aucune notion de PUSH : D120 est gravée en candidate, sans code.
 */

export type NotificationDeLaBoite = {
  id: string;
  /** La clé d'événement du contrat, telle quelle (ex. `booking.requested`). */
  type: string;
  bookingId: string | null;
  /** Le prénom de l'AUTRE partie (A91), ou `null` (compte effacé, système). */
  prenomDeLAutre: string | null;
  /** Le corridor, quand la charge utile le porte. */
  corridor: string | null;
  /** Le rôle que la charge utile désigne pour CE lecteur. */
  roleDuLecteur: 'SHIPPER' | 'CARRIER' | null;
  lueA: string | null;
  creeeA: string;
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

function entier(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? Math.max(0, Math.trunc(valeur)) : 0;
}

/**
 * Le corridor, lu de la charge utile. Elle n'est pas typée par le contrat
 * (`z.record(z.string(), z.unknown())`) : tout y est optionnel, et une
 * notification dont on ne sait pas lire le trajet reste parfaitement
 * affichable — elle a un titre.
 */
function corridorDe(charge: Record<string, unknown>): string | null {
  const c = objet(charge.corridor);
  const depart = texte(c.originCity).trim();
  const arrivee = texte(c.destinationCity).trim();
  if (depart.length === 0 || arrivee.length === 0) return null;
  return `${depart} → ${arrivee}`;
}

/**
 * Le rôle du LECTEUR dans le deal de cette notification (A44).
 *
 * La charge utile porte `carrierId` : si c'est moi, je suis le Voyageur.
 * Sans mon identifiant ou sans le sien, on ne devine pas — `null`, et
 * l'écran ne prétend alors mener nulle part en particulier.
 */
export function roleDuLecteur(
  charge: Record<string, unknown>,
  monId: string | null
): 'SHIPPER' | 'CARRIER' | null {
  const carrierId = texteOuNull(charge.carrierId);
  const shipperId = texteOuNull(charge.shipperId);
  if (monId === null || monId.length === 0) return null;
  if (carrierId === monId) return 'CARRIER';
  if (shipperId === monId) return 'SHIPPER';
  return null;
}

/** Une notification de l'API, ou `null` si elle n'a ni identité ni date. */
export function notificationDeLApi(
  brut: unknown,
  monId: string | null
): NotificationDeLaBoite | null {
  const n = objet(brut);
  const id = texte(n.id).trim();
  const type = texte(n.type).trim();
  const creeeA = texte(n.createdAt).trim();
  // Une notification sans TYPE n'a pas de titre possible : même le repli
  // suppose qu'on sache qu'il s'agit d'un événement.
  if (id.length === 0 || type.length === 0 || creeeA.length === 0) return null;

  const charge = objet(n.payload);
  return {
    id,
    type,
    bookingId: texteOuNull(n.bookingId),
    prenomDeLAutre: texteOuNull(n.counterpartFirstName),
    corridor: corridorDe(charge),
    roleDuLecteur: roleDuLecteur(charge, monId),
    lueA: texteOuNull(n.readAt),
    creeeA,
  };
}

/**
 * La boîte entière.
 *
 * Le compte des non-lues vient du SERVEUR et n'est jamais recalculé depuis
 * la liste : elle est tronquée aux plus récentes, et deux comptes qui se
 * contredisent valent moins qu'un seul (même règle que le fil, D117).
 */
export function boiteDeLApi(
  brut: unknown,
  monId: string | null
): { items: NotificationDeLaBoite[]; nonLues: number } {
  const corps = objet(brut);
  const lignes = Array.isArray(corps.notifications) ? corps.notifications : [];
  return {
    items: lignes
      .map((ligne) => notificationDeLApi(ligne, monId))
      .filter((n): n is NotificationDeLaBoite => n !== null),
    nonLues: entier(corps.unreadCount),
  };
}

/**
 * La clé de libellé d'un type d'événement.
 *
 * `booking.requested` → `booking_requested`. La convention est celle du
 * site, pour que les deux fronts se comparent — et parce qu'une clé i18n ne
 * peut PAS contenir de point (piège maison #174 : le namespace entier est
 * refusé AU RENDU).
 */
export function cleDuLibelle(type: string): string {
  return type.trim().replace(/\./g, '_');
}

/* ══ Où mène une notification ═════════════════════════════════════════ */

export type DestinationDeLaBoite =
  | { ou: 'demande'; id: string }
  | { ou: 'envoi'; id: string }
  | { ou: 'nulle-part' };

/**
 * Une notification MÈNE quelque part, ou elle n'est pas une notification.
 *
 * Le Voyageur va vers sa demande, l'Expéditeur vers son envoi — c'est la
 * charge utile qui dit lequel on est. Sans `bookingId` (notification
 * système) ou sans rôle lisible, la ligne ne prétend PAS être cliquable :
 * un geste qui ne mène nulle part est pire qu'une ligne inerte.
 */
export function destinationDe(notification: NotificationDeLaBoite): DestinationDeLaBoite {
  if (notification.bookingId === null) return { ou: 'nulle-part' };
  if (notification.roleDuLecteur === 'CARRIER')
    return { ou: 'demande', id: notification.bookingId };
  if (notification.roleDuLecteur === 'SHIPPER') return { ou: 'envoi', id: notification.bookingId };
  return { ou: 'nulle-part' };
}

/* ══ L'âge d'une notification ═════════════════════════════════════════ */

export type Anciennete = { unite: 'minute' | 'heure' | 'jour'; valeur: number };

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/**
 * Depuis combien de temps ? Rend une UNITÉ et un NOMBRE — jamais une
 * phrase : c'est le dictionnaire qui écrit « il y a 3 h », parce qu'un
 * nombre s'écrit dans la langue de celui qui le lit (D108).
 *
 * Une date illisible ou future rend « il y a 0 minute » plutôt que `null` :
 * une ligne sans âge serait plus déroutante qu'une ligne toute fraîche, et
 * une horloge d'appareil en avance de deux minutes est banale.
 */
export function ancienneteDe(iso: string, maintenantMs: number): Anciennete {
  const instant = new Date(iso).getTime();
  if (Number.isNaN(instant)) return { unite: 'minute', valeur: 0 };
  const ecart = Math.max(0, maintenantMs - instant);
  if (ecart >= JOUR) return { unite: 'jour', valeur: Math.floor(ecart / JOUR) };
  if (ecart >= HEURE) return { unite: 'heure', valeur: Math.floor(ecart / HEURE) };
  return { unite: 'minute', valeur: Math.floor(ecart / MINUTE) };
}

/** Lue ? Le serveur pose la date ; l'app ne la fabrique jamais. */
export function estLue(notification: NotificationDeLaBoite): boolean {
  return notification.lueA !== null;
}

/**
 * Y a-t-il quelque chose à marquer ?
 *
 * La question n'est pas « le compteur existe-t-il » — un compteur n'est
 * jamais négatif — mais « reste-t-il une non-lue ». Même défaut que le site
 * portait sur les conversations (`unreadCount >= 0`, toujours vrai), corrigé
 * en D117 bis.
 */
export function resteAMarquer(items: readonly NotificationDeLaBoite[]): boolean {
  return items.some((n) => !estLue(n));
}

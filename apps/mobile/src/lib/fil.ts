/**
 * fil.ts — le fil de discussion, côté règles (D117).
 * ====================================================
 * Zéro import : le harnais (A223) doit pouvoir jouer ces règles sous Node,
 * sans Metro, sans React, sans `expo-constants`.
 *
 * ── CE N'EST PAS UN CHAT, C'EST UNE COORDINATION (D61) ──────────────────
 * Deux inconnus doivent se retrouver, souvent dans un aéroport. D'où trois
 * choses qu'une messagerie grand public n'a pas : le fil porte un corridor
 * et l'état d'un deal, il a une FIN (quatorze jours après la fin du deal),
 * et il se TAIT pendant un litige — les échanges passent alors par la
 * médiation (D55).
 *
 * ── CE QUE LE SERVEUR DÉCIDE, L'ÉCRAN L'AFFICHE ─────────────────────────
 * `access.canWrite` ferme la saisie et `access.reason` dit LEQUEL des deux
 * motifs s'applique. L'app ne déduit jamais la fermeture d'un statut : elle
 * la LIT. Un champ grisé que rien n'explique est un cul-de-sac (A209).
 *
 * ── LA LECTURE EST DÉFENSIVE, ET ELLE EST LE SUJET DU LOT ───────────────
 * `activite-context.tsx` appelait déjà `/messages/conversations` en typant
 * la réponse `{ totalUnread: number }` alors que le serveur répond
 * `{ items, totalUnread }` : la liste entière traversait le réseau à chaque
 * rafraîchissement et mourait à `JSON.parse`. **C'est D102 rejoué** — un
 * contrat se vérifie dans les DEUX sens, et la fiche qui le demandait
 * n'existait que pour la recherche. `conversationsDeLApi` lit les deux.
 */

/* ── LES RYTHMES DE SONDAGE (D117 7A) ──────────────────────────────────
 * D61 10A : sondage court tant que le volume le permet. Ces nombres sont
 * ceux du site (`useMessaging.ts`) et ils vivent ICI pour les deux : deux
 * fronts qui sondent à des rythmes différents sont deux produits.
 *
 * Le téléphone ajoute une règle que le web n'a pas besoin d'écrire : on ne
 * sonde PAS en arrière-plan. `refetchIntervalInBackground: false` suffit à
 * un onglet de navigateur ; un sondage à 3 s dans la poche est une facture
 * de batterie. */
export const RYTHME_DU_FIL_MS = 3_000;
export const RYTHME_DE_LA_LISTE_MS = 20_000;
/** Les réponses rapides sont un CATALOGUE, pas une donnée vivante. */
export const RYTHME_DES_REPONSES_MS = 60 * 60_000;

/** Le contrat : 2 000 caractères (`MESSAGE_MAX_LENGTH`). Fiche à l'appui. */
export const MESSAGE_MAX = 2000;

/**
 * Les motifs de signalement d'un message : la liste FERMÉE du contrat
 * (`MESSAGE_REPORT_REASONS`). Recopiée faute de pouvoir importer le contrat
 * depuis un écran (A223), et confrontée au Zod réel par une fiche.
 *
 * L'ORDRE est celui du site : « sortir de Yamba » en tête, parce que c'est
 * le motif que la plateforme a le plus d'intérêt à voir arriver.
 */
export const MOTIFS_DE_SIGNALEMENT = ['OFF_PLATFORM', 'SCAM', 'HARASSMENT', 'OTHER'] as const;
export type MotifDeSignalement = (typeof MOTIFS_DE_SIGNALEMENT)[number];

/** À partir de combien de caractères restants on montre le compteur. */
export const SEUIL_DU_COMPTEUR = 200;

export type RoleDuFil = 'SHIPPER' | 'CARRIER';
export type RoleAuteur = RoleDuFil | 'SYSTEM';
export type GenreDeMessage = 'TEXT' | 'SYSTEM' | 'MEETUP';

const GENRES: readonly GenreDeMessage[] = ['TEXT', 'SYSTEM', 'MEETUP'];
const ROLES_AUTEUR: readonly RoleAuteur[] = ['SHIPPER', 'CARRIER', 'SYSTEM'];

/**
 * Pourquoi la saisie est fermée. Les clés du serveur sont stables et
 * TRADUITES ICI en motifs nommés : un écran qui compare des chaînes
 * d'anglais au milieu d'un rendu est un écran qui se trompera de casse.
 */
export type MotifDeFermeture = 'litige' | 'fenetre' | 'autre';

export type AccesAuFil = {
  peutLire: boolean;
  peutEcrire: boolean;
  /** `null` quand la saisie est OUVERTE — un motif sans fermeture n'a pas de sens. */
  motif: MotifDeFermeture | null;
  /** Quand l'écriture se fermera, ISO, ou `null`. */
  fermetureA: string | null;
};

export type MessageDuFil = {
  id: string;
  genre: GenreDeMessage;
  roleAuteur: RoleAuteur;
  corps: string;
  /** Clé i18n d'un message SYSTEM / MEETUP : le client affiche SA copie. */
  cleSysteme: string | null;
  donneesSysteme: Record<string, unknown> | null;
  /** D61 5A — le serveur a vu des coordonnées. Averti, jamais bloqué. */
  coordonneesDetectees: boolean;
  creeA: string;
};

export type ConversationDeLaListe = {
  id: string;
  bookingId: string;
  /** Le rôle de CELUI QUI LIT — c'est lui qui dit quelle bulle est la sienne. */
  monRole: RoleDuFil;
  interlocuteur: { prenom: string; avatarUrl: string | null };
  corridor: { depart: string; arrivee: string; departA: string | null };
  statutDuDeal: string;
  dernierMessage: { corps: string; roleAuteur: RoleAuteur; creeA: string } | null;
  nonLus: number;
  acces: AccesAuFil;
};

export type FilComplet = {
  conversation: ConversationDeLaListe;
  /** Du plus ancien au plus récent, comme le serveur les sert. */
  messages: MessageDuFil[];
  /** Messages plus ANCIENS à charger, ou `null`. */
  curseur: string | null;
};

/* ══ Lecture défensive ════════════════════════════════════════════════ */

function texte(valeur: unknown): string {
  return typeof valeur === 'string' ? valeur : '';
}

function objet(valeur: unknown): Record<string, unknown> {
  return typeof valeur === 'object' && valeur !== null ? (valeur as Record<string, unknown>) : {};
}

function entier(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? Math.max(0, Math.trunc(valeur)) : 0;
}

function texteOuNull(valeur: unknown): string | null {
  const t = texte(valeur).trim();
  return t.length > 0 ? t : null;
}

/**
 * Le motif de fermeture, traduit des clés du serveur.
 *
 * Une clé INCONNUE donne `'autre'` et non `null` : si le serveur ferme la
 * saisie pour une raison que l'app ne connaît pas encore, elle doit dire
 * « c'est fermé » plutôt que de prétendre que c'est ouvert.
 */
export function motifDeFermeture(cle: unknown): MotifDeFermeture | null {
  const brut = texte(cle).trim().toUpperCase();
  if (brut === 'DISPUTE_OPEN') return 'litige';
  if (brut === 'WRITE_WINDOW_OVER') return 'fenetre';
  return brut.length > 0 ? 'autre' : null;
}

function accesDeLApi(brut: unknown): AccesAuFil {
  const a = objet(brut);
  // L'ABSENCE ne vaut pas permission : un accès illisible se lit fermé.
  const peutEcrire = a.canWrite === true;
  return {
    peutLire: a.canRead === true,
    peutEcrire,
    motif: peutEcrire ? null : (motifDeFermeture(a.reason) ?? 'autre'),
    fermetureA: texteOuNull(a.writeClosesAt),
  };
}

/** Une conversation de l'API, ou `null` si elle n'a pas d'identité. */
export function conversationDeLApi(brut: unknown): ConversationDeLaListe | null {
  const c = objet(brut);
  const id = texte(c.id).trim();
  const role = texte(c.role).trim().toUpperCase();
  if (id.length === 0) return null;
  if (role !== 'SHIPPER' && role !== 'CARRIER') return null;

  const interlocuteur = objet(c.counterpart);
  const corridor = objet(c.corridor);
  const dernier = objet(c.lastMessage);
  const roleDuDernier = texte(dernier.authorRole).trim().toUpperCase();

  return {
    id,
    bookingId: texte(c.bookingId).trim(),
    monRole: role,
    interlocuteur: {
      prenom: texte(interlocuteur.firstName).trim(),
      avatarUrl: texteOuNull(interlocuteur.avatarUrl),
    },
    corridor: {
      depart: texte(corridor.originCity).trim(),
      arrivee: texte(corridor.destinationCity).trim(),
      departA: texteOuNull(corridor.departureAt),
    },
    statutDuDeal: texte(c.bookingStatus).trim(),
    dernierMessage:
      texte(dernier.createdAt).length === 0
        ? null
        : {
            corps: texte(dernier.body),
            roleAuteur: (ROLES_AUTEUR.find((r) => r === roleDuDernier) ?? 'SYSTEM') as RoleAuteur,
            creeA: texte(dernier.createdAt),
          },
    nonLus: entier(c.unreadCount),
    acces: accesDeLApi(c.access),
  };
}

/**
 * LA RÉPONSE ENTIÈRE, et c'est tout le sujet du lot (D117 0A).
 *
 * Le serveur sert `{ items, totalUnread }` depuis F-PR1. L'app lisait le
 * second et jetait le premier. Le total reste celui du SERVEUR et n'est
 * jamais recalculé depuis la liste : elle peut être tronquée un jour, et
 * deux comptes qui se contredisent valent moins qu'un seul.
 */
export function conversationsDeLApi(brut: unknown): {
  items: ConversationDeLaListe[];
  totalNonLus: number;
} {
  const corps = objet(brut);
  const lignes = Array.isArray(corps.items) ? corps.items : [];
  return {
    items: lignes
      .map(conversationDeLApi)
      .filter((c): c is ConversationDeLaListe => c !== null),
    totalNonLus: entier(corps.totalUnread),
  };
}

/** Un message de l'API, ou `null` s'il n'a ni identifiant ni date. */
export function messageDeLApi(brut: unknown): MessageDuFil | null {
  const m = objet(brut);
  const id = texte(m.id).trim();
  const creeA = texte(m.createdAt).trim();
  if (id.length === 0 || creeA.length === 0) return null;

  const genre = texte(m.kind).trim().toUpperCase();
  const role = texte(m.authorRole).trim().toUpperCase();
  const donnees = m.systemData;

  return {
    id,
    // Un genre INCONNU se lit SYSTEM : il s'affichera au centre, en petit,
    // plutôt que comme une bulle attribuée à quelqu'un qui n'a rien dit.
    genre: (GENRES.find((g) => g === genre) ?? 'SYSTEM') as GenreDeMessage,
    roleAuteur: (ROLES_AUTEUR.find((r) => r === role) ?? 'SYSTEM') as RoleAuteur,
    corps: texte(m.body),
    cleSysteme: texteOuNull(m.systemKey),
    donneesSysteme:
      typeof donnees === 'object' && donnees !== null ? (donnees as Record<string, unknown>) : null,
    coordonneesDetectees: m.flaggedContact === true,
    creeA,
  };
}

/**
 * Le fil complet.
 *
 * DEUX CHAMPS SONT IGNORÉS À DESSEIN : `meetups` et `phone`. Ils sont le
 * lot 2 (le rendez-vous comme objet, le numéro révélé à H-2) — les nommer
 * ici plutôt que de les laisser tomber en silence est la différence entre
 * un périmètre et un oubli. Une fiche épingle ce choix : le jour où le lot
 * 2 arrive, elle rougit et demande qu'on la mette à jour.
 */
export function filDeLApi(brut: unknown): FilComplet | null {
  const corps = objet(brut);
  const conversation = conversationDeLApi(corps.conversation);
  if (conversation === null) return null;
  const lignes = Array.isArray(corps.messages) ? corps.messages : [];
  return {
    conversation,
    messages: lignes.map(messageDeLApi).filter((m): m is MessageDuFil => m !== null),
    curseur: texteOuNull(corps.nextCursor),
  };
}

/* ══ Ce qui retient l'envoi ═══════════════════════════════════════════ */

/**
 * La liste de ce qui retient, jamais un booléen (D115 2A, D116 bis).
 *
 * L'ordre est une décision : la FERMETURE passe avant tout le reste. Dire
 * « écris quelque chose » à quelqu'un dont la saisie est close est exact et
 * hors sujet — le même défaut que « il manque deux chiffres » pendant un
 * verrou (D116).
 */
export type ManqueDuMessage =
  | { quoi: 'ferme'; motif: MotifDeFermeture }
  | { quoi: 'vide' }
  | { quoi: 'trop-long'; dePlus: number }
  | { quoi: 'envoi' };

export function manquesDuMessage({
  corps,
  acces,
  envoiEnCours,
}: {
  corps: string;
  acces: AccesAuFil;
  envoiEnCours: boolean;
}): ManqueDuMessage[] {
  const manques: ManqueDuMessage[] = [];

  if (!acces.peutEcrire) manques.push({ quoi: 'ferme', motif: acces.motif ?? 'autre' });
  if (corps.trim().length === 0) manques.push({ quoi: 'vide' });
  if (corps.length > MESSAGE_MAX) manques.push({ quoi: 'trop-long', dePlus: corps.length - MESSAGE_MAX });
  if (envoiEnCours) manques.push({ quoi: 'envoi' });

  return manques;
}

/** Le corps prêt à partir, ou `null` si quelque chose retient. */
export function corpsAEnvoyer(etat: {
  corps: string;
  acces: AccesAuFil;
  envoiEnCours: boolean;
}): { body: string } | null {
  if (manquesDuMessage(etat).length > 0) return null;
  return { body: etat.corps.trim() };
}

/**
 * La clé de phrase d'un refus serveur.
 *
 * `DELIVERY_CODE_IN_MESSAGE` est une RÈGLE, pas une panne : elle se dit en
 * toutes lettres. Et le texte ne quitte PAS la saisie sur un refus — le
 * perdre ferait tout retaper (c'est l'écran qui le garde ; ici on nomme
 * seulement la phrase).
 */
export function cleDuRefus(code: unknown): 'codeDeLivraison' | 'ferme' | 'echec' {
  const brut = texte(code).trim().toUpperCase();
  if (brut === 'DELIVERY_CODE_IN_MESSAGE') return 'codeDeLivraison';
  if (brut === 'CONVERSATION_READ_ONLY') return 'ferme';
  return 'echec';
}

/* ══ Ce que l'écran montre ════════════════════════════════════════════ */

/**
 * La bulle est-elle la MIENNE ? C'est `conversation.role` qui le dit — le
 * rôle de celui qui lit — et jamais un identifiant d'utilisateur : le DTO
 * sert `authorId` nullable, et un message système n'a pas d'auteur.
 */
export function estDeMoi(message: MessageDuFil, monRole: RoleDuFil): boolean {
  return message.genre === 'TEXT' && message.roleAuteur === monRole;
}

/**
 * Faut-il avertir pour des coordonnées détectées ? (D117 4A)
 *
 * SUR SA PROPRE BULLE UNIQUEMENT. Le serveur marque les deux côtés, l'admin
 * voit les deux — mais afficher la pastille sur la bulle de l'AUTRE le
 * désignerait du doigt sur la foi d'une regex qui ne distingue pas un
 * numéro de vol d'un téléphone. On avertit celui qui PEUT encore changer
 * de comportement : l'auteur.
 */
export function avertirDesCoordonnees(message: MessageDuFil, monRole: RoleDuFil): boolean {
  return message.coordonneesDetectees && estDeMoi(message, monRole);
}

/**
 * Le JOUR d'un message, en clé stable `AAAA-MM-JJ` **locale**.
 *
 * Locale et non UTC : un message de 23 h 30 à Paris appartient à la journée
 * que le lecteur a vécue, pas à celle de Greenwich. La clé ne s'affiche
 * jamais — l'écran la met en forme dans la langue du lecteur (D108).
 */
export function jourDuMessage(iso: string): string | null {
  const instant = new Date(iso);
  const ms = instant.getTime();
  if (Number.isNaN(ms)) return null;
  const mois = `${instant.getMonth() + 1}`.padStart(2, '0');
  const jour = `${instant.getDate()}`.padStart(2, '0');
  return `${instant.getFullYear()}-${mois}-${jour}`;
}

export type GroupeDeJour = { jour: string; messages: MessageDuFil[] };

/**
 * Les messages groupés par journée, dans l'ordre reçu.
 *
 * Un message dont la date est ILLISIBLE ne disparaît pas : il rejoint le
 * groupe courant. Perdre un message parce qu'on n'a pas su lire sa date
 * serait le pire des deux maux — et s'il ouvre la liste, il forme son
 * propre groupe sans en-tête (`jour` vide), que l'écran n'intitule pas.
 */
export function groupesParJour(messages: readonly MessageDuFil[]): GroupeDeJour[] {
  const groupes: GroupeDeJour[] = [];
  for (const message of messages) {
    const jour = jourDuMessage(message.creeA);
    const dernier = groupes[groupes.length - 1];
    if (dernier !== undefined && (jour === null || dernier.jour === jour)) {
      dernier.messages.push(message);
      continue;
    }
    groupes.push({ jour: jour ?? '', messages: [message] });
  }
  return groupes;
}

/**
 * La fermeture est-elle PROCHE ? (D117 2A)
 *
 * Une porte qui se ferme sans prévenir est la même famille que le bouton
 * muet : on annonce les deux derniers jours. Rend le nombre de jours
 * restants (0 = aujourd'hui), ou `null` s'il n'y a rien à annoncer — date
 * absente, illisible, déjà passée, ou encore lointaine.
 */
export const PREAVIS_DE_FERMETURE_JOURS = 2;

export function preavisDeFermeture(fermetureA: string | null, maintenantMs: number): number | null {
  if (fermetureA === null) return null;
  const fin = new Date(fermetureA).getTime();
  if (Number.isNaN(fin) || fin <= maintenantMs) return null;
  const jours = Math.ceil((fin - maintenantMs) / 86_400_000);
  return jours <= PREAVIS_DE_FERMETURE_JOURS ? Math.max(0, jours) : null;
}

/**
 * Les conversations à montrer : celles que le serveur dit LISIBLES.
 *
 * L'ordre vient du serveur et n'est pas retouché — contrairement aux
 * demandes (D113), où attendre coûte quelque chose à quelqu'un d'autre et
 * où l'échéance commande. Ici, la dernière parole commande, et c'est le
 * serveur qui la connaît.
 */
export function conversationsLisibles(
  items: readonly ConversationDeLaListe[]
): ConversationDeLaListe[] {
  return items.filter((c) => c.acces.peutLire);
}

/**
 * fil.ts — le fil de discussion, côté SITE (D117 bis).
 * ======================================================
 * Zéro import : le harnais du site (A224, `testEnvironment: node`) doit
 * pouvoir jouer ces règles, et un écran ne doit pas tirer zod dans le bundle
 * du navigateur pour connaître une borne.
 *
 * ── POURQUOI CE FICHIER NAÎT, ALORS QUE L'ÉCRAN EXISTE DEPUIS SEPTEMBRE ──
 * En écrivant le fil NATIF (D117), quatre choses de cet écran-ci se sont
 * montrées. Aucune n'était visible à la lecture ; toutes l'étaient en
 * demandant « et ici, qu'est-ce que le serveur me dit que je n'affiche
 * pas ? » — la même question qui a produit D115 bis et D116 bis.
 *
 *   ① `flaggedContact` : le serveur détecte les coordonnées et marque le
 *      message. L'ADMIN l'affiche depuis F-PR3. Le contrat MEMBRE le sert
 *      en disant « averti, jamais bloqué » — et aucun front membre
 *      n'avertissait personne. Une détection qui ne dit rien ne décourage
 *      rien : elle documente l'échec après coup ;
 *   ② `access.writeClosesAt` : TYPÉ dans `messaging.types.ts`, lu nulle
 *      part. La conversation se fermait donc sans prévenir ;
 *   ③ le plafond de 2 000 caractères était écrit DEUX FOIS en dur dans
 *      `ConversationThread.tsx` (`slice(0, 2000)`), sans domicile — le
 *      défaut que D110 a compté 51 fois sur `max-w-7xl` ;
 *   ④ `if (data && data.conversation.unreadCount >= 0) markRead.mutate()` :
 *      un compteur n'est JAMAIS négatif, donc la condition était toujours
 *      vraie. Une condition qui ne décide rien n'est pas une condition, et
 *      celle-ci postait une lecture à chaque ouverture, même sans rien à
 *      marquer.
 *
 * Les règles ci-dessous sont les MÊMES que celles du natif
 * (`apps/mobile/src/lib/fil.ts`) et une fiche les confronte en lisant les
 * deux fichiers — jamais en important à travers une frontière de projet,
 * qui serait une dépendance de build (D93).
 */

/** Le contrat : 2 000 caractères (`MESSAGE_MAX_LENGTH`). Fiche à l'appui. */
export const MESSAGE_MAX = 2000;

/** On annonce la fermeture deux jours avant, pas à la seconde où elle tombe. */
export const PREAVIS_DE_FERMETURE_JOURS = 2;

export type RoleDuFil = "SHIPPER" | "CARRIER";
export type MotifDeFermeture = "litige" | "fenetre" | "autre";

/**
 * Le motif de fermeture, traduit des clés stables du serveur.
 *
 * Une clé INCONNUE donne `'autre'` et non `null` : si le serveur ferme la
 * saisie pour une raison que le front ne connaît pas encore, il doit dire
 * « c'est fermé » plutôt que de prétendre que c'est ouvert.
 */
export function motifDeFermeture(cle: unknown): MotifDeFermeture | null {
  const brut = typeof cle === "string" ? cle.trim().toUpperCase() : "";
  if (brut === "DISPUTE_OPEN") return "litige";
  if (brut === "WRITE_WINDOW_OVER") return "fenetre";
  return brut.length > 0 ? "autre" : null;
}

/**
 * La bulle est-elle la MIENNE ? C'est `conversation.role` qui le dit — le
 * rôle de celui qui lit — et jamais un identifiant : le DTO sert `authorId`
 * nullable, et un message système n'a pas d'auteur.
 */
export function estDeMoi(
  message: { kind: string; authorRole: string },
  monRole: RoleDuFil
): boolean {
  return message.kind === "TEXT" && message.authorRole === monRole;
}

/**
 * Faut-il avertir pour des coordonnées détectées ? (D117 4A)
 *
 * SUR SA PROPRE BULLE UNIQUEMENT. Le serveur marque les deux côtés et
 * l'admin voit les deux — mais afficher la pastille sur la bulle de
 * l'AUTRE le désignerait du doigt sur la foi d'une regex qui ne distingue
 * pas un numéro de vol d'un téléphone. On avertit celui qui peut encore
 * changer de comportement : l'auteur.
 */
export function avertirDesCoordonnees(
  message: { kind: string; authorRole: string; flaggedContact: boolean },
  monRole: RoleDuFil
): boolean {
  return message.flaggedContact === true && estDeMoi(message, monRole);
}

/**
 * La fermeture est-elle PROCHE ?
 *
 * Rend le nombre de jours restants (0 = aujourd'hui), ou `null` s'il n'y a
 * rien à annoncer — date absente, illisible, déjà passée, ou encore
 * lointaine. Une porte qui se ferme sans prévenir est de la même famille
 * que le bouton muet.
 */
export function preavisDeFermeture(
  fermetureA: string | null,
  maintenantMs: number
): number | null {
  if (fermetureA === null) return null;
  const fin = new Date(fermetureA).getTime();
  if (Number.isNaN(fin) || fin <= maintenantMs) return null;
  const jours = Math.ceil((fin - maintenantMs) / 86_400_000);
  return jours <= PREAVIS_DE_FERMETURE_JOURS ? Math.max(0, jours) : null;
}

/**
 * Faut-il marquer la conversation comme lue ?
 *
 * `unreadCount >= 0` était toujours vrai — un compteur n'est jamais
 * négatif. La question n'est pas « le compteur existe-t-il » mais « y
 * a-t-il quelque chose à marquer ».
 */
export function fautIlMarquerLu(conversation: { unreadCount: number } | undefined): boolean {
  return (conversation?.unreadCount ?? 0) > 0;
}

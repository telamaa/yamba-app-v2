/**
 * remise.ts — la remise du colis, côté règles (D116).
 * =====================================================
 * Un seul import, et il est PUR (`photos`).
 *
 * ── LE SERVEUR COMPTE, CE MODULE LIT (A38) ──────────────────────────────
 * Trois essais, puis quinze minutes de verrou ET le compteur remis à zéro :
 * tout cela se décide dans `deal-transport.service.ts`. Ce module ne
 * reproduit JAMAIS cette arithmétique — il porte l'état que le serveur a
 * annoncé (`deliveryAttemptsLeft` à l'ouverture, `details.attemptsLeft` et
 * `details.lockedUntil` des 409) et le rend lisible. Deux arithmétiques
 * divergent, et ce serait celle du client qui aurait tort devant le
 * destinataire.
 *
 * ── UN REFUS A UN HORIZON ───────────────────────────────────────────────
 * « Ce n'est pas le bon code, il reste deux essais », puis « réessaye dans
 * 14:59 ». Jamais « action impossible » — ce que lisait le Voyageur avant
 * ANO-API-15, debout, sans savoir quand réessayer.
 *
 * ── LES PHOTOS NE BLOQUENT JAMAIS EN SILENCE (A76) ──────────────────────
 * Elles sont OPTIONNELLES : le code prouve la remise, la photo prouve
 * l'état. Mais une photo EN VOL ou EN ÉCHEC retient l'envoi (on ne part pas
 * sans une preuve qu'on a commencé à joindre) — et le bouton doit DIRE
 * laquelle des deux, ce que le site ne sait pas faire : il fusionne les deux
 * conditions dans `isSubmitting || !photosReady`, et affiche
 * « Vérification… » pour toujours.
 */
import { photosPretes, urlsDesPhotos, type PhotoLocale } from '@/lib/photos';

/** Le contrat : deux photos de remise au plus (A76). */
export const PHOTOS_REMISE_MAX = 2;

/** La longueur du code (D43). Recopiée du contrat, confrontée par une fiche. */
export const CODE_LONGUEUR = 6;

/* Le NOMBRE d'essais n'est PAS une constante de l'app : il arrive du
 * serveur (`essaisRestants`) et l'écran le lit (A38, D116 1B). Un
 * `ESSAIS_MAX = 3` local a existé ici le temps d'une relecture : personne
 * ne l'appelait, et sa seule fiche INTERDISAIT de s'en servir. Une
 * constante dont l'unique règle est « ne t'en sers pas » est une seconde
 * vérité qui attend son premier lecteur. */

/* ── L'état de la saisie, tel que le serveur l'a annoncé ─────────────── */

export type EtatDeLaSaisie = {
  /** Ce que le serveur dit rester. `null` = on ne sait pas encore. */
  essaisRestants: number | null;
  /** L'instant de fin du verrou, ISO, ou `null`. */
  verrouJusqua: string | null;
};

export const SAISIE_NEUVE: EtatDeLaSaisie = { essaisRestants: null, verrouJusqua: null };

/**
 * Ce qu'il reste du verrou, en millisecondes. L'écran en tire les DEUX
 * choses dont il a besoin — le compte à rebours, et « est-ce verrouillé ? »
 * (`> 0`). Un prédicat `verrouActif` a existé à côté : deux façons de poser
 * la même question, dont l'écran n'appelait aucune.
 *
 * Une date illisible ou passée ne verrouille rien — un verrou qu'on ne sait
 * pas lire ne doit pas bloquer pour toujours.
 */
export function resteDuVerrouMs(etat: EtatDeLaSaisie, maintenantMs: number): number {
  if (etat.verrouJusqua === null) return 0;
  const fin = new Date(etat.verrouJusqua).getTime();
  if (Number.isNaN(fin)) return 0;
  return Math.max(0, fin - maintenantMs);
}

/**
 * « 14:59 ». Les secondes sont ARRONDIES AU SUPÉRIEUR : afficher 00:00
 * pendant la dernière seconde ferait croire que c'est fini alors que le
 * serveur refuse encore.
 */
export function compteARebours(restantMs: number): string {
  const secondes = Math.ceil(Math.max(0, restantMs) / 1000);
  const minutes = Math.floor(secondes / 60);
  return `${minutes}:${String(secondes % 60).padStart(2, '0')}`;
}

/**
 * Ce que le serveur vient de répondre, traduit en état de saisie.
 *
 * On ne DÉDUIT rien : un refus `DELIVERY_CODE_INVALID` sans `attemptsLeft`
 * lisible laisse le compteur tel quel plutôt que de l'inventer (le serveur
 * reste la seule source — et un compteur inventé est un mensonge affiché à
 * côté d'un code juste).
 */
export function apresLeRefus(
  etat: EtatDeLaSaisie,
  refus: { code: string | null; details: Record<string, unknown> | null }
): EtatDeLaSaisie {
  const details = refus.details ?? {};
  const restants = typeof details.attemptsLeft === 'number' ? details.attemptsLeft : null;
  const verrou = typeof details.lockedUntil === 'string' ? details.lockedUntil : null;

  if (refus.code === 'DELIVERY_LOCKED') {
    return { essaisRestants: 0, verrouJusqua: verrou ?? etat.verrouJusqua };
  }
  if (refus.code === 'DELIVERY_CODE_INVALID') {
    return { essaisRestants: restants ?? etat.essaisRestants, verrouJusqua: null };
  }
  return etat;
}

/**
 * La fin du verrou n'est pas une permission : c'est une RELECTURE.
 *
 * À l'expiration, le serveur a déjà remis le compteur à zéro — l'écran
 * repart donc d'un état neuf plutôt que de garder « 0 essai restant », qui
 * afficherait un blocage que le serveur n'applique plus.
 */
export function verrouExpire(): EtatDeLaSaisie {
  return SAISIE_NEUVE;
}

/* ── Ce qui retient l'envoi ──────────────────────────────────────────── */

/**
 * Les quatre manques, DÉCLARÉS dans l'ordre où ils tombent — le verrou
 * d'abord. Une union qui ne suit pas l'ordre de sa fonction se lit mal, et
 * une fiche de parité qui compare les deux fronts lit l'une ou l'autre.
 */
export type ManqueDeLaRemise =
  | { quoi: 'verrou'; restantMs: number }
  | { quoi: 'code'; chiffres: number }
  | { quoi: 'televersement' }
  | { quoi: 'echec' };

/**
 * CE QUI RETIENT L'ENVOI, dans l'ordre où l'écran le lit.
 *
 * Le verrou passe AVANT le code : quand la saisie est bloquée, dire « il
 * manque deux chiffres » serait exact et hors sujet.
 */
export function manquesDeLaRemise({
  code,
  photos,
  etat,
  maintenantMs,
}: {
  code: string;
  photos: readonly PhotoLocale[];
  etat: EtatDeLaSaisie;
  maintenantMs: number;
}): ManqueDeLaRemise[] {
  const manques: ManqueDeLaRemise[] = [];

  const restantMs = resteDuVerrouMs(etat, maintenantMs);
  if (restantMs > 0) manques.push({ quoi: 'verrou', restantMs });

  const chiffres = CODE_LONGUEUR - code.replace(/\D/g, '').length;
  if (chiffres > 0) manques.push({ quoi: 'code', chiffres });

  // Les photos sont facultatives : un lot VIDE ne manque de rien. Mais une
  // photo commencée doit finir — sinon on remet le colis sans la preuve
  // qu'on était en train de joindre.
  if (photos.some((p) => p.uploading)) manques.push({ quoi: 'televersement' });
  else if (!photosPretes(photos)) manques.push({ quoi: 'echec' });

  return manques;
}

export type CorpsDeLaRemise = { code: string; photoUrls: string[] };

/**
 * Le corps de `POST /deals/:id/deliver`, ou `null` s'il manque quelque
 * chose. Rendre `null` plutôt que jeter : l'écran a déjà la liste.
 */
export function corpsDeLaRemise(entree: {
  code: string;
  photos: readonly PhotoLocale[];
  etat: EtatDeLaSaisie;
  maintenantMs: number;
}): CorpsDeLaRemise | null {
  if (manquesDeLaRemise(entree).length > 0) return null;
  return {
    code: entree.code.replace(/\D/g, ''),
    photoUrls: urlsDesPhotos(entree.photos),
  };
}

/**
 * L'instant du VERSEMENT, lu dans la réponse du serveur (`payoutDueAt`).
 *
 * Jamais recalculé : le délai de vérification de l'Expéditeur est une règle
 * serveur (J+4 aujourd'hui). Un « dans quatre jours » calculé ici créerait
 * une seconde vérité le jour où ce délai change — et c'est de l'ARGENT.
 */
export function versementDeLaReponse(brut: unknown): string | null {
  if (typeof brut !== 'object' || brut === null) return null;
  const valeur = (brut as Record<string, unknown>).payoutDueAt;
  if (typeof valeur !== 'string') return null;
  return Number.isNaN(new Date(valeur).getTime()) ? null : valeur;
}

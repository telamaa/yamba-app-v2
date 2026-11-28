/**
 * prise-en-charge.ts — l'inspection du colis, côté règles (D115).
 * ================================================================
 * Un seul import, et il est PUR (`photos`).
 *
 * LA CHECKLIST N'EST PAS UNE FORMALITÉ. C'est le moment où le Voyageur
 * s'expose : il déclare avoir vu le contenu ouvert. Le serveur exige les
 * CINQ points (CNF-04) et refuse une inspection partielle — ce fichier dit
 * donc ce qui MANQUE, en liste, pas en booléen, pour que le bouton puisse
 * l'annoncer plutôt que de rester muet (doctrine A209 du bouton désactivé).
 *
 * Les cinq codes sont RECOPIÉS du contrat (`booking-transport.schema.ts`) :
 * `apps/mobile/tsconfig.json` ne déclare pas `@packages/api-contracts`
 * (A223), zod n'a rien à faire dans le bundle d'un écran. Une fiche
 * confronte cette copie au contrat Zod réel, que le harnais, lui, sait lire.
 */
import { photosPretes, urlsDesPhotos, type PhotoLocale } from '@/lib/photos';

/**
 * Les cinq points d'inspection, DANS L'ORDRE DU SITE.
 *
 * Premier jet de ce fichier : je les avais réordonnés selon le GESTE
 * physique (ouvrir, identifier, vérifier l'interdit, soupeser, regarder
 * l'emballage). L'idée tient debout — mais le site les affiche dans l'ordre
 * du contrat, et **deux fronts qui montrent les mêmes cinq cases dans deux
 * ordres différents sont exactement le défaut de D99 bis** : la fiche de
 * parité comparait les règles, les clés et les seuils, jamais l'ORDRE.
 *
 * Diverger sur une intuition que je ne peux même pas voir à l'écran serait
 * créer la dette qu'on vient de nommer trois fois. L'ordre du geste reste
 * un AXE, écrit au registre ; le jour où on le veut, il change DES DEUX
 * CÔTÉS, et une fiche compare les deux listes.
 */
export const POINTS_INSPECTION = [
  'CONTENT_MATCHES',
  'WEIGHT_OK',
  'NO_FORBIDDEN',
  'PACKAGING_OK',
  'ITEMS_IDENTIFIED',
] as const;

export type PointInspection = (typeof POINTS_INSPECTION)[number];

/** Les cinq raisons de refus du contrat (A40). Jamais un champ libre. */
export const RAISONS_REFUS = [
  'CONTENT_MISMATCH',
  'SUSPICIOUS_CONTENT',
  'OVERWEIGHT',
  'BAD_PACKAGING',
  'OTHER',
] as const;

export type RaisonRefus = (typeof RAISONS_REFUS)[number];

/** Le contrat : une photo au minimum, cinq au plus. */
export const PHOTOS_MIN = 1;
export const PHOTOS_MAX = 5;

/** Le contrat : 500 caractères de notes, au plus. */
export const NOTES_MAX = 500;

export type FormulairePriseEnCharge = {
  points: readonly PointInspection[];
  photos: readonly PhotoLocale[];
  notes: string;
};

/** Un point coché, ou décoché — l'ordre d'affichage ne bouge pas. */
export function basculerPoint(
  points: readonly PointInspection[],
  point: PointInspection
): PointInspection[] {
  return points.includes(point)
    ? points.filter((p) => p !== point)
    : [...points, point];
}

export function pointsManquants(points: readonly PointInspection[]): PointInspection[] {
  return POINTS_INSPECTION.filter((p) => !points.includes(p));
}

/**
 * CE QUI MANQUE POUR ENVOYER, dans l'ordre où l'écran le lit.
 *
 * Une liste plutôt qu'un booléen : le bouton doit pouvoir dire POURQUOI il
 * n'envoie pas encore, sans que l'écran re-déduise les mêmes conditions —
 * deux déductions divergent, et c'est l'écran qui aurait tort.
 */
export type ManqueDeLaPriseEnCharge =
  | { quoi: 'points'; combien: number }
  | { quoi: 'photo' }
  | { quoi: 'televersement' }
  | { quoi: 'echec' }
  | { quoi: 'notes'; deTrop: number };

export function manquesDeLaPriseEnCharge(
  formulaire: FormulairePriseEnCharge
): ManqueDeLaPriseEnCharge[] {
  const manques: ManqueDeLaPriseEnCharge[] = [];

  const restants = pointsManquants(formulaire.points).length;
  if (restants > 0) manques.push({ quoi: 'points', combien: restants });

  if (formulaire.photos.length < PHOTOS_MIN) manques.push({ quoi: 'photo' });
  else if (formulaire.photos.some((p) => p.uploading)) manques.push({ quoi: 'televersement' });
  else if (!photosPretes(formulaire.photos)) manques.push({ quoi: 'echec' });

  const trop = formulaire.notes.trim().length - NOTES_MAX;
  if (trop > 0) manques.push({ quoi: 'notes', deTrop: trop });

  return manques;
}

/**
 * Le corps de `POST /deals/:id/pickup`, ou `null` s'il manque quelque chose.
 *
 * Rendre `null` plutôt que de jeter : l'écran a DÉJÀ la liste des manques,
 * et une fonction qui répond à une question n'a pas à lever une exception
 * pour dire « pas encore ».
 */
export type CorpsPriseEnCharge = {
  checklist: PointInspection[];
  photoUrls: string[];
  notes: string | null;
};

export function corpsDeLaPriseEnCharge(
  formulaire: FormulairePriseEnCharge
): CorpsPriseEnCharge | null {
  if (manquesDeLaPriseEnCharge(formulaire).length > 0) return null;
  const notes = formulaire.notes.trim();
  return {
    // On envoie les cinq points dans l'ordre du CONTRAT, pas dans celui où
    // le Voyageur les a cochés : le serveur vérifie une présence, et une
    // liste stable se relit mieux dans un dossier de litige.
    checklist: [...POINTS_INSPECTION],
    photoUrls: urlsDesPhotos(formulaire.photos),
    notes: notes.length > 0 ? notes : null,
  };
}

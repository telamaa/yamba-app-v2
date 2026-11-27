/**
 * prise-en-charge.ts — l'inspection du colis, côté SITE (D115 bis).
 * ===================================================================
 * Zéro import : le harnais du site (A224, `testEnvironment: node`) doit
 * pouvoir jouer ces règles, et un écran ne doit pas tirer zod dans le bundle
 * du navigateur pour connaître cinq codes.
 *
 * ── POURQUOI CE FICHIER NAÎT, ALORS QUE L'ÉCRAN EXISTE DEPUIS DES MOIS ──
 * En écrivant l'écran NATIF (D115), trois règles de cet écran-ci se sont
 * révélées écrites DANS ses composants :
 *
 *   ① la liste des cinq points vivait dans `PickupChecklist.tsx` ;
 *   ② le « ce qui manque pour confirmer » était un ternaire RECOPIÉ dans
 *      `DealPickupDesktop.tsx` ET `DealPickupMobile.tsx` — deux copies de la
 *      même phrase, donc deux vérités à tenir d'accord (défaut D93 : une
 *      règle écrite dans le composant qui s'en sert ne protège qu'une page) ;
 *   ③ le plafond de 500 caractères de la remarque n'existait NULLE PART
 *      côté client, alors que le contrat le refuse — le Voyageur tapait 600
 *      caractères, ses photos partaient chez ImageKit, et le serveur
 *      refusait tout avec un message générique.
 *
 * ── CE QUI EST VOLONTAIREMENT DIFFÉRENT DU TÉLÉPHONE ────────────────────
 * Le modèle de PHOTO. Le site téléverse à la CONFIRMATION (D42/A43 : rien ne
 * part si une photo échoue), le téléphone téléverse à la SÉLECTION. Les deux
 * se défendent, et ce n'est pas le même objet : d'où deux fichiers, et une
 * fiche qui compare ce qui doit l'être — les CODES, l'ORDRE et les BORNES —
 * sans exiger une égalité octet pour octet qui serait un mensonge.
 */

/** Les cinq points d'inspection, DANS L'ORDRE du contrat (CNF-04). */
export const POINTS_INSPECTION = [
  "CONTENT_MATCHES",
  "WEIGHT_OK",
  "NO_FORBIDDEN",
  "PACKAGING_OK",
  "ITEMS_IDENTIFIED",
] as const;

export type PointInspection = (typeof POINTS_INSPECTION)[number];

/** Les cinq raisons de refus du contrat (A40). Jamais un champ libre. */
export const RAISONS_REFUS = [
  "CONTENT_MISMATCH",
  "SUSPICIOUS_CONTENT",
  "OVERWEIGHT",
  "BAD_PACKAGING",
  "OTHER",
] as const;

export type RaisonRefus = (typeof RAISONS_REFUS)[number];

/** Le contrat : une photo au minimum, cinq au plus, 500 caractères de notes. */
export const PHOTOS_MIN = 1;
export const PHOTOS_MAX = 5;
export const NOTES_MAX = 500;

/**
 * CE QUI MANQUE POUR CONFIRMER, dans l'ordre où l'écran le lit.
 *
 * Une LISTE et non un booléen : le bouton doit pouvoir dire POURQUOI il
 * n'envoie pas encore. Et une seule fonction pour les deux arbres (bureau et
 * mobile), sans quoi la phrase diverge au premier correctif.
 */
export type ManquePriseEnCharge =
  | { quoi: "points"; combien: number }
  | { quoi: "photo" }
  | { quoi: "notes"; deTrop: number };

export function pointsManquants(coches: Iterable<string>): PointInspection[] {
  const vus = new Set(coches);
  return POINTS_INSPECTION.filter((point) => !vus.has(point));
}

export function manquesPriseEnCharge({
  coches,
  photos,
  notes,
}: {
  coches: Iterable<string>;
  photos: number;
  notes: string;
}): ManquePriseEnCharge[] {
  const manques: ManquePriseEnCharge[] = [];

  const restants = pointsManquants(coches).length;
  if (restants > 0) manques.push({ quoi: "points", combien: restants });

  if (photos < PHOTOS_MIN) manques.push({ quoi: "photo" });

  const trop = notes.trim().length - NOTES_MAX;
  if (trop > 0) manques.push({ quoi: "notes", deTrop: trop });

  return manques;
}

/** Peut-on confirmer ? La même liste, lue en une fois. */
export function peutConfirmerLaPriseEnCharge(etat: {
  coches: Iterable<string>;
  photos: number;
  notes: string;
}): boolean {
  return manquesPriseEnCharge(etat).length === 0;
}

/**
 * Les cinq points dans l'ordre du CONTRAT, jamais dans celui des clics.
 *
 * Le site envoyait `Array.from(checked)`, c'est-à-dire l'ordre dans lequel
 * le Voyageur avait tapé : le serveur vérifie une présence, donc les deux
 * passent — mais une liste stable se relit mieux dans un dossier de litige,
 * et deux réservations identiques ne doivent pas s'archiver différemment
 * selon l'ordre des gestes.
 */
export function checklistAEnvoyer(): PointInspection[] {
  return [...POINTS_INSPECTION];
}

/** La remarque telle que l'API la reçoit : coupée, ou absente. */
export function notesAEnvoyer(notes: string): string | undefined {
  const propre = notes.trim();
  return propre.length > 0 ? propre : undefined;
}

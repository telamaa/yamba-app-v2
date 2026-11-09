/**
 * report-form.ts — les règles du signalement, en fonctions PURES.
 * ================================================================
 * Le formulaire de litige a cinq règles, et aucune n'a besoin de React :
 * quels motifs ont un sens maintenant, quand la description est assez
 * longue, combien de photos il reste, ce qui bloque l'envoi, et comment
 * nommer un refus du serveur. Les sortir de l'écran les rend lisibles — et
 * exécutables le jour où le mobile aura son harnais de tests (axe consigné).
 *
 * Les constantes MIROITENT le contrat (`booking-settlement.schema.ts`,
 * `booking.enums.ts`) sans l'importer : ce module est tiré par Metro, et
 * `@packages/api-contracts` embarque zod. Toute divergence serait un bug ici
 * — le serveur reste seul juge et refuse ce qui sort de ses listes.
 */

/* ── Les listes FERMÉES du contrat ───────────────────────────────────────── */

/** Les six motifs de la spec §3.6, dans l'ordre d'affichage du site. */
export const DISPUTE_CATEGORIES = [
  'NOT_DELIVERED',
  'CONTENT_MISSING',
  'DAMAGED',
  'SIGNIFICANT_DELAY',
  'RECIPIENT_ISSUE',
  'OTHER',
] as const;
export type DisputeCategory = (typeof DISPUTE_CATEGORIES)[number];

/** Ce que l'Expéditeur demande — facultatif, il informe la médiation. */
export const DISPUTE_DESIRED_OUTCOMES = [
  'FULL_REFUND',
  'PARTIAL_REFUND',
  'CONTACT_CARRIER',
  'YAMBA_DECIDES',
] as const;
export type DisputeDesiredOutcome = (typeof DISPUTE_DESIRED_OUTCOMES)[number];

/** Paramètres serveur (`DISPUTE_MIN_DESCRIPTION_LENGTH`, `…_MAX_…`, `DISPUTE_PHOTOS_MAX`). */
export const DESCRIPTION_MIN_LENGTH = 50;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const PHOTOS_MAX = 5;

/* ── Le motif, selon l'état du colis ────────────────────────────────────── */

/**
 * D51 — en transit, seul « jamais livré » a un sens : le contenu ne se
 * constate pas avant la remise, et le serveur refuse tout autre motif
 * (`DISPUTE_CATEGORY_NOT_ALLOWED`). L'écran ne propose donc rien d'autre
 * plutôt que de laisser l'Expéditeur buter sur un refus.
 */
export function allowedCategories(status: string): readonly DisputeCategory[] {
  return status === 'PICKED_UP' ? (['NOT_DELIVERED'] as const) : DISPUTE_CATEGORIES;
}

/** Le motif est-il IMPOSÉ par l'état (un seul choix possible) ? */
export function categoryLocked(status: string): boolean {
  return allowedCategories(status).length === 1;
}

/* ── La description ─────────────────────────────────────────────────────── */

export type DescriptionState = {
  /** La longueur APRÈS découpe des blancs — celle que le serveur mesure. */
  length: number;
  /** Ce qu'il manque pour atteindre le minimum. 0 quand c'est bon. */
  missing: number;
  ok: boolean;
  /** Vrai dès que la limite haute est atteinte (le champ cesse d'accepter). */
  full: boolean;
};

export function describeDescription(text: string): DescriptionState {
  // `trim()` parce que le contrat trime avant de mesurer : compter les
  // espaces donnerait un compteur vert et un refus 400.
  const length = text.trim().length;
  return {
    length,
    missing: Math.max(0, DESCRIPTION_MIN_LENGTH - length),
    ok: length >= DESCRIPTION_MIN_LENGTH,
    full: text.length >= DESCRIPTION_MAX_LENGTH,
  };
}

/* ── Les photos ─────────────────────────────────────────────────────────── */

/**
 * Une preuve, telle que l'écran la tient. Elle part chez ImageKit DÈS la
 * sélection (comme sur le site) : au moment d'envoyer le dossier, il ne doit
 * rester aucun téléversement en vol — `POST /deals/:id/dispute` n'accepte que
 * des URL.
 */
export type ReportPhoto = {
  /** L'URI locale : unique sur l'appareil, et seule identité avant ImageKit. */
  id: string;
  uri: string;
  uploading: boolean;
  /** L'URL publique, une fois en ligne. */
  url: string | null;
  /** Le code d'échec à traduire (`INVALID_TYPE`, `TOO_LARGE`, `FAILED`). */
  errorCode: string | null;
};

export function photoSlotsLeft(photos: readonly ReportPhoto[]): number {
  return Math.max(0, PHOTOS_MAX - photos.length);
}

/** Toutes en ligne, aucune en vol, aucune en échec (RG-P-13 : rien à moitié fait). */
export function photosReady(photos: readonly ReportPhoto[]): boolean {
  return photos.every((p) => p.url !== null && !p.uploading && p.errorCode === null);
}

/* ── L'envoi ────────────────────────────────────────────────────────────── */

export type ReportForm = {
  category: DisputeCategory | null;
  description: string;
  photos: readonly ReportPhoto[];
  outcome: DisputeDesiredOutcome | null;
  pledgeAccepted: boolean;
};

/**
 * Ce qui MANQUE pour envoyer, dans l'ordre où l'écran le lit. Une liste
 * plutôt qu'un booléen : le bouton doit pouvoir dire pourquoi il n'envoie
 * pas encore, sans que l'écran re-déduise les mêmes conditions.
 */
export type ReportBlocker = 'category' | 'description' | 'photos' | 'pledge';

export function reportBlockers(form: ReportForm): ReportBlocker[] {
  const blockers: ReportBlocker[] = [];
  if (form.category === null) blockers.push('category');
  if (!describeDescription(form.description).ok) blockers.push('description');
  if (!photosReady(form.photos)) blockers.push('photos');
  if (!form.pledgeAccepted) blockers.push('pledge');
  return blockers;
}

export function canSubmitReport(form: ReportForm): boolean {
  return reportBlockers(form).length === 0;
}

/* ── Les refus du serveur ───────────────────────────────────────────────── */

/**
 * Le refus, traduit en clé de message. Les trois cas qui arrivent VRAIMENT :
 *   • `TRANSITION_NOT_ALLOWED` — le deal a changé entre la lecture et le clic
 *     (versement automatique passé, Voyageur qui a bougé) : la fiche relira ;
 *   • `DISPUTE_CATEGORY_NOT_ALLOWED` — colis reparti en transit entre-temps ;
 *   • le reste (400 de validation, panne) → un message général.
 * On ne devine jamais un texte à partir du `message` serveur : il est en
 * anglais et destiné aux journaux.
 */
export function reportFailureKey(code: string | null, status: number): string {
  if (code === 'TRANSITION_NOT_ALLOWED') return 'conflict';
  if (code === 'DISPUTE_CATEGORY_NOT_ALLOWED') return 'categoryRefused';
  if (code === 'SHIPPER_ONLY') return 'conflict';
  if (status === 400) return 'validation';
  return 'generic';
}

/**
 * photos.ts — l'état d'un lot de photos, côté règles (D115).
 * ============================================================
 * Zéro import : le harnais doit pouvoir jouer ces règles (frontière A223).
 *
 * POURQUOI CE FICHIER EXISTE. La prise de photo était recopiée dans TROIS
 * écrans (`booking/content.tsx`, `shipment/[id]/report.tsx`,
 * `publish-trip/review.tsx`) : permission, lancement, téléversement, état
 * d'avancement, chacun pour soi. La prise en charge en aurait fait une
 * quatrième et la remise une cinquième. **On factorise au moment où l'on
 * devient le quatrième, pas le deuxième.**
 *
 * Les trois copies existantes ne sont PAS migrées : entrer dans le tunnel de
 * réservation pour un motif cosmétique est un risque, pas une dette qu'on
 * paie. Une fiche les COMPTE — une dette comptée se rembourse, une dette
 * promise s'oublie.
 *
 * Le modèle d'état vient de `report-form.ts` (A73) et il est juste : la
 * photo part chez ImageKit DÈS la sélection, parce que les endpoints
 * n'acceptent que des URL. Au moment d'envoyer, il ne doit rester aucun
 * téléversement en vol.
 */

/** Une photo, telle que l'écran la tient entre la sélection et l'envoi. */
export type PhotoLocale = {
  /** L'URI locale : unique sur l'appareil, et seule identité avant ImageKit. */
  id: string;
  uri: string;
  uploading: boolean;
  /** L'URL publique, une fois en ligne. */
  url: string | null;
  /** Le code d'échec à traduire (`INVALID_TYPE`, `TOO_LARGE`, `FAILED`). */
  errorCode: string | null;
};

/** Combien de photos on peut encore ajouter. */
export function placesLibres(photos: readonly PhotoLocale[], max: number): number {
  return Math.max(0, max - photos.length);
}

/**
 * Toutes en ligne, aucune en vol, aucune en échec — rien à moitié fait.
 * Un lot VIDE est « prêt » : c'est à l'appelant de dire s'il en exige une.
 */
export function photosPretes(photos: readonly PhotoLocale[]): boolean {
  return photos.every((p) => p.url !== null && !p.uploading && p.errorCode === null);
}

/** Les URL publiques, dans l'ordre d'ajout. Les photos en vol ou en échec sont ignorées. */
export function urlsDesPhotos(photos: readonly PhotoLocale[]): string[] {
  return photos.map((p) => p.url).filter((url): url is string => url !== null);
}

/** Y a-t-il un téléversement en cours ? */
export function televersementEnCours(photos: readonly PhotoLocale[]): boolean {
  return photos.some((p) => p.uploading);
}

/** Y a-t-il au moins un échec à traiter ? */
export function auMoinsUnEchec(photos: readonly PhotoLocale[]): boolean {
  return photos.some((p) => p.errorCode !== null);
}

/**
 * Ajoute ce qui est NOUVEAU, sans dépasser le plafond.
 *
 * Les doublons sont écartés par identité locale : rechoisir la même image
 * dans la photothèque ne doit pas la téléverser deux fois, et surtout pas
 * consommer deux places.
 */
export function ajouterPhotos(
  photos: readonly PhotoLocale[],
  candidates: readonly { id: string; uri: string }[],
  max: number
): PhotoLocale[] {
  const connues = new Set(photos.map((p) => p.id));
  const retenues = candidates
    .filter((c) => !connues.has(c.id))
    .slice(0, placesLibres(photos, max));
  return [
    ...photos,
    ...retenues.map((c) => ({
      id: c.id,
      uri: c.uri,
      uploading: true,
      url: null,
      errorCode: null,
    })),
  ];
}

/** Le résultat d'un téléversement, tel que l'appelant le reçoit. */
export type ResultatTeleversement = { ok: true; url: string } | { ok: false; code: string };

/** Marque UNE photo, sans toucher aux autres. */
export function marquerPhoto(
  photos: readonly PhotoLocale[],
  id: string,
  resultat: ResultatTeleversement
): PhotoLocale[] {
  return photos.map((p) =>
    p.id !== id
      ? p
      : resultat.ok
        ? { ...p, uploading: false, url: resultat.url, errorCode: null }
        : { ...p, uploading: false, url: null, errorCode: resultat.code }
  );
}

/** Retire une photo. Une photo en échec doit pouvoir partir sans bloquer l'envoi. */
export function retirerPhoto(photos: readonly PhotoLocale[], id: string): PhotoLocale[] {
  return photos.filter((p) => p.id !== id);
}

/** Remet une photo en vol, pour un nouvel essai. */
export function reessayerPhoto(photos: readonly PhotoLocale[], id: string): PhotoLocale[] {
  return photos.map((p) =>
    p.id !== id ? p : { ...p, uploading: true, url: null, errorCode: null }
  );
}

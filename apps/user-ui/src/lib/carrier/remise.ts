/**
 * remise.ts — la remise du colis, côté SITE (D116 bis).
 * =======================================================
 * Zéro import : le harnais du site (A224) doit pouvoir jouer ces règles.
 *
 * ── POURQUOI CE FICHIER NAÎT ────────────────────────────────────────────
 * L'écran de remise du site était le modèle du natif, et il est bon sur
 * l'essentiel : c'est le SERVEUR qui compte les essais et pose le verrou
 * (A38), l'écran ne fait que lire ses `details`. Mais une ligne y fusionne
 * deux états qui n'ont rien à voir :
 *
 *     isSubmitting={props.isSubmitting || !props.photosReady}
 *
 * Une photo de remise qui ÉCHOUE met donc le bouton en « Vérification… »
 * **pour toujours**, debout devant le destinataire : l'écran affirme
 * travailler alors qu'il attend quelque chose qu'il ne nomme pas. C'est la
 * famille D100 (un écran ne prétend pas faire ce qu'il ne fait pas) et la
 * leçon de D115 2A : **jamais une disjonction dans une prop d'état** — on
 * rend une LISTE de ce qui retient, et le bouton la dit.
 *
 * Les photos restent OPTIONNELLES (A76) : un lot vide ne retient rien. Mais
 * une photo commencée doit finir, sinon on remet le colis sans la preuve
 * qu'on était en train de joindre.
 */

/** Le contrat : deux photos de remise au plus (A76). */
export const PHOTOS_REMISE_MAX = 2;

/** Six chiffres (D43). Recopié du contrat, confronté par une fiche. */
export const CODE_LONGUEUR = 6;

/* Le NOMBRE d'essais n'est PAS une constante de ce module : le site a déjà
 * `MAX_DELIVERY_ATTEMPTS` (deal.api.ts), avec de vrais lecteurs. En déclarer
 * un second ici aurait donné deux domiciles au même 3 — le défaut que D110
 * vient de compter 51 fois sur `max-w-7xl`, commis dans le fichier écrit
 * pour en appliquer la leçon. */

/** Ce que l'écran tient d'une photo entre la sélection et l'envoi. */
export type PhotoDeRemise = {
  url?: string | null;
  uploading?: boolean;
  error?: string | null;
};

export type ManqueDeLaRemise =
  | { quoi: "verrou" }
  | { quoi: "code"; chiffres: number }
  | { quoi: "televersement" }
  | { quoi: "echec" };

/**
 * CE QUI RETIENT L'ENVOI, dans l'ordre où l'écran le lit. Le verrou passe
 * avant le code : quand la saisie est bloquée, dire « il manque deux
 * chiffres » est exact et hors sujet.
 */
export function manquesDeLaRemise({
  code,
  photos,
  verrouille,
}: {
  code: string;
  photos: readonly PhotoDeRemise[];
  verrouille: boolean;
}): ManqueDeLaRemise[] {
  const manques: ManqueDeLaRemise[] = [];

  if (verrouille) manques.push({ quoi: "verrou" });

  const chiffres = CODE_LONGUEUR - code.replace(/\D/g, "").length;
  if (chiffres > 0) manques.push({ quoi: "code", chiffres });

  if (photos.some((p) => p.uploading === true)) manques.push({ quoi: "televersement" });
  else if (photos.some((p) => !p.url || (p.error ?? null) !== null))
    manques.push({ quoi: "echec" });

  return manques;
}

/**
 * Ce que les PHOTOS retiennent, ou `null` si elles ne retiennent rien.
 *
 * Question posée À PART, parce que c'est elle que le bouton confondait avec
 * « je travaille » — et posée en rendant LE MANQUE, pas un booléen : un
 * `photosRetiennent(): boolean` a vécu ici, et son unique appelant a dû
 * recopier son corps en ligne pour savoir QUOI dire. Un prédicat qui oblige
 * son lecteur à refaire le calcul pour en connaître la raison n'est pas le
 * bon prédicat.
 *
 * Le code est passé COMPLET : seules les photos peuvent répondre.
 */
export function manqueDesPhotos(photos: readonly PhotoDeRemise[]): ManqueDeLaRemise | null {
  const manques = manquesDeLaRemise({
    code: "0".repeat(CODE_LONGUEUR),
    photos,
    verrouille: false,
  });
  return manques[0] ?? null;
}

/**
 * Les URL prêtes, dans l'ordre d'ajout. Une photo en vol ou en échec n'a
 * pas d'URL : elle ne part pas, et c'est `manquesDeLaRemise` qui l'a déjà
 * dit à l'écran.
 */
export function urlsDeLaRemise(photos: readonly PhotoDeRemise[]): string[] {
  return photos
    .map((p) => p.url)
    .filter((url): url is string => typeof url === "string" && url.length > 0);
}

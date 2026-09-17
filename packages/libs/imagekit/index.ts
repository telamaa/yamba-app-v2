/**
 * @packages/libs/imagekit — client ImageKit partagé (ex `apps/trip-service/src/lib/imagekit.ts`)
 * =============================================================================================
 * Paresseux : rien n'est construit avant le premier appel (les specs ne touchent pas le réseau).
 * Consommé par le trip-service (upload, documents) et, depuis C-PR8b (D63 4A), par l'auth-service
 * pour supprimer les justificatifs d'un compte effacé. `imagekit@6.0.0` est pinné à la racine (A47).
 */
import ImageKit from "imagekit";

for (const key of ["IMAGEKIT_PUBLIC_KEY", "IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_URL_ENDPOINT"] as const) {
  if (!process.env[key]) console.warn(`[ImageKit] ${key} is not set — upload endpoints will fail`);
}

let instance: ImageKit | null = null;

function getImageKit(): ImageKit {
  if (!instance) {
    instance = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
    });
  }
  return instance;
}

const imagekit = new Proxy({} as ImageKit, {
  get(_target, prop) {
    const real = getImageKit() as unknown as Record<PropertyKey, unknown>;
    const value = real[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export default imagekit;

/** Supprime un fichier ; « n'existe pas » vaut succès ; toute autre erreur est renvoyée à l'appelant. */
export async function deleteImageKitFile(fileId: string): Promise<void> {
  try {
    await imagekit.deleteFile(fileId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/does not exist|not found/i.test(msg)) return;
    throw err;
  }
}

/**
 * A198 (e) — une URL SIGNÉE, à durée courte, pour un justificatif.
 * ================================================================
 * Un billet d'avion porte un nom, un numéro de vol, parfois un numéro de réservation. Servi par une URL
 * ImageKit ordinaire, il reste lisible **pour toujours** par quiconque a l'URL — et une URL se recopie : dans
 * un message, dans un ticket de support, dans un journal. Le risque n'est pas l'énumération (le chemin est
 * aléatoire), c'est le PARTAGE, et surtout l'impossibilité de révoquer.
 *
 * Une URL signée porte une empreinte et une échéance : le lien recopié cesse de fonctionner.
 *
 * ⚠️ **Deux moitiés, dont une hors du code.** La signature ne PROTÈGE que si le compte ImageKit refuse les URL
 * non signées (« Restrict unsigned URLs » dans le tableau de bord). Sans ce réglage, l'URL signée fonctionne…
 * et l'URL nue aussi. Le réglage est documenté dans `docs/livrables/05-YAMBA-CONFIGURATION.md`.
 *
 * Sans clé privée (dev, tests), on rend l'URL telle quelle : un justificatif illisible en développement
 * coûterait plus cher que le risque qu'on couvre ici.
 */
export function signedImageKitUrl(url: string, expireSeconds = 300): string {
  if (!url || !process.env.IMAGEKIT_PRIVATE_KEY) return url;
  try {
    return imagekit.url({ src: url, signed: true, expireSeconds });
  } catch {
    // Une URL d'un autre domaine, ou un endpoint mal configuré : mieux vaut l'URL d'origine qu'une page vide.
    return url;
  }
}

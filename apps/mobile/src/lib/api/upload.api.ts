/**
 * upload.api.ts — les photos déclarées montent chez ImageKit (A45, D42).
 * ======================================================================
 * Le serveur ne reçoit JAMAIS le fichier : il signe une autorisation courte
 * (`GET /uploads/imagekit-auth`, authentifiée), l'appareil envoie l'image
 * directement à ImageKit, et seule l'URL revient dans `POST /deals`. C'est
 * exactement ce que fait le site (`useImageKitUpload`) — la clé privée reste
 * côté serveur, le binaire ne traverse pas le gateway.
 *
 * ORDRE IMPOSÉ PAR A45 : les photos partent AVANT l'autorisation bancaire.
 * Un échec de téléversement doit tout arrêter pendant qu'aucune empreinte
 * n'existe — sinon on laisse une autorisation orpheline sur la carte de
 * l'Expéditeur pour une demande qui ne sera jamais créée (A34).
 *
 * Deux différences avec le web, imposées par React Native :
 *   • il n'y a pas d'objet `File`. `FormData` accepte `{ uri, name, type }` :
 *     c'est le pont natif qui lit le fichier, d'où le `as unknown as Blob`
 *     (le typage DOM de `FormData` ne connaît pas cette forme) ;
 *   • `expo-image-picker` ne garantit NI le type MIME NI le nom. Quand ils
 *     manquent, on les déduit de l'extension de l'URI — et un format inconnu
 *     est refusé ICI plutôt que par ImageKit, qui répondrait en anglais et
 *     sans code exploitable.
 */
import { apiFetch } from './client';

/** Les formats que le site accepte déjà pour une photo de colis. */
const PHOTO_MIME_TYPES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

/** Spec §3.4 — 10 Mo par photo, comme sur le site. */
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_MAX_MB = Math.round(PHOTO_MAX_BYTES / (1024 * 1024));

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

type ImageKitAuth = {
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
  urlEndpoint: string;
};

/** Ce que l'écran doit pouvoir DIRE à l'Expéditeur — jamais un message brut. */
export type UploadFailureCode = 'INVALID_TYPE' | 'TOO_LARGE' | 'FAILED';

export type UploadablePhoto = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type UploadResult = { ok: true; url: string } | { ok: false; code: UploadFailureCode };

/** « …/IMG_4312.HEIC » → « heic ». Vide si l'URI n'en porte pas. */
function extensionOf(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const lastDot = withoutQuery.lastIndexOf('.');
  return lastDot === -1 ? '' : withoutQuery.slice(lastDot + 1).toLowerCase();
}

function resolveMimeType(photo: UploadablePhoto): string | null {
  const declared = photo.mimeType?.toLowerCase();
  if (declared && PHOTO_MIME_TYPES.includes(declared)) return declared;
  return MIME_BY_EXTENSION[extensionOf(photo.uri)] ?? null;
}

function resolveFileName(photo: UploadablePhoto, mimeType: string): string {
  if (photo.fileName) return photo.fileName;
  const extension = extensionOf(photo.uri) || mimeType.split('/')[1] || 'jpg';
  return `yamba-${Date.now()}.${extension}`;
}

/**
 * Téléverse UNE photo et rend son URL publique. Ne lève jamais : l'appelant
 * est au milieu d'un parcours d'argent, il a besoin d'un code à traduire, pas
 * d'une exception à rattraper.
 */
export async function uploadDeclaredPhoto(photo: UploadablePhoto): Promise<UploadResult> {
  const mimeType = resolveMimeType(photo);
  if (!mimeType) return { ok: false, code: 'INVALID_TYPE' };
  if (photo.sizeBytes !== null && photo.sizeBytes > PHOTO_MAX_BYTES) {
    return { ok: false, code: 'TOO_LARGE' };
  }

  try {
    const auth = await apiFetch<ImageKitAuth>('/uploads/imagekit-auth');
    if (!auth.publicKey || !auth.token || !auth.signature || !auth.expire) {
      return { ok: false, code: 'FAILED' };
    }

    const form = new FormData();
    // La forme `{ uri, name, type }` est celle que React Native attend : c'est
    // le module natif qui ouvre le fichier, pas JavaScript.
    form.append('file', { uri: photo.uri, name: resolveFileName(photo, mimeType), type: mimeType } as unknown as Blob);
    form.append('fileName', resolveFileName(photo, mimeType));
    form.append('publicKey', auth.publicKey);
    form.append('signature', auth.signature);
    form.append('expire', String(auth.expire));
    form.append('token', auth.token);
    form.append('useUniqueFileName', 'true');
    form.append('folder', '/bookings/declared');

    // Pas d'en-tête `content-type` : `fetch` doit poser lui-même la frontière
    // multipart. L'écrire à la main casse l'envoi (frontière absente).
    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) return { ok: false, code: 'FAILED' };

    const body = (await response.json()) as { url?: string };
    return typeof body.url === 'string' ? { ok: true, url: body.url } : { ok: false, code: 'FAILED' };
  } catch {
    return { ok: false, code: 'FAILED' };
  }
}

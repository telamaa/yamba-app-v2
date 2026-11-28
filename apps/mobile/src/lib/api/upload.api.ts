/**
 * upload.api.ts — les photos montent chez ImageKit (A45, D42).
 * =============================================================
 * Le serveur ne reçoit JAMAIS le fichier : il signe une autorisation courte
 * (`GET /uploads/imagekit-auth`, authentifiée), l'appareil envoie l'image
 * directement à ImageKit, et seule l'URL revient dans `POST /deals`. C'est
 * exactement ce que fait le site (`useImageKitUpload`) — la clé privée reste
 * côté serveur, le binaire ne traverse pas le gateway.
 *
 * Deux usages, deux dossiers : les photos du colis DÉCLARÉ (tunnel de
 * réservation) et les PREUVES d'un signalement (A73). Le dossier est le seul
 * paramètre qui change — la signature, elle, ne le mentionne pas.
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

/**
 * Un DOCUMENT (billet) : le serveur en veut plus qu'une URL — il garde le
 * `fileId` d'ImageKit pour pouvoir supprimer le fichier avec le document
 * (`DELETE /trips/:id/documents/:docId`). Une URL seule laisserait des
 * fichiers orphelins chez le prestataire, facturés et jamais relus.
 */
export type DocumentTeleverse = {
  url: string;
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
};

export type DocumentUploadResult =
  | { ok: true; document: DocumentTeleverse }
  | { ok: false; code: UploadFailureCode };

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

/** Les deux dossiers ImageKit de Yamba, les mêmes que ceux du site. */
const FOLDER_DECLARED = '/bookings/declared';
const FOLDER_DISPUTE = '/deals/dispute';
/** Les PREUVES d'inspection, à la prise en charge (D115). Mêmes dossiers que le site. */
const FOLDER_PICKUP = '/deals/pickup';
const FOLDER_DELIVERY = '/deals/delivery';
/** Le MÊME dossier que le site (`useImageKitUpload("/trips")`) : deux fronts,
 *  un seul rangement — un administrateur qui cherche un billet n'a pas à
 *  savoir par quel appareil il est arrivé. */
const FOLDER_TRIP = '/trips';

/**
 * Téléverse UNE photo et rend son URL publique. Ne lève jamais : l'appelant
 * est au milieu d'un parcours d'argent, il a besoin d'un code à traduire, pas
 * d'une exception à rattraper.
 */
async function uploadTo(photo: UploadablePhoto, folder: string): Promise<UploadResult> {
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
    form.append('folder', folder);

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

/**
 * LE BILLET du Voyageur (D111) — il ouvre le badge « Voyage vérifié » après
 * validation par Yamba.
 *
 * Même chemin que les photos (autorisation courte signée par le serveur, le
 * binaire va directement chez ImageKit), mais le retour garde le `fileId` :
 * `POST /trips/:id/documents` l'exige, et c'est lui qui permettra d'effacer
 * le fichier le jour où le document est retiré.
 */
export async function uploadTripTicket(photo: UploadablePhoto): Promise<DocumentUploadResult> {
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

    const name = resolveFileName(photo, mimeType);
    const form = new FormData();
    form.append('file', { uri: photo.uri, name, type: mimeType } as unknown as Blob);
    form.append('fileName', name);
    form.append('publicKey', auth.publicKey);
    form.append('signature', auth.signature);
    form.append('expire', String(auth.expire));
    form.append('token', auth.token);
    form.append('useUniqueFileName', 'true');
    form.append('folder', FOLDER_TRIP);

    const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
      method: 'POST',
      body: form,
    });
    if (!response.ok) return { ok: false, code: 'FAILED' };

    const body = (await response.json()) as { url?: string; fileId?: string };
    if (typeof body.url !== 'string' || typeof body.fileId !== 'string') {
      return { ok: false, code: 'FAILED' };
    }
    return {
      ok: true,
      document: {
        url: body.url,
        fileId: body.fileId,
        name,
        mimeType,
        sizeBytes: photo.sizeBytes,
      },
    };
  } catch {
    return { ok: false, code: 'FAILED' };
  }
}

/** Une photo du colis DÉCLARÉ, au moment de créer la réservation (A45). */
export function uploadDeclaredPhoto(photo: UploadablePhoto): Promise<UploadResult> {
  return uploadTo(photo, FOLDER_DECLARED);
}

/**
 * Une PREUVE de signalement (A73, D42). Dossier séparé à dessein : les
 * photos d'un litige sont des pièces d'un dossier de médiation, pas des
 * photos de colis — elles ne se rangent pas avec elles, et l'admin les lit
 * par ce chemin.
 */
export function uploadDisputePhoto(photo: UploadablePhoto): Promise<UploadResult> {
  return uploadTo(photo, FOLDER_DISPUTE);
}

/**
 * Une photo d'INSPECTION, prise au moment de la prise en charge (D115).
 *
 * Dossier identique à celui du site (`/deals/pickup`) : ces photos sont
 * lues par la fiche de l'Expéditeur et, le cas échéant, par un dossier de
 * médiation — deux dossiers ImageKit pour la même preuve rendraient une
 * moitié des réservations illisible selon le front qui les a créées.
 */
export function uploadPickupPhoto(photo: UploadablePhoto): Promise<UploadResult> {
  return uploadTo(photo, FOLDER_PICKUP);
}

/** Une photo de REMISE, optionnelle (D116, A76) : le code prouve la remise, la photo prouve l'état. */
export function uploadDeliveryPhoto(photo: UploadablePhoto): Promise<UploadResult> {
  return uploadTo(photo, FOLDER_DELIVERY);
}

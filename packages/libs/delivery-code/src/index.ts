/**
 * @packages/delivery-code — génération, hachage et chiffrement du code de livraison (D43)
 * ==========================================================================================
 * Emplacement : packages/libs/delivery-code/src/index.ts
 * Consommateurs : deal-service (pickup, régénération, livraison, vue
 * Shipper) et le seed (packages/libs/prisma/scripts, import relatif).
 *
 * Le code (6 chiffres, 100000–999999) est généré par le SERVEUR à la
 * transition ACCEPTED → PICKED_UP et stocké sous DEUX formes :
 *   - `deliveryCodeHash`      : bcrypt (coût 10) — lu par `deliver` seul,
 *                               jamais réversible ;
 *   - `deliveryCodeEncrypted` : AES-256-GCM — lu par la vue Shipper seule
 *                               (ré-affichage, PICKED_UP uniquement).
 *
 * Format chiffré, VERSIONNÉ pour la rotation de clé :
 *   v1.<iv base64url>.<tag base64url>.<chiffré base64url>
 *
 * Clé : DELIVERY_CODE_ENCRYPTION_KEY (32 octets base64). Hors production
 * sans clé → clé de développement dérivée d'une constante (un seul
 * avertissement) ; en production sans clé → erreur (miroir D38 : le Fake
 * paiement est refusé en production).
 *
 * ZÉRO import @packages ni dépendance d'infrastructure : node:crypto et
 * bcryptjs seulement — importable par un script tsx sans alias.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

export const DELIVERY_CODE_MIN = 100_000;
export const DELIVERY_CODE_MAX = 999_999;
const BCRYPT_ROUNDS = 10;
const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_BYTES = 12;

/* ══ Génération ═══════════════════════════════════════════════ */

/** 6 chiffres, CSPRNG (randomInt est uniforme, borne haute exclusive). */
export function generateDeliveryCode(): string {
  return String(randomInt(DELIVERY_CODE_MIN, DELIVERY_CODE_MAX + 1));
}

export function isDeliveryCodeFormat(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/* ══ bcrypt (validation) ══════════════════════════════════════ */

export async function hashDeliveryCode(code: string): Promise<string> {
  return bcrypt.hash(code, BCRYPT_ROUNDS);
}

export async function verifyDeliveryCode(code: string, hash: string): Promise<boolean> {
  if (!isDeliveryCodeFormat(code)) return false;
  return bcrypt.compare(code, hash);
}

/* ══ AES-256-GCM (ré-affichage) ═══════════════════════════════ */

export class DeliveryCodeKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeliveryCodeKeyError";
  }
}

let devKeyWarned = false;

/**
 * Résout la clé de 32 octets. Injectable (tests) via `env`.
 * - clé présente et valide (32 octets base64) → utilisée ;
 * - absente hors production → clé de DEV dérivée (SHA-256 d'une
 *   constante) + un avertissement unique ;
 * - absente en production, ou invalide partout → DeliveryCodeKeyError.
 */
export function resolveDeliveryCodeKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.DELIVERY_CODE_ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) {
      throw new DeliveryCodeKeyError(
        "DELIVERY_CODE_ENCRYPTION_KEY must be 32 bytes encoded in base64 (openssl rand -base64 32)."
      );
    }
    return key;
  }
  if (env.NODE_ENV === "production") {
    throw new DeliveryCodeKeyError("DELIVERY_CODE_ENCRYPTION_KEY is required in production.");
  }
  if (!devKeyWarned) {
    devKeyWarned = true;
    // eslint-disable-next-line no-console
    console.warn(
      "[delivery-code] DELIVERY_CODE_ENCRYPTION_KEY absent — using a DEVELOPMENT key (never in production)."
    );
  }
  return createHash("sha256").update("yamba-dev-delivery-code-key").digest();
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

export function encryptDeliveryCode(code: string, key: Buffer = resolveDeliveryCodeKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, b64url(iv), b64url(tag), b64url(encrypted)].join(".");
}

/**
 * Déchiffre ; retourne null sur tout défaut (format inconnu, tag
 * invalide, mauvaise clé) — la vue affiche alors « code indisponible »
 * plutôt qu'un 500 : le hash bcrypt reste valide pour la livraison.
 */
export function decryptDeliveryCode(
  encrypted: string,
  key: Buffer = resolveDeliveryCodeKey()
): string | null {
  const parts = encrypted.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) return null;
  try {
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const clear = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]).toString(
      "utf8"
    );
    return isDeliveryCodeFormat(clear) ? clear : null;
  } catch {
    return null;
  }
}

/* ══ Matérialisation (les deux formes en un appel) ════════════ */

export type DeliveryCodeMaterial = {
  code: string;
  deliveryCodeHash: string;
  deliveryCodeEncrypted: string;
};

/** Génère un code et ses deux représentations — une seule vérité écrite en transaction. */
export async function issueDeliveryCode(key?: Buffer): Promise<DeliveryCodeMaterial> {
  const code = generateDeliveryCode();
  const [deliveryCodeHash, deliveryCodeEncrypted] = await Promise.all([
    hashDeliveryCode(code),
    Promise.resolve(encryptDeliveryCode(code, key)),
  ]);
  return { code, deliveryCodeHash, deliveryCodeEncrypted };
}

/**
 * Le code à montrer à l'EXPÉDITEUR : uniquement en PICKED_UP (spec §3.1 :
 * révélé au pickup, inutile après la remise), uniquement si un chiffré
 * existe et se déchiffre. Le mapper reste pur : c'est le controller qui
 * appelle cette fonction pour la vue Shipper de GET /deals/:id.
 */
export function revealDeliveryCode(
  booking: { status: string; deliveryCodeEncrypted?: string | null },
  key?: Buffer
): string | null {
  if (booking.status !== "PICKED_UP" || !booking.deliveryCodeEncrypted) return null;
  return decryptDeliveryCode(booking.deliveryCodeEncrypted, key);
}

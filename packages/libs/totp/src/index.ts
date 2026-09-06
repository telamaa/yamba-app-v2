/**
 * @packages/totp — TOTP (RFC 6238) et codes de secours, ZÉRO dépendance (D54, 8A)
 * ================================================================================
 * Pourquoi maison : otplib tire une chaîne de dépendances pour 40 lignes de
 * HMAC-SHA1 ; ici tout passe par node:crypto, testable avec les vecteurs
 * officiels de la RFC (voir totp.spec.ts dans auth-service).
 *
 * - secret : 20 octets CSPRNG, présenté en base32 (format des applications
 *   d'authentification) ; stocké CHIFFRÉ (AES-256-GCM, clé TOTP_ENCRYPTION_KEY,
 *   même patron que le code de livraison D43 : clé de dev hors production,
 *   refus en production sans clé) ;
 * - vérification : fenêtre ±1 pas (30 s), comparaison à temps constant,
 *   et l'appelant REFUSE la réutilisation du même pas (anti-rejeu) ;
 * - codes de secours : 8 codes de 10 caractères sans ambiguïté, montrés UNE
 *   fois, stockés en SHA-256 (entropie ~50 bits : un hash rapide suffit).
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
export const BACKUP_CODES_COUNT = 8;

/* ══ Base32 (RFC 4648, sans padding) ══════════════════════════ */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/[^A-Z2-7]/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/* ══ HOTP / TOTP ══════════════════════════════════════════════ */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: number, digits: number = TOTP_DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[offset] & 0x7f) << 24) | ((mac[offset + 1] & 0xff) << 16) | ((mac[offset + 2] & 0xff) << 8) | (mac[offset + 3] & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function totpStep(timeMs: number, stepSeconds: number = TOTP_STEP_SECONDS): number {
  return Math.floor(timeMs / 1000 / stepSeconds);
}

export function totpCode(secretBase32: string, timeMs: number = Date.now(), digits: number = TOTP_DIGITS): string {
  return hotp(base32Decode(secretBase32), totpStep(timeMs), digits);
}

export type TotpVerification = { ok: true; step: number } | { ok: false };

/**
 * Vérifie un code dans la fenêtre ±window pas. Retourne le pas accepté :
 * l'appelant le mémorise (`totpLastUsedStep`) et refuse un pas ≤ au dernier
 * utilisé — un code intercepté ne sert donc jamais deux fois.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  opts: { timeMs?: number; window?: number; lastUsedStep?: number | null } = {}
): TotpVerification {
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return { ok: false };
  const secret = base32Decode(secretBase32);
  const now = totpStep(opts.timeMs ?? Date.now());
  const window = opts.window ?? TOTP_WINDOW;
  for (let delta = -window; delta <= window; delta++) {
    const step = now + delta;
    if (opts.lastUsedStep != null && step <= opts.lastUsedStep) continue;
    const expected = hotp(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(clean))) return { ok: true, step };
  }
  return { ok: false };
}

export function otpauthUrl(params: { issuer: string; account: string; secret: string }): string {
  const label = encodeURIComponent(`${params.issuer}:${params.account}`);
  const q = new URLSearchParams({ secret: params.secret, issuer: params.issuer, algorithm: "SHA1", digits: String(TOTP_DIGITS), period: String(TOTP_STEP_SECONDS) });
  return `otpauth://totp/${label}?${q.toString()}`;
}

/* ══ Codes de secours ═════════════════════════════════════════ */
const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I, O, 0, 1

export function generateBackupCodes(count: number = BACKUP_CODES_COUNT): string[] {
  const codes: string[] = [];
  while (codes.length < count) {
    let raw = "";
    for (let i = 0; i < 10; i++) raw += BACKUP_ALPHABET[randomInt(BACKUP_ALPHABET.length)];
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function normalizeBackupCode(input: string): string {
  return String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isBackupCodeFormat(input: string): boolean {
  return /^[A-Z2-9]{10}$/.test(normalizeBackupCode(input));
}

export function hashBackupCode(code: string): string {
  return createHash("sha256").update(normalizeBackupCode(code)).digest("hex");
}

/** Retourne la liste des hashes SANS le code consommé, ou null si aucun ne correspond. */
export function consumeBackupCode(code: string, hashes: string[]): string[] | null {
  const h = hashBackupCode(code);
  const idx = hashes.findIndex((x) => x.length === h.length && timingSafeEqual(Buffer.from(x), Buffer.from(h)));
  if (idx === -1) return null;
  return hashes.filter((_, i) => i !== idx);
}

/* ══ Chiffrement du secret (AES-256-GCM, patron D43) ══════════ */
const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";

export class TotpKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TotpKeyError";
  }
}

let devKeyWarned = false;

export function resolveTotpKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.TOTP_ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = Buffer.from(raw, "base64");
    if (key.length !== 32) throw new TotpKeyError("TOTP_ENCRYPTION_KEY must be 32 bytes encoded in base64 (openssl rand -base64 32).");
    return key;
  }
  if (env.NODE_ENV === "production") throw new TotpKeyError("TOTP_ENCRYPTION_KEY is required in production.");
  if (!devKeyWarned) {
    devKeyWarned = true;
    // eslint-disable-next-line no-console
    console.warn("[totp] TOTP_ENCRYPTION_KEY absent — using a DEVELOPMENT key (never in production).");
  }
  return createHash("sha256").update("yamba-dev-totp-key").digest();
}

export function encryptTotpSecret(secretBase32: string, key: Buffer = resolveTotpKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(secretBase32, "utf8"), cipher.final()]);
  return [FORMAT_VERSION, iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function decryptTotpSecret(encrypted: string, key: Buffer = resolveTotpKey()): string | null {
  const parts = encrypted.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) return null;
  try {
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    const clear = Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
    return /^[A-Z2-7]{16,}$/.test(clear) ? clear : null;
  } catch {
    return null;
  }
}

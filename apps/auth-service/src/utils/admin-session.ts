/**
 * admin-session.ts — record Redis d'une session ADMIN (D54, 8A)
 * =============================================================
 * Préfixe `admin_jti:` séparé des sessions utilisateur (`refresh_jti:`) :
 * un jti admin ne vaut jamais comme session utilisateur, et inversement.
 * TTL = politique admin (min(inactivité 45 min, vie absolue 12 h)).
 */
import redis from "@packages/libs/redis";
import { adminSessionKey } from "@packages/middleware/session-revocation";
import { adminSessionTtlSeconds, loadAdminSessionPolicy } from "./admin-session-policy";
import { describeUserAgent, shortUserAgent } from "./session-device";

/**
 * A188 a (recette 02-ADMIN § 5.26, ANO-ADM-81) — « Révoque ce que tu ne reconnais pas » : sans appareil ni IP, les sessions ne
 * se distinguaient que par leurs dates. Posés à l'ouverture, recopiés à chaque rotation ; absents des sessions d'avant.
 */
export type AdminSessionClient = { ip: string | null; userAgent: string | null; device: string };
export type AdminSessionRecord = { createdAt: number; lastActivityAt: number } & Partial<AdminSessionClient>;

/** Le client d'une requête, tel qu'il est gardé dans la session. */
export function adminSessionClient(req: { ip?: string; headers: Record<string, unknown> }): AdminSessionClient {
  const ua = typeof req.headers["user-agent"] === "string" ? (req.headers["user-agent"] as string) : null;
  return { ip: req.ip ?? null, userAgent: shortUserAgent(ua), device: describeUserAgent(ua) };
}

/** ANO-ADM-04 — la clé vient du middleware qui la relit : une seule écriture. */
const key = adminSessionKey;

/** Retourne le TTL posé (0 = session absolument expirée, rien n'est écrit). */
export async function storeAdminSession(userId: string, jti: string, createdAt: number, now: number = Date.now(), client?: Partial<AdminSessionClient>): Promise<number> {
  const ttl = adminSessionTtlSeconds(createdAt, loadAdminSessionPolicy(), now);
  if (ttl <= 0) return 0;
  const record: AdminSessionRecord = { createdAt, lastActivityAt: now, ...(client?.device ? { ip: client.ip ?? null, userAgent: client.userAgent ?? null, device: client.device } : {}) };
  await redis.set(key(userId, jti), JSON.stringify(record), "EX", ttl);
  return ttl;
}

export async function getAdminSession(userId: string, jti: string): Promise<AdminSessionRecord | null> {
  const raw = await redis.get(key(userId, jti));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminSessionRecord;
    return typeof parsed?.createdAt === "number" ? parsed : null;
  } catch {
    return null;
  }
}

/** A188 b (ANO-ADM-83) — `true` seulement si la session existait : une déconnexion rejouée ne se journalise pas deux fois. */
export async function revokeAdminSession(userId: string, jti: string): Promise<boolean> {
  return (await redis.del(key(userId, jti))) === 1;
}

/* ── Compteur d'échecs TOTP (5 par pré-authentification, 15 min) ── */
const FAIL_LIMIT = 5;
const FAIL_TTL_SECONDS = 15 * 60;

export async function registerTotpFailure(userId: string): Promise<number> {
  const k = `admin_totp_fail:${userId}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, FAIL_TTL_SECONDS);
  return n;
}

export async function totpFailuresExceeded(userId: string): Promise<boolean> {
  const raw = await redis.get(`admin_totp_fail:${userId}`);
  return Number(raw ?? 0) >= FAIL_LIMIT;
}

export async function clearTotpFailures(userId: string): Promise<void> {
  await redis.del(`admin_totp_fail:${userId}`);
}

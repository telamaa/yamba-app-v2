/**
 * admin-session.ts — record Redis d'une session ADMIN (D54, 8A)
 * =============================================================
 * Préfixe `admin_jti:` séparé des sessions utilisateur (`refresh_jti:`) :
 * un jti admin ne vaut jamais comme session utilisateur, et inversement.
 * TTL = politique admin (min(inactivité 45 min, vie absolue 12 h)).
 */
import redis from "@packages/libs/redis";
import { adminSessionTtlSeconds, loadAdminSessionPolicy } from "./admin-session-policy";

export type AdminSessionRecord = { createdAt: number; lastActivityAt: number };

const key = (userId: string, jti: string) => `admin_jti:${userId}:${jti}`;

/** Retourne le TTL posé (0 = session absolument expirée, rien n'est écrit). */
export async function storeAdminSession(userId: string, jti: string, createdAt: number, now: number = Date.now()): Promise<number> {
  const ttl = adminSessionTtlSeconds(createdAt, loadAdminSessionPolicy(), now);
  if (ttl <= 0) return 0;
  const record: AdminSessionRecord = { createdAt, lastActivityAt: now };
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

export async function revokeAdminSession(userId: string, jti: string): Promise<void> {
  await redis.del(key(userId, jti));
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

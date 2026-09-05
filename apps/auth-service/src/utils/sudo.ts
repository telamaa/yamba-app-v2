/**
 * sudo.ts — la fenêtre sudo liée à la session courante (D65 1A, SES-03)
 * =====================================================================
 * `sudo:<userId>:<jti>` en Redis, TTL 15 min, ouverte par un code email vérifié. Un geste
 * sensible sans fenêtre répond 403 `SUDO_REQUIRED` : le front ouvre la porte puis rejoue.
 * Le client Redis est injectable (un Map suffit en test).
 */
import jwt from "jsonwebtoken";
import type { Request } from "express";
import redisClient from "@packages/libs/redis";
import { SUDO_WINDOW_MINUTES } from "@packages/api-contracts";
import { ForbiddenError } from "@packages/error-handler";

export type SudoStore = { set(key: string, value: string, mode: "EX", seconds: number): Promise<unknown>; ttl(key: string): Promise<number>; del(key: string): Promise<unknown> };
export const sudoKey = (userId: string, jti: string) => `sudo:${userId}:${jti}`;

/** Le jti de la session courante, lu dans le cookie refresh (même secret que la rotation). */
export function currentMemberJti(req: Request): string | null {
  const token = req.cookies?.["refresh_token"];
  if (!token) return null;
  try {
    return (jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string) as { jti?: string }).jti ?? null;
  } catch {
    return null;
  }
}

export async function openSudoWindow(store: SudoStore, userId: string, jti: string, minutes: number = SUDO_WINDOW_MINUTES): Promise<Date> {
  await store.set(sudoKey(userId, jti), "1", "EX", minutes * 60);
  return new Date(Date.now() + minutes * 60_000);
}

export async function sudoStatus(store: SudoStore, userId: string, jti: string | null): Promise<{ active: boolean; expiresAt: string | null }> {
  if (!jti) return { active: false, expiresAt: null };
  const ttl = await store.ttl(sudoKey(userId, jti));
  return ttl > 0 ? { active: true, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() } : { active: false, expiresAt: null };
}

export async function closeSudoWindow(store: SudoStore, userId: string, jti: string): Promise<void> {
  await store.del(sudoKey(userId, jti));
}

/** 403 typé si la fenêtre n'est pas ouverte pour CETTE session. */
export async function requireSudo(req: Request & { user?: { id: string } }, store: SudoStore = redisClient as unknown as SudoStore): Promise<string> {
  const userId = req.user?.id;
  const jti = currentMemberJti(req);
  if (!userId || !jti) throw new ForbiddenError("Sudo required: confirm with the code sent by email.");
  const status = await sudoStatus(store, userId, jti);
  if (!status.active) {
    const err = new ForbiddenError("Sudo required: confirm with the code sent by email.");
    (err as ForbiddenError & { details?: unknown }).details = { code: "SUDO_REQUIRED", windowMinutes: SUDO_WINDOW_MINUTES };
    throw err;
  }
  return jti;
}

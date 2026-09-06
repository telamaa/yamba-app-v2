/**
 * adminCookies.ts — cookies de la session ADMIN (D54, 8A)
 * ========================================================
 * Noms DISTINCTS de la session utilisateur (`admin_*`) : les cookies ignorent
 * le port, user-ui (3000) et admin-ui (3001) partagent donc le même hôte en
 * dev — deux paires de noms évitent qu'une connexion admin écrase la session
 * utilisateur (et inversement), et les routes admin ne lisent JAMAIS
 * `access_token`. Pas de « rester connecté » : le refresh est un cookie de
 * session borné par la politique admin.
 */
import type { CookieOptions, Response } from "express";

export const ADMIN_ACCESS_COOKIE = "admin_access_token";
export const ADMIN_REFRESH_COOKIE = "admin_refresh_token";
export const ADMIN_PREAUTH_COOKIE = "admin_preauth";

function base(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  return { httpOnly: true, secure: isProd, sameSite: isProd ? "none" : "lax", path: "/" };
}

export function setAdminPreauthCookie(res: Response, token: string, maxAgeMs: number): void {
  res.cookie(ADMIN_PREAUTH_COOKIE, token, { ...base(), maxAge: maxAgeMs });
}

export function setAdminSessionCookies(res: Response, accessToken: string, refreshToken: string, refreshMaxAgeMs: number): void {
  res.clearCookie(ADMIN_PREAUTH_COOKIE, base());
  res.cookie(ADMIN_ACCESS_COOKIE, accessToken, { ...base(), maxAge: 15 * 60 * 1000 });
  res.cookie(ADMIN_REFRESH_COOKIE, refreshToken, { ...base(), maxAge: refreshMaxAgeMs });
}

export function clearAdminCookies(res: Response): void {
  const b = base();
  res.clearCookie(ADMIN_PREAUTH_COOKIE, b);
  res.clearCookie(ADMIN_ACCESS_COOKIE, b);
  res.clearCookie(ADMIN_REFRESH_COOKIE, b);
}

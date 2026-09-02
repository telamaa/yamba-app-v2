/**
 * safe-redirect.ts — garde-fou anti « open redirect »
 * ====================================================
 * Le paramètre `?redirect=` (retour à la page visée après connexion ou
 * inscription) n'est accepté que s'il désigne un chemin INTERNE :
 * commence par « / », pas « // » ni un schéma. Sinon : null.
 */
export function sanitizeRedirect(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://")) return null;
  return value;
}

/** Ajoute `redirect=` à une URL interne (login/register) si présent. */
export function withRedirect(path: string, redirect: string | null): string {
  if (!redirect) return path;
  return path + (path.includes("?") ? "&" : "?") + "redirect=" + encodeURIComponent(redirect);
}

/** Clé sessionStorage : le retour survit à inscription → OTP → connexion. */
export const REGISTER_REDIRECT_KEY = "register_redirect";

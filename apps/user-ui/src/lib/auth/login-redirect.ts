/**
 * login-redirect.ts — où revenir après connexion (RG-C-12, A58)
 * =============================================================
 * Le lien « Connexion » du header (et « Créer un compte ») transmet la page
 * COURANTE en `?redirect=` pour que l'utilisateur revienne là où il était.
 * Exceptions : les pages d'authentification elles-mêmes (boucle) et
 * l'accueil (retour par défaut de LoginForm).
 *
 * `pathname` est SANS préfixe de locale (usePathname de @/i18n/navigation).
 */
import { withRedirect } from "./safe-redirect";

const NO_REDIRECT_PREFIXES = ["/login", "/register", "/password"];

export function shouldCarryRedirect(pathname: string | null | undefined): boolean {
  if (!pathname || pathname === "/") return false;
  return !NO_REDIRECT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function loginHrefFor(pathname: string | null | undefined): string {
  return withRedirect("/login", shouldCarryRedirect(pathname) ? pathname! : null);
}

export function registerHrefFor(pathname: string | null | undefined): string {
  return withRedirect("/register", shouldCarryRedirect(pathname) ? pathname! : null);
}

/** Retour après la porte de réservation : directement dans le wizard (intention = réserver). */
export function bookingRedirectFor(tripId: string): string {
  return `/trips/${tripId}/book`;
}

/**
 * login-redirect.ts — où revenir après connexion (RG-C-12, A58)
 * =============================================================
 * Le lien « Connexion » du header (et « Créer un compte ») transmet la page
 * COURANTE en `?redirect=` pour que l'utilisateur revienne là où il était.
 * Exceptions : les pages d'authentification elles-mêmes (boucle) et
 * l'accueil (retour par défaut de LoginForm).
 *
 * `pathname` est SANS préfixe de locale (usePathname de @/i18n/navigation).
 *
 * D93 — la liste des pages d'auth N'EST PLUS ICI. Ce fichier en tenait sa
 * propre copie (`NO_REDIRECT_PREFIXES`), et les deux avaient divergé :
 * `/refresh` appartient au groupe de routes `(auth)` depuis le 28/08 et
 * manquait à celle-ci, donc le header proposait d'y revenir après connexion —
 * un `?redirect=/refresh` qui ne ramène sur aucune page utile. La liste vit
 * désormais dans `lib/layout/tunnel.ts`, une fois.
 */
import { isAuthTunnel } from "@/lib/layout/tunnel";
import { withRedirect } from "./safe-redirect";

export function shouldCarryRedirect(pathname: string | null | undefined): boolean {
  if (!pathname || pathname === "/") return false;
  return !isAuthTunnel(pathname);
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

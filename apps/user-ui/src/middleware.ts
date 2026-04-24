import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * Middleware qui gère le routing i18n.
 * - Redirige / vers /fr ou /en selon Accept-Language
 * - Maintient la locale dans l'URL pour chaque navigation
 */
export default createMiddleware(routing);

export const config = {
  // Match toutes les routes sauf:
  // - Les API routes (/api/*)
  // - Les assets statiques (/_next, /_vercel, /favicon.ico, etc.)
  // - Les fichiers avec extension (.png, .jpg, .svg, etc.)
  matcher: [
    "/((?!api|_next|_vercel|assets|favicon.ico|.*\\..*).*)",
  ],
};

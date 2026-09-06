/**
 * current-locale.ts — la locale de l'interface, lue depuis l'URL (D44)
 * =====================================================================
 * next-intl impose le préfixe (`localePrefix: "always"`) : le premier
 * segment du chemin EST la locale. Utilisable hors React (intercepteur
 * axios, apiFetch) ; côté serveur (pas de window) → null, l'appelant
 * n'ajoute pas l'en-tête.
 */
import { isSupportedLocale, type SupportedLocale } from "@packages/api-contracts/locale";

export function getCurrentLocale(): SupportedLocale | null {
  if (typeof window === "undefined") return null;
  const first = window.location.pathname.split("/")[1];
  return isSupportedLocale(first) ? first : null;
}

/** En-tête `x-locale` à joindre à chaque requête API (vide côté serveur). */
export function localeHeaders(): Record<string, string> {
  const locale = getCurrentLocale();
  return locale ? { "x-locale": locale } : {};
}

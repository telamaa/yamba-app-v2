/**
 * locale.ts — la liste UNIQUE des langues de Yamba (D44)
 * =====================================================
 * Consommée par next-intl (routing du front), par le client API (en-tête
 * `x-locale`), par l'auth-service (`User.preferredLocale`) et par les trois
 * mailers. Ajouter une langue = ajouter une entrée ICI + un dictionnaire
 * d'emails + un dossier `messages/<locale>/` côté front. Jamais un booléen
 * `fr ? … : …` ailleurs.
 *
 * Fichier volontairement SANS zod : le front l'importe par un alias dédié
 * (`@packages/api-contracts/locale`) sans embarquer les schémas d'API.
 */

export const SUPPORTED_LOCALES = ["fr", "en"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "fr";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Normalise une valeur venue de l'extérieur (`x-locale`, `Accept-Language`,
 * champ en base, segment d'URL) vers une locale supportée :
 *  - "fr-FR" / "FR" / "en-US,en;q=0.9" → "fr" / "fr" / "en"
 *  - absent, vide ou inconnu → DEFAULT_LOCALE
 */
export function resolveLocale(raw: string | null | undefined): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE;
  const first = raw.split(",")[0]?.trim() ?? "";
  const base = first.split(";")[0]?.split("-")[0]?.split("_")[0]?.toLowerCase() ?? "";
  return isSupportedLocale(base) ? base : DEFAULT_LOCALE;
}

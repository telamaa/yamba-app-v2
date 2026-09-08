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

/**
 * Les sources possibles d'une langue, pour UNE réponse servie à UN lecteur.
 * Toutes optionnelles : un appel public n'en a qu'une, un membre connecté peut en avoir quatre.
 */
export type LocaleSources = {
  /** Paramètre `?locale=` explicite : une surcharge délibérée, pour cet appel seulement. */
  query?: string | null;
  /** `User.preferredLocale` du membre connecté — la langue du COMPTE (D44). */
  preferred?: string | null;
  /** En-tête `x-locale` : la langue de l'APPAREIL qui appelle. */
  header?: string | null;
  /** `Accept-Language` du navigateur, dernier recours avant le défaut. */
  acceptLanguage?: string | null;
};

/**
 * La langue d'une réponse servie à un lecteur — UNE règle, pour tous les services (dette D-1).
 *
 * L'ordre est celui de la décision D44, complété du cas « surcharge explicite » :
 *
 * 1. **`?locale=`** — l'appelant a demandé cette langue-là, pour cet appel. C'est ce qui rend un
 *    lien partageable et une réponse d'API reproductible ; une préférence stockée ne doit pas
 *    changer le résultat d'une URL qu'on s'est envoyée.
 * 2. **`preferredLocale`** — « une locale par UTILISATEUR, pas par appareil » (D44). Un membre qui
 *    a choisi l'anglais lit l'anglais, même depuis un téléphone en français. Le front garde cette
 *    valeur à jour : basculer la langue déclenche `PATCH /auth/me/locale`.
 * 3. **`x-locale`** — la langue de l'appareil, pour un visiteur sans compte.
 * 4. **`Accept-Language`**, puis le défaut.
 *
 * Pourquoi une seule fonction : avant, trois endpoints résolvaient la langue de trois façons —
 * l'un ignorait le membre, l'autre l'en-tête, le troisième répondait toujours en français si le
 * paramètre manquait. Aucun n'était faux isolément ; ensemble, ils n'étaient pas la même règle.
 */
export function resolveViewerLocale(sources: LocaleSources): SupportedLocale {
  for (const brut of [sources.query, sources.preferred, sources.header, sources.acceptLanguage]) {
    if (!brut) continue;
    const first = brut.split(",")[0]?.trim() ?? "";
    const base = first.split(";")[0]?.split("-")[0]?.split("_")[0]?.toLowerCase() ?? "";
    if (isSupportedLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

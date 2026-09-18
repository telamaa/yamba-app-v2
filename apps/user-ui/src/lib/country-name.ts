/**
 * Nom de pays localisé, dérivé du code ISO 3166-1 alpha-2.
 *
 * Pourquoi partir du CODE et pas du texte `country` stocké sur le trajet :
 *  - le texte est FIGÉ dans la locale du créateur (un trajet publié en FR
 *    montrerait « Belgique » à un visiteur EN) ;
 *  - le jeu d'essai (seed-deals) ne remplit QUE le code — le texte est absent.
 * Le code est donc la source de vérité ; `Intl.DisplayNames` le traduit pour
 * CHAQUE visiteur, sans aucune donnée à réparer ni dictionnaire à maintenir.
 *
 * Fallbacks, dans l'ordre : nom localisé → texte stocké (`fallback`) → code brut.
 */

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function displayNamesFor(locale: string): Intl.DisplayNames | null {
  const cached = displayNamesCache.get(locale);
  if (cached) return cached;
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    displayNamesCache.set(locale, dn);
    return dn;
  } catch {
    // Locale inconnue du runtime — on retombera sur le texte stocké
    return null;
  }
}

export function countryName(
  code: string | null | undefined,
  locale: string,
  fallback?: string | null
): string | null {
  if (code) {
    const upper = code.toUpperCase();
    try {
      const name = displayNamesFor(locale)?.of(upper);
      // `.of()` renvoie le code tel quel quand la région lui est inconnue :
      // dans ce cas le texte stocké (s'il existe) est plus parlant.
      if (name && name !== upper) return name;
      return fallback ?? name ?? null;
    } catch {
      // Code malformé (RangeError) → texte stocké
      return fallback ?? null;
    }
  }
  return fallback ?? null;
}

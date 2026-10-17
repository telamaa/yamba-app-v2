/**
 * Nom de pays localisé, dérivé du code ISO 3166-1 alpha-2 (miroir du web,
 * `apps/user-ui/src/lib/country-name.ts`).
 *
 * Pourquoi partir du CODE : c'est la seule donnée que le DTO de recherche
 * transporte (le jeu d'essai ne remplit que lui), et `Intl.DisplayNames`
 * le traduit pour CHAQUE visiteur — aucun dictionnaire à maintenir. Sur
 * Hermes, l'API vient du polyfill @formatjs (`i18n/intl-polyfills.ts`).
 *
 * Fallbacks, dans l'ordre : nom localisé → null (jamais le code brut à
 * l'écran — « CG » n'aide personne, l'absence est plus honnête).
 */

const displayNamesCache = new Map<string, Intl.DisplayNames>();

function displayNamesFor(locale: string): Intl.DisplayNames | null {
  const cached = displayNamesCache.get(locale);
  if (cached) return cached;
  try {
    const dn = new Intl.DisplayNames([locale], { type: 'region' });
    displayNamesCache.set(locale, dn);
    return dn;
  } catch {
    // Locale inconnue du runtime — pas de nom, pas de code brut
    return null;
  }
}

export function countryName(code: string | null | undefined, locale: string): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  try {
    const name = displayNamesFor(locale)?.of(upper);
    // `.of()` renvoie le code tel quel quand la région lui est inconnue
    return name && name !== upper ? name : null;
  } catch {
    // Code malformé (RangeError)
    return null;
  }
}

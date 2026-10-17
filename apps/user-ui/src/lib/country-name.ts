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

/**
 * Drapeau emoji dérivé du code ISO 3166-1 alpha-2 (« FR » → 🇫🇷).
 *
 * Les deux lettres sont décalées dans le bloc REGIONAL INDICATOR SYMBOL
 * (U+1F1E6 = « A ») : la police du système assemble la paire en drapeau, il n'y
 * a donc AUCUNE image à charger ni dictionnaire à maintenir. Même raison qu'au
 * `countryName` ci-dessus de partir du code : le texte `country` du trajet est
 * figé dans la locale du créateur et absent du jeu d'essai.
 *
 * Miroir assumé de `flagEmoji` dans `apps/mobile/src/components/trip-result-card.tsx`
 * (porte de sortie : un paquet partagé au troisième front, comme pour
 * `trip-format` et `pricing-example`).
 *
 * Rend `null` sur tout code absent ou malformé — un drapeau est décoratif, il ne
 * doit jamais casser une ligne de texte.
 */
export function countryFlag(code: string | null | undefined): string | null {
  if (!code) return null;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

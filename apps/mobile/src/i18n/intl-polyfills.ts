/**
 * intl-polyfills.ts — `Intl.PluralRules` + `Intl.DisplayNames` pour Hermes
 * ========================================================================
 * (lot résultats). Hermes n'embarque ni `Intl.PluralRules` (toute clé ICU
 * `{count, plural, …}` levait `FORMATTING_ERROR` et use-intl rendait la clé
 * BRUTE à l'écran — « search.results », capture du 28/09), ni
 * `Intl.DisplayNames` (le nom de pays localisé des cartes de résultat,
 * dérivé du code ISO comme sur le web — `lib/country-name.ts`). Les
 * polyfills @formatjs comblent les trous — variantes `polyfill` (détection) :
 * si un futur Hermes apporte l'API, elles s'effacent d'elles-mêmes. L'ordre
 * des premiers imports est une dépendance (getcanonicallocales ← Locale ←
 * PluralRules/DisplayNames), pas un style.
 * Une langue de plus dans SUPPORTED_LOCALES (locale.ts) = SES lignes
 * `locale-data` ICI (une par API) — sans elles, cette langue retombe en panne.
 * L'extension `.js` est OBLIGATOIRE : l'exports map de @formatjs n'expose que
 * les chemins avec extension, et `moduleResolution: bundler` (tsconfig Expo)
 * l'honore strictement — sans elle, TS2882.
 */
import '@formatjs/intl-getcanonicallocales/polyfill.js';
import '@formatjs/intl-locale/polyfill.js';
import '@formatjs/intl-pluralrules/polyfill.js';
import '@formatjs/intl-pluralrules/locale-data/fr.js';
import '@formatjs/intl-pluralrules/locale-data/en.js';
import '@formatjs/intl-displaynames/polyfill.js';
import '@formatjs/intl-displaynames/locale-data/fr.js';
import '@formatjs/intl-displaynames/locale-data/en.js';

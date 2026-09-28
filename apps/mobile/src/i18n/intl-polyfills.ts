/**
 * intl-polyfills.ts — `Intl.PluralRules` pour Hermes (lot résultats).
 * ===================================================================
 * Hermes n'embarque pas `Intl.PluralRules` : toute clé ICU `{count, plural, …}`
 * levait `FORMATTING_ERROR` et use-intl rendait la clé BRUTE à l'écran
 * (« search.results », capture du 28/09). Les polyfills @formatjs comblent le
 * trou — variantes `polyfill` (détection) : si un futur Hermes apporte l'API,
 * elles s'effacent d'elles-mêmes. L'ordre des trois premiers imports est une
 * dépendance (getcanonicallocales ← Locale ← PluralRules), pas un style.
 * Une langue de plus dans SUPPORTED_LOCALES (locale.ts) = sa ligne
 * `locale-data` ICI — sans elle, le pluriel de cette langue retombe en panne.
 */
import '@formatjs/intl-getcanonicallocales/polyfill';
import '@formatjs/intl-locale/polyfill';
import '@formatjs/intl-pluralrules/polyfill';
import '@formatjs/intl-pluralrules/locale-data/fr';
import '@formatjs/intl-pluralrules/locale-data/en';

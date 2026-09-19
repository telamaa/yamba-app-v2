/**
 * locale-state.ts — la langue courante, lisible HORS React (client API).
 * ======================================================================
 * La liste des langues vit UNIQUEMENT dans `@packages/api-contracts/locale`
 * (D44) : ici on ne fait que la résoudre depuis l'appareil, et mémoriser la
 * langue que le provider affiche réellement (préférence du compte comprise)
 * pour que l'en-tête `x-locale` dise la même chose que l'écran.
 */
import { getLocales } from 'expo-localization';

import { resolveLocale, type SupportedLocale } from '@packages/api-contracts/locale';

let uiLocale: SupportedLocale | null = null;

/** La langue de l'appareil, normalisée vers une locale supportée. */
export function deviceLocale(): SupportedLocale {
  return resolveLocale(getLocales()[0]?.languageTag);
}

/** La langue de l'interface — celle que chaque requête envoie en `x-locale`. */
export function currentLocale(): SupportedLocale {
  return uiLocale ?? deviceLocale();
}

/** Posée par le provider i18n à chaque changement effectif de langue. */
export function setCurrentLocale(locale: SupportedLocale): void {
  uiLocale = locale;
}

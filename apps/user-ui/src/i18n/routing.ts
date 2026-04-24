import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  // Toutes les locales supportées
  locales: ["fr", "en"],

  // Locale par défaut (si le navigateur n'a pas de préférence claire)
  defaultLocale: "fr",

  // "as-needed" = pas de préfixe sur la locale par défaut (ex: /dashboard → FR)
  // "always" = préfixe toujours présent (/fr/dashboard, /en/dashboard) ← recommandé
  // "never" = jamais de préfixe (mode classique sans URL)
  localePrefix: "always",

  // Détection automatique de la langue du navigateur
  // Si l'utilisateur n'a jamais choisi, on utilise Accept-Language
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

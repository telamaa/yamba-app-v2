import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Chargement des messages côté serveur pour chaque requête.
 * On charge TOUS les domaines en un seul objet et on les expose
 * sous leur nom pour pouvoir faire useTranslations('search'), etc.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale est une Promise qui résout la locale détectée via URL
  let locale = await requestLocale;

  // Fallback si la locale n'est pas supportée
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }

  // Charger tous les fichiers de messages en parallèle
  const [common, home, auth, dashboard, trips, carrier, search] =
    await Promise.all([
      import(`../../messages/${locale}/common.json`),
      import(`../../messages/${locale}/home.json`),
      import(`../../messages/${locale}/auth.json`),
      import(`../../messages/${locale}/dashboard.json`),
      import(`../../messages/${locale}/trips.json`),
      import(`../../messages/${locale}/carrier.json`),
      import(`../../messages/${locale}/search.json`),
    ]);

  return {
    locale,
    messages: {
      common: common.default,
      home: home.default,
      auth: auth.default,
      dashboard: dashboard.default,
      trips: trips.default,
      carrier: carrier.default,
      search: search.default,
    },
  };
});

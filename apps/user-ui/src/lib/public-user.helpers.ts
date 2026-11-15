import type { PublicTopRoute, PublicUser } from "./public-user.types";

/**
 * Formate une date ISO en "Mois AAAA" pour le memberSince.
 * Ex: "2026-03-28T..." → "mars 2026" (FR) / "March 2026" (EN)
 */
export function formatMemberSince(isoDate: string, locale: "fr" | "en"): string {
  const date = new Date(isoDate);

  // A224 lot 4 — une date illisible rendait « undefined NaN » : `getMonth()`
  // vaut NaN, et `months[locale][NaN]` vaut `undefined`. Sur la page de
  // profil PUBLIC, c'est-à-dire la plus visible du produit.
  // L'homonyme du fichier voisin (`public-trip.helpers.ts`) portait déjà la
  // garde — elle n'avait pas voyagé de trois lignes.
  if (Number.isNaN(date.getTime())) return "";

  const months = {
    fr: [
      "janvier", "février", "mars", "avril", "mai", "juin",
      "juillet", "août", "septembre", "octobre", "novembre", "décembre",
    ],
    en: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
  };

  return `${months[locale][date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Formate une date ISO d'avis ou trip en format relatif court.
 * Ex: "il y a 2 jours" / "2 days ago"
 *
 * Pour MVP : on utilise une logique simple. Plus tard, on pourra
 * passer sur date-fns ou Intl.RelativeTimeFormat.
 */
export function formatRelativeDate(
  isoDate: string,
  locale: "fr" | "en"
): string {
  const date = new Date(isoDate);
  // A224 lot 4 — même garde, même raison : sans elle, `diffMs` vaut NaN,
  // TOUTE comparaison avec NaN est fausse, et le flot tombe dans le dernier
  // cas de la cascade sans qu'aucune condition ne l'ait choisi — « il y a NaN
  // mois ». C'est exactement le défaut de `formatExpiresIn`, trouvé ce matin
  // dans `saved-route.helpers.ts`.
  if (Number.isNaN(date.getTime())) return "";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (locale === "fr") {
    if (diffDays < 1) return "aujourd'hui";
    if (diffDays === 1) return "hier";
    if (diffDays < 7) return `il y a ${diffDays} jours`;
    if (diffWeeks < 4) {
      return diffWeeks === 1 ? "il y a 1 semaine" : `il y a ${diffWeeks} semaines`;
    }
    return diffMonths === 1 ? "il y a 1 mois" : `il y a ${diffMonths} mois`;
  }

  if (diffDays < 1) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffWeeks < 4) {
    return diffWeeks === 1 ? "1 week ago" : `${diffWeeks} weeks ago`;
  }
  return diffMonths === 1 ? "1 month ago" : `${diffMonths} months ago`;
}

/**
 * Récupère les initiales d'un user pour un avatar fallback.
 * Ex: "Enrique", "T" → "ET"
 */
/**
 * A224 lot 4 — TROISIÈME copie du même défaut, et elle servait la page de
 * profil PUBLIC (`UserHero`, `TripperBlock`, `ShipperBlock`).
 *
 * `lastInitial.toUpperCase()` prenait la chaîne ENTIÈRE : « Marven MABIALA »
 * rendait « MMABIALA », le défaut que D88 a corrigé sur le téléphone le
 * 08/11 et que le lot 3 a corrigé sur `public-trip.helpers.ts` ce matin.
 * Il y avait deux jumeaux, pas un.
 *
 * Il n'y a désormais qu'UNE implémentation par front, et une fiche compte
 * les copies plutôt que de faire confiance à la mémoire.
 */
export { getInitials } from "./public-trip.helpers";

/**
 * Calcule la note globale pondérée par nombre de votes.
 * Combine tripper rating + shipper rating.
 *
 * Retourne null si l'user n'a aucune note dans aucun des 2 rôles.
 */
export function calculateGlobalRating(user: PublicUser): {
  average: number;
  count: number;
} | null {
  const tripper = user.tripperRating;
  const shipper = user.shipperRating;

  // A224 lot 4 — les deux rôles sont traités PAREIL. `tripperRating` était
  // lu avec précaution (`tripper?.count ?? 0`) et `shipperRating` sans :
  // un profil servi sans ce champ faisait TOMBER la page publique. Une
  // asymétrie de ce genre ne se voit pas — elle attend une donnée
  // incomplète, et l'API peut en servir une le jour d'une migration.
  const tripperCount = tripper?.count ?? 0;
  const shipperCount = shipper?.count ?? 0;
  const totalCount = tripperCount + shipperCount;

  if (totalCount === 0) return null;

  const tripperWeighted = (tripper?.average ?? 0) * tripperCount;
  const shipperWeighted = (shipper?.average ?? 0) * shipperCount;

  return {
    average: (tripperWeighted + shipperWeighted) / totalCount,
    count: totalCount,
  };
}

/**
 * Format un prix en euros depuis cents.
 * Ex: 2500, "EUR", "fr" → "25 €"
 *     2500, "EUR", "en" → "€25"
 */
export function formatPriceShort(
  cents: number,
  currencyCode: string,
  locale: "fr" | "en"
): string {
  const amount = Math.floor(cents / 100);
  const symbol = currencyCode === "EUR" ? "€" : currencyCode;
  return locale === "fr" ? `${amount} ${symbol}` : `${symbol}${amount}`;
}

/**
 * Format un label court de date pour les trips disponibles.
 * Ex: "2026-05-28T..." → "jeu. 28 mai" (FR) / "Thu, May 28" (EN)
 */
export function formatShortTripDate(
  isoDate: string,
  locale: "fr" | "en"
): string {
  const date = new Date(isoDate);

  const days = {
    fr: ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  };

  const months = {
    fr: ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  };

  const dayLabel = days[locale][date.getDay()];
  const monthLabel = months[locale][date.getMonth()];
  const dayNum = date.getDate();

  return locale === "fr"
    ? `${dayLabel} ${dayNum} ${monthLabel}`
    : `${dayLabel}, ${monthLabel} ${dayNum}`;
}

/**
 * Génère un label court pour une route :
 * Ex: { Paris, Brazzaville, 12 } → "Paris → Brazzaville · 12"
 */
export function formatRouteLabel(route: PublicTopRoute): string {
  return `${route.originCity} → ${route.destinationCity} · ${route.count}`;
}

/**
 * Retourne la route HREF vers la page détail d'un trip.
 */
export function getTripDetailHref(tripId: string): string {
  return `/trips/${tripId}`;
}

/**
 * Retourne la route HREF vers la page profil d'un user.
 */
export function getUserProfileHref(slug: string): string {
  return `/u/${slug}`;
}

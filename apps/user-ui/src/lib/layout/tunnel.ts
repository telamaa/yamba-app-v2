/**
 * tunnel.ts — « un tunnel n'offre pas la sortie » (D93)
 * =====================================================
 * Quelles pages du site sont un ENTONNOIR, et ce qu'il reste de la
 * navigation haute quand on y est.
 *
 * Le site avait déjà la règle, écrite une fois, en dur, dans le composant qui
 * s'en servait : une expression régulière à la ligne 40 de `Header.tsx`,
 * posée le 17/10 pour le seul tunnel de paiement. Elle était juste, et
 * invisible — aucune fiche ne la lisait, et rien ne disait aux cinq autres
 * entonnoirs du produit qu'elle existait. Les six pages d'auth ont donc gardé
 * « Partager un trajet » et « Connexion » au milieu d'une inscription,
 * jusqu'à D93.
 *
 * Deux décisions de gabarit sont gravées ici :
 *
 * 1. LE MODE EST UNE DONNÉE DE LA ROUTE, PAS UN ÉTAT DU COMPOSANT. D'où une
 *    fonction PURE : elle prend un chemin, elle rend un mode, elle n'a aucun
 *    import. C'est la seule forme qu'une fiche peut exécuter sans monter
 *    React, et la seule qui se lise sans ouvrir le `Header`.
 *
 * 2. LE MODE NE DÉMONTE RIEN. L'en-tête reste monté et se RÉDUIT, parce que
 *    `app/[locale]/layout.tsx` réserve sa hauteur en dur (`pt-[78px]`) : un
 *    en-tête retiré laisserait un trou de 78 px. C'est aussi pour cela que la
 *    règle ne vit pas dans un `(auth)/layout.tsx` — ce layout est SOUS le
 *    `Header` dans l'arbre React, il ne peut ni le démonter ni l'informer.
 *
 * Ce que « réduire » veut dire, par mode, est l'affaire du `Header` ; ici on
 * ne dit que l'essentiel : le logo reste un lien vers l'accueil dans TOUS les
 * modes. Un entonnoir dont on ne peut pas sortir est un motif hostile, et le
 * navigateur garde de toute façon son bouton Retour — prétendre la porte
 * fermée serait un mensonge d'interface. La ligne que trace D93 n'est donc
 * pas « aucune sortie » mais : UNE sortie, neutre, jamais un appel à l'action
 * concurrent À L'INTÉRIEUR de l'entonnoir.
 *
 * `pathname` est SANS préfixe de locale (le `usePathname` de
 * `@/i18n/navigation`), comme dans `lib/auth/login-redirect.ts`.
 */

/** Les trois régimes de navigation haute du site. */
export type TunnelMode =
  /** Page ordinaire : la navigation complète. */
  | "none"
  /** Les six pages d'auth : logo + langue + thème. */
  | "auth"
  /** Le tunnel de réservation : logo + mention de paiement. */
  | "checkout";

/**
 * Les préfixes des pages d'authentification — le groupe de routes
 * `app/[locale]/(auth)/` en toutes lettres : `/login`, `/register`,
 * `/register/verify`, `/password/forgot`, `/password/verify`,
 * `/password/reset`, et `/refresh` (la porte technique qui rejoue un jeton).
 *
 * Cette liste est la SEULE du dépôt : `login-redirect.ts` la lisait en double
 * sous le nom `NO_REDIRECT_PREFIXES`, et les deux copies avaient déjà
 * divergé — `/refresh` manquait à l'une. Deux listes qui disent la même chose
 * finissent toujours par ne plus la dire : c'est le motif que D92 a trouvé
 * sur `maskEmail` et D96 sur la lecture des refus.
 */
export const AUTH_TUNNEL_PREFIXES = [
  "/login",
  "/register",
  "/password",
  "/refresh",
] as const;

/**
 * Le tunnel de réservation : l'étape de paiement d'un trajet, et elle seule.
 * La page publique du trajet (`/trips/:id`) n'en fait pas partie — on y
 * compare encore, on n'y est pas engagé.
 */
const CHECKOUT_TUNNEL_PATH = /^\/trips\/[^/]+\/book\/?$/;

/** Un chemin est-il sous ce préfixe, lui-même ou un de ses enfants ? */
const sousPrefixe = (pathname: string, prefixe: string): boolean =>
  pathname === prefixe || pathname.startsWith(prefixe + "/");

/** Une des six pages d'authentification ? */
export function isAuthTunnel(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AUTH_TUNNEL_PREFIXES.some((prefixe) => sousPrefixe(pathname, prefixe));
}

/** L'étape de paiement d'une réservation ? */
export function isCheckoutTunnel(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return CHECKOUT_TUNNEL_PATH.test(pathname);
}

/**
 * Le régime de navigation haute d'un chemin.
 *
 * `checkout` passe AVANT `auth` : les deux ensembles sont disjoints
 * aujourd'hui, et l'ordre est explicite pour que le jour où une étape de
 * paiement vivrait sous un préfixe d'auth, la règle ait déjà tranché.
 */
export function tunnelModeFor(pathname: string | null | undefined): TunnelMode {
  if (isCheckoutTunnel(pathname)) return "checkout";
  if (isAuthTunnel(pathname)) return "auth";
  return "none";
}

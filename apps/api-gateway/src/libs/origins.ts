/**
 * origins.ts — les origines autorisées à appeler le gateway (CORS)
 * ================================================================
 * 3000 = user-ui · 3001 = admin-ui (chantier C, D54), sur localhost, un Wi-Fi domestique (192.168.x.x) ou un
 * réseau d'entreprise (10.x.x.x). Même en proxy D48 (Next → gateway), l'en-tête Origin du navigateur est transmis.
 *
 * Recette 01-WEB, chapitre 7 (WEB-NRG-11) : une origine refusée levait une `Error` dans le callback de `cors`,
 * que le gestionnaire par défaut d'Express rendait en **500** — une panne apparente, comptée comme une erreur
 * serveur (alerte des 5xx) pour ce qui n'est qu'un REFUS. Le refus est désormais un 403 explicite avec un code.
 * Il reste un refus FRANC (la requête n'atteint jamais les services) : se contenter de ne pas poser l'en-tête
 * `Access-Control-Allow-Origin` laisserait un formulaire d'un site tiers exécuter un POST côté serveur.
 */
const ORIGINES_AUTORISEES: RegExp[] = [
  /^http:\/\/localhost:300[01]$/,
  /^http:\/\/192\.168\.\d+\.\d+:300[01]$/, // Wi-Fi domestique
  /^http:\/\/10\.\d+\.\d+\.\d+:300[01]$/, // Réseau d'entreprise
];

/** Une requête SANS en-tête Origin (curl, appel serveur à serveur, navigation directe) n'est pas une requête CORS. */
export function origineAutorisee(origin: string | undefined): boolean {
  if (!origin) return true;
  return ORIGINES_AUTORISEES.some((re) => re.test(origin));
}

/** Le corps du refus, au format d'erreur commun : `details.code` atteint le client (A146). */
export const REFUS_ORIGINE = {
  status: "error",
  message: "Origin not allowed",
  details: { code: "ORIGIN_NOT_ALLOWED" },
} as const;

/**
 * Mapping currency code (ISO 4217) → symbole d'affichage.
 * Utilisé pour exposer côté UI un caractère court ("€") plutôt que le code.
 *
 * Ajoute des devises ici quand tu ouvres de nouveaux corridors.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CAD: "C$",
  CHF: "CHF",
  XAF: "FCFA",  // Cameroun, Congo-Brazzaville, Gabon, etc.
  XOF: "FCFA",  // Sénégal, Côte d'Ivoire, etc.
  MAD: "DH",    // Maroc
  TND: "DT",    // Tunisie
  CDF: "FC",    // RD Congo
};

/**
 * Retourne le symbole pour un code devise donné.
 * Fallback : retourne le code lui-même si non mappé (sécurité).
 */
export function symbolFor(code: string | null | undefined): string {
  if (!code) return "€";
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

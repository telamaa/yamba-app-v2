/**
 * pricing-example.ts — « ex. colis 2 kg ≈ 27 € » sous un prix au kilo.
 * ====================================================================
 * Projection INDICATIVE côté front pour ancrer l'Expéditeur (D15 : l'ancre
 * convertit). Le prix réel est calculé et figé côté serveur (snapshot D17).
 *
 *   transport = max(poids, PLANCHER_KG) × €/kg                      (D81)
 *   service   = max(12 % du transport, 3 €)                         (D16)
 *   total     = transport + service
 *
 * D81 — le plancher est en KILOS, plus en euros. Conséquence pour l'affichage :
 * il n'existe PLUS de « prix minimum » universel à annoncer, puisqu'il dépend
 * du tarif du Voyageur. Les libellés « colis léger » parlent donc du PLANCHER
 * EN KILOS, qui lui est vrai sur tous les corridors.
 *
 * Cette projection ne connaît que le POIDS, jamais la taille : elle rend donc
 * le prix d'un colis S — le plus bas possible. Elle ne promet jamais moins cher
 * que le devis du tunnel, elle peut seulement être dépassée en M ou L.
 *
 * Tout en CENTS entiers (règle non négociable) — la conversion en euros
 * n'a lieu qu'à l'affichage.
 */

export const PRICING_EXAMPLE_PARAMS = {
  /** poids du colis d'exemple affiché */
  exampleWeightKg: 2,
  /** D81 — plancher de facturation, en kilos */
  billingFloorKg: 2.3,
  /** D16 — commission Expéditeur */
  commissionPct: 12,
  /** D16 — plancher de commission, cents */
  commissionFloorCents: 300,
} as const;

export function estimateShipperTotalCents(
  pricePerKgCents: number,
  weightKg: number = PRICING_EXAMPLE_PARAMS.exampleWeightKg,
  p = PRICING_EXAMPLE_PARAMS
): { transportCents: number; serviceCents: number; totalCents: number } {
  const billableKg = Math.max(weightKg, p.billingFloorKg);
  const transportCents = Math.round(pricePerKgCents * billableKg);
  const serviceCents = Math.max(Math.round((transportCents * p.commissionPct) / 100), p.commissionFloorCents);
  return { transportCents, serviceCents, totalCents: transportCents + serviceCents };
}

/** D81 — le plancher, en kilos : la seule formulation vraie sur tous les corridors. */
export const BILLING_FLOOR_KG = PRICING_EXAMPLE_PARAMS.billingFloorKg;

/**
 * D99 1A — LA MISE EN FORME D'UN PRIX EST UNE RÈGLE, PAS UN DÉTAIL D'ÉCRAN.
 *
 * Les deux applications affichaient le même total de deux façons : le site
 * arrondissait à l'euro (`maximumFractionDigits: 0` → « ≈ 25 € »), le
 * téléphone donnait deux décimales (« ≈ 24,85 € »). Même trajet, même colis,
 * deux prix. Le CALCUL était pourtant le même — c'est la mise en forme qui
 * avait divergé, et c'est l'endroit où une divergence coûte le plus cher.
 *
 * La règle, tranchée le 13/11/2026 : **toujours deux décimales**. Le « ≈ »
 * dit déjà que c'est une estimation ; arrondir ajoute une seconde
 * approximation par-dessus, et ce chiffre sera comparé au prix DÉFINITIF à la
 * réservation — un total qui change entre la liste et le paiement coûte plus
 * cher en confiance que deux décimales en lisibilité.
 *
 * Le séparateur décimal suit la langue (`toLocaleString`), pas le pays du
 * prix : « 24,85 » en français, « 24.85 » en anglais.
 */
export const PRICE_FRACTION_DIGITS = 2;

export function formatAmountFromCents(cents: number, localeTag: string): string {
  return (cents / 100).toLocaleString(localeTag, {
    minimumFractionDigits: PRICE_FRACTION_DIGITS,
    maximumFractionDigits: PRICE_FRACTION_DIGITS,
  });
}

/**
 * D123 — LE SYMBOLE FAIT PARTIE DU NOMBRE, ET IL N'A PAS LA MÊME PLACE DANS
 * LES DEUX LANGUES.
 *
 * `formatAmountFromCents` ci-dessus ne rend que le NOMBRE. Les écrans
 * collaient le symbole derrière lui — « 24,85 € » — ce qui est juste en
 * français et faux en anglais, où l'on écrit « €24.85 ». Mesuré le 28/11/2026
 * sur une capture de l'application en anglais : « You earn 23.00 € ».
 *
 * `Intl` place le symbole, choisit l'espace (une insécable FINE en français,
 * U+202F — attention aux comparaisons de chaînes) et sait rendre n'importe
 * quelle devise. On lui passe donc un CODE ISO 4217, jamais un caractère : le
 * dépôt avait deux tables devise→symbole à une seule entrée, et un endroit où
 * `trip.currency` (un code) servait directement de symbole.
 *
 * Deux décimales toujours, par la même règle que `PRICE_FRACTION_DIGITS` :
 * « 3,00 € » et « 24,85 € » s'alignent dans une colonne, « 3 € » et
 * « 24,85 € » se lisent comme deux natures de chiffre.
 */
export const DEFAULT_CURRENCY = 'EUR';

export function formatMoneyFromCents(
  cents: number,
  localeTag: string,
  currency: string = DEFAULT_CURRENCY
): string {
  const amount = cents / 100;
  try {
    return amount.toLocaleString(localeTag, {
      style: 'currency',
      currency,
      minimumFractionDigits: PRICE_FRACTION_DIGITS,
      maximumFractionDigits: PRICE_FRACTION_DIGITS,
    });
  } catch {
    // Hermes sans données Intl, ou un code devise refusé : un chiffre lisible,
    // jamais un écran qui tombe. Le repli de `trip-result-card` disait déjà
    // cela — il vit ici maintenant, pour les deux fronts.
    return `${amount.toFixed(PRICE_FRACTION_DIGITS)} ${currency}`;
  }
}

/** Le même montant donné en EUROS plutôt qu'en centimes (les DTO font les deux). */
export function formatMoney(amount: number, localeTag: string, currency: string = DEFAULT_CURRENCY): string {
  return formatMoneyFromCents(Math.round(amount * 100), localeTag, currency);
}

/**
 * Un tarif au kilo : « 11,50 €/kg » en français, « €11.50/kg » en anglais.
 * Le « /kg » ne se traduit pas — le kilogramme est une unité SI.
 */
export function formatPerKg(amountPerKg: number, localeTag: string, currency: string = DEFAULT_CURRENCY): string {
  return `${formatMoney(amountPerKg, localeTag, currency)}/kg`;
}

/**
 * Une GRADUATION, pas un montant : les crans d'une échelle et les pastilles de
 * valeurs usuelles (« 8 € », « 10 € », « 11,50 € »).
 *
 * Deux décimales valent pour ce que l'on paie, gagne ou additionne — on les
 * veut alignées dans une colonne. Une rangée de repères se lit d'un coup
 * d'œil : « 8,00 € » y ajoute deux caractères qui ne portent aucune
 * information, et quatre pastilles débordaient déjà sur deux lignes. Le
 * symbole, lui, reste placé par `Intl` : c'est tout l'objet de D123.
 */
export function formatMoneyCompact(amount: number, localeTag: string, currency: string = DEFAULT_CURRENCY): string {
  try {
    return amount.toLocaleString(localeTag, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: PRICE_FRACTION_DIGITS,
    });
  } catch {
    return `${amount} ${currency}`;
  }
}

/**
 * Le poids que le prix FACTURE, à partir du poids du colis (D100 2A).
 * ===================================================================
 * Sous le plancher de facturation (D81), le montant ne bouge plus : une
 * enveloppe de 200 g, un colis de 1,5 kg et un colis de 2,3 kg coûtent le même
 * prix. La carte de résultat nommait pourtant le poids CHOISI à côté de ce
 * montant — « pour ton colis de 1,5 kg » sous un prix qui est celui de 2,3 kg.
 * Mesuré le 14/11/2026 sur les deux fronts : le site à 1,5 kg et le téléphone
 * à 2 kg affichaient le même 24,85 €, et le curseur semblait donc inerte.
 *
 * D99 bis avait tranché que la carte ne doit NI répéter NI contredire le
 * plancher : elle le contredisait. La mention nomme désormais le poids
 * facturé ; l'explication du plancher, elle, reste dans le panneau où l'on
 * règle son colis — c'est là qu'elle répond à une question.
 */
export function billedKg(kg: number): number {
  return Math.max(kg, BILLING_FLOOR_KG);
}

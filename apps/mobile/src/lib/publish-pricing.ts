/**
 * publish-pricing.ts — l'offre du Voyageur : bornes, crans, valeurs d'usage.
 * ===========================================================================
 * Zéro import, comme `publish-trip.ts` : le harnais doit pouvoir lire ces
 * règles sans traverser Metro.
 *
 * Les NOMBRES sont ceux du site (`create-trip.config.ts` : `PRICE_PER_KG_RANGE`,
 * `CAPACITY_KG_RANGE`, `CHECKED_BAG_KG`, `CABIN_BAG_KG`) et une fiche les
 * confronte à ce fichier-là, lu à l'exécution. Pas une copie à l'octet près
 * cette fois — le fichier du site importe son moteur de corridors, il n'est
 * pas duplicable —, mais la même exigence : deux fronts ne peuvent pas
 * s'accorder sur des nombres qu'aucun des deux ne nomme (D101).
 *
 * Le GESTE, lui, diffère et c'est voulu (doctrine A207 / D101 2A) : le site
 * fait GLISSER deux curseurs — geste de souris, précis au pixel. Sur un
 * téléphone, 31 crans de prix étalés sur une piste d'un écran font ~12 px
 * par cran, et surtout le Voyageur VISE un tarif qu'il a en tête (« 10 € le
 * kilo ») plutôt qu'il n'explore un continuum. D'où un pas-à-pas de 44 pt
 * et des valeurs d'usage — mêmes nombres, mode de parcours natif.
 */

/* ── Le prix au kilo ───────────────────────────────────────────────────── */

export const PRIX_MIN_PAR_KG = 5;
export const PRIX_MAX_PAR_KG = 20;
export const PRIX_PAS_PAR_KG = 0.5;

/** Les tarifs les plus souvent affichés — des repères, pas une contrainte. */
export const PRIX_USUELS_PAR_KG = [8, 10, 12, 15] as const;

/* ── La capacité ───────────────────────────────────────────────────────── */

export const CAPACITE_MIN_KG = 2;
export const CAPACITE_MAX_KG = 30;
export const CAPACITE_PAS_KG = 1;

/**
 * Les capacités d'usage. 23 et 12 sont les deux franchises de bagage : les
 * proposer, c'est rendre possible le forfait « bagage entier » sans avoir à
 * expliquer pourquoi il reste grisé (RG-B-29).
 */
export const CAPACITES_USUELLES_KG = [5, 10, 12, 23] as const;

/* ── Le supplément par famille (D14) ───────────────────────────────────── */

export const SURCHARGE_MIN_PCT = 5;
export const SURCHARGE_MAX_PCT = 50;
export const SURCHARGE_PAS_PCT = 5;

export function rameneSurcharge(pct: number): number {
  const borne = Math.min(Math.max(pct, SURCHARGE_MIN_PCT), SURCHARGE_MAX_PCT);
  return Math.round(borne / SURCHARGE_PAS_PCT) * SURCHARGE_PAS_PCT;
}

export function cranSurcharge(pct: number, sens: 1 | -1): number {
  return rameneSurcharge(pct + sens * SURCHARGE_PAS_PCT);
}

export function peutCranerSurcharge(pct: number, sens: 1 | -1): boolean {
  return cranSurcharge(pct, sens) !== rameneSurcharge(pct);
}

/* ── Les forfaits « bagage entier » (PRC-04) ───────────────────────────── */

export const FRANCHISE_SOUTE_KG = 23;
export const FRANCHISE_CABINE_KG = 12;

/* ── Arithmétique de curseur, en pas-à-pas ─────────────────────────────── */

function ramene(valeur: number, min: number, max: number, pas: number): number {
  const borne = Math.min(Math.max(valeur, min), max);
  const crans = Math.round((borne - min) / pas) * pas + min;
  // Le produit flottant rouvre des 10.500000000000002 : on referme à la
  // précision du pas, qui n'a qu'une décimale.
  return Math.round(crans * 10) / 10;
}

export function ramenePrix(prix: number): number {
  return ramene(prix, PRIX_MIN_PAR_KG, PRIX_MAX_PAR_KG, PRIX_PAS_PAR_KG);
}

export function rameneCapacite(kg: number): number {
  return ramene(kg, CAPACITE_MIN_KG, CAPACITE_MAX_KG, CAPACITE_PAS_KG);
}

export function cranPrix(prix: number, sens: 1 | -1): number {
  return ramenePrix(prix + sens * PRIX_PAS_PAR_KG);
}

export function cranCapacite(kg: number, sens: 1 | -1): number {
  return rameneCapacite(kg + sens * CAPACITE_PAS_KG);
}

/** Peut-on encore avancer dans ce sens ? (pour éteindre le bouton) */
export function peutCranerPrix(prix: number, sens: 1 | -1): boolean {
  return cranPrix(prix, sens) !== ramenePrix(prix);
}

export function peutCranerCapacite(kg: number, sens: 1 | -1): boolean {
  return cranCapacite(kg, sens) !== rameneCapacite(kg);
}

/* ── Ce que ça rapporte ────────────────────────────────────────────────── */

/**
 * Le gain du Voyageur si toute sa capacité part, EN CENTS (règle non
 * négociable : jamais de flottant monétaire).
 *
 * D16 — son prix EST son net : aucune commission n'est retranchée ici, c'est
 * l'Expéditeur qui paie le service. C'est pour cela que la barre du tunnel de
 * publication montre un gain là où celle de la réservation montre un prix.
 *
 * Les forfaits bagage sont HORS de cette projection : ils consomment la même
 * capacité, les additionner compterait deux fois les mêmes kilos.
 */
export function gainSiToutPartCents(prixParKiloEur: number | null, capaciteKg: number | null): number | null {
  if (prixParKiloEur === null || capaciteKg === null) return null;
  if (prixParKiloEur <= 0 || capaciteKg <= 0) return null;
  return Math.round(prixParKiloEur * 100 * capaciteKg);
}

/**
 * RG-B-29 — un forfait n'est ACTIF que si son prix est posé ET que la
 * capacité peut contenir la franchise. Sinon il est SUSPENDU : la valeur est
 * mémorisée, mais rien n'est envoyé au serveur (qui la refuserait).
 */
export function forfaitActif(
  prixEur: number | null,
  franchiseKg: number,
  capaciteKg: number | null
): boolean {
  return prixEur !== null && prixEur > 0 && capaciteKg !== null && capaciteKg >= franchiseKg;
}

/** Un forfait lu en €/kg — pour que le Voyageur voie s'il brade ses kilos. */
export function forfaitParKilo(prixEur: number | null, franchiseKg: number): number | null {
  if (prixEur === null || prixEur <= 0) return null;
  return Math.round((prixEur / franchiseKg) * 100) / 100;
}

/* ── Ce qui manque à l'offre ───────────────────────────────────────────── */

export type ManquePrix = 'prix' | 'capacite' | 'forfaitSoute' | 'forfaitCabine';

export function manquesOffre(offre: {
  prixParKiloEur: number | null;
  capaciteKg: number | null;
  forfaitSouteEur: number | null;
  forfaitCabineEur: number | null;
}): ManquePrix[] {
  const manques: ManquePrix[] = [];
  if (offre.prixParKiloEur === null || offre.prixParKiloEur <= 0) manques.push('prix');
  if (offre.capaciteKg === null || offre.capaciteKg <= 0) manques.push('capacite');
  // Un forfait est FACULTATIF ; posé, il doit être positif. Une capacité trop
  // petite ne le rend PAS fautif — elle le suspend (ci-dessus), ce qui est
  // une information, pas une erreur à corriger.
  if (offre.forfaitSouteEur !== null && offre.forfaitSouteEur <= 0) manques.push('forfaitSoute');
  if (offre.forfaitCabineEur !== null && offre.forfaitCabineEur <= 0) manques.push('forfaitCabine');
  return manques;
}

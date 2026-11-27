/**
 * number-format.ts — les nombres que l'on MONTRE (D108).
 * ======================================================
 * Ce fichier est DUPLIQUÉ OCTET POUR OCTET entre `apps/mobile/src/lib/` et
 * `apps/user-ui/src/lib/`, et une fiche compare les deux copies. C'est le
 * quatrième du motif, après `pricing-example.ts` (D99), `search-facets.ts`
 * (D100) et `parcel-weight.ts` (D101) : le téléphone ne doit pas tirer un
 * paquet partagé dans un écran d'atterrissage, et le site n'a pas à dépendre
 * du mobile. Le prix de la duplication est payé par la fiche qui l'interdit
 * de diverger ; le prix d'une règle ABSENTE, lui, se paie à l'écran.
 *
 * Le défaut qui l'a fait naître, vu au simulateur le 21/11/2026 :
 *
 *     29,62 €
 *     estimation pour 2.3 kg      ← une virgule, un point, le même bloc
 *
 * Et son frère sur les notes : « 4.8 » sur le téléphone, « 4,8 » sur le site,
 * pour le même Voyageur — parce que vingt endroits mettaient en forme à la
 * main, de trois façons différentes.
 *
 * LA RÈGLE : un nombre montré à quelqu'un s'écrit dans SA langue, et ce qui
 * décide de la langue est soit ce fichier, soit le dictionnaire — jamais un
 * `toFixed`, jamais un `.replace('.', ',')`. Une mise en forme faite à la
 * main ne « dépanne » pas : elle SORT le nombre du seul endroit qui connaît
 * la langue, et la suite n'est plus rattrapable (une chaîne « 4,8 » rendue à
 * un gabarit `{rating, number}` ne vaut plus rien).
 */

/**
 * Une note, toujours avec UNE décimale : « 4,8 » en français, « 4.8 » sinon.
 *
 * Pourquoi une décimale TOUJOURS, même sur un compte rond : « 5 » et « 5,0 »
 * ne disent pas la même chose sous une étoile — le premier se lit comme un
 * compte, le second comme une moyenne. C'est aussi ce que faisait `toFixed(1)`,
 * et c'est la seule chose qu'il faisait bien.
 */
export function formatRating(rating: number, localeTag: string): string {
  return new Intl.NumberFormat(localeTag, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

/**
 * Arrondir SANS mettre en forme — l'arrondi est un fait, la langue n'est pas
 * son affaire.
 *
 * Le CO₂ sort du calcul avec toutes ses décimales et deux lignes du dépôt
 * l'arrondissaient avec `toFixed(1)`, qui rend une CHAÎNE à point. L'une
 * rattrapait le point à la main, l'autre non. En rendant un NOMBRE, on laisse
 * le dictionnaire faire son travail (`{kg, number}`) : une seule règle décide,
 * et elle décide au bon endroit.
 */
export function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * La langue d'affichage → l'étiquette BCP 47 attendue par `Intl`.
 *
 * `'fr'` fonctionne seul, mais les deux fronts écrivaient déjà
 * `locale === 'fr' ? 'fr-FR' : 'en-US'` à la main en six endroits : le
 * ternaire vit ici une fois, au lieu d'être recopié une septième.
 */
export function intlTagFor(locale: string): string {
  return locale === 'fr' ? 'fr-FR' : 'en-US';
}

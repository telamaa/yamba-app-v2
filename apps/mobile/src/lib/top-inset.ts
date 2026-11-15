/**
 * top-inset.ts — la marge haute d'un écran poussé (D107).
 * =========================================================
 * Zéro import : la règle doit être lisible par une fiche, et le hook qui la
 * branche sur l'appareil vit à côté (`hooks/use-top-inset.ts`).
 *
 * POURQUOI deux sources. L'inset haut mesuré par
 * `react-native-safe-area-context` rend ZÉRO dans la pile de l'éditeur de
 * recherche (`presentation: 'transparentModal'`) — mesuré à l'écran le
 * 15/11 à 13:29, c'est-à-dire APRÈS le `SafeAreaProvider` posé par D103 1A.
 * Ce fournisseur manquait réellement (vingt-cinq consommateurs sans aucun),
 * sa pose reste juste, et elle n'a pas suffi : le diagnostic était
 * vraisemblable et il était faux.
 *
 * La décision n'est donc pas de trouver POURQUOI la mesure échoue, c'est de
 * ne plus en dépendre : un titre posé sur l'horloge n'est pas une
 * imperfection, c'est une information perdue. On prend le MAXIMUM de l'inset
 * et de la hauteur de barre d'état fournie par l'appareil
 * (`expo-constants`) : l'une des deux peut rendre zéro, les deux ensemble non.
 *
 * ⚠️ PAS de nombre en dur. Un plancher fixe serait faux sur la moitié du parc
 * — 20 pt sur un iPhone SE, 59 sur un appareil à Dynamic Island. Une fiche
 * interdit explicitement la constante.
 */

/**
 * La marge haute à appliquer, en points.
 *
 * Les deux entrées sont traitées comme « peut-être fausse » : une valeur
 * absente, négative ou non finie vaut zéro, et c'est l'autre qui parle.
 */
export function plancherHaut(
  insetMesure: number | null | undefined,
  hauteurDeBarre: number | null | undefined
): number {
  const sain = (v: number | null | undefined): number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
  return Math.max(sain(insetMesure), sain(hauteurDeBarre));
}

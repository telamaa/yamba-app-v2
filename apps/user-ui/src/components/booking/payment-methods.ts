/**
 * payment-methods.ts — ce que l'étape 4 propose, et dans quelle langue (D83 7A)
 * =============================================================================
 * Le jumeau web de l'écran mobile de choix du moyen de paiement. La forme
 * diffère, et c'est assumé : sur le site, le Payment Element de Stripe DESSINE
 * déjà ses onglets (carte, PayPal, portefeuille du navigateur) — lui superposer
 * une liste maison dédoublerait le choix. Ce que le site lui doit, en revanche,
 * c'est exactement ce que D83 reproche à la feuille mobile :
 *
 *   1. **la LANGUE de Yamba, pas celle du navigateur.** Sans `locale`, le
 *      Payment Element suit les préférences du navigateur : un membre qui lit
 *      Yamba en français depuis un Chrome anglais payait en anglais, sur la
 *      dernière marche du tunnel. C'est le même défaut que sur mobile (la
 *      feuille suivait la langue de l'APPAREIL), et il se corrige par un
 *      réglage parce que, ici, Stripe l'expose ;
 *   2. **notre ORDRE.** La carte d'abord : le cas majoritaire, et le seul
 *      qu'on sait toujours servir. Même ordre que les lignes du mobile, pour
 *      qu'un membre qui passe du site à l'app retrouve le même parcours ;
 *   3. **l'HONNÊTETÉ sur ce qui est accepté** (D83 4A) : si l'empreinte
 *      n'accepte aucun moyen, on le DIT, au lieu de laisser le Payment Element
 *      rendre un cadre vide.
 *
 * Tout est en fonctions pures, sans React : la décision est lisible et se
 * relit sans monter une page.
 */

import type { PaymentIntentInfo } from "./booking.types";

/**
 * Les types Stripe que cette page sait conduire, dans NOTRE ordre d'affichage.
 *
 * Les portefeuilles n'y figurent pas, et ce n'est pas un oubli : pour Stripe,
 * Apple Pay et Google Pay sont des façons de livrer une CARTE et n'ont pas de
 * type à eux — ils voyagent sur `card`. Sur le site, c'est le navigateur qui
 * décide de les offrir ; nous n'avons rien à détecter (sur mobile, si : le
 * verdict de `isPlatformPaySupported()` y est mesuré, jamais déduit — A209).
 */
export const WEB_METHOD_ORDER = ["card", "paypal"] as const;

/**
 * Les moyens de CETTE empreinte que la page sait conduire, dans notre ordre.
 * C'est l'intersection de D83 4A : afficher un moyen que l'intention ne porte
 * pas fabrique un refus, et en cacher un qu'on saurait servir appauvrit le
 * parcours sans raison.
 *
 * Un moyen servi par l'intention mais inconnu d'ici (Klarna demain, activé au
 * Dashboard) n'est pas dans la liste : il ne décide donc pas de l'ordre, mais
 * le Payment Element l'affichera APRÈS les nôtres — c'est la règle de
 * `paymentMethodOrder` chez Stripe, et elle nous convient : un moyen activé
 * sans redéploiement reste proposé, jamais caché.
 */
export function acceptedMethods(serverTypes: readonly string[] | undefined): string[] {
  if (!serverTypes) return [];
  const servis = new Set(serverTypes);
  return WEB_METHOD_ORDER.filter((type) => servis.has(type));
}

/**
 * L'empreinte propose-t-elle quelque chose à ouvrir ?
 *
 * `undefined` est un OUI : c'est un serveur plus ancien que ce front, qui ne
 * sert pas encore la liste. On ne va pas lui refuser un paiement que Stripe
 * saurait conduire — le Payment Element reste, dans ce cas, seul juge.
 *
 * `[]` sur une empreinte STRIPE, en revanche, est un NON franc : le
 * fournisseur a résolu la liste et elle est vide (aucun moyen compatible avec
 * la capture manuelle, configuration du compte vide). Le FAKE, lui, répond
 * toujours `[]` — il n'a aucune feuille à ouvrir — et l'étape 4 le traite bien
 * avant d'arriver ici (bandeau « mode test »).
 */
export function hasPayableMethod(intent: Pick<PaymentIntentInfo, "paymentMethodTypes">): boolean {
  if (intent.paymentMethodTypes === undefined) return true;
  return intent.paymentMethodTypes.length > 0;
}

/**
 * La langue à passer au Payment Element. `SUPPORTED_LOCALES` ne contient que
 * `fr` et `en`, tous deux connus de Stripe ; toute autre valeur (une URL
 * bricolée, une troisième langue ajoutée avant que Stripe ne la serve) retombe
 * sur `auto` — le comportement d'aujourd'hui, jamais une erreur de rendu.
 */
const STRIPE_LOCALES = ["fr", "en"] as const;
export type StripeLocale = (typeof STRIPE_LOCALES)[number] | "auto";

export function elementsLocale(appLocale: string): StripeLocale {
  return (STRIPE_LOCALES as readonly string[]).includes(appLocale)
    ? (appLocale as StripeLocale)
    : "auto";
}

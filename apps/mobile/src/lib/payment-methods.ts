/**
 * payment-methods.ts — quels moyens de paiement proposer, et dans quel ordre.
 * ===========================================================================
 * D83. L'écran de choix est à NOUS : la feuille de Stripe cesse d'être la
 * porte d'entrée et devient l'outil d'UN des moyens. Ce module porte toute la
 * décision, en fonctions pures — sans React, sans réseau, sans `Platform`
 * importé en dur : ce qui dépend de l'appareil est passé en argument, donc
 * exécutable.
 *
 * LA RÈGLE, en une phrase : on affiche l'INTERSECTION de ce que l'empreinte
 * accepte et de ce que l'app sait conduire (D83 4A).
 *
 *   • afficher un moyen que l'intention ne porte pas = fabriquer un refus ;
 *   • afficher un moyen dont nous n'avons pas la page = promettre un écran
 *     absent (A203) ;
 *   • masquer un moyen que nous saurions servir = appauvrir le parcours sans
 *     raison.
 *
 * LE PIÈGE DES PORTEFEUILLES, qui mérite son paragraphe. Apple Pay et Google
 * Pay n'apparaissent PAS dans `payment_method_types` : pour Stripe, ce sont
 * des façons de livrer une CARTE, et l'empreinte annonce donc `card`. Leur
 * ligne dépend donc de deux choses, et de deux seulement : que `card` soit
 * accepté, et que l'appareil réponde OUI à `isPlatformPaySupported()`. Jamais
 * de `Platform.OS === 'ios'` : un simulateur sans portefeuille, un téléphone
 * sans carte enregistrée, un Android sans services Google disent tous non —
 * et un bouton qui ne peut pas marcher ne doit pas exister (A209).
 */

/* ── Ce que l'app sait conduire ──────────────────────────────────────────── */

/**
 * Les quatre moyens qui ont une page, et leur ordre d'affichage. L'ordre suit
 * la maquette de référence : la carte d'abord (le cas majoritaire et celui
 * qu'on sait toujours servir), le portefeuille en dernier.
 */
export const PAYMENT_METHODS = ['card', 'paypal', 'applePay', 'googlePay'] as const;
export type PaymentMethodKey = (typeof PAYMENT_METHODS)[number];

/** Les deux portefeuilles — ils partagent une règle et une page. */
export const WALLETS: readonly PaymentMethodKey[] = ['applePay', 'googlePay'];
export const isWallet = (key: PaymentMethodKey): boolean => WALLETS.includes(key);

/**
 * Le type Stripe qui porte chaque moyen. `null` pour les portefeuilles : ils
 * n'ont pas de type à eux, ils voyagent sur `card` (voir l'en-tête).
 */
const STRIPE_TYPE: Record<PaymentMethodKey, string | null> = {
  card: 'card',
  paypal: 'paypal',
  applePay: null,
  googlePay: null,
};

/* ── La disponibilité ────────────────────────────────────────────────────── */

export type MethodContext = {
  /** `paymentMethodTypes` de l'empreinte — ce que le SERVEUR autorise (D83 4A). */
  serverTypes: readonly string[];
  /** Le verdict de `isPlatformPaySupported()`, MESURÉ sur l'appareil. */
  walletSupported: boolean;
  /** `ios` | `android` — rien d'autre n'a de portefeuille chez nous. */
  platform: string;
};

/** Le portefeuille de CETTE plateforme, ou `null` si elle n'en a pas. */
export function walletOf(platform: string): PaymentMethodKey | null {
  if (platform === 'ios') return 'applePay';
  if (platform === 'android') return 'googlePay';
  return null;
}

/**
 * Les moyens à afficher, dans l'ordre. Une liste VIDE est un état légitime —
 * le fournisseur Fake du poste de développement n'annonce aucun moyen, et
 * l'écran le dit au lieu d'afficher une carte vide.
 */
export function availableMethods(ctx: MethodContext): PaymentMethodKey[] {
  const servis = new Set(ctx.serverTypes);
  const carteOk = servis.has('card');
  const portefeuille = walletOf(ctx.platform);

  return PAYMENT_METHODS.filter((key) => {
    if (isWallet(key)) {
      // Deux conditions, toutes deux nécessaires : le portefeuille livre une
      // carte, donc il faut que la carte soit acceptée ; et l'appareil doit
      // dire oui. Et c'est le portefeuille DE CETTE plateforme, pas l'autre.
      return key === portefeuille && carteOk && ctx.walletSupported;
    }
    const type = STRIPE_TYPE[key];
    return type !== null && servis.has(type);
  });
}

/**
 * Le moyen pré-sélectionné à l'ouverture. La CARTE quand elle est là : c'est
 * le cas majoritaire, et le seul qui n'impose ni redirection ni portefeuille
 * configuré. À défaut, le premier de la liste — jamais `null` quand il y a au
 * moins un choix, sans quoi le bouton du bas n'aurait rien à faire.
 */
export function defaultMethod(disponibles: readonly PaymentMethodKey[]): PaymentMethodKey | null {
  if (disponibles.length === 0) return null;
  return disponibles.includes('card') ? 'card' : disponibles[0];
}

/**
 * Le choix MÉMORISÉ reste valide ? Entre le moment où l'Expéditeur a choisi et
 * celui où l'écran se rouvre, l'intention a pu être recréée avec d'autres
 * moyens (changement au Dashboard, montant différent). On ne garde donc jamais
 * un choix que la liste ne porte plus.
 */
export function keepOrDefault(
  choisi: PaymentMethodKey | null,
  disponibles: readonly PaymentMethodKey[]
): PaymentMethodKey | null {
  if (choisi !== null && disponibles.includes(choisi)) return choisi;
  return defaultMethod(disponibles);
}

/* ── Ce que chaque ligne montre ──────────────────────────────────────────── */

/**
 * Les réseaux cités SOUS « Carte bancaire ». Ce ne sont pas des choix : une
 * carte co-badgée CB/Visa se traite dans le même formulaire, où le porteur
 * choisit son réseau. Les citer rassure ; en faire des lignes séparées
 * promettrait un choix que l'intégration ne fait pas (D83 2A).
 */
export const CARD_NETWORKS = ['CB', 'VISA', 'MASTERCARD'] as const;

/** La clé i18n du libellé d'un moyen — jamais une phrase en dur (D44). */
export const labelKey = (key: PaymentMethodKey): string => `methods.${key}.label`;
/** La clé i18n de sa ligne d'explication, celle qui dit ce qui va se passer. */
export const hintKey = (key: PaymentMethodKey): string => `methods.${key}.hint`;

/**
 * Ce qui se passe quand on valide ce moyen. L'écran suivant n'est pas le même
 * selon les cas, et le DIRE avant évite la surprise :
 *   • `form`     — une page de saisie s'ouvre (la carte) ;
 *   • `redirect` — on quitte l'app et on y revient (PayPal) ;
 *   • `sheet`    — la feuille du système s'ouvre par-dessus (les portefeuilles).
 */
export type MethodFlow = 'form' | 'redirect' | 'sheet';

export function flowOf(key: PaymentMethodKey): MethodFlow {
  if (key === 'card') return 'form';
  if (key === 'paypal') return 'redirect';
  return 'sheet';
}

/* ── Les refus, traduits ─────────────────────────────────────────────────── */

/**
 * Le refus d'une autorisation, en clé de message. Même doctrine que partout
 * ailleurs dans l'app : on ne devine JAMAIS un texte à partir du `message`
 * rendu par le SDK — il est en anglais et destiné aux journaux.
 *
 * `CANCELED` est à part et c'est tout l'enjeu : fermer une feuille n'est pas
 * une carte refusée, et l'afficher comme telle accuserait la banque du membre
 * à tort.
 */
export function authFailureKey(reason: string | null | undefined): string {
  if (reason === 'CANCELED') return 'canceled';
  if (reason === 'UNAVAILABLE') return 'unavailable';
  return 'failed';
}

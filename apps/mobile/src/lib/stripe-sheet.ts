/**
 * stripe-sheet.ts — la feuille de paiement native, ISOLÉE derrière une porte.
 * ===========================================================================
 * `@stripe/stripe-react-native` est un module NATIF : son code n'est pas dans
 * Expo Go. L'importer en haut d'un écran suffirait à faire tomber l'app sur le
 * téléphone de test au moment où elle ouvre le tunnel — pas au paiement, mais
 * bien avant, à la simple résolution du module.
 *
 * D'où cette porte. Trois propriétés, dans l'ordre d'importance :
 *   1. le module n'est chargé QU'À l'instant où une feuille doit s'ouvrir, et
 *      seulement si le serveur a répondu `provider: "STRIPE"` ;
 *   2. toute absence (module non lié, clé publiable manquante, appel natif qui
 *      lève) devient `UNAVAILABLE` — un état que l'écran SAIT dire, jamais un
 *      écran blanc ni un crash ;
 *   3. l'annulation est distinguée de l'échec : fermer la feuille n'est pas
 *      une erreur de carte, et ne doit pas s'afficher comme telle.
 *
 * Conséquence assumée (arbitrage du 18/10) : avec le fournisseur FAKE — celui
 * du poste de développement — le parcours va jusqu'au bout DANS Expo Go, sans
 * jamais toucher ce fichier. La vraie carte demandera un build de
 * développement (`expo-dev-client` + EAS, plus le plugin de config Stripe dans
 * `app.json`) ; c'est une décision d'outillage, pas de code, et elle est prise
 * le jour où une carte réelle doit être testée.
 */

/** Ce que l'app utilise de la bibliothèque — rien de plus. */
type StripeNativeModule = {
  initStripe: (params: { publishableKey: string; merchantIdentifier?: string }) => Promise<unknown>;
  initPaymentSheet: (params: Record<string, unknown>) => Promise<{ error?: StripeNativeError }>;
  presentPaymentSheet: () => Promise<{ error?: StripeNativeError }>;
};

type StripeNativeError = { code?: string; message?: string };

export type SheetOutcome =
  | { ok: true }
  | { ok: false; reason: 'CANCELED' }
  | { ok: false; reason: 'UNAVAILABLE' }
  | { ok: false; reason: 'FAILED'; message: string | null };

/**
 * La clé publiable, côté app. Elle est PUBLIQUE par nature (elle n'autorise
 * que la confirmation d'une intention déjà créée par le serveur) — d'où le
 * préfixe `EXPO_PUBLIC_`, qui l'embarque dans le bundle en toute connaissance
 * de cause. La clé SECRÈTE, elle, ne quitte jamais le deal-service.
 */
export function stripePublishableKey(): string | null {
  const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key ? key : null;
}

let cached: StripeNativeModule | null = null;
/** Sondé une seule fois : dans Expo Go, l'évaluation LÈVE à chaque appel. */
let probed = false;
let initialised = false;

function loadModule(): StripeNativeModule | null {
  if (cached) return cached;
  if (probed) return null;
  probed = true;
  try {
    // `require` et non `import` : c'est tout l'objet de ce fichier. Un import
    // statique serait résolu au chargement de l'écran, donc dans Expo Go — où
    // le module réclame son pendant natif DÈS son évaluation et lève.
    cached = require('@stripe/stripe-react-native') as StripeNativeModule;
    return cached;
  } catch {
    return null;
  }
}

/**
 * Le paiement par carte est-il ouvrable sur CET appareil ? Un `false` n'est
 * pas une panne : c'est Expo Go sans module natif, ou une clé publiable
 * absente. L'écran doit le DIRE, pas le masquer.
 */
export function isPaymentSheetAvailable(): boolean {
  return stripePublishableKey() !== null && loadModule() !== null;
}

/**
 * Ouvre la feuille native et rend son issue. Ne lève jamais : l'appelant est
 * au milieu d'un chemin d'argent, il a besoin d'une issue à traduire.
 *
 * Ce que la feuille confirme est une AUTORISATION, pas un débit : l'intention
 * est créée en capture manuelle côté serveur (D31). L'argent ne bouge qu'à
 * l'acceptation du Voyageur.
 */
export async function confirmWithPaymentSheet(args: {
  clientSecret: string;
  merchantName: string;
  dark: boolean;
}): Promise<SheetOutcome> {
  const key = stripePublishableKey();
  const stripe = loadModule();
  if (!key || !stripe) return { ok: false, reason: 'UNAVAILABLE' };

  try {
    if (!initialised) {
      await stripe.initStripe({ publishableKey: key });
      initialised = true;
    }

    const init = await stripe.initPaymentSheet({
      merchantDisplayName: args.merchantName,
      paymentIntentClientSecret: args.clientSecret,
      // 3-D Secure renvoie vers l'app par son schéma (`app.json`) — sans cela,
      // l'authentification bancaire se perd dans le navigateur système.
      returnURL: 'yamba://booking/payment',
      allowsDelayedPaymentMethods: false,
      style: args.dark ? 'alwaysDark' : 'alwaysLight',
    });
    if (init.error) return { ok: false, reason: 'FAILED', message: init.error.message ?? null };

    const result = await stripe.presentPaymentSheet();
    if (!result.error) return { ok: true };
    if (result.error.code === 'Canceled') return { ok: false, reason: 'CANCELED' };
    return { ok: false, reason: 'FAILED', message: result.error.message ?? null };
  } catch {
    // Un appel natif qui lève ici = module présent côté JS, absent côté natif
    // (le cas exact d'Expo Go). C'est une indisponibilité, pas un échec carte.
    return { ok: false, reason: 'UNAVAILABLE' };
  }
}

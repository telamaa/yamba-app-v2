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
  initStripe: (params: {
    publishableKey: string;
    /** Apple Pay — l'identifiant marchand Apple (`merchant.…`). Sans lui, pas d'Apple Pay. */
    merchantIdentifier?: string;
    /** 3-D Secure ET redirections bancaires (Klarna, PayPal) : le schéma qui ramène dans l'app. */
    urlScheme?: string;
  }) => Promise<unknown>;
  initPaymentSheet: (params: Record<string, unknown>) => Promise<{ error?: StripeNativeError }>;
  presentPaymentSheet: () => Promise<{ error?: StripeNativeError }>;
  /** iOS — rend `true` si l'URL était une redirection Stripe (D82 7A). */
  handleURLCallback: (url: string) => Promise<boolean>;
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

/**
 * Le pays du MARCHAND (nous), pas celui du membre. Apple Pay et Google Pay l'exigent tous
 * les deux, et c'est un fait d'entreprise : Yamba encaisse en France, en EUR — ce qui est
 * aussi ce qui rend Klarna éligible (D82).
 */
const MERCHANT_COUNTRY = 'FR';

/** Le schéma déclaré dans `app.json` — il ramène le membre dans l'app après une redirection. */
const URL_SCHEME = 'yamba';

/**
 * Apple Pay ne s'active pas tout seul : il réclame un compte développeur Apple, un
 * identifiant marchand et un certificat. Tant que cet identifiant n'est pas fourni, le bloc
 * Apple Pay n'est PAS envoyé — un identifiant inventé passerait la configuration pour
 * échouer au moment où le membre appuie (D82 2A : Android d'abord, iOS ensuite).
 */
function appleMerchantId(): string | null {
  const id = process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID?.trim();
  return id ? id : null;
}

/**
 * Google Pay a DEUX environnements, et le sien n'a rien à voir avec le mode Stripe : en
 * environnement de test, il accepte les cartes de démonstration d'un compte Google ; en
 * production, il exige de vraies cartes et un marchand validé.
 *
 * D82 1A interdit au code de deviner dans quel mode il tourne (pas de lecture de préfixe de
 * clé). L'environnement est donc une CONFIGURATION explicite, qui suit le type de build par
 * défaut : un build de développement teste, un build publié paie.
 */
function googlePayTestEnv(): boolean {
  const declared = process.env.EXPO_PUBLIC_GOOGLE_PAY_TEST_ENV?.trim();
  if (declared === 'true') return true;
  if (declared === 'false') return false;
  return __DEV__;
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
      const merchantIdentifier = appleMerchantId();
      await stripe.initStripe({
        publishableKey: key,
        urlScheme: URL_SCHEME,
        ...(merchantIdentifier ? { merchantIdentifier } : {}),
      });
      initialised = true;
    }

    const init = await stripe.initPaymentSheet({
      merchantDisplayName: args.merchantName,
      paymentIntentClientSecret: args.clientSecret,
      // 3-D Secure renvoie vers l'app par son schéma (`app.json`) — sans cela,
      // l'authentification bancaire se perd dans le navigateur système.
      returnURL: `${URL_SCHEME}://booking/payment`,
      // Les moyens à NOTIFICATION DIFFÉRÉE (comptes bancaires américains, prélèvements)
      // restent dehors : leur issue n'est pas connue quand la feuille se referme, et Yamba
      // ne crée pas de réservation sur une empreinte dont il n'est pas sûr. Klarna et
      // PayPal, eux, sont à notification IMMÉDIATE — ce réglage ne les exclut pas.
      allowsDelayedPaymentMethods: false,
      // D82 — Google Pay côté Android, Apple Pay côté iOS. Les deux réclament le pays du
      // marchand ; Apple Pay n'est envoyé que si son identifiant existe.
      googlePay: { merchantCountryCode: MERCHANT_COUNTRY, testEnv: googlePayTestEnv() },
      ...(appleMerchantId() ? { applePay: { merchantCountryCode: MERCHANT_COUNTRY } } : {}),
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

/**
 * D82 7A — le retour d'une redirection bancaire (3-D Secure, Klarna, PayPal).
 *
 * Sur iOS, le SDK ne voit pas l'URL qui réveille l'app : c'est au composant racine de la
 * lui passer. Sans ce relais, l'authentification se termine dans le navigateur système et
 * la feuille attend indéfiniment. Sur Android, le SDK s'en charge seul — appeler ceci n'y
 * fait rien de mal.
 *
 * Passe par la MÊME porte que le reste du fichier : dans Expo Go, le module n'existe pas,
 * et une URL non reconnue n'est pas une erreur — c'est une URL qui ne nous concerne pas.
 */
export async function handleStripeRedirect(url: string): Promise<boolean> {
  const stripe = loadModule();
  if (!stripe?.handleURLCallback) return false;
  try {
    return await stripe.handleURLCallback(url);
  } catch {
    return false;
  }
}

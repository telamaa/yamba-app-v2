/**
 * stripe-sheet.spec.ts — la porte devant le module NATIF de Stripe (D82).
 * =======================================================================
 * Ce fichier garde un chemin d'ARGENT, et il garde surtout une promesse :
 * « ne lève jamais ». L'appelant est au milieu d'un paiement, il a besoin
 * d'une ISSUE à traduire, pas d'une exception.
 *
 * Trois propriétés à tenir, dans l'ordre d'importance de l'en-tête du module :
 *   1. le module natif n'est chargé qu'au moment d'ouvrir une feuille ;
 *   2. toute absence devient `UNAVAILABLE` — un état que l'écran SAIT dire ;
 *   3. l'annulation est distinguée de l'échec : fermer la feuille n'est pas
 *      une erreur de carte, et l'afficher comme telle accuserait à tort la
 *      banque du membre.
 *
 * Le module garde un état de MODULE (sonde faite, module en cache, Stripe
 * initialisé) : chaque fiche repart donc d'un registre vierge
 * (`jest.resetModules()`), sans quoi la deuxième mesurerait le cache de la
 * première. C'est le prix d'une porte à sonde unique — et c'est voulu : dans
 * Expo Go, l'évaluation du module lève à CHAQUE appel.
 */
type SheetModule = typeof import('@/lib/stripe-sheet');

/** Un module natif factice, piloté par la fiche. */
type FakeNative = {
  initStripe: jest.Mock;
  initPaymentSheet: jest.Mock;
  presentPaymentSheet: jest.Mock;
  handleURLCallback: jest.Mock;
  isPlatformPaySupported: jest.Mock;
  confirmPlatformPayPayment: jest.Mock;
  confirmPayment: jest.Mock;
};

function fakeNative(overrides: Partial<FakeNative> = {}): FakeNative {
  return {
    initStripe: jest.fn().mockResolvedValue(undefined),
    initPaymentSheet: jest.fn().mockResolvedValue({}),
    presentPaymentSheet: jest.fn().mockResolvedValue({}),
    handleURLCallback: jest.fn().mockResolvedValue(true),
    isPlatformPaySupported: jest.fn().mockResolvedValue(true),
    confirmPlatformPayPayment: jest.fn().mockResolvedValue({}),
    confirmPayment: jest.fn().mockResolvedValue({}),
    ...overrides,
  };
}

/**
 * Charge le module à neuf, avec ou sans son pendant natif. Sans `native`, le
 * `require` du module LÈVE — exactement ce qui se passe dans Expo Go, où le
 * JavaScript est là et le natif absent.
 */
function loadSheet(native: FakeNative | null): SheetModule {
  let sheet: SheetModule = {} as SheetModule;
  jest.isolateModules(() => {
    jest.doMock('@stripe/stripe-react-native', () => {
      if (!native) throw new Error('native module not linked (Expo Go)');
      return native;
    });
    sheet = require('@/lib/stripe-sheet') as SheetModule;
  });
  return sheet;
}

const SHEET_ARGS = { clientSecret: 'pi_123_secret_456', merchantName: 'Yamba', dark: false };

const KEY = 'pk_test_51AbCdEf';

beforeEach(() => {
  jest.resetModules();
  process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = KEY;
  delete process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_PAY_TEST_ENV;
});

afterEach(() => {
  delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
});

describe('stripePublishableKey — publique par nature, absente par défaut', () => {
  it('rend la clé déclarée, débarrassée de ses espaces', () => {
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = `  ${KEY}  `;
    expect(loadSheet(fakeNative()).stripePublishableKey()).toBe(KEY);
  });

  it('une clé vide ou absente est une ABSENCE, pas une chaîne vide', () => {
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY = '   ';
    expect(loadSheet(fakeNative()).stripePublishableKey()).toBeNull();
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    expect(loadSheet(fakeNative()).stripePublishableKey()).toBeNull();
  });
});

describe('isPaymentSheetAvailable — un « non » n’est pas une panne', () => {
  it('oui quand la clé ET le module natif sont là', () => {
    expect(loadSheet(fakeNative()).isPaymentSheetAvailable()).toBe(true);
  });

  it('non dans Expo Go : le module JavaScript est là, le natif n’existe pas', () => {
    expect(loadSheet(null).isPaymentSheetAvailable()).toBe(false);
  });

  it('non sans clé publiable, même avec le module natif', () => {
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    expect(loadSheet(fakeNative()).isPaymentSheetAvailable()).toBe(false);
  });
});

describe('confirmWithPaymentSheet — une issue, jamais une exception', () => {
  it('ouvre la feuille et rend un succès', async () => {
    const native = fakeNative();
    const sheet = loadSheet(native);
    await expect(sheet.confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({ ok: true });
    expect(native.initStripe).toHaveBeenCalledTimes(1);
    expect(native.presentPaymentSheet).toHaveBeenCalledTimes(1);
  });

  it('n’initialise Stripe QU’UNE fois, même sur deux paiements', async () => {
    const native = fakeNative();
    const sheet = loadSheet(native);
    await sheet.confirmWithPaymentSheet(SHEET_ARGS);
    await sheet.confirmWithPaymentSheet(SHEET_ARGS);
    expect(native.initStripe).toHaveBeenCalledTimes(1);
    expect(native.initPaymentSheet).toHaveBeenCalledTimes(2);
  });

  it('déclare le schéma de retour — sans lui, le 3-D Secure se perd dans le navigateur', async () => {
    const native = fakeNative();
    await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    expect(native.initStripe).toHaveBeenCalledWith(expect.objectContaining({ urlScheme: 'yamba' }));
    expect(native.initPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ returnURL: 'yamba://booking/payment' })
    );
  });

  it('refuse les moyens à notification DIFFÉRÉE : Yamba ne réserve pas sur une empreinte incertaine', async () => {
    const native = fakeNative();
    await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    expect(native.initPaymentSheet).toHaveBeenCalledWith(
      expect.objectContaining({ allowsDelayedPaymentMethods: false })
    );
  });

  it('Google Pay part avec le pays du MARCHAND (nous), pas celui du membre', async () => {
    const native = fakeNative();
    await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    const params = native.initPaymentSheet.mock.calls[0][0] as Record<string, unknown>;
    expect(params.googlePay).toEqual({ merchantCountryCode: 'FR', testEnv: false });
  });

  it('D82 1A — l’environnement Google Pay est une CONFIGURATION, jamais un préfixe de clé deviné', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_PAY_TEST_ENV = 'true';
    const native = fakeNative();
    await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    const params = native.initPaymentSheet.mock.calls[0][0] as { googlePay: { testEnv: boolean } };
    expect(params.googlePay.testEnv).toBe(true);
  });

  it('Apple Pay n’est PAS envoyé sans identifiant marchand — un identifiant inventé échouerait au pire moment', async () => {
    const native = fakeNative();
    await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    const params = native.initPaymentSheet.mock.calls[0][0] as Record<string, unknown>;
    expect(params.applePay).toBeUndefined();
    expect(native.initStripe).toHaveBeenCalledWith(
      expect.not.objectContaining({ merchantIdentifier: expect.anything() })
    );
  });

  it('…et il l’est dès que l’identifiant existe', async () => {
    process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID = 'merchant.com.telama.yamba';
    const native = fakeNative();
    await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    expect(native.initStripe).toHaveBeenCalledWith(
      expect.objectContaining({ merchantIdentifier: 'merchant.com.telama.yamba' })
    );
    const params = native.initPaymentSheet.mock.calls[0][0] as Record<string, unknown>;
    expect(params.applePay).toEqual({ merchantCountryCode: 'FR' });
  });

  it('FERMER la feuille est une ANNULATION — pas une carte refusée', async () => {
    const native = fakeNative({
      presentPaymentSheet: jest.fn().mockResolvedValue({ error: { code: 'Canceled' } }),
    });
    await expect(loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'CANCELED',
    });
  });

  it('une carte refusée est un ÉCHEC, et il porte son message', async () => {
    const native = fakeNative({
      presentPaymentSheet: jest
        .fn()
        .mockResolvedValue({ error: { code: 'Failed', message: 'Votre carte a été refusée.' } }),
    });
    await expect(loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'FAILED',
      message: 'Votre carte a été refusée.',
    });
  });

  it('un échec SANS message reste un échec, avec un message nul — jamais « undefined » à l’écran', async () => {
    const native = fakeNative({
      presentPaymentSheet: jest.fn().mockResolvedValue({ error: { code: 'Failed' } }),
    });
    await expect(loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'FAILED',
      message: null,
    });
  });

  it('une préparation en échec ne présente PAS la feuille', async () => {
    const native = fakeNative({
      initPaymentSheet: jest.fn().mockResolvedValue({ error: { message: 'Intention expirée' } }),
    });
    const sheet = loadSheet(native);
    await expect(sheet.confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'FAILED',
      message: 'Intention expirée',
    });
    expect(native.presentPaymentSheet).not.toHaveBeenCalled();
  });

  it('sans clé publiable, on ne touche jamais au module natif', async () => {
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const native = fakeNative();
    await expect(loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
    expect(native.initStripe).not.toHaveBeenCalled();
  });

  it('dans Expo Go, c’est UNAVAILABLE et rien d’autre', async () => {
    await expect(loadSheet(null).confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });

  it('un appel natif qui LÈVE est une indisponibilité, pas un échec de carte', async () => {
    const native = fakeNative({
      initPaymentSheet: jest.fn().mockRejectedValue(new Error('TurboModule not found')),
    });
    await expect(loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS)).resolves.toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });

  it('ne lève JAMAIS, quelle que soit la panne du natif', async () => {
    const native = fakeNative({
      initStripe: jest.fn().mockRejectedValue(new Error('boom')),
    });
    const result = await loadSheet(native).confirmWithPaymentSheet(SHEET_ARGS);
    expect(result.ok).toBe(false);
  });
});

describe('handleStripeRedirect — le relais de lien d’iOS (D82 7A)', () => {
  it('passe l’URL au SDK et rend son verdict', async () => {
    const native = fakeNative();
    const sheet = loadSheet(native);
    await expect(sheet.handleStripeRedirect('yamba://booking/payment?x=1')).resolves.toBe(true);
    expect(native.handleURLCallback).toHaveBeenCalledWith('yamba://booking/payment?x=1');
  });

  it('une URL que Stripe ne reconnaît pas n’est pas une erreur : elle ne nous concerne pas', async () => {
    const native = fakeNative({ handleURLCallback: jest.fn().mockResolvedValue(false) });
    await expect(loadSheet(native).handleStripeRedirect('yamba://shipment/42')).resolves.toBe(false);
  });

  it('sans module natif (Expo Go), le relais se tait', async () => {
    await expect(loadSheet(null).handleStripeRedirect('yamba://booking/payment')).resolves.toBe(false);
  });

  it('un relais qui LÈVE se tait aussi — il ne casse pas le réveil de l’app', async () => {
    const native = fakeNative({
      handleURLCallback: jest.fn().mockRejectedValue(new Error('no native')),
    });
    await expect(loadSheet(native).handleStripeRedirect('yamba://x')).resolves.toBe(false);
  });

  it('un SDK sans `handleURLCallback` (version plus ancienne) ne fait pas tomber l’app', async () => {
    const native = fakeNative();
    const withoutCallback = { ...native, handleURLCallback: undefined } as unknown as FakeNative;
    await expect(loadSheet(withoutCallback).handleStripeRedirect('yamba://x')).resolves.toBe(false);
  });
});

/**
 * Cette fiche n'a aucun `import` de tête : elle ne charge ses modules qu'à
 * l'intérieur de `jest.isolateModules`, et ses seuls types viennent de
 * `typeof import(...)`, qui est effacé à la compilation. Pour TypeScript,
 * c'est donc un SCRIPT — ses `const` et ses `function` de tête tombent dans la
 * portée GLOBALE, où elles se heurteront un jour à celles d'une fiche voisine
 * (TS2451, rapporté sur l'autre fichier). `export {}` en fait un module.
 *
 * Attrapé par `fiches-sont-des-modules.spec.ts`, qui balaie tout le dépôt —
 * le harnais du mobile entre donc aussi dans SON champ (A223).
 */
export {};

/* ══ D83 — les trois autres chemins d'autorisation ═══════════════════════════
   La feuille n'est plus la porte d'entrée : l'écran de Yamba choisit, et
   chaque moyen a son chemin. Les trois partagent les propriétés de la
   feuille, et ce sont elles qu'on tient ici — ne jamais lever, distinguer
   l'annulation de l'échec, et traduire toute absence en « indisponible ».
   ══════════════════════════════════════════════════════════════════════════ */

describe('isWalletSupported — une MESURE, jamais une déduction (D83 3A)', () => {
  it('rend le verdict de l’appareil quand il répond oui', async () => {
    const native = fakeNative();
    await expect(loadSheet(native).isWalletSupported()).resolves.toBe(true);
    expect(native.isPlatformPaySupported).toHaveBeenCalled();
  });

  it('un appareil sans portefeuille dit non, et ce n’est pas une panne', async () => {
    const native = fakeNative({ isPlatformPaySupported: jest.fn().mockResolvedValue(false) });
    await expect(loadSheet(native).isWalletSupported()).resolves.toBe(false);
  });

  it('sans module natif (Expo Go sur iOS), non — ses droits Apple Pay n’existent pas', async () => {
    await expect(loadSheet(null).isWalletSupported()).resolves.toBe(false);
  });

  it('sans clé publiable, non — et on ne touche pas au natif', async () => {
    delete process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    const native = fakeNative();
    await expect(loadSheet(native).isWalletSupported()).resolves.toBe(false);
    expect(native.isPlatformPaySupported).not.toHaveBeenCalled();
  });

  it('un appel natif qui LÈVE vaut non — une liste de choix, pas un diagnostic', async () => {
    const native = fakeNative({
      isPlatformPaySupported: jest.fn().mockRejectedValue(new Error('no wallet')),
    });
    await expect(loadSheet(native).isWalletSupported()).resolves.toBe(false);
  });

  it('initialise Stripe avant d’interroger : la clé doit être posée', async () => {
    const native = fakeNative();
    await loadSheet(native).isWalletSupported();
    expect(native.initStripe).toHaveBeenCalledTimes(1);
  });
});

describe('confirmWithWallet — la feuille du système', () => {
  const ARGS = { clientSecret: 'pi_1_secret_2', amountCents: 1105, currencyCode: 'EUR', merchantName: 'Yamba' };

  it('confirme et rend un succès', async () => {
    const native = fakeNative();
    await expect(loadSheet(native).confirmWithWallet(ARGS)).resolves.toEqual({ ok: true });
    expect(native.confirmPlatformPayPayment).toHaveBeenCalledWith('pi_1_secret_2', expect.any(Object));
  });

  it('affiche le MONTANT du devis serveur — la feuille du système ne lit pas l’intention', async () => {
    const native = fakeNative();
    await loadSheet(native).confirmWithWallet(ARGS);
    const params = native.confirmPlatformPayPayment.mock.calls[0][1] as {
      applePay: { cartItems: { amount: string }[]; merchantCountryCode: string };
      googlePay: { currencyCode: string; merchantCountryCode: string };
    };
    expect(params.applePay.cartItems[0].amount).toBe('11.05');
    expect(params.applePay.merchantCountryCode).toBe('FR');
    expect(params.googlePay.currencyCode).toBe('EUR');
    expect(params.googlePay.merchantCountryCode).toBe('FR');
  });

  it('fermer la feuille du système est une ANNULATION', async () => {
    const native = fakeNative({
      confirmPlatformPayPayment: jest.fn().mockResolvedValue({ error: { code: 'Canceled' } }),
    });
    await expect(loadSheet(native).confirmWithWallet(ARGS)).resolves.toEqual({
      ok: false,
      reason: 'CANCELED',
    });
  });

  // Un seul chargement de module par fiche : `isolateModules` donne un registre
  // neuf, mais deux chargements dans la MÊME fiche se marchent dessus — mesuré.
  it('un refus porte son message', async () => {
    const refus = fakeNative({
      confirmPlatformPayPayment: jest.fn().mockResolvedValue({ error: { code: 'Failed', message: 'Carte refusée' } }),
    });
    await expect(loadSheet(refus).confirmWithWallet(ARGS)).resolves.toEqual({
      ok: false,
      reason: 'FAILED',
      message: 'Carte refusée',
    });
  });

  it('sans module natif, c’est indisponible', async () => {
    await expect(loadSheet(null).confirmWithWallet(ARGS)).resolves.toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });
});

describe('confirmWithRedirect — PayPal part et revient', () => {
  const ARGS = { clientSecret: 'pi_1_secret_2', paymentMethodType: 'PayPal' as const };

  it('confirme avec le type nommé', async () => {
    const native = fakeNative();
    await expect(loadSheet(native).confirmWithRedirect(ARGS)).resolves.toEqual({ ok: true });
    expect(native.confirmPayment).toHaveBeenCalledWith('pi_1_secret_2', {
      paymentMethodType: 'PayPal',
    });
  });

  it('un retour annulé n’est pas un refus de paiement', async () => {
    const native = fakeNative({
      confirmPayment: jest.fn().mockResolvedValue({ error: { code: 'Canceled' } }),
    });
    await expect(loadSheet(native).confirmWithRedirect(ARGS)).resolves.toEqual({
      ok: false,
      reason: 'CANCELED',
    });
  });

  it('ne lève jamais, même si l’appel natif explose', async () => {
    const native = fakeNative({
      confirmPayment: jest.fn().mockRejectedValue(new Error('boom')),
    });
    await expect(loadSheet(native).confirmWithRedirect(ARGS)).resolves.toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });
});

describe('confirmCardPayment — la carte saisie dans NOTRE page', () => {
  it('n’envoie que le secret et le type : les données de carte restent dans le champ natif', async () => {
    const native = fakeNative();
    await expect(
      loadSheet(native).confirmCardPayment({ clientSecret: 'pi_1_secret_2' })
    ).resolves.toEqual({ ok: true });
    expect(native.confirmPayment).toHaveBeenCalledWith('pi_1_secret_2', {
      paymentMethodType: 'Card',
    });
  });

  it('joint le nom du porteur quand il est saisi, TRIMÉ', async () => {
    const avec = fakeNative();
    await loadSheet(avec).confirmCardPayment({ clientSecret: 's', holderName: '  Awa Nkounkou  ' });
    expect(avec.confirmPayment).toHaveBeenCalledWith('s', {
      paymentMethodType: 'Card',
      paymentMethodData: { billingDetails: { name: 'Awa Nkounkou' } },
    });
  });

  it('…et n’envoie PAS la clé quand il est vide : un nom blanc n’est pas un nom', async () => {
    const sans = fakeNative();
    await loadSheet(sans).confirmCardPayment({ clientSecret: 's', holderName: '   ' });
    expect(sans.confirmPayment).toHaveBeenCalledWith('s', { paymentMethodType: 'Card' });
  });

  it('une carte refusée porte son message', async () => {
    const refus = fakeNative({
      confirmPayment: jest.fn().mockResolvedValue({ error: { code: 'Failed', message: 'Votre carte a été refusée.' } }),
    });
    await expect(loadSheet(refus).confirmCardPayment({ clientSecret: 's' })).resolves.toEqual({
      ok: false,
      reason: 'FAILED',
      message: 'Votre carte a été refusée.',
    });
  });

  it('…et une annulation reste une annulation, jamais un refus de carte', async () => {
    const annule = fakeNative({
      confirmPayment: jest.fn().mockResolvedValue({ error: { code: 'Canceled' } }),
    });
    await expect(loadSheet(annule).confirmCardPayment({ clientSecret: 's' })).resolves.toEqual({
      ok: false,
      reason: 'CANCELED',
    });
  });

  it('sans module natif, indisponible — et l’écran le DIT', async () => {
    await expect(loadSheet(null).confirmCardPayment({ clientSecret: 's' })).resolves.toEqual({
      ok: false,
      reason: 'UNAVAILABLE',
    });
  });
});

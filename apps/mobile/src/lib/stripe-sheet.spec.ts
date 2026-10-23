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
};

function fakeNative(overrides: Partial<FakeNative> = {}): FakeNative {
  return {
    initStripe: jest.fn().mockResolvedValue(undefined),
    initPaymentSheet: jest.fn().mockResolvedValue({}),
    presentPaymentSheet: jest.fn().mockResolvedValue({}),
    handleURLCallback: jest.fn().mockResolvedValue(true),
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

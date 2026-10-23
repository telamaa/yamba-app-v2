/**
 * payment-methods.spec.ts — l'écran de choix du moyen de paiement (D83).
 * =======================================================================
 * Ce module décide ce que l'Expéditeur voit au moment de payer. Deux erreurs
 * y coûtent cher, et dans les deux sens :
 *
 *   • proposer un moyen que l'empreinte n'accepte pas → un refus fabriqué,
 *     au pire moment du parcours ;
 *   • proposer un portefeuille que l'appareil ne sait pas ouvrir → un bouton
 *     mort sur l'écran de paiement (A209).
 *
 * Le piège qui justifie la moitié de ces fiches : Apple Pay et Google Pay
 * n'apparaissent PAS dans `payment_method_types`. Pour Stripe, ce sont des
 * façons de livrer une CARTE. Leur ligne dépend donc de `card` ET du verdict
 * de l'appareil — jamais de la plateforme seule.
 */
import {
  CARD_NETWORKS,
  PAYMENT_METHODS,
  authFailureKey,
  availableMethods,
  defaultMethod,
  flowOf,
  hintKey,
  isWallet,
  keepOrDefault,
  labelKey,
  walletOf,
  type MethodContext,
  type PaymentMethodKey,
} from '@/lib/payment-methods';

/** Un iPhone avec un portefeuille actif et une empreinte carte + PayPal. */
function ctx(patch: Partial<MethodContext> = {}): MethodContext {
  return { serverTypes: ['card', 'paypal'], walletSupported: true, platform: 'ios', ...patch };
}

describe('availableMethods — l’intersection, et rien d’autre', () => {
  it('un iPhone qui sait payer : carte, PayPal, Apple Pay — dans l’ordre de la maquette', () => {
    expect(availableMethods(ctx())).toEqual(['card', 'paypal', 'applePay']);
  });

  it('le même sur Android rend Google Pay, jamais Apple Pay', () => {
    expect(availableMethods(ctx({ platform: 'android' }))).toEqual(['card', 'paypal', 'googlePay']);
  });

  it('un moyen que le SERVEUR n’annonce pas n’existe pas à l’écran', () => {
    expect(availableMethods(ctx({ serverTypes: ['card'] }))).toEqual(['card', 'applePay']);
  });

  it('un moyen que le serveur annonce mais que l’app ne sait pas conduire est ignoré', () => {
    // Klarna est servi par l'empreinte, mais aucune page ne sait le conduire :
    // l'afficher promettrait un écran absent (A203).
    const liste = availableMethods(ctx({ serverTypes: ['card', 'klarna', 'link'] }));
    expect(liste).toEqual(['card', 'applePay']);
    expect(liste as string[]).not.toContain('klarna');
  });

  it('PayPal seul, sans carte : pas de portefeuille — il n’a plus rien à livrer', () => {
    expect(availableMethods(ctx({ serverTypes: ['paypal'] }))).toEqual(['paypal']);
  });

  it('l’appareil qui dit NON au portefeuille le retire, même sur iOS', () => {
    expect(availableMethods(ctx({ walletSupported: false }))).toEqual(['card', 'paypal']);
  });

  it('le fournisseur Fake n’annonce RIEN : la liste est vide, et c’est un état légitime', () => {
    expect(availableMethods(ctx({ serverTypes: [] }))).toEqual([]);
  });

  it('une plateforme sans portefeuille (le web) garde les autres moyens', () => {
    expect(availableMethods(ctx({ platform: 'web' }))).toEqual(['card', 'paypal']);
  });

  it('ne rend jamais les DEUX portefeuilles à la fois', () => {
    for (const platform of ['ios', 'android', 'web']) {
      const liste = availableMethods(ctx({ platform }));
      expect(liste.filter(isWallet).length).toBeLessThanOrEqual(1);
    }
  });

  it('respecte toujours l’ordre déclaré, quel que soit l’ordre servi', () => {
    const liste = availableMethods(ctx({ serverTypes: ['paypal', 'card'] }));
    expect(liste).toEqual(['card', 'paypal', 'applePay']);
  });
});

describe('walletOf — le portefeuille de CETTE plateforme', () => {
  it('iOS a Apple Pay, Android a Google Pay, le reste n’en a pas', () => {
    expect(walletOf('ios')).toBe('applePay');
    expect(walletOf('android')).toBe('googlePay');
    expect(walletOf('web')).toBeNull();
    expect(walletOf('windows')).toBeNull();
  });
});

describe('defaultMethod — la carte d’abord', () => {
  it('choisit la carte dès qu’elle est là : ni redirection, ni portefeuille à configurer', () => {
    expect(defaultMethod(['card', 'paypal', 'applePay'])).toBe('card');
    expect(defaultMethod(['paypal', 'card'])).toBe('card');
  });

  it('à défaut, le premier de la liste — jamais null quand il y a un choix', () => {
    expect(defaultMethod(['paypal', 'applePay'])).toBe('paypal');
  });

  it('aucun moyen : aucun défaut (le bouton du bas n’aurait rien à faire)', () => {
    expect(defaultMethod([])).toBeNull();
  });
});

describe('keepOrDefault — un choix mémorisé ne survit pas à sa disparition', () => {
  it('garde le choix tant que la liste le porte', () => {
    expect(keepOrDefault('paypal', ['card', 'paypal'])).toBe('paypal');
  });

  it('retombe sur le défaut quand le moyen choisi a disparu (intention recréée)', () => {
    expect(keepOrDefault('paypal', ['card', 'applePay'])).toBe('card');
  });

  it('un portefeuille mémorisé puis refusé par l’appareil retombe sur la carte', () => {
    expect(keepOrDefault('applePay', ['card', 'paypal'])).toBe('card');
  });

  it('sans choix mémorisé, c’est le défaut', () => {
    expect(keepOrDefault(null, ['card'])).toBe('card');
  });

  it('sans aucun moyen, rien — et surtout pas le choix d’avant', () => {
    expect(keepOrDefault('card', [])).toBeNull();
  });
});

describe('flowOf — dire AVANT ce qui va s’ouvrir', () => {
  it('la carte ouvre une page de saisie', () => {
    expect(flowOf('card')).toBe('form');
  });

  it('PayPal quitte l’app et y revient', () => {
    expect(flowOf('paypal')).toBe('redirect');
  });

  it('les portefeuilles ouvrent la feuille du système', () => {
    expect(flowOf('applePay')).toBe('sheet');
    expect(flowOf('googlePay')).toBe('sheet');
  });

  it('les quatre moyens déclarés ont tous un parcours', () => {
    for (const key of PAYMENT_METHODS) {
      expect(['form', 'redirect', 'sheet']).toContain(flowOf(key));
    }
  });
});

describe('les libellés sont des CLÉS, jamais des phrases (D44)', () => {
  it('chaque moyen a sa clé de libellé et sa clé d’explication', () => {
    for (const key of PAYMENT_METHODS) {
      expect(labelKey(key)).toBe(`methods.${key}.label`);
      expect(hintKey(key)).toBe(`methods.${key}.hint`);
    }
  });

  it('aucune clé ne contient de point APRÈS le préfixe — next-intl les refuse au rendu', () => {
    for (const key of PAYMENT_METHODS) {
      expect(key).not.toContain('.');
    }
  });

  it('les réseaux cités sous la carte ne sont pas des moyens de paiement', () => {
    // D83 2A — CB est un RÉSEAU : en faire une ligne promettrait un choix que
    // l'intégration ne fait pas. Ils ne doivent donc jamais devenir des clés.
    for (const reseau of CARD_NETWORKS) {
      expect(PAYMENT_METHODS as readonly string[]).not.toContain(reseau.toLowerCase());
    }
    expect(CARD_NETWORKS).toContain('CB');
  });
});

describe('authFailureKey — fermer n’est pas être refusé', () => {
  it('une annulation a son propre mot : la banque du membre n’est pas en cause', () => {
    expect(authFailureKey('CANCELED')).toBe('canceled');
  });

  it('une indisponibilité se distingue d’un échec', () => {
    expect(authFailureKey('UNAVAILABLE')).toBe('unavailable');
  });

  it('tout le reste est un échec, y compris l’absence de motif', () => {
    expect(authFailureKey('FAILED')).toBe('failed');
    expect(authFailureKey(null)).toBe('failed');
    expect(authFailureKey(undefined)).toBe('failed');
    expect(authFailureKey('UN_MOTIF_INCONNU')).toBe('failed');
  });
});

describe('garde-fou de cohérence', () => {
  it('tout moyen déclaré est soit un portefeuille, soit pas — et la liste n’a pas de doublon', () => {
    expect(new Set(PAYMENT_METHODS).size).toBe(PAYMENT_METHODS.length);
    const portefeuilles = (PAYMENT_METHODS as readonly PaymentMethodKey[]).filter(isWallet);
    expect(portefeuilles).toEqual(['applePay', 'googlePay']);
  });
});

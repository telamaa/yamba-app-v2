/**
 * payment-choice.spec.ts — la mémoire du paiement en cours (D83).
 * ================================================================
 * Deux pages filles (le choix du moyen, la carte) et l'écran de paiement se
 * parlent par cette mémoire de processus : une page POUSSÉE ne retourne rien
 * à celle qui l'a poussée.
 *
 * LA RÈGLE QUE CES FICHES VERROUILLENT, et qui a été payée le 23/10 :
 *
 *     une fonction qui RÉPOND à une question n'ÉCRIT jamais.
 *
 * La première version avait un `resolvePaymentChoice` qui normalisait la
 * mémoire en répondant. Les écrans l'appelaient pour AFFICHER, donc pendant
 * leur rendu — donc elle prévenait ses abonnés pendant un rendu, et React
 * refuse : « Cannot update a component while rendering a different
 * component ». Le défaut n'est pas visible au typage, et le harnais ne rend
 * aucun composant : il ne pouvait être attrapé qu'ici, en comptant les
 * notifications.
 */
import {
  clearPaymentChoice,
  getIntentMethods,
  getPaymentChoice,
  getPendingIntent,
  isPaymentAuthorized,
  markPaymentAuthorized,
  resolvedChoice,
  setPaymentChoice,
  setPendingIntent,
  subscribePaymentChoice,
} from '@/lib/payment-choice';

const EMPREINTE = {
  clientSecret: 'pi_3ABC_secret_xyz',
  amountCents: 1105,
  currencyCode: 'EUR',
  types: ['card', 'paypal'],
};

beforeEach(() => {
  clearPaymentChoice();
});

describe('les lectures n’écrivent JAMAIS', () => {
  it('`resolvedChoice` répond sans prévenir un seul abonné', () => {
    const listener = jest.fn();
    subscribePaymentChoice(listener);
    expect(resolvedChoice(['card', 'paypal'])).toBe('card');
    expect(resolvedChoice([])).toBeNull();
    expect(listener).not.toHaveBeenCalled();
  });

  it('…et ne modifie pas la mémoire, même quand elle doit corriger le choix', () => {
    setPaymentChoice('paypal');
    // La liste ne porte plus PayPal : la réponse retombe sur la carte…
    expect(resolvedChoice(['card'])).toBe('card');
    // …mais la mémoire, elle, n'a pas bougé. C'est à l'écran de l'aligner,
    // explicitement, dans un effet.
    expect(getPaymentChoice()).toBe('paypal');
  });

  it('les autres lectures sont muettes elles aussi', () => {
    const listener = jest.fn();
    subscribePaymentChoice(listener);
    getPaymentChoice();
    getIntentMethods();
    getPendingIntent();
    isPaymentAuthorized();
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('le choix du moyen', () => {
  it('s’écrit et se relit', () => {
    setPaymentChoice('paypal');
    expect(getPaymentChoice()).toBe('paypal');
  });

  it('ne prévient pas les abonnés quand la valeur ne change PAS', () => {
    setPaymentChoice('card');
    const listener = jest.fn();
    subscribePaymentChoice(listener);
    setPaymentChoice('card');
    expect(listener).not.toHaveBeenCalled();
    setPaymentChoice('paypal');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('se désabonne vraiment', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePaymentChoice(listener);
    unsubscribe();
    setPaymentChoice('applePay');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('l’empreinte en cours', () => {
  it('porte le secret, le montant du devis et les moyens acceptés', () => {
    setPendingIntent(EMPREINTE);
    expect(getPendingIntent()).toEqual(EMPREINTE);
    expect(getIntentMethods()).toEqual(['card', 'paypal']);
  });

  it('sans empreinte, aucun moyen — et jamais `undefined`', () => {
    expect(getPendingIntent()).toBeNull();
    expect(getIntentMethods()).toEqual([]);
  });

  it('une intention NEUVE efface le drapeau d’autorisation', () => {
    setPendingIntent(EMPREINTE);
    markPaymentAuthorized();
    expect(isPaymentAuthorized()).toBe(true);
    // L'empreinte précédente n'existe plus : garder le drapeau ferait partir
    // la demande sur un identifiant mort.
    setPendingIntent({ ...EMPREINTE, clientSecret: 'pi_AUTRE_secret' });
    expect(isPaymentAuthorized()).toBe(false);
  });

  it('copie la liste reçue : une mutation du dehors ne la change pas', () => {
    const types = ['card'];
    setPendingIntent({ ...EMPREINTE, types });
    types.push('paypal');
    expect(getIntentMethods()).toEqual(['card']);
  });
});

describe('le drapeau d’autorisation', () => {
  it('est faux au départ, vrai une fois posé', () => {
    expect(isPaymentAuthorized()).toBe(false);
    markPaymentAuthorized();
    expect(isPaymentAuthorized()).toBe(true);
  });

  it('ne prévient qu’UNE fois : le reposer ne redéclenche aucun rendu', () => {
    const listener = jest.fn();
    subscribePaymentChoice(listener);
    markPaymentAuthorized();
    markPaymentAuthorized();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('est effacé par la remise à zéro du parcours', () => {
    markPaymentAuthorized();
    setPendingIntent(EMPREINTE);
    markPaymentAuthorized();
    clearPaymentChoice();
    expect(isPaymentAuthorized()).toBe(false);
    expect(getPendingIntent()).toBeNull();
    expect(getPaymentChoice()).toBeNull();
  });
});

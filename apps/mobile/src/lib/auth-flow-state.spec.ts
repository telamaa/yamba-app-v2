/**
 * auth-flow-state.spec.ts — les secrets COURTS des parcours d'auth.
 * ==================================================================
 * Transposition du `sessionStorage` du web : un jeton de vérification (15
 * min), un jeton de réinitialisation, l'e-mail de l'étape. Ils vivent en
 * mémoire de PROCESSUS et jamais en SecureStore — ce sont des jetons d'étape,
 * pas une session : l'app tuée, le parcours recommence, comme un onglet fermé.
 *
 * Deux propriétés valent une fiche chacune :
 *   • le préremplissage de connexion se CONSOMME (une fois, puis plus rien) ;
 *   • l'attente de réservation est bornée au trajet qui l'a posée — un retour
 *     de connexion trois écrans plus loin ne doit JAMAIS pousser un tunnel que
 *     personne n'a demandé (A58).
 */
import {
  clearPendingBooking,
  consumeLoginPrefill,
  getLoginEmail,
  getPendingRegistration,
  getPendingReset,
  setLoginEmail,
  setLoginPrefill,
  setPendingBooking,
  setPendingRegistration,
  setPendingReset,
  takePendingBooking,
} from '@/lib/auth-flow-state';

beforeEach(() => {
  setPendingRegistration(null);
  setPendingReset(null);
  setLoginEmail(null);
  consumeLoginPrefill();
});

describe('les jetons d’étape', () => {
  it('s’écrivent et se relisent tels quels', () => {
    setPendingRegistration({ email: 'awa@exemple.cg', password: 'Yamba!2027', verificationToken: 'tok' });
    expect(getPendingRegistration()).toEqual({
      email: 'awa@exemple.cg',
      password: 'Yamba!2027',
      verificationToken: 'tok',
    });
  });

  it('s’effacent explicitement — c’est l’appelant qui purge, pas un hasard', () => {
    setPendingReset({ email: 'awa@exemple.cg', passwordResetToken: 'reset' });
    setPendingReset(null);
    expect(getPendingReset()).toBeNull();
  });

  it('un mot de passe ABSENT est un cas prévu (le processus a redémarré)', () => {
    setPendingRegistration({ email: 'awa@exemple.cg', password: null, verificationToken: 'tok' });
    expect(getPendingRegistration()?.password).toBeNull();
  });

  it('l’email de l’étape identifier-first se relit à l’étape méthode', () => {
    setLoginEmail('awa@exemple.cg');
    expect(getLoginEmail()).toBe('awa@exemple.cg');
  });
});

describe('le préremplissage de connexion se CONSOMME', () => {
  it('rend la valeur une fois, puis plus rien', () => {
    setLoginPrefill({ email: 'awa@exemple.cg', notice: 'accountVerified' });
    expect(consumeLoginPrefill()).toEqual({ email: 'awa@exemple.cg', notice: 'accountVerified' });
    expect(consumeLoginPrefill()).toBeNull();
  });

  it('le dernier posé l’emporte — un seul message à l’arrivée', () => {
    setLoginPrefill({ email: 'a@b.cg', notice: 'accountVerified' });
    setLoginPrefill({ email: 'c@d.cg', notice: 'passwordChanged' });
    expect(consumeLoginPrefill()?.notice).toBe('passwordChanged');
  });
});

describe('l’attente de réservation est bornée au trajet qui l’a posée (A58)', () => {
  it('se prend UNE fois, et seulement pour le bon trajet', () => {
    setPendingBooking('trip-1');
    expect(takePendingBooking('trip-1')).toBe(true);
    expect(takePendingBooking('trip-1')).toBe(false);
  });

  it('ne pousse rien pour un AUTRE trajet — et ne consomme pas l’attente au passage', () => {
    setPendingBooking('trip-1');
    expect(takePendingBooking('trip-2')).toBe(false);
    expect(takePendingBooking('trip-1')).toBe(true);
  });

  it('se nettoie quand l’écran qui l’a posée se démonte', () => {
    setPendingBooking('trip-1');
    clearPendingBooking('trip-1');
    expect(takePendingBooking('trip-1')).toBe(false);
  });

  it('un nettoyage par un AUTRE écran ne retire pas l’attente du premier', () => {
    setPendingBooking('trip-1');
    clearPendingBooking('trip-2');
    expect(takePendingBooking('trip-1')).toBe(true);
  });

  it('sans attente posée, rien ne se déclenche', () => {
    expect(takePendingBooking('trip-1')).toBe(false);
  });
});

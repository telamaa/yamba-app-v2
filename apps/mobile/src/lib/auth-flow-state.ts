/**
 * auth-flow-state.ts — l'état des parcours d'auth à étapes (lot auth mobile).
 * ===========================================================================
 * La transposition du `sessionStorage` du web (RegisterForm, ResetVerifyForm) :
 * les secrets COURTS d'un parcours en cours — `verificationToken` (15 min),
 * `passwordResetToken` (15 min), l'e-mail de l'étape — vivent EN MÉMOIRE de
 * processus, jamais en SecureStore (ce sont des jetons d'étape, pas une
 * session : l'app tuée = le parcours recommence, comme un onglet fermé).
 * Le mot de passe d'inscription y transite UNIQUEMENT pour chaîner le login
 * automatique après l'OTP (le serveur n'ouvre pas de session à la
 * vérification) — purgé à la première utilisation.
 */

export type PendingRegistration = {
  email: string;
  /** Pour le login auto post-OTP ; absent si le processus a redémarré. */
  password: string | null;
  verificationToken: string;
};

export type PendingReset = {
  email: string;
  passwordResetToken: string | null;
};

export type LoginNotice = 'accountVerified' | 'passwordChanged';

export type LoginPrefill = {
  email: string;
  notice: LoginNotice;
};

let pendingRegistration: PendingRegistration | null = null;
let pendingReset: PendingReset | null = null;
let loginPrefill: LoginPrefill | null = null;

export const getPendingRegistration = () => pendingRegistration;
export const setPendingRegistration = (value: PendingRegistration | null) => {
  pendingRegistration = value;
};

export const getPendingReset = () => pendingReset;
export const setPendingReset = (value: PendingReset | null) => {
  pendingReset = value;
};

/** Posé par une étape qui aboutit hors session (OTP vérifié sans mot de passe
 *  en mémoire, reset réussi) ; l'écran de connexion le CONSOMME au focus. */
export const setLoginPrefill = (value: LoginPrefill) => {
  loginPrefill = value;
};
export const consumeLoginPrefill = (): LoginPrefill | null => {
  const value = loginPrefill;
  loginPrefill = null;
  return value;
};

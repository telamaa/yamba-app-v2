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
/** L'adresse confirmée à l'étape identifier-first, lue par l'étape méthode. */
let loginEmail: string | null = null;

export const getLoginEmail = () => loginEmail;
export const setLoginEmail = (value: string | null) => {
  loginEmail = value;
};

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

/**
 * Le trajet dont la RÉSERVATION attend une identité (A58, aligné sur le site).
 *
 * Le site ouvre « Connecte-toi pour réserver » au-dessus du trajet et revient
 * DIRECTEMENT dans le wizard. En natif, la feuille d'auth se referme sur
 * l'écran qui l'a ouverte : sans cette mémoire, le membre se reconnecte et
 * doit retrouver son geste lui-même. Elle vit en mémoire de processus, comme
 * tout ce fichier, et elle est bornée à l'écran qui l'a posée (il la nettoie
 * en se démontant) — un retour de connexion trois écrans plus loin ne doit
 * jamais pousser un tunnel que personne n'a demandé.
 */
let pendingBookingTripId: string | null = null;

export const setPendingBooking = (tripId: string) => {
  pendingBookingTripId = tripId;
};

/** Vrai UNE fois, et seulement pour le trajet qui avait posé l'attente. */
export const takePendingBooking = (tripId: string): boolean => {
  if (pendingBookingTripId !== tripId) return false;
  pendingBookingTripId = null;
  return true;
};

export const clearPendingBooking = (tripId: string) => {
  if (pendingBookingTripId === tripId) pendingBookingTripId = null;
};

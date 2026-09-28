/**
 * email.ts — la validation d'adresse partagée (lot auth mobile).
 * ==============================================================
 * Le miroir de la regex SERVEUR (auth.controller) et du web : trois écrans
 * la consommaient chacun sa copie — une seule source désormais. Le serveur
 * reste seul juge (RG-MOB-1) ; ceci ne sert qu'à allumer un bouton.
 */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isValidEmail = (value: string) => EMAIL_REGEX.test(value.trim().toLowerCase());

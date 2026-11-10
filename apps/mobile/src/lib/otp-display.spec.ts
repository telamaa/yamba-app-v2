/**
 * otp-display.spec.ts — un seul compte à rebours, et l'aide à l'heure (D92 6A).
 * =============================================================================
 * Ces règles n'ont aucune conséquence technique : elles ne cassent rien quand
 * on les défait, elles rendent juste l'écran légèrement plus anxiogène. C'est
 * exactement pour cela qu'elles ont besoin de fiches — une pastille remise
 * « pour que l'utilisateur sache » est le genre de retouche qu'on fait sans y
 * penser, et personne ne la verrait revenir.
 */
import { formatMMSS } from '@/hooks/use-countdown';

import {
  HELP_AFTER_SECONDS,
  OTP_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  VALIDITY_VISIBLE_SECONDS,
  resendPhase,
  showValidity,
} from './otp-display';

describe('la validité ne se montre qu’à sa dernière minute', () => {
  it('reste cachée tant que le code a du temps devant lui', () => {
    expect(showValidity(OTP_EXPIRY_SECONDS)).toBe(false);
    expect(showValidity(120)).toBe(false);
    expect(showValidity(VALIDITY_VISIBLE_SECONDS + 1)).toBe(false);
  });

  it('apparaît à la dernière minute — le moment où elle devient actionnable', () => {
    expect(showValidity(VALIDITY_VISIBLE_SECONDS)).toBe(true);
    expect(showValidity(30)).toBe(true);
  });

  it('se montre une fois le code expiré : c’est là qu’elle a quelque chose à dire', () => {
    expect(showValidity(0)).toBe(true);
  });

  it('le seuil est un ARGUMENT, pas une valeur gravée dans la règle', () => {
    // Une constante par défaut se déplace sans réécrire la règle (et une
    // fiche peut la déplacer sans toucher au produit).
    expect(showValidity(90, 120)).toBe(true);
  });
});

describe('les trois temps du bloc de renvoi', () => {
  it('les vingt premières secondes annoncent le délai normal', () => {
    // On vient d'envoyer le mail : accuser les spams à la seconde zéro
    // reproche à l'utilisateur un retard qui n'existe pas encore.
    expect(resendPhase(RESEND_COOLDOWN_SECONDS)).toBe('early');
    expect(resendPhase(RESEND_COOLDOWN_SECONDS - HELP_AFTER_SECONDS + 1)).toBe('early');
  });

  it('ensuite seulement, l’écran propose de chercher ailleurs', () => {
    expect(resendPhase(RESEND_COOLDOWN_SECONDS - HELP_AFTER_SECONDS)).toBe('waiting');
    expect(resendPhase(1)).toBe('waiting');
  });

  it('le geste n’apparaît qu’une fois disponible', () => {
    expect(resendPhase(0)).toBe('ready');
    // Un compteur négatif (horloge système reculée) reste un geste offert,
    // jamais un état inconnu.
    expect(resendPhase(-5)).toBe('ready');
  });

  it('les deux seuils sont des arguments', () => {
    expect(resendPhase(100, 120, 30)).toBe('early');
    expect(resendPhase(80, 120, 30)).toBe('waiting');
  });
});

describe('les compteurs s’écrivent de la même façon sur les deux fronts (D92)', () => {
  /**
   * Le défaut mesuré : le site écrivait `09:41` et le téléphone `9:29` pour
   * la même mécanique, parce que le `padStart` des MINUTES manquait côté
   * mobile. Deux fronts, deux largeurs — et une ligne qui sautille quand le
   * compteur passe sous la minute.
   */
  it.each([
    [600, '10:00'],
    [41, '00:41'],
    [581, '09:41'],
    [60, '01:00'],
    [9, '00:09'],
    [0, '00:00'],
  ])('%i seconde(s) → %s', (secondes, attendu) => {
    expect(formatMMSS(secondes)).toBe(attendu);
  });

  it('un compteur négatif ne s’écrit pas « -1:-1 »', () => {
    expect(formatMMSS(-30)).toBe('00:00');
  });
});

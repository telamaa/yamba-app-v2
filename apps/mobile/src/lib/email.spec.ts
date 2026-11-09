/**
 * email.spec.ts — la regex d'adresse, miroir du serveur.
 * ======================================================
 * Volontairement PERMISSIVE : elle n'allume qu'un bouton, le serveur juge
 * (RG-MOB-1). Ce qu'elle doit garantir, c'est de ne pas refuser une adresse
 * valable — un faux refus bloque une inscription sans recours.
 */
import { isValidEmail } from '@/lib/email';

describe('isValidEmail', () => {
  it('accepte les formes courantes, espaces et majuscules comprises', () => {
    expect(isValidEmail('awa@exemple.cg')).toBe(true);
    expect(isValidEmail('  Awa.Nkounkou+colis@Exemple.CG  ')).toBe(true);
    expect(isValidEmail('a@b.c')).toBe(true);
  });

  it('refuse ce qui ne PEUT pas être une adresse', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('awa')).toBe(false);
    expect(isValidEmail('awa@')).toBe(false);
    expect(isValidEmail('@exemple.cg')).toBe(false);
    expect(isValidEmail('awa@exemple')).toBe(false);
    expect(isValidEmail('awa exemple@cg.fr')).toBe(false);
    expect(isValidEmail('awa@@exemple.cg')).toBe(false);
  });
});

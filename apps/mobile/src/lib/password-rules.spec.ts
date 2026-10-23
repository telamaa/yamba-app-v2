/**
 * password-rules.spec.ts — le TROISIÈME miroir des huit critères.
 * ===============================================================
 * Le serveur juge (`apps/auth-service/src/utils/password-rules.ts`), le web
 * pré-valide, l'app pré-valide ici. Trois copies qui DOIVENT dire la même
 * chose : un mot de passe accepté à l'écran puis refusé par le serveur est un
 * refus que l'utilisateur ne peut pas comprendre.
 *
 * Ces fiches tiennent les huit critères, leur NOMBRE (le score en dépend) et
 * les quatre paliers. Elles couvrent aussi le critère le plus subtil : les
 * données personnelles, comparées sans accents ni casse.
 */
import {
  getPasswordChecks,
  getPasswordLevel,
  getPasswordScore,
  isPasswordValid,
} from '@/lib/password-rules';

describe('les huit critères', () => {
  it('sont bien huit — le score et les paliers en dépendent', () => {
    expect(Object.keys(getPasswordChecks(''))).toHaveLength(8);
  });

  it('un mot de passe solide les satisfait tous', () => {
    const checks = getPasswordChecks('Yamba!Vole2027');
    expect(isPasswordValid(checks)).toBe(true);
    expect(getPasswordScore(checks)).toBe(8);
  });

  it('les cinq critères de FORME se lisent un par un', () => {
    expect(getPasswordChecks('abcdefg').minLength).toBe(false);
    expect(getPasswordChecks('abcdefgh').minLength).toBe(true);
    expect(getPasswordChecks('ABCDEFGH').lowercase).toBe(false);
    expect(getPasswordChecks('abcdefgh').uppercase).toBe(false);
    expect(getPasswordChecks('Abcdefgh').number).toBe(false);
    expect(getPasswordChecks('Abcdefg1').special).toBe(false);
    expect(getPasswordChecks('Abcdefg1!').special).toBe(true);
  });
});

describe('le critère « données personnelles » — sans accents ni casse', () => {
  it('refuse le prénom, même accentué et en capitales', () => {
    const checks = getPasswordChecks('SÉRGE!2027x', { firstName: 'Serge' });
    expect(checks.personalInfo).toBe(false);
  });

  it('refuse la partie locale de l’email', () => {
    expect(getPasswordChecks('Awa.Colis!27', { email: 'awa.colis@exemple.cg' }).personalInfo).toBe(
      false
    );
  });

  it('ignore les fragments de moins de trois lettres — « Li » ne doit pas tout interdire', () => {
    expect(getPasswordChecks('Lithium!2027', { firstName: 'Li' }).personalInfo).toBe(true);
  });

  it('sans contexte, le critère est satisfait', () => {
    expect(getPasswordChecks('Lithium!2027').personalInfo).toBe(true);
  });
});

describe('les deux critères anti-prévisible', () => {
  it('refuse une date simple (six ou huit chiffres)', () => {
    expect(getPasswordChecks('Ab!120390').simpleDate).toBe(false);
    expect(getPasswordChecks('Ab!12031990').simpleDate).toBe(false);
    expect(getPasswordChecks('Ab!1203199').simpleDate).toBe(true);
  });

  it('refuse les suites et les claviers', () => {
    expect(getPasswordChecks('Ab!1234xy').predictable).toBe(false);
    expect(getPasswordChecks('Azerty!27x').predictable).toBe(false);
    expect(getPasswordChecks('MotDePasse!27').predictable).toBe(false);
  });

  it('refuse trois fois le même caractère de suite', () => {
    expect(getPasswordChecks('Yaaamba!27').predictable).toBe(false);
    expect(getPasswordChecks('Yaamba!27').predictable).toBe(true);
  });
});

describe('les paliers', () => {
  it('un champ vide n’est pas « faible », il est VIDE — on ne juge pas une saisie absente', () => {
    expect(getPasswordLevel('', 0)).toBe('empty');
  });

  it('montent avec le score, et le maximum n’est atteint qu’à huit', () => {
    expect(getPasswordLevel('x', 4)).toBe('weak');
    expect(getPasswordLevel('x', 5)).toBe('medium');
    expect(getPasswordLevel('x', 6)).toBe('medium');
    expect(getPasswordLevel('x', 7)).toBe('strong');
    expect(getPasswordLevel('x', 8)).toBe('excellent');
  });

  it('un mot de passe VALIDE est forcément « excellent » (les huit critères = le score maximum)', () => {
    const password = 'Yamba!Vole2027';
    const checks = getPasswordChecks(password);
    expect(isPasswordValid(checks)).toBe(true);
    expect(getPasswordLevel(password, getPasswordScore(checks))).toBe('excellent');
  });
});

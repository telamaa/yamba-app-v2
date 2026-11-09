/**
 * country-name.spec.ts — le nom et le drapeau d'un pays, depuis son code.
 * =======================================================================
 * Partir du CODE est un choix : c'est la seule donnée que le DTO de recherche
 * transporte, et `Intl` la traduit pour chaque visiteur. La règle qui compte
 * ici est le REPLI : jamais le code brut à l'écran (« CG » n'aide personne),
 * jamais un crash sur un code malformé.
 */
import { countryFlag, countryName } from '@/lib/country-name';

describe('countryName', () => {
  it('traduit dans la langue demandée', () => {
    expect(countryName('CG', 'fr')).toBe('Congo-Brazzaville');
    expect(countryName('FR', 'en')).toBe('France');
  });

  it('accepte un code en minuscules', () => {
    expect(countryName('fr', 'fr')).toBe('France');
  });

  it('rend null plutôt que le code brut quand la région est inconnue', () => {
    // `.of()` rend le code TEL QUEL pour une région qu'il ne nomme pas : c'est
    // ce retour-là que le module reconnaît et convertit en `null`.
    expect(countryName('QQ', 'fr')).toBeNull();
  });

  it('mesuré : « ZZ » est le seul code sans pays que CLDR NOMME quand même', () => {
    // CLDR définit ZZ (« région inconnue ») : le garde-fou du module ne peut
    // donc pas l'attraper, puisque le nom rendu diffère bien du code. Aucun
    // chemin ne sert ZZ aujourd'hui (les codes viennent de l'autocomplétion de
    // lieux), et inventer une liste noire coûterait plus que ce qu'elle évite.
    // La mesure est ici pour que personne ne la refasse.
    expect(countryName('ZZ', 'fr')).toBe('région inconnue');
  });

  it('rend null sur une absence ou un code malformé, sans lever', () => {
    expect(countryName(null, 'fr')).toBeNull();
    expect(countryName(undefined, 'fr')).toBeNull();
    expect(countryName('', 'fr')).toBeNull();
    expect(countryName('FRANCE', 'fr')).toBeNull();
  });

  it('survit à une locale inconnue du moteur', () => {
    expect(() => countryName('FR', 'xx-YY-zz')).not.toThrow();
  });
});

describe('countryFlag — deux lettres, un emoji, aucune image embarquée', () => {
  it('assemble la paire d’indicateurs régionaux', () => {
    expect(countryFlag('FR')).toBe('🇫🇷');
    expect(countryFlag('cg')).toBe('🇨🇬');
  });

  it('un drapeau est décoratif : il ne casse jamais une ligne de texte', () => {
    expect(countryFlag(null)).toBeNull();
    expect(countryFlag('')).toBeNull();
    expect(countryFlag('F')).toBeNull();
    expect(countryFlag('FRA')).toBeNull();
    expect(countryFlag('F1')).toBeNull();
  });
});

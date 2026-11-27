/**
 * barre-qui-se-nomme.spec.ts — la barre d'onglets nomme ses destinations,
 * et sa géométrie ne dépend plus d'un signal invisible (D109).
 * ========================================================================
 * Née d'une autopsie demandée par l'utilisateur, deux constats en ouverture :
 * « il y a le texte que sur l'icône active » et « le bouton + n'est pas pro ».
 *
 * Ce que ces fiches épinglent est la RÈGLE, pas l'effet du jour (leçon D98,
 * où l'effet a changé cinq fois en une journée). Concrètement : que les cinq
 * onglets se nomment, que le texte soit au-dessus des minimums des deux
 * plateformes, que la hauteur de la barre reste une SOMME, et qu'un objet
 * graphique atteigne le contraste que la norme lui demande.
 *
 * Lecture des composants par `readFileSync` : une fiche ne peut pas importer
 * `tab-bar.tsx`, qui tire `react-native` — le harnais est `testEnvironment:
 * node` (A223). C'est pour cela que les mesures vivent dans un module pur,
 * comme `back-affordance.ts` l'a fait pour le retour (D105) : quand un test
 * ne peut pas charger votre code, il vous dit où est la frontière.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  BAR_BREATHING,
  ICON_SIZE,
  INDICATOR_HEIGHT,
  LABEL_LINE_HEIGHT,
  LABEL_SIZE,
  BAR_DARK,
  BAR_LIGHT,
  MARK_BG,
  MARK_BG_DEEP,
  MARK_GLYPH,
  MARK_INK,
  MARK_SIZE,
  STACK_GAP,
  barHeight,
  markBackground,
  labelRatio,
} from '@/lib/tab-bar-geometry';

const MOBILE = resolve(__dirname, '../..');
const BARRE = join(MOBILE, 'src/components/tab-bar.tsx');
const THEME = join(MOBILE, 'src/constants/theme.ts');
const FICHE_TYPO = join(MOBILE, 'src/lib/typography.spec.ts');

const lire = (chemin: string) => readFileSync(chemin, 'utf8');

/** Luminance relative WCAG d'une couleur `#rrggbb`. */
function luminance(hex: string): number {
  const canaux = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = canaux.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contraste(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('les cinq onglets se nomment', () => {
  it('le libellé n’est PAS conditionné à la sélection', () => {
    /**
     * Le défaut d'origine, et c'est le plus coûteux du lot : D88 2A montrait
     * le mot sur l'onglet ACTIF, c'est-à-dire là où il ne sert à rien —
     * l'écran dit déjà où l'on est — pendant que les quatre destinations
     * possibles restaient anonymes, dont deux que le fichier reconnaissait
     * lui-même indevinables (le cube, le squircle).
     *
     * On vise la FORME qui le produisait (`{focused && <...Text`), pas un
     * libellé particulier : c'est elle qui reviendrait.
     */
    const source = lire(BARRE);
    expect(source).not.toMatch(/\{focused &&\s*\(?\s*<Animated\.Text/);
    expect(source).not.toMatch(/labelSlot/);
  });

  it('les cinq routes ont un mot, dans les DEUX langues', () => {
    /**
     * Première écriture de cette fiche : compter les occurrences de
     * `{label}` dans la source. Elle comptait aussi `accessibilityLabel` et
     * partait au rouge pour rien — une fiche qui vise une ORTHOGRAPHE, pour
     * la sixième fois ce mois-ci. Ce qui compte n'est pas combien de fois la
     * chaîne apparaît : c'est que chaque onglet ait un mot à afficher.
     */
    const source = lire(BARRE);
    const cles = [...source.matchAll(/labelKey: '([a-z]+)'/g)].map((m) => m[1]);
    expect(cles).toEqual(['home', 'favorites', 'publish', 'activity', 'messages']);

    for (const langue of ['fr', 'en']) {
      const dico = JSON.parse(lire(join(MOBILE, `messages/${langue}/tabs.json`)));
      for (const cle of cles) {
        expect(typeof dico.bar?.[cle]).toBe('string');
        expect(dico.bar[cle].length).toBeGreaterThan(0);
      }
    }
  });

  it('la sélection garde TROIS signaux non colorés', () => {
    // WCAG 1.4.1 : l'état ne doit pas tenir à la seule couleur. Glyphe plein
    // contre contour (une FORME), encre contre gris, et graisse du mot.
    const source = lire(BARRE);
    expect(source).toContain('focused ? onglet.on : onglet.off');
    expect(source).toContain('focused ? actif : theme.textSecondary');
    expect(source).toContain('labelFocused');
  });
});

describe('le texte est au-dessus des minimums, et l’exception a disparu', () => {
  it('le libellé fait au moins 10 pt', () => {
    // 10 pt est le minimum d'un libellé d'onglet iOS ; Material 3 descend à
    // 11 sp. Les 9 pt d'avant n'étaient pas un choix typographique : ils
    // étaient le reste d'une fente de 11.
    expect(LABEL_SIZE).toBeGreaterThanOrEqual(10);
  });

  it('son interligne tient le plancher maison de 1,35', () => {
    expect(labelRatio()).toBeGreaterThanOrEqual(1.35);
  });

  it('`typography.spec.ts` n’exempte PLUS la barre — c’est la mesure du lot', () => {
    /**
     * L'exception existait, et sa raison écrite n'était pas une propriété du
     * texte mais un COÛT : « toucher à la fente rouvre D88 ». Une exception
     * qui parle du coût du changement est une dette qui a trouvé où se
     * cacher — et la fiche qui la porte la reconduit à chaque passage.
     */
    expect(lire(FICHE_TYPO)).not.toContain("'components/tab-bar.tsx'");
  });
});

describe('la hauteur de la barre est une somme, pas un nombre', () => {
  it('elle se recalcule depuis ses termes', () => {
    expect(barHeight()).toBe(INDICATOR_HEIGHT + STACK_GAP + LABEL_LINE_HEIGHT + BAR_BREATHING * 2);
  });

  it('l’indicateur loge l’icône, et RIEN d’autre', () => {
    // C'est le geste structurel de D109 : tant que l'indicateur contenait le
    // mot, la taille du texte était dictée par une hauteur de pilule.
    expect(INDICATOR_HEIGHT).toBeGreaterThanOrEqual(ICON_SIZE);
    expect(INDICATOR_HEIGHT).toBeLessThan(ICON_SIZE + LABEL_LINE_HEIGHT);
  });

  it('le thème ne réécrit pas la hauteur à la main', () => {
    // Un nombre posé une fois devient la contrainte de tout ce qu'il
    // contient : c'est exactement comment 52 a produit 9 pt de police.
    const source = lire(THEME);
    expect(source).toContain('height: barHeight()');
    expect(source).not.toMatch(/height:\s*\d+,\s*\n\s*\/\*\* Son écart/);
  });

  it('la cible tactile reste la cellule entière', () => {
    // Acquis de D88 à ne pas perdre : 64 × 60, bien au-delà des 44 pt
    // qu'exige RG-D105-2.
    expect(barHeight()).toBeGreaterThanOrEqual(44);
    expect(lire(BARRE)).toMatch(/hit: \{[\s\S]*?flex: 1,/);
  });
});

describe('la marque « Publier » est dessinée, pas collée', () => {
  it('aucune image matricielle dans la barre', () => {
    /**
     * `tab-publish.png` en @1x/@2x/@3x, sans source vectorielle ni variante
     * sombre, était le seul élément de la barre que le thème ne gouvernait
     * pas : ni teinte, ni état pressé, ni Dynamic Type.
     */
    const source = lire(BARRE);
    expect(source).not.toContain('tab-publish');
    expect(source).not.toMatch(/require\(.*\.png.*\)/);
    expect(source).not.toContain("from 'expo-image'");
  });

  it('elle pèse plus que les quatre contours — c’est ce qui en fait une action', () => {
    expect(MARK_SIZE).toBeGreaterThan(ICON_SIZE);
  });

  it('son glyphe atteint les 3:1 de WCAG 1.4.11', () => {
    // Mesuré avant de choisir : du BLANC sur cette mangue vaut 2,14:1 et
    // échoue. L'encre retenue est déjà celle de la pastille de badge de cette
    // barre — on suit le précédent de la maison plutôt que d'en inventer un.
    expect(contraste(MARK_INK, MARK_BG)).toBeGreaterThanOrEqual(3);
    expect(contraste('#FFFFFF', MARK_BG)).toBeLessThan(3);
  });

  it('le glyphe tient dans le squircle avec de la marge', () => {
    expect(MARK_GLYPH).toBeLessThan(MARK_SIZE);
    expect(MARK_SIZE - MARK_GLYPH).toBeGreaterThanOrEqual(8);
  });

  it('elle porte un état actif, comme les quatre autres', () => {
    // Le code disait « la même image qu'on y soit ou non ». Mais `publish`
    // EST un onglet : il se sélectionne, et il lui manquait justement le
    // signal le plus fort.
    expect(lire(BARRE)).toContain('markBackground(dark, focused)');
  });
});

describe('la marque change de teinte selon le THÈME, pas seulement l’état', () => {
  /**
   * Trouvé en REGARDANT le mode sombre, pas en relisant le code : l'état
   * actif employait `mangoDark`, dont le jeton dit lui-même « pour l'état
   * actif sur fond CLAIR ». Sur une barre sombre, assombrir rend la marque
   * moins visible au moment où elle doit l'être le plus — défaut ① de D88,
   * rejoué sur la même barre : un même jeton ne vaut pas sur deux supports.
   */
  it('l’état actif s’ÉLOIGNE toujours de la luminance de sa barre', () => {
    const clair = contraste(markBackground(false, true), BAR_LIGHT);
    const clairRepos = contraste(markBackground(false, false), BAR_LIGHT);
    expect(clair).toBeGreaterThan(clairRepos);

    const sombre = contraste(markBackground(true, true), BAR_DARK);
    const sombreRepos = contraste(markBackground(true, false), BAR_DARK);
    expect(sombre).toBeGreaterThan(sombreRepos);
  });

  it('les deux thèmes n’utilisent PAS la même paire', () => {
    // Le défaut tenait précisément à croire que si.
    expect(markBackground(false, true)).toBe(MARK_BG_DEEP);
    expect(markBackground(true, true)).toBe(MARK_BG);
  });

  it('l’état actif atteint les 3:1 dans les DEUX thèmes', () => {
    expect(contraste(markBackground(false, true), BAR_LIGHT)).toBeGreaterThanOrEqual(3);
    expect(contraste(markBackground(true, true), BAR_DARK)).toBeGreaterThanOrEqual(3);
  });

  it('le glyphe reste lisible sur les DEUX mangues', () => {
    expect(contraste(MARK_INK, MARK_BG)).toBeGreaterThanOrEqual(3);
    expect(contraste(MARK_INK, MARK_BG_DEEP)).toBeGreaterThanOrEqual(3);
  });
});

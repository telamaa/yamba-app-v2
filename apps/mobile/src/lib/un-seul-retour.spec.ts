/**
 * un-seul-retour.spec.ts — un même geste ne porte pas quatre costumes (D105).
 * ============================================================================
 * Retour de recette : « sur la page profil la flèche ajoutée est différente
 * des autres ». L'utilisateur avait raison, et c'était pire que cet écran —
 * l'inventaire a trouvé QUATRE variantes du même geste :
 *
 *   chevron 20 px (paiement) · 22 px (étape, envoi) · 26 px (ville, date)
 *   · et un LIEN TEXTE « ‹ Retour » (profil, puis la porte d'identité).
 *
 * Trois zones tactiles (`hitSlop` 8, 10, 12), et deux écrans sans aucun nom
 * accessible. Rien n'avait été décidé : chaque écran avait recopié son voisin.
 *
 * **Une incohérence de charte ne se voit pas en LISANT le code, elle se voit
 * en le COMPTANT.** Cette fiche compte à la place de l'œil.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { BACK_BOX_SIZE, BACK_HIT_SLOP, BACK_ICON_SIZE } from '@/lib/back-affordance';

const SRC = resolve(__dirname, '..');

function sources(dossier: string = SRC): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return sources(chemin);
    return chemin.endsWith('.tsx') ? [chemin] : [];
  });
}

/**
 * Les deux SEULS fichiers autorisés à dessiner un chevron de retour :
 *  · le composant partagé lui-même ;
 *  · l'écran d'auth, dont le glyphe ALTERNE entre « fermer » et « retour »
 *    selon la façon dont la feuille a été ouverte — c'est une fermeture, pas
 *    un retour, et la nommer ici vaut mieux qu'un motif large.
 */
const EXCEPTIONS = ['components/back-button.tsx', 'components/auth/auth-screen.tsx'];

describe('1A — un seul dessin du retour dans toute l’application', () => {
  it('aucun écran ne dessine son propre chevron', () => {
    const fautifs = sources()
      .map((f) => relative(SRC, f))
      .filter((rel) => !EXCEPTIONS.includes(rel))
      .filter((rel) => readFileSync(join(SRC, rel), 'utf8').includes('chevron-back'));
    expect(fautifs).toEqual([]);
  });

  it('aucun écran ne refait le lien texte « ‹ Retour »', () => {
    // Le quatrième costume, celui que l'utilisateur a repéré.
    const fautifs = sources()
      .map((f) => relative(SRC, f))
      .filter((rel) => readFileSync(join(SRC, rel), 'utf8').includes('‹ {t('));
    expect(fautifs).toEqual([]);
  });

  it('le composant partagé est bien UTILISÉ, et pas qu’écrit', () => {
    // Une règle extraite que personne n'appelle ne protège rien.
    const consommateurs = sources().filter((f) =>
      readFileSync(f, 'utf8').includes('<BackButton')
    );
    expect(consommateurs.length).toBeGreaterThanOrEqual(8);
  });
});

describe('les mesures ne varient plus', () => {
  it('une seule taille d’icône, nommée une fois', () => {
    expect(BACK_ICON_SIZE).toBe(22);
  });

  it('une seule zone tactile, assez grande pour le pouce', () => {
    // 22 px d'icône + 12 pt de part et d'autre ≈ les 44 pt du système.
    expect(BACK_HIT_SLOP).toBe(12);
    expect(BACK_ICON_SIZE + 2 * BACK_HIT_SLOP).toBeGreaterThanOrEqual(44);
  });

  it('le composant ne laisse pas régler la taille depuis l’extérieur', () => {
    // C'est par là qu'une charte se défait : une prop `size` et chacun
    // reprend la sienne.
    const source = readFileSync(join(SRC, 'components/back-button.tsx'), 'utf8');
    expect(source).not.toMatch(/size\?:\s*number/);
  });
});

describe('2A — le nom accessible ne peut plus être oublié', () => {
  const composant = readFileSync(join(SRC, 'components/back-button.tsx'), 'utf8');

  it('le libellé est REQUIS par la signature', () => {
    // D98 2A : quand le texte visible disparaît, le bouton perd son NOM.
    // `city.tsx` et `date.tsx` rendaient un chevron nu sans aucun nom — un
    // lecteur d'écran y annonçait « bouton », sans plus.
    expect(composant).toContain('label: string;');
    expect(composant).not.toContain('label?: string');
  });

  it('il est posé sur le bouton, pas seulement reçu', () => {
    expect(composant).toContain('accessibilityLabel={label}');
    expect(composant).toContain('accessibilityRole="button"');
  });

  it('chaque appel passe un libellé non vide', () => {
    const appels = sources().flatMap((f) => {
      const source = readFileSync(f, 'utf8');
      return [...source.matchAll(/<BackButton[^/]*?\/>/gs)].map((m) => [relative(SRC, f), m[0]]);
    });
    expect(appels.length).toBeGreaterThanOrEqual(8);
    for (const [nom, appel] of appels) {
      expect(`${nom} ${appel}`).toMatch(/label=\{[^}]+\}/);
      expect(appel).not.toMatch(/label=""/);
    }
  });
});

describe('4A — la seule différence conservée a une raison', () => {
  const composant = readFileSync(join(SRC, 'components/back-button.tsx'), 'utf8');

  it('deux variantes, pas plus', () => {
    // `boxed` existe parce que le chevron FLOTTE sur du contenu et a besoin
    // d'un fond pour rester lisible. `bare` vit dans une rangée d'en-tête.
    expect(composant).toContain("variant?: 'bare' | 'boxed'");
  });

  it('le disque garde les 36 px qu’il avait partout', () => {
    // Trois écrans de paiement et le cadre d'étape le dessinaient déjà ainsi :
    // on ne change pas ce qui était déjà cohérent.
    expect(BACK_BOX_SIZE).toBe(36);
    expect(composant).toContain('BACK_BOX_SIZE');
  });
});

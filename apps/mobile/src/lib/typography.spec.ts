/**
 * typography.spec.ts — la police de la marque, et les trois façons de la perdre (D95).
 * ====================================================================================
 * Le danger de ce lot n'est pas qu'il casse : c'est qu'il se DÉFASSE en
 * silence. React Native ne se plaint jamais d'une famille de police inconnue
 * — il retombe sur la police système, sans avertissement, sans erreur, sans
 * rien dans les journaux. Un écran écrit demain avec `fontWeight: 600` sera
 * simplement composé dans une autre police que ses voisins, et personne ne le
 * verra avant une capture côte à côte.
 *
 * Trois façons de perdre la police, trois fiches :
 *   ① un `fontWeight` réapparaît quelque part dans `src/` ;
 *   ② un nom de famille est écrit à la main au lieu de passer par `Font` ;
 *   ③ `Font` et `FONT_ASSETS` divergent — un niveau déclaré mais jamais
 *     chargé compose en police système, et c'est le cas le plus sournois
 *     puisque les quatre autres sont justes.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

import { FONT_ASSETS, Font, fontFor } from '@/constants/typography';

const SRC = resolve(__dirname, '..');

/** Le seul `fontWeight` légitime : il porte sur la famille MONO (D95). */
const EXCEPTION_MONO = 'components/themed-text.tsx';
/** Ces fichiers PARLENT des graisses, ils n'en posent pas. */
const QUI_EN_PARLENT = ['constants/typography.ts', 'lib/typography.spec.ts', 'lib/auth-verify-parite.spec.ts'];

function sources(): string[] {
  const out: string[] = [];
  const marcher = (dir: string): void => {
    for (const nom of readdirSync(dir)) {
      const chemin = join(dir, nom);
      if (statSync(chemin).isDirectory()) marcher(chemin);
      else if (['.ts', '.tsx'].includes(extname(nom))) out.push(chemin);
    }
  };
  marcher(SRC);
  return out;
}

describe('① plus aucun `fontWeight` dans l’application', () => {
  it('seul le style MONO en porte encore un, et il est nommé', () => {
    const fautifs = sources()
      .filter((f) => {
        const rel = relative(SRC, f);
        if (rel === EXCEPTION_MONO || QUI_EN_PARLENT.includes(rel)) return false;
        return readFileSync(f, 'utf8').includes('fontWeight');
      })
      .map((f) => relative(SRC, f));
    // Un `fontWeight` posé À CÔTÉ d'une famille nommée déclenche un gras de
    // SYNTHÈSE sur Android : le système épaissit un dessin déjà épais, et le
    // résultat ne ressemble à aucune des deux graisses.
    expect(fautifs).toEqual([]);
  });

  it('le mono garde le sien pour une raison écrite dans le fichier', () => {
    const source = readFileSync(join(SRC, EXCEPTION_MONO), 'utf8');
    expect(source).toContain('fontFamily: Fonts.mono');
    expect(source).toContain('fontWeight');
  });
});

describe('② personne n’écrit un nom de police à la main', () => {
  it('« PlusJakartaSans_ » n’apparaît que là où les familles sont DÉCLARÉES', () => {
    const fautifs = sources()
      .filter((f) => !QUI_EN_PARLENT.includes(relative(SRC, f)))
      .filter((f) => readFileSync(f, 'utf8').includes('PlusJakartaSans_'))
      .map((f) => relative(SRC, f));
    // Une chaîne recopiée se démode toute seule : le jour où une graisse
    // change de fichier, `Font` suit et la recopie reste en arrière.
    expect(fautifs).toEqual([]);
  });
});

describe('③ tout niveau déclaré est un niveau CHARGÉ', () => {
  it('les clés de FONT_ASSETS sont exactement les valeurs de Font', () => {
    // C'est le seul lien entre le nom et le fichier. Une faute de frappe y
    // serait invisible : React Native retomberait sur la police système, en
    // silence, pour ce niveau-là seulement.
    expect(Object.keys(FONT_ASSETS).sort()).toEqual(Object.values(Font).sort());
  });

  it('chaque niveau pointe un fichier réellement embarqué', () => {
    for (const [nom, actif] of Object.entries(FONT_ASSETS)) {
      // Metro rend un identifiant numérique pour un `require` d'actif ; sous
      // Node il rend le chemin. Dans les deux cas : défini et non vide.
      expect(actif).toBeDefined();
      expect(String(actif).length).toBeGreaterThan(0);
      expect(nom.startsWith('PlusJakartaSans_')).toBe(true);
    }
  });

  it('`fontFor` couvre les cinq graisses et ne rend jamais rien d’inconnu', () => {
    const connues = Object.values(Font);
    for (const poids of [400, 500, 600, 700, 800] as const) {
      expect(connues).toContain(fontFor(poids));
    }
  });

  it('les cinq niveaux sont DISTINCTS — deux alias rendraient un écran plat', () => {
    expect(new Set(Object.values(Font)).size).toBe(Object.values(Font).length);
  });
});

describe('le site et le téléphone composent dans la MÊME police', () => {
  it('le nom de la famille du web se retrouve côté mobile', () => {
    const web = readFileSync(resolve(SRC, '../../user-ui/src/app/layout.tsx'), 'utf8');
    // Le web l'importe de `next/font/google` sous son nom à underscores.
    expect(web).toContain('Plus_Jakarta_Sans');
    for (const famille of Object.values(Font)) {
      expect(famille.startsWith('PlusJakartaSans_')).toBe(true);
    }
  });
});

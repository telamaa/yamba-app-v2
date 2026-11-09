/**
 * splash.spec.ts — l'écran de démarrage, et l'accord de ses DEUX moitiés.
 * ========================================================================
 * Le démarrage de Yamba est dessiné à deux endroits qui ne se parlent pas :
 *
 *   ① le splash NATIF, décrit dans `app.json` et compilé dans l'application
 *      (c'est lui que le système affiche avant que le moindre JavaScript ne
 *      tourne) ;
 *   ② le splash JS (`components/app-splash.tsx`), qui le PROLONGE pendant
 *      l'amorçage réel de la session.
 *
 * L'utilisateur ne voit qu'un écran. S'ils divergent — une couleur, une
 * taille — le logo saute ou le fond clignote à la bascule, et personne ne
 * sait dire pourquoi : les deux fichiers sont justes, pris séparément.
 *
 * Rien ne surveille cet accord. `tsc` ne lit pas `app.json`, le harnais ne
 * rend aucun écran (A223), et la bascule dure deux dixièmes de seconde.
 * D'où ces fiches, qui lisent les DEUX fichiers comme du texte.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP = resolve(__dirname, '../..');

type SplashConfig = {
  backgroundColor: string;
  image: string;
  imageWidth: number;
  dark?: { backgroundColor: string; image: string };
};

/** La configuration du greffon `expo-splash-screen`, telle qu'elle sera compilée. */
function splashConfig(): SplashConfig {
  const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as {
    expo: { plugins: (string | [string, Record<string, unknown>])[] };
  };
  const entree = appJson.expo.plugins.find(
    (p): p is [string, Record<string, unknown>] =>
      Array.isArray(p) && p[0] === 'expo-splash-screen'
  );
  if (entree === undefined) throw new Error('greffon expo-splash-screen absent d’app.json');
  return entree[1] as SplashConfig;
}

const MANGO = '#FF9900';

describe('le splash natif ne porte plus la marque en aplat (D90)', () => {
  it('① le fond est celui de la PAGE, jamais le mango', () => {
    // La rupture que D88 6A avait supprimée de l'écran de bienvenue : ouvrir
    // sur un aplat de marque pour atterrir sur une page blanche.
    const { backgroundColor, dark } = splashConfig();
    expect(backgroundColor.toUpperCase()).not.toBe(MANGO);
    expect(dark?.backgroundColor.toUpperCase()).not.toBe(MANGO);
  });

  it('② les DEUX thèmes sont déclarés — un splash blanc devant une app sombre éblouit', () => {
    const { backgroundColor, dark } = splashConfig();
    expect(backgroundColor.toLowerCase()).toBe('#ffffff');
    expect(dark).toBeDefined();
    expect(dark?.backgroundColor.toLowerCase()).toBe('#000000');
  });

  it('③ les deux images déclarées existent vraiment sur le disque', () => {
    // Un chemin faux ne casse rien au build : le splash s'affiche VIDE.
    const { image, dark } = splashConfig();
    for (const chemin of [image, dark?.image]) {
      expect(chemin).toBeDefined();
      expect(existsSync(join(APP, chemin as string))).toBe(true);
    }
  });
});

/**
 * Les deux cadrages, mesurés sur les sources vectorielles — ce sont EUX qui
 * rendent les deux tailles comparables, et ils ne se devinent pas :
 *
 *   • `splash-icon.png` est dessiné dans un carré de 240 (scripts/
 *     generate-brand-icons.mjs) où le Y s'étend de x=49 à x=191, demi-trait
 *     compris : 142 / 240 ;
 *   • `yamba-symbol.svg` est cadré SERRÉ — fenêtre de 192 de large, Y de
 *     x=28 à x=212 : 184 / 192.
 *
 * Si le DESSIN change, ces deux rapports sont à recalculer ; la fiche ④
 * ci-dessous vérifie justement que le tracé n'a pas bougé sous eux.
 */
const CADRAGE_PNG = 142 / 240;
const CADRAGE_SVG = 184 / 192;

/** Le nombre déclaré dans un fichier, lu tel quel (jamais importé : RN ici ne charge pas). */
function nombre(fichier: string, motif: RegExp): number {
  const source = readFileSync(join(APP, fichier), 'utf8');
  const trouve = source.match(motif);
  if (trouve === null) throw new Error(`motif introuvable dans ${fichier} : ${String(motif)}`);
  return Number(trouve[1]);
}

describe('les deux moitiés de l’écran montrent le MÊME logo à la MÊME taille', () => {
  it('④ le tracé du splash n’a pas bougé sous les rapports de cadrage', () => {
    const generateur = readFileSync(resolve(APP, '../../scripts/generate-brand-icons.mjs'), 'utf8');
    expect(generateur).toContain('M60 60 C69 108 91 130 120 130 C149 130 171 108 180 60 M120 130 V186');
    const symbole = readFileSync(join(APP, 'assets/images/yamba-symbol.svg'), 'utf8');
    expect(symbole).toContain('viewBox="24 24 192 200"');
    expect(symbole).toContain('d="M40 40 C52 100 80 128 120 128 C160 128 188 100 200 40 M120 128 V210"');
  });

  it('⑤ 76 px de natif et 47 px de JS rendent le même glyphe, à 1 px près', () => {
    const natif = nombre('app.json', /"imageWidth":\s*(\d+)/);
    const js = nombre('src/components/app-splash.tsx', /TAILLE_SYMBOLE\s*=\s*(\d+)/);

    const glypheNatif = natif * CADRAGE_PNG;
    const glypheJs = js * CADRAGE_SVG;

    // Changer l'un sans l'autre fait SAUTER le logo au passage du natif au JS.
    expect(Math.abs(glypheNatif - glypheJs)).toBeLessThanOrEqual(1);
  });

  it('⑥ le splash JS suit le thème au lieu de figer une couleur de marque', () => {
    const source = readFileSync(join(APP, 'src/components/app-splash.tsx'), 'utf8');
    expect(source).toContain('useColorScheme');
    expect(source).not.toContain('Brand.mango');
  });
});

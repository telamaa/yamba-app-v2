/**
 * porte-avec-sortie.spec.ts — une porte n'enferme pas celui qu'elle arrête (D104).
 * =================================================================================
 * Retour de recette, six mots : « on ne peut pas revenir en arrière ».
 *
 * `profile.tsx` déclarait son bouton de retour DANS `ProfileContent`, puis
 * enveloppait ce composant dans `<IdentityGate>`. Un visiteur non connecté
 * voit la porte, jamais le contenu — donc jamais le bouton. La règle était
 * écrite, juste, et placée du mauvais côté de la condition.
 *
 * Le défaut n'était dans AUCUN des deux fichiers pris séparément : le retour
 * est correct, la porte est correcte, c'est leur composition qui enferme.
 * D'où un balayage plutôt qu'une correction ponctuelle — le prochain écran
 * poussé derrière une porte partira au rouge avant d'atteindre un simulateur.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const APP = resolve(__dirname, '../app');

/** Tous les écrans de `src/app`, chemin relatif compris. */
function ecrans(dossier: string = APP): string[] {
  return readdirSync(dossier).flatMap((entree) => {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) return ecrans(chemin);
    return chemin.endsWith('.tsx') ? [chemin] : [];
  });
}

const gardes = ecrans().filter((f) => readFileSync(f, 'utf8').includes('<IdentityGate'));

/** Un écran d'ONGLET garde sa barre : elle EST sa sortie. */
const estUnOnglet = (chemin: string) => relative(APP, chemin).includes('(tabs)');

describe('le balayage trouve bien les écrans gardés', () => {
  it('il y en a, et le balayage ne rend pas une liste vide', () => {
    // Une fiche de balayage qui ne balaie rien est verte pour la pire des
    // raisons : si le composant est renommé, c'est ICI qu'on doit le voir.
    expect(gardes.length).toBeGreaterThanOrEqual(5);
  });

  it('Profil en fait partie, et il n’est PAS un onglet', () => {
    const profil = gardes.find((f) => relative(APP, f) === 'profile.tsx');
    expect(profil).toBeDefined();
    expect(estUnOnglet(profil as string)).toBe(false);
  });
});

describe('tout écran POUSSÉ derrière la porte sait se refermer', () => {
  const pousses = gardes.filter((f) => !estUnOnglet(f));

  it('il y en a au moins un — sinon la règle ne garde rien', () => {
    expect(pousses.length).toBeGreaterThanOrEqual(1);
  });

  it.each(pousses.map((f) => [relative(APP, f), f]))(
    '%s passe une sortie à la porte',
    (_nom, chemin) => {
      // Un écran poussé n'a ni barre d'onglets ni en-tête natif
      // (`headerShown: false` à la racine) : sans `onDismiss`, il enferme.
      expect(readFileSync(chemin as string, 'utf8')).toContain('onDismiss');
    }
  );
});

describe('un écran d’ONGLET n’en passe pas, et c’est voulu', () => {
  const onglets = gardes.filter(estUnOnglet);

  it('les quatre onglets gardés gardent leur barre pour sortir', () => {
    expect(onglets.length).toBeGreaterThanOrEqual(4);
  });

  it.each(onglets.map((f) => [relative(APP, f), f]))(
    '%s ne pose pas de retour là où il n’y a rien derrière',
    (_nom, chemin) => {
      // Un retour sur un onglet mènerait... nulle part. La barre est la
      // sortie, et elle est toujours là.
      expect(readFileSync(chemin as string, 'utf8')).not.toContain('onDismiss');
    }
  );
});

describe('la porte elle-même tient sa part', () => {
  const porte = readFileSync(resolve(__dirname, '../components/identity-gate.tsx'), 'utf8');

  it('elle accepte une sortie', () => {
    expect(porte).toContain('onDismiss?: () => void');
  });

  it('elle ne l’affiche QUE si on lui en donne une', () => {
    // Sur un onglet, la rangée de retour ne doit pas apparaître.
    expect(porte).toContain('onDismiss !== undefined && (');
  });

  it('AUCUN vide n’est posé au-dessus du contenu — D104 2A est défait', () => {
    // CETTE FICHE DISAIT L'INVERSE jusqu'au 27/11, et elle avait tort : elle
    // exigeait un ressort conditionnel AU-DESSUS du bloc, pour « centrer »
    // le contenu des écrans poussés. Vue à l'écran, cette mise en page
    // reproduit mot pour mot le défaut que l'en-tête de la porte déclare
    // avoir corrigé — un titre de page lu à mi-hauteur sous un vide que rien
    // ne justifie.
    //
    // On ne l'a pas supprimée en silence : elle est RETOURNÉE, et sa raison
    // écrite avec. Une fiche qui a tort change de NATURE, elle ne disparaît
    // pas (leçon D110) — sinon la règle qu'elle tenait redevient une opinion.
    expect(porte).not.toContain('{onDismiss !== undefined && <View style={styles.spacer} />}');
  });

  it('elle rend la main sans rien dessiner quand la session est ouverte', () => {
    // La porte ne doit JAMAIS s'intercaler pour un membre connecté : ni
    // rangée, ni vide, ni marge.
    expect(porte).toContain("if (status === 'authenticated') return <>{children}</>;");
  });
});

/**
 * D112 bis — LE CONTENU COMMENCE EN HAUT, POUR TOUT LE MONDE.
 *
 * D104 2A posait un ressort AU-DESSUS du bloc pour les écrans poussés, afin
 * de centrer leur contenu « au lieu de le tasser en haut d'un écran aux
 * trois quarts vide ». Vu à l'écran un mois plus tard : le titre de page
 * flottait à ~40 % de la hauteur sous un vide que rien ne justifiait —
 * c'est-à-dire exactement ce que l'en-tête de `identity-gate.tsx` déclare
 * avoir corrigé le 08/11, dans les mêmes mots.
 *
 * Le fichier se contredisait à cent lignes d'écart, et personne ne pouvait
 * le voir en le lisant : les deux moitiés sont justes séparément. D'où ces
 * fiches, qui tiennent la seule chose que les deux moitiés se disputaient —
 * OÙ commence le contenu.
 */
describe('la porte ne centre pas son contenu', () => {
  const porte = readFileSync(resolve(__dirname, '../components/identity-gate.tsx'), 'utf8');

  it('il n’y a qu’UN ressort dans la porte', () => {
    // Deux ressorts, c'est un contenu centré. Un seul, c'est un contenu en
    // haut et du vide dessous.
    expect(porte.match(/styles\.spacer/g) ?? []).toHaveLength(1);
  });

  it('le ressort vient APRÈS le bloc de contenu, jamais avant', () => {
    const bloc = porte.indexOf('style={styles.block}');
    const ressort = porte.indexOf('style={styles.spacer}');
    // Les deux repères existent vraiment : un `indexOf` qui rend -1 ferait
    // passer la comparaison pour la pire des raisons (D98).
    expect(bloc).toBeGreaterThan(0);
    expect(ressort).toBeGreaterThan(0);
    expect(ressort).toBeGreaterThan(bloc);
  });

  it('l’amorçage, LUI, reste centré — et c’est une autre règle', () => {
    // Un sablier calé en haut se lirait comme un élément d'interface et non
    // comme une attente. La fiche le dit pour qu'on ne « simplifie » pas les
    // deux cas en un seul.
    expect(porte).toContain('loading: {');
    const styleAmorcage = porte.slice(porte.indexOf('loading: {'));
    expect(styleAmorcage.length).toBeGreaterThan(0);
    expect(styleAmorcage.slice(0, 120)).toContain("justifyContent: 'center'");
  });
});

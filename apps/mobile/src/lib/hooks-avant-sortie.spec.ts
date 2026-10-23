/**
 * hooks-avant-sortie.spec.ts — aucun hook APRÈS un retour anticipé.
 * ==================================================================
 * Défaut payé le 23/10/2026, sur l'écran de paiement, et arrivé jusqu'au
 * simulateur :
 *
 *     Render Error — Rendered more hooks than during the previous render.
 *
 * La cause est une règle de React, pas une subtilité de Yamba : **les hooks
 * doivent être appelés dans le MÊME ordre et en même NOMBRE à chaque rendu**.
 * Un écran qui sort tôt —
 *
 *     if (failed) return <Erreur />;      // ← sortie anticipée
 *     if (!trip) return <Chargement />;
 *     useFocusEffect(…);                  // ← ce hook ne s'exécute pas toujours
 *
 * — en appelle donc tantôt six, tantôt sept. React s'en aperçoit au rendu
 * SUIVANT, et l'écran tombe en marche, après coup, loin de la ligne fautive.
 *
 * Pourquoi rien ne l'a vu : `tsc` ne connaît pas cette règle (le code est
 * parfaitement typé), et le harnais ne rend aucun composant — c'est la
 * frontière assumée d'A223. L'outil normal serait `eslint-plugin-react-hooks`,
 * mais le dépôt n'a pas de linter (`linter: none`, choix de génération).
 *
 * D'où ce balayage, qui coûte une seconde et n'a AUCUNE liste d'exceptions :
 * la règle est vraie pour tout écran, sans dérogation possible. Il attrape la
 * forme exacte du défaut — un appel de hook au PREMIER niveau du composant,
 * situé après une sortie anticipée de premier niveau.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const APP = resolve(__dirname, '../app');

/** Tous les écrans versionnés de l'application (expo-router). */
function ecrans(dir = APP): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dir)) {
    const complet = join(dir, entree);
    if (statSync(complet).isDirectory()) {
      trouves.push(...ecrans(complet));
      continue;
    }
    if (entree.endsWith('.tsx')) trouves.push(complet);
  }
  return trouves;
}

/**
 * Un appel de hook au PREMIER niveau d'un composant : deux espaces
 * d'indentation, puis (éventuellement) une affectation, puis `useXxx(`.
 * Les hooks imbriqués dans une fonction ou une JSX sont plus profonds, et ne
 * sont pas concernés par la règle d'ordre.
 */
const HOOK = /^ {2}(?:(?:const|let)\s+[^=]+=\s*)?use[A-Z]\w*\s*\(/;

/**
 * Le début de chaque COMPOSANT du fichier. Un fichier en contient souvent
 * plusieurs (l'écran, ses sous-vues), et la règle de React vaut par
 * composant : un hook du deuxième n'a rien à voir avec la sortie du premier.
 * Sans ce découpage, la sonde crie au loup sur la moitié du dossier (mesuré).
 */
const DEBUT_COMPOSANT = /^(?:export\s+)?(?:default\s+)?function\s+[A-Z]|^(?:export\s+)?const\s+[A-Z]\w*\s*[:=].*(?:=>|function)/;

/** Les blocs de lignes, un par composant, avec leur décalage d'origine. */
export function composants(lignes: string[]): { debut: number; lignes: string[] }[] {
  const departs: number[] = [];
  lignes.forEach((ligne, i) => {
    if (DEBUT_COMPOSANT.test(ligne)) departs.push(i);
  });
  if (departs.length === 0) return [{ debut: 0, lignes }];
  return departs.map((debut, i) => ({
    debut,
    lignes: lignes.slice(debut, departs[i + 1] ?? lignes.length),
  }));
}

/**
 * Une SORTIE anticipée de premier niveau : un `if (…) {` à deux espaces dont
 * le bloc rend quelque chose. On ne retient que celles qui RETOURNENT — un
 * `if` qui se contente d'appeler ne fait pas varier le nombre de hooks.
 */
function premiereSortie(lignes: string[]): number {
  for (let i = 0; i < lignes.length; i += 1) {
    if (!/^ {2}if \(/.test(lignes[i])) continue;
    // Le bloc va jusqu'à sa fermeture à deux espaces.
    for (let j = i + 1; j < lignes.length; j += 1) {
      if (/^ {2}\}/.test(lignes[j])) break;
      if (/^ {4}return\b/.test(lignes[j])) return i;
    }
  }
  return -1;
}

describe('aucun hook ne vit après une sortie anticipée (React)', () => {
  const fautifs: string[] = [];

  for (const fichier of ecrans()) {
    const toutes = readFileSync(fichier, 'utf8').split('\n');
    for (const bloc of composants(toutes)) {
      const sortie = premiereSortie(bloc.lignes);
      if (sortie < 0) continue;
      for (let i = sortie + 1; i < bloc.lignes.length; i += 1) {
        if (!HOOK.test(bloc.lignes[i])) continue;
        const numero = bloc.debut + i + 1;
        fautifs.push(`${relative(APP, fichier)}:${numero} — ${bloc.lignes[i].trim().slice(0, 60)}`);
      }
    }
  }

  it('balaie bien des écrans — une sonde muette ne prouve rien', () => {
    expect(ecrans().length).toBeGreaterThan(10);
  });

  it('…et n’en trouve aucun qui appelle un hook après être sorti', () => {
    expect(fautifs).toEqual([]);
  });

  it('la sonde SAIT reconnaître le défaut (vérifié sur sa forme exacte)', () => {
    // Sans cette fiche, un balayage cassé rendrait une liste vide et passerait
    // pour une bonne nouvelle. On lui donne donc le défaut à trouver.
    const fautif = [
      'export default function Ecran() {',
      '  const [x, setX] = useState(0);',
      '  if (!x) {',
      '    return null;',
      '  }',
      '  useEffect(() => {}, []);',
      '  return null;',
      '}',
    ];
    expect(premiereSortie(fautif)).toBe(2);
    expect(HOOK.test(fautif[5])).toBe(true);
  });

  it('…sans confondre avec un hook imbriqué, qui lui est licite', () => {
    expect(HOOK.test('      useEffect(() => {}, []);')).toBe(false);
    expect(HOOK.test('  const valeur = useMemo(() => 1, []);')).toBe(true);
    expect(HOOK.test('  const [a, b] = useState(0);')).toBe(true);
    expect(HOOK.test('  useFocusEffect(')).toBe(true);
    // `useSomething` d'un objet n'est pas un hook de premier niveau.
    expect(HOOK.test('  objet.useChose();')).toBe(false);
  });

  it('découpe par COMPOSANT : un hook du suivant n’est pas après la sortie du précédent', () => {
    const deux = [
      'function Premier() {',
      '  if (!x) {',
      '    return null;',
      '  }',
      '  return null;',
      '}',
      '',
      'export default function Second() {',
      '  const t = useTranslations("x");',
      '  return null;',
      '}',
    ];
    const blocs = composants(deux);
    expect(blocs).toHaveLength(2);
    expect(blocs[1].debut).toBe(7);
    // Le second composant n'a aucune sortie anticipée : son hook est licite.
    expect(premiereSortie(blocs[1].lignes)).toBe(-1);
  });

  it('…ni avec un `if` de premier niveau qui ne RETOURNE pas', () => {
    const sansSortie = [
      'export default function Ecran() {',
      '  const [x, setX] = useState(0);',
      '  if (!x) {',
      '    console.warn("rien");',
      '  }',
      '  useEffect(() => {}, []);',
      '  return null;',
      '}',
    ];
    expect(premiereSortie(sansSortie)).toBe(-1);
  });
});

/**
 * modules-ios-seuls.spec.ts — aucun écran ne dépend d'un module Apple-seul.
 * ==========================================================================
 * Défaut CONSTATÉ le 09/11/2026, à la première recette sur émulateur Android
 * (D88 l'avait laissée « ouverte » : « la vérification au poste Android,
 * qu'aucun simulateur iOS ne peut faire »).
 *
 * `expo-symbols` sert les SF Symbols d'Apple. Son manifeste le dit sans
 * ambiguïté — `"platforms": ["apple"]` — et le composant accepte un `fallback`
 * pour les autres systèmes. Les quatre écrans d'authentification en servaient
 * un : l'écran de connexion d'Android affichait donc 🔑 devant « Continuer
 * avec e-mail et mot de passe », ✓ dans le badge « Connexion sécurisée », ✕ et
 * ‹ pour fermer, et le MOT « Afficher » à la place de l'œil du mot de passe.
 * Rien ne cassait : c'est pire qu'une panne, parce que rien ne le signale.
 *
 * Pourquoi aucun des dix-neuf contrôles ne l'a vu : le repli est du code
 * parfaitement typé, la CI ne compile aucun bundle Android, et le harnais ne
 * rend rien (frontière assumée d'A223). Seul un œil sur un Android le voyait —
 * et il a fallu en lancer un.
 *
 * LA RÈGLE, et elle est plus large que le cas : **un module dont le manifeste
 * déclare `apple` SANS `android` ne s'importe pas depuis un fichier partagé.**
 * Le détecteur ci-dessous ne connaît aucun nom par cœur : il LIT les
 * manifestes des dépendances, ce qui le rend vrai pour les modules qui
 * n'existent pas encore (`expo-glass-effect` est déjà dans ce cas).
 *
 * L'ÉCHAPPATOIRE EXISTE, et elle est sûre : un fichier `*.ios.ts(x)`. Metro ne
 * le sert QU'À iOS et exige un jumeau Android ou générique à côté — c'est le
 * mécanisme du moteur, pas une dérogation de confiance.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
const APP_RACINE = resolve(__dirname, '../..');
const DEPOT_RACINE = resolve(APP_RACINE, '../..');

/** Le manifeste d'un module Expo, où qu'il soit installé (app, puis racine). */
function manifeste(paquet: string): { platforms?: string[] } | null {
  for (const base of [APP_RACINE, DEPOT_RACINE]) {
    const chemin = join(base, 'node_modules', paquet, 'expo-module.config.json');
    try {
      return JSON.parse(readFileSync(chemin, 'utf8')) as { platforms?: string[] };
    } catch {
      // Paquet absent d'ici, ou sans manifeste (ce n'est pas un module natif).
    }
  }
  return null;
}

/** Les dépendances déclarées qui ne tournent QUE sur les systèmes d'Apple. */
function modulesAppleSeuls(): string[] {
  const pkg = JSON.parse(readFileSync(join(APP_RACINE, 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return Object.keys(pkg.dependencies ?? {}).filter((nom) => {
    const plateformes = manifeste(nom)?.platforms;
    if (plateformes === undefined) return false;
    return plateformes.includes('apple') && !plateformes.includes('android');
  });
}

/** Tout le code partagé : `.ts`/`.tsx`, fiches et variantes iOS exclues. */
function fichiersPartages(dir = SRC): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dir)) {
    const complet = join(dir, entree);
    if (statSync(complet).isDirectory()) {
      trouves.push(...fichiersPartages(complet));
      continue;
    }
    if (!/\.tsx?$/.test(entree)) continue;
    if (entree.includes('.spec.')) continue;
    if (/\.ios\.tsx?$/.test(entree)) continue; // l'échappatoire du moteur
    trouves.push(complet);
  }
  return trouves;
}

describe('modules Apple-seuls — le détecteur lui-même', () => {
  it('reconnaît `expo-symbols` comme Apple-seul (sans quoi le balayage ne prouverait rien)', () => {
    // Un balayage qui ne trouve jamais rien passe au vert pour de mauvaises
    // raisons : on vérifie d'abord qu'il SAIT voir.
    expect(modulesAppleSeuls()).toContain('expo-symbols');
  });

  it('ne range PAS un module qui tourne aussi sur Android', () => {
    const appleSeuls = modulesAppleSeuls();
    expect(appleSeuls).not.toContain('expo-blur');
    expect(appleSeuls).not.toContain('expo-localization');
  });
});

describe('aucun fichier partagé n’importe un module Apple-seul', () => {
  it('le code de `src/` tourne entier sur les deux systèmes', () => {
    const appleSeuls = modulesAppleSeuls();
    const fautifs: string[] = [];

    for (const fichier of fichiersPartages()) {
      const source = readFileSync(fichier, 'utf8');
      for (const paquet of appleSeuls) {
        const importe = new RegExp(`from\\s+['"]${paquet}(/[^'"]*)?['"]`);
        if (importe.test(source)) {
          fautifs.push(`${fichier.slice(SRC.length + 1)} → ${paquet}`);
        }
      }
    }

    expect(fautifs).toEqual([]);
  });
});

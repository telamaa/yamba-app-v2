/**
 * base-url.spec.ts — où l'app va chercher l'API, et dans quel ordre.
 * ==================================================================
 * C'est la configuration qui coûte le plus cher quand elle se trompe en
 * silence : une mauvaise base d'URL donne un login à 200 puis un `/me` à 401
 * (les cookies sont liés à l'hôte — le piège est consigné au CLAUDE.md pour le
 * web), ou pire, une app qui parle au gateway de QUELQU'UN D'AUTRE sur le même
 * réseau.
 *
 * La règle tient en trois priorités, et la deuxième est une astuce qui mérite
 * d'être tenue : en développement, l'adresse du poste qui sert Metro EST
 * l'adresse du gateway — le téléphone physique comme l'émulateur Android (où
 * `localhost` désigne l'émulateur lui-même) joignent la bonne machine sans
 * aucune configuration.
 */
type BaseUrlModule = typeof import('@/lib/api/base-url');

/** Charge le module avec un `expo-constants` factice : `hostUri` au choix. */
function loadBaseUrl(hostUri: string | undefined): BaseUrlModule {
  let mod: BaseUrlModule = {} as BaseUrlModule;
  jest.isolateModules(() => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: { expoConfig: hostUri === undefined ? {} : { hostUri } },
    }));
    mod = require('@/lib/api/base-url') as BaseUrlModule;
  });
  return mod;
}

beforeEach(() => {
  jest.resetModules();
  delete process.env.EXPO_PUBLIC_API_BASE_URL;
});

describe('apiBaseUrl — trois priorités, dans cet ordre', () => {
  it('① la variable déclarée gagne toujours', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.yamba.com/api';
    expect(loadBaseUrl('192.168.1.23:8081').apiBaseUrl()).toBe('https://api.yamba.com/api');
  });

  it('① …et sa barre oblique finale est retirée (sans quoi les URL auraient un double slash)', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.yamba.com/api/';
    expect(loadBaseUrl(undefined).apiBaseUrl()).toBe('https://api.yamba.com/api');
  });

  it('② sinon, l’adresse du poste qui sert Metro — le gateway est sur la même machine', () => {
    expect(loadBaseUrl('192.168.1.23:8081').apiBaseUrl()).toBe('http://192.168.1.23:8080/api');
  });

  it('② le port de Metro est bien remplacé par celui du gateway', () => {
    expect(loadBaseUrl('10.0.0.7:8081').apiBaseUrl()).toContain(':8080/api');
    expect(loadBaseUrl('10.0.0.7:8081').apiBaseUrl()).not.toContain('8081');
  });

  it('③ à défaut, localhost — le simulateur iOS sans Metro', () => {
    expect(loadBaseUrl(undefined).apiBaseUrl()).toBe('http://localhost:8080/api');
  });

  it('une variable VIDE n’est pas une valeur : on retombe sur la priorité suivante', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = '';
    expect(loadBaseUrl('192.168.1.23:8081').apiBaseUrl()).toBe('http://192.168.1.23:8080/api');
  });
});

/**
 * Cette fiche n'a aucun `import` de tête : elle ne charge ses modules qu'à
 * l'intérieur de `jest.isolateModules`, et ses seuls types viennent de
 * `typeof import(...)`, qui est effacé à la compilation. Pour TypeScript,
 * c'est donc un SCRIPT — ses `const` et ses `function` de tête tombent dans la
 * portée GLOBALE, où elles se heurteront un jour à celles d'une fiche voisine
 * (TS2451, rapporté sur l'autre fichier). `export {}` en fait un module.
 *
 * Attrapé par `fiches-sont-des-modules.spec.ts`, qui balaie tout le dépôt —
 * le harnais du mobile entre donc aussi dans SON champ (A223).
 */
export {};

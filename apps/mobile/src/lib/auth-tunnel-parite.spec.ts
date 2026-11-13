/**
 * auth-tunnel-parite.spec.ts — « un tunnel n'offre pas la sortie », et ce qui
 * doit rester vrai des DEUX côtés (D93).
 * ==========================================================================
 * Page 5 de la passe de finitions, et la première qui ne touche aucun
 * formulaire : elle tranche le GABARIT. Le site montait sa navigation haute
 * complète sur les six pages d'auth — « Partager un trajet » en mangue et
 * « Connexion » (un compte qui n'existe pas encore) au milieu d'une
 * inscription. Le téléphone, lui, avait déjà répondu : son groupe `(auth)`
 * déclare `headerShown: false` et son commentaire dit l'intention — « l'auth
 * est une parenthèse au-dessus de l'app, jamais une destination ».
 *
 * Comme ses quatre sœurs (`auth-register-parite`, `auth-verify-parite`,
 * `auth-login-parite`, `auth-password-parite`), cette fiche lit les deux
 * fronts comme du TEXTE. Ce n'est pas un pis-aller : un `import` du code du
 * site créerait une arête dans le graphe Nx, et `targetDefaults.test.dependsOn
 * = ["^build"]` ferait CONSTRUIRE user-ui avant chaque lancement des tests du
 * téléphone — 53,6 s mesurées, et un job « Tests unitaires (mobile) » qui
 * tombe quand le build du site casse. Deux contrôles couplés pour une fiche.
 *
 * CE QU'ELLE NE PEUT PAS FAIRE, et qu'il faut dire : elle n'EXÉCUTE pas
 * `tunnelModeFor`. Elle lit la liste réelle dans la source et rejoue
 * l'appariement ; si quelqu'un changeait l'ALGORITHME d'appariement sans
 * toucher la liste, elle ne le verrait pas. La seule façon de l'exécuter est
 * de donner à `apps/user-ui` son propre harnais — la plus grosse application
 * du dépôt n'a AUCUNE cible de test, et aucun des dix-neuf contrôles n'en lit
 * une ligne de logique. C'est exactement le constat qui a justifié A223 pour
 * le mobile, et c'est un lot à part, nommé : « l'A223 du site ».
 *
 * La fiche la plus utile du fichier est celle qui lit le SYSTÈME DE FICHIERS :
 * toute route du groupe `app/[locale]/(auth)/` doit être couverte par la
 * liste. Une septième page d'auth ajoutée sans elle passe au rouge — c'est la
 * seule chose qui empêche ce lot de vieillir comme le harnais de recette a
 * vieilli entre D92 et D97.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

const REGLE = join(WEB, 'src/lib/layout/tunnel.ts');
const HEADER = join(WEB, 'src/components/layout/Header.tsx');
const SQUELETTE = join(WEB, 'src/components/layout/HeaderSkeleton.tsx');
const LOGO = join(WEB, 'src/components/layout/header/HeaderLogo.tsx');
const REDIRECTION = join(WEB, 'src/lib/auth/login-redirect.ts');
const GROUPE_WEB = join(WEB, 'src/app/[locale]/(auth)');
const GROUPE_MOBILE = join(MOBILE, 'src/app/(auth)/_layout.tsx');

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');

/** Les préfixes tels que la RÈGLE les déclare, lus dans sa source. */
function prefixesDeclares(): string[] {
  const bloc = /export const AUTH_TUNNEL_PREFIXES = \[([^\]]+)\]/.exec(lire(REGLE));
  if (!bloc) throw new Error('AUTH_TUNNEL_PREFIXES introuvable dans tunnel.ts');
  return [...bloc[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Toute route du groupe `(auth)` du site : tout dossier qui porte un
 * `page.tsx`, converti en chemin sans préfixe de locale. On lit l'arbre réel
 * plutôt qu'une liste recopiée — c'est tout l'intérêt.
 */
function routesDuGroupeWeb(racine = GROUPE_WEB, prefixe = ''): string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(racine, { withFileTypes: true })) {
    if (!entree.isDirectory()) continue;
    const chemin = `${prefixe}/${entree.name}`;
    if (existsSync(join(racine, entree.name, 'page.tsx'))) trouvees.push(chemin);
    trouvees.push(...routesDuGroupeWeb(join(racine, entree.name), chemin));
  }
  return trouvees.sort();
}

/** L'appariement de la règle, rejoué : le préfixe lui-même ou un de ses enfants. */
const couvertPar = (chemin: string, prefixe: string): boolean =>
  chemin === prefixe || chemin.startsWith(prefixe + '/');

/** Le corps de la branche `isAuthTunnel` du Header, entre son `? (` et son `) : (`. */
function brancheAuthDuHeader(): string {
  const source = lire(HEADER);
  const debut = source.indexOf(') : isAuthTunnel ? (');
  expect(debut).toBeGreaterThan(-1);
  const fin = source.indexOf(') : (', debut + 10);
  expect(fin).toBeGreaterThan(debut);
  return source.slice(debut, fin);
}

/**
 * Les portes de sortie : tout ce qui emmène AILLEURS que dans l'entonnoir.
 * Le sélecteur de langue et le thème n'en font PAS partie — ils ne quittent
 * pas la page, ils la rendent lisible (arbitrage du 13/11).
 */
const PORTES_DE_SORTIE = [
  'HeaderShareTripCTA',
  'HeaderNotificationBell',
  'HeaderMessageBubble',
  'HeaderUserDropdown',
  'HeaderMobileTrigger',
];

describe('D93 — la liste des pages d’auth couvre le groupe de routes réel', () => {
  const prefixes = prefixesDeclares();
  const routes = routesDuGroupeWeb();

  it('le groupe (auth) du site porte bien les sept routes attendues', () => {
    expect(routes).toEqual([
      '/login',
      '/password/forgot',
      '/password/reset',
      '/password/verify',
      '/refresh',
      '/register',
      '/register/verify',
    ]);
  });

  it.each(routesDuGroupeWeb())('%s est couverte par la liste', (route) => {
    expect(prefixes.some((p) => couvertPar(route, p))).toBe(true);
  });

  it('la liste ne contient aucun préfixe qui ne couvre plus rien', () => {
    for (const prefixe of prefixes) {
      expect(routes.some((r) => couvertPar(r, prefixe))).toBe(true);
    }
  });

  it('/refresh y est — la divergence que D93 a fermée', () => {
    // La porte technique appartient au groupe `(auth)` depuis le 28/08 et
    // manquait à `NO_REDIRECT_PREFIXES` : le header proposait d'y revenir
    // après connexion, un `?redirect=/refresh` qui ne ramène nulle part.
    expect(prefixes).toContain('/refresh');
  });

  it.each([
    '/loginate',
    '/registered',
    '/passwords',
    '/refreshed',
    '/dashboard',
    '/trips/abc',
    '/',
  ])('%s n’est PAS une page d’auth (le piège du préfixe nu)', (chemin) => {
    expect(prefixes.some((p) => couvertPar(chemin, p))).toBe(false);
  });
});

describe('D93 — une seule liste, une seule règle', () => {
  it('la liste n’existe qu’une fois : login-redirect ne la recopie plus', () => {
    const source = lire(REDIRECTION);
    // On cherche la DÉCLARATION, pas le mot : le fichier cite encore
    // `NO_REDIRECT_PREFIXES` dans le commentaire qui explique sa disparition,
    // et c'est très bien ainsi — un commentaire qui dit pourquoi la liste a
    // déménagé vaut mieux qu'un fichier qui fait comme si elle n'avait jamais
    // existé. La première écriture de cette fiche interdisait le mot : elle
    // est partie au rouge sur le commentaire, le 13/11.
    expect(source).not.toMatch(/const NO_REDIRECT_PREFIXES/);
    expect(source).toContain('isAuthTunnel');
  });

  it('le Header ne porte plus d’expression régulière de route en dur', () => {
    const source = lire(HEADER);
    expect(source).toContain('tunnelModeFor');
    expect(source).not.toMatch(/\/\^\\\/trips/);
    expect(source).not.toContain('book\\/?$');
  });

  it('la règle du tunnel de paiement vit dans la règle, et là seulement', () => {
    expect(lire(REGLE)).toContain('CHECKOUT_TUNNEL_PATH');
  });

  it('la règle est PURE : aucun import, donc exécutable par une fiche', () => {
    // La condition qui rend possible « l'A223 du site » le jour où il arrive.
    expect(lire(REGLE)).not.toMatch(/^\s*import /m);
  });
});

describe('D93 — ce qu’il reste de la navigation haute dans l’entonnoir', () => {
  it('les six pages d’auth ne gardent que la langue et le thème', () => {
    const branche = brancheAuthDuHeader();
    expect(branche).toContain('HeaderLocaleSwitcher');
    expect(branche).toContain('HeaderThemeToggle');
  });

  it.each(PORTES_DE_SORTIE)('%s ne s’affiche pas en tunnel d’auth', (porte) => {
    expect(brancheAuthDuHeader()).not.toContain(porte);
  });

  it('la palette Cmd+K et la feuille du bas sont fermées dans TOUT tunnel', () => {
    const source = lire(HEADER);
    expect(source).toContain('{!isTunnel && <CommandPalette');
    expect(source).toMatch(/\{!isTunnel && \(\s*<HeaderMobileBottomSheet/);
  });

  it('le logo reste monté hors des branches : UNE sortie, toujours', () => {
    const source = lire(HEADER);
    const logo = source.indexOf('<HeaderLogo');
    const premiereBranche = source.indexOf('{isCheckoutTunnel ? (');
    expect(logo).toBeGreaterThan(-1);
    expect(logo).toBeLessThan(premiereBranche);
  });

  it('et le logo est bien un lien vers l’accueil', () => {
    expect(lire(LOGO)).toContain('href="/"');
  });
});

describe('D93 — le squelette suit le régime (défaut du 17/10)', () => {
  it('le Header lui passe le régime', () => {
    expect(lire(HEADER)).toContain('<HeaderSkeleton isCompact={isCompact} tunnel={tunnel} />');
  });

  it('le squelette connaît les trois régimes', () => {
    const source = lire(SQUELETTE);
    expect(source).toContain('TunnelMode');
    expect(source).toContain('tunnel === "checkout"');
    expect(source).toContain('tunnel === "auth"');
  });

  it('il ne fait clignoter NI le CTA mangue NI une pastille en tunnel', () => {
    const source = lire(SQUELETTE);
    const auth = source.indexOf('tunnel === "auth"');
    const ordinaire = source.indexOf('{/* Desktop : statique réel');
    // Le CTA et les pastilles vivent APRÈS la branche d'auth, dans la branche
    // ordinaire : en tunnel, il n'y a rien à attendre, donc rien à shimmer.
    expect(auth).toBeLessThan(ordinaire);
    expect(source.slice(auth, ordinaire)).not.toContain('ShimmerCircle');
    expect(source.slice(auth, ordinaire)).not.toContain('HeaderShareTripCTA');
  });
});

describe('D93 — parité : les deux fronts ferment le même tunnel', () => {
  it('le téléphone ne monte aucun en-tête de navigateur sur son groupe (auth)', () => {
    const source = lire(GROUPE_MOBILE);
    expect(source).toContain('headerShown: false');
  });

  it('et il n’y monte pas non plus sa barre d’onglets', () => {
    // La barre est déclarée par le groupe `(tabs)` (D88) ; le groupe `(auth)`
    // est une pile, et c'est ce qui fait de l'auth une parenthèse.
    const source = lire(GROUPE_MOBILE);
    expect(source).toContain('<Stack');
    expect(source).not.toContain('Tabs');
  });
});

describe('D91 1A — un signal de confiance nomme un tiers', () => {
  const mention = (locale: string): string => {
    const dictionnaire = JSON.parse(
      readFileSync(join(WEB, `messages/${locale}/common.json`), 'utf8')
    ) as { header: Record<string, string> };
    return dictionnaire.header.checkoutSecure;
  };

  it.each(['fr', 'en'])('la mention du tunnel de paiement nomme Stripe (%s)', (locale) => {
    expect(mention(locale)).toContain('Stripe');
  });

  it.each([
    ['fr', 'Réservation sécurisée'],
    ['en', 'Secure booking'],
  ])('elle ne se décerne plus la sécurité à elle-même (%s)', (locale, ancien) => {
    expect(mention(locale)).not.toBe(ancien);
  });

  it('et aucun écran d’auth ne porte de mention de sécurité', () => {
    // D91 1A l'a fait sauter des six écrans ; la rendre par l'en-tête
    // l'aurait réinstallée par la fenêtre.
    expect(brancheAuthDuHeader()).not.toContain('checkoutSecure');
    expect(brancheAuthDuHeader()).not.toContain('Lock');
  });
});

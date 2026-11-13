/**
 * auth-login-parite.spec.ts — la connexion, et ce qui doit rester vrai des
 * DEUX côtés (D96).
 * ==========================================================================
 * Page 3 de la passe de finitions, et le premier lot où c'est le SITE qui
 * s'aligne sur le téléphone : jusqu'ici les deux applications ne proposaient
 * pas le même parcours (identifier-first sur le mobile, formulaire unique sur
 * le site), ni le même ordre (les fournisseurs sociaux au-dessus du
 * formulaire sur le site, alors que sa propre page d'inscription les met
 * dessous), ni la même façon de lire un refus.
 *
 * Ce dernier point est le plus coûteux, et il ne se voyait nulle part : le
 * site comparait le MESSAGE anglais de l'API à dix-huit chaînes normalisées
 * (« request failed with status code 401 », « too many attempts »…). Un mot
 * reformulé côté serveur — ce qu'aucune fiche du dépôt n'interdit, puisque
 * ces messages sont des messages et non des codes — et l'Expéditeur recevait
 * « Connexion impossible pour le moment » à la place de la vraie raison. Le
 * mobile lisait déjà `details.code` (RG-MOB-1). Une règle, deux
 * implémentations, dont une fausse : c'est exactement le motif que D92 a
 * trouvé sur `maskEmail`.
 *
 * Comme ses deux sœurs (`auth-register-parite`, `auth-verify-parite`), cette
 * fiche lit les deux fronts comme du TEXTE : c'est le seul endroit du dépôt
 * où un test voit les deux à la fois, et la règle porte sur leur accord.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

const FORM_WEB = join(WEB, 'src/components/auth/forms/LoginForm.tsx');
const CODES_WEB = join(WEB, 'src/lib/auth/auth-error-codes.ts');
const ECRAN_IDENTIFIANT = join(MOBILE, 'src/app/(auth)/login.tsx');
const ECRAN_MOT_DE_PASSE = join(MOBILE, 'src/app/(auth)/login-password.tsx');

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');

function login(front: string, locale: string): Record<string, string> {
  const dictionnaire = JSON.parse(
    readFileSync(join(front, `messages/${locale}/auth.json`), 'utf8')
  ) as { login: Record<string, string> };
  return dictionnaire.login;
}

function erreurs(front: string, locale: string): Record<string, string> {
  return login(front, locale).errors as unknown as Record<string, string>;
}

const LOCALES = ['fr', 'en'];

/** Les textes qui disent LA MÊME CHOSE sur les deux fronts, donc mot pour mot. */
const TEXTES_PARTAGES = [
  'title',
  'subtitle',
  'emailLabel',
  'emailPlaceholder',
  'continue',
  'confirmBody',
  'confirmYes',
  'confirmBack',
  'methodPassword',
  'passwordTitle',
  'changeEmail',
  'passwordLabel',
  'passwordPlaceholder',
  'forgot',
  'rememberLabel',
  'rememberHelper',
  'submit',
  'noAccount',
  'registerLink',
];

describe('les deux connexions existent là où ces fiches les cherchent', () => {
  it.each([
    ['le formulaire du site', FORM_WEB],
    ['les codes de refus du site', CODES_WEB],
    ['l’étape identifiant du mobile', ECRAN_IDENTIFIANT],
    ['l’étape mot de passe du mobile', ECRAN_MOT_DE_PASSE],
  ])('%s', (_quoi, chemin) => {
    // Sans ce garde-fou, un déplacement de fichier rendrait toutes les fiches
    // suivantes vertes pour la pire des raisons : elles ne liraient plus rien.
    expect(existsSync(chemin)).toBe(true);
  });
});

describe('① le site a adopté le parcours du téléphone (D96 1A)', () => {
  const source = (): string => lire(FORM_WEB);

  it('deux étapes nommées, l’adresse puis le mot de passe', () => {
    expect(source()).toContain('type Step = "identifier" | "password"');
  });

  it('la confirmation d’adresse est là, et c’est une vraie fenêtre', () => {
    const s = source();
    expect(s).toContain('confirmBody');
    expect(s).toContain('role="dialog"');
    expect(s).toContain('aria-modal="true"');
  });

  it('l’autre méthode mène à la même étape, sans confirmation', () => {
    // « Continuer avec e-mail et mot de passe » saute la confirmation : on
    // n'a pas demandé à l'adresse d'être le chemin, donc on ne la confirme
    // pas. Le mobile fait exactement cela (`openPasswordMethod`).
    expect(source()).toContain('methodPassword');
    expect(source()).toContain('goToPassword(emailValid)');
  });

  it('les fournisseurs sociaux sont SOUS le formulaire, comme sur l’inscription du même site', () => {
    const s = source();
    const cta = s.indexOf('{t("continue")}');
    const google = s.indexOf('<GoogleSignInButton');
    expect(cta).toBeGreaterThan(-1);
    expect(google).toBeGreaterThan(cta);
  });
});

describe('② le site lit le CODE du refus, plus jamais son message (D96 4A)', () => {
  it('les dix-huit chaînes anglaises normalisées ont disparu', () => {
    const s = lire(FORM_WEB);
    expect(s).not.toContain('localizeLoginError');
    expect(s).not.toContain('normalizeMessage');
    expect(s).not.toContain('request failed with status code 401');
    expect(s).not.toContain('invalid email or password');
  });

  it('il lit `details.code`, et ne devine rien quand il n’y en a pas', () => {
    expect(lire(FORM_WEB)).toContain('readLoginErrorCode');
    expect(lire(CODES_WEB)).toContain('typeof code === "string" ? code : null');
  });

  it('CHAQUE code connu a sa phrase dans les deux dictionnaires du site', () => {
    // La clé est CALCULÉE (`t(\`errors.${code}\`)`) : ni `tsc` (un gabarit se
    // type toujours), ni le contrôle i18n de la CI (il compare FR et EN entre
    // EUX, pas aux clés que le code demande) ne verraient le trou. Une clé
    // absente fait lire le CHEMIN de la clé à l'Expéditeur — le défaut trouvé
    // sur le paiement (payment-i18n).
    const codes = [...lire(CODES_WEB).matchAll(/"([A-Z_]{4,})",/g)].map((m) => m[1]);
    expect(codes).toContain('INVALID_CREDENTIALS');
    for (const locale of LOCALES) {
      for (const code of codes) {
        expect(erreurs(WEB, locale)).toHaveProperty(code);
      }
    }
  });

  it('les trois refus que le mobile connaît disent la MÊME chose des deux côtés', () => {
    for (const locale of LOCALES) {
      for (const code of ['INVALID_CREDENTIALS', 'TOO_MANY_ATTEMPTS', 'ACCOUNT_SUSPENDED']) {
        expect(erreurs(WEB, locale)[code]).toBe(erreurs(MOBILE, locale)[code]);
      }
    }
  });
});

describe('③ la politique de mot de passe ne se vérifie pas sur la connexion (D96 5A)', () => {
  it('aucune longueur minimale dans le formulaire du site', () => {
    // Elle refusait d'ESSAYER un mot de passe ancien, et renseignait un
    // attaquant sur la politique — pour un gain nul, le serveur étant seul
    // juge. Le mobile ne vérifie que le vide.
    const s = lire(FORM_WEB);
    expect(s).not.toContain('minLength');
    expect(s).not.toMatch(/at least 8 characters/);
  });

  it('le mobile non plus', () => {
    expect(lire(ECRAN_MOT_DE_PASSE)).not.toContain('minLength');
  });
});

describe('④ la pastille de sécurité ne revient sur aucun des deux fronts (D91 1A)', () => {
  it('plus de clé `badge` dans les dictionnaires de connexion du mobile', () => {
    for (const locale of LOCALES) {
      expect(login(MOBILE, locale)).not.toHaveProperty('badge');
    }
  });

  it('plus un mot d’auto-décernement dans les sources', () => {
    for (const chemin of [FORM_WEB, ECRAN_IDENTIFIANT, ECRAN_MOT_DE_PASSE]) {
      const s = lire(chemin);
      expect(s).not.toContain('Connexion sécurisée');
      expect(s).not.toContain('Secure connection');
      expect(s).not.toContain('Secure sign-in');
    }
  });
});

describe('⑤ un seul discours, mot pour mot (D96 6A)', () => {
  it.each(LOCALES)('les textes partagés sont identiques en %s', (locale) => {
    const site = login(WEB, locale);
    const telephone = login(MOBILE, locale);
    for (const cle of TEXTES_PARTAGES) {
      expect(`${cle}: ${site[cle]}`).toBe(`${cle}: ${telephone[cle]}`);
    }
  });

  it('les textes du site ne sont plus des ternaires dans le composant', () => {
    const s = lire(FORM_WEB);
    expect(s).not.toContain('function buildCopy');
    expect(s).not.toContain('const fr = lang === "fr"');
    expect(s).not.toContain('useUiPreferences');
  });
});

/**
 * Le chargement des boutons a changé de forme le 13/11/2026, sur arbitrage à
 * l'écran : les trois points animés remplacent le libellé effacé + disque
 * centré de D95 4A. Ce qui est CONSERVÉ de D95, et qui compte plus que
 * l'effet lui-même : le libellé ne change pas, la largeur du bouton ne bouge
 * pas, et `aria-busy` reste le seul canal pour les lecteurs d'écran.
 *
 * Ce qui est GAGNÉ : le motif ne vit plus recopié dans les cinq formulaires
 * (il avait déjà dérivé — disque 16 px dans trois fichiers, 18 px dans deux
 * autres) mais dans UN composant, `components/ui/LoadingDots.tsx`.
 */
/**
 * Le bloc du bouton QUI TRAVAILLE : celui dont le `type="submit"` porte un
 * `aria-busy`. On ne prend pas « le premier bouton du fichier » : depuis D96,
 * `LoginForm` en a DEUX — « Continuer » (étape 1, aucune attente, puisque le
 * passage à l'étape du mot de passe est local) et « Se connecter » (étape 2).
 * La première écriture de cette aide visait le premier : elle est partie au
 * rouge sur l'étape 1, le 13/11.
 */
function blocDuBouton(source: string): string {
  let i = source.indexOf('type="submit"');
  while (i >= 0) {
    const bloc = source.slice(i, source.indexOf('</button>', i));
    if (bloc.includes('aria-busy')) return bloc;
    i = source.indexOf('type="submit"', i + 1);
  }
  throw new Error('aucun bouton d’envoi avec aria-busy dans ce fichier');
}

/**
 * Le chargement des boutons a été arbitré À L'ÉCRAN le 13/11/2026, après avoir
 * vu quatre dispositions dans le simulateur et dans le navigateur : libellé
 * remplacé par un libellé d'attente, points animés à droite, points animés à
 * gauche avec le libellé conservé, et enfin celle-ci — **le spinner PREND la
 * place du libellé, centré**. C'est la seule qui a été retenue après l'avoir
 * vue, et c'est la leçon du lot : sur un effet d'interface, une capture vaut
 * trois raisonnements.
 *
 * Ce que ces fiches gardent n'est donc PAS l'effet (il a changé quatre fois en
 * un jour) mais ce qui doit rester vrai quel qu'il soit :
 *   ① le bouton ne change pas de taille pendant l'attente ;
 *   ② il garde son NOM pour un lecteur d'écran, alors que son texte visible
 *     disparaît — `accessibilityLabel` sur le téléphone, `sr-only` sur le
 *     site. C'est le seul coût réel de cette disposition, et il est payé ;
 *   ③ les deux fronts attendent de la même façon.
 *
 * Et une dette refermée au passage : avant ce jour, AUCUNE fiche n'épinglait
 * l'indicateur d'attente. D95 avait pu remplacer les points du téléphone par
 * un spinner système sans que rien ne le signale.
 */
describe('⑥ le bouton qui travaille : la vague prend la place du mot (13/11)', () => {
  const KIT = join(MOBILE, 'src/components/auth/auth-kit.tsx');
  const COMPOSANT_WEB = join(WEB, 'src/components/ui/LoadingDots.tsx');

  it('le téléphone : la vague native, et le libellé cède la place', () => {
    const kit = lire(KIT);
    expect(kit).toContain('function LoadingDots');
    expect(kit).toContain('<LoadingDots color={palette.ctaLabel} />');
    // `Animated` natif : la condition pour que l'animation tourne hors du fil JS.
    expect(kit).toContain('useNativeDriver: true');
    expect(kit).not.toMatch(/<ActivityIndicator/);
    expect(kit).not.toMatch(/^\s*ActivityIndicator,$/m);
  });

  it('le site : la vague aussi, et plus aucun disque sur le CTA', () => {
    const s = lire(FORM_WEB);
    const bouton = blocDuBouton(s);
    expect(bouton).toContain('<LoadingDots />');
    expect(bouton).toContain('aria-busy');
    expect(bouton).not.toContain('animate-spin');
    expect(bouton).not.toContain('ctaLoading');
    expect(bouton).not.toContain('opacity-0');
  });

  it('② le bouton garde son NOM quand son texte s’en va', () => {
    // Le seul coût réel de cette disposition, et il est payé des deux côtés :
    // sans ça, un lecteur d'écran n'annonce plus que « bouton » pendant
    // toute l'attente.
    const kit = lire(KIT);
    expect(kit).toContain('accessibilityLabel={label}');
    expect(kit).toContain('accessibilityState={{ busy: pending');
    expect(lire(FORM_WEB)).toContain('className="sr-only"');
  });

  it('① le bouton ne change pas de taille pendant l’attente', () => {
    const kit = lire(KIT);
    // Téléphone : hauteur du CTA fixée, et la rangée de points porte la
    // hauteur exacte de la ligne du libellé.
    expect(kit.slice(kit.indexOf('  cta: {'), kit.indexOf('  dimmed'))).toMatch(/height: AuthFieldHeight/);
    expect(kit.slice(kit.indexOf('dotsRow: {'), kit.indexOf('dot: {'))).toMatch(/height: 24/);
    // Site : bouton en pleine largeur, insensible à son contenu.
    expect(lire(FORM_WEB)).toMatch(/w-full/);
  });

  /**
   * ③ Les DEUX fronts attendent de la même façon — et ici ce n'est pas une
   * formule : les mesures de la vague sont RECOPIÉES d'un front à l'autre
   * (trois points, cycle 900 ms, décalage 150 ms, montée 4 px, grossissement
   * 0,85 → 1,15, opacité 0,35 → 1). Deux implémentations d'une même règle
   * divergent toujours : c'est `maskEmail` (D92), la lecture des refus (D96)
   * et la liste des pages d'auth (D93). Ces fiches comparent les chiffres.
   */
  it.each([
    ['trois points', /DOT_COUNT = 3/, /length: DOT_COUNT = 3|DOT_COUNT = 3/],
    ['décalage de 150 ms', /DOT_STAGGER_MS = 150/, /DOT_STAGGER_MS = 150/],
  ])('③ %s, des deux côtés', (_quoi, motifMobile, motifWeb) => {
    expect(lire(KIT)).toMatch(motifMobile);
    expect(lire(COMPOSANT_WEB)).toMatch(motifWeb);
  });

  it('③ la course de la vague est la même des deux côtés', () => {
    const kit = lire(KIT);
    expect(kit).toMatch(/outputRange: \[0, -4\]/);
    expect(kit).toMatch(/outputRange: \[0\.85, 1\.15\]/);
    expect(kit).toMatch(/outputRange: \[0\.35, 1\]/);
    expect(kit).toMatch(/DOT_CYCLE_MS = 900/);

    const css = lire(join(WEB, 'src/app/global.css'));
    expect(css).toContain('@keyframes yambaDot');
    expect(css).toMatch(/translateY\(-4px\) scale\(1\.15\)/);
    expect(css).toMatch(/translateY\(0\) scale\(0\.85\)/);
    expect(css).toMatch(/opacity: 0\.35/);
    expect(css).toMatch(/animation: yambaDot 900ms/);
    // Mouvement réduit : on retire le mouvement, pas le signal.
    expect(css).toContain('prefers-reduced-motion');
  });
});

describe('⑦ les liens secondaires se désignent par la couleur, pas par la graisse', () => {
  it('le mobile n’a plus de gras sur « Oublié ? » ni sur « Modifier »', () => {
    const s = lire(ECRAN_MOT_DE_PASSE);
    for (const bloc of ['changeEmail', 'forgotLink']) {
      const debut = s.indexOf(`  ${bloc}: {`);
      expect(debut).toBeGreaterThan(-1);
      const corps = s.slice(debut, s.indexOf('\n  },', debut));
      expect(corps).toContain('Font.medium');
      expect(corps).not.toContain('Font.bold');
    }
  });

  it('le site non plus', () => {
    const s = lire(FORM_WEB);
    const debut = s.indexOf('const linkSubtle');
    expect(debut).toBeGreaterThan(-1);
    const corps = s.slice(debut, s.indexOf(';', debut));
    expect(corps).not.toContain('font-semibold');
    expect(corps).not.toContain('font-bold');
  });
});

describe('⑧ les deux fronts allument leur bouton sur la MÊME règle', () => {
  it('la regex d’adresse est la même des deux côtés', () => {
    // Le serveur reste seul juge (RG-MOB-1) : ceci n'allume qu'un bouton.
    // Mais deux règles différentes donneraient deux écrans qui ne
    // s'allument pas au même moment, pour la même adresse.
    const REGEX = String.raw`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`;
    expect(lire(FORM_WEB)).toContain(REGEX);
    expect(lire(join(MOBILE, 'src/lib/email.ts'))).toContain(REGEX);
  });
});

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

describe('⑥ le bouton qui travaille garde sa taille et son mot (D95 4A)', () => {
  it('aucun libellé de chargement, et le disque se superpose', () => {
    const s = lire(FORM_WEB);
    expect(s).not.toContain('ctaLoading');
    expect(s).toContain('aria-busy');
    expect(s).toContain('absolute inset-0 m-auto animate-spin');
    expect(s).toContain('opacity-0');
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

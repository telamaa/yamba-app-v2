/**
 * auth-password-parite.spec.ts — le parcours « mot de passe oublié », et ce
 * qui doit rester vrai des DEUX côtés (D97).
 * ==========================================================================
 * Trois écrans (demander un code, le saisir, choisir le nouveau mot de passe)
 * et, côté site, un constat qui résume le lot : **l'écran de saisie du code
 * existait en DEUX exemplaires**. D92 avait refondu celui de l'inscription —
 * l'adresse en clair, la 6ᵉ frappe qui valide, les cases qui se voient, un
 * seul compte à rebours — et rien, nulle part, ne disait qu'il en existait un
 * second, à six cents lignes de là, resté tel quel.
 *
 * Le téléphone n'a jamais eu ce problème : `otp-verify-view.tsx` y est
 * partagé depuis A208. Le site a maintenant le sien, et ces fiches tiennent
 * ce qui ne doit plus se dédoubler.
 *
 * Elles tiennent aussi quatre défauts corrigés, tous du même genre — **le
 * client qui réinvente ce que le serveur dit déjà** :
 *   ① l'expiration se lisait sur le TEXTE du message (« expired ») ;
 *   ② les règles de mot de passe étaient RÉÉCRITES dans l'écran ;
 *   ③ le message anglais de l'API s'affichait tel quel ;
 *   ④ la confirmation du mot de passe, et le collage interdit sur ce champ.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

const VUE_OTP_WEB = join(WEB, 'src/components/auth/shared/OtpVerifyView.tsx');
const OUBLI_WEB = join(WEB, 'src/components/auth/forms/ForgotPasswordForm.tsx');
const CODE_WEB = join(WEB, 'src/components/auth/forms/ResetVerifyForm.tsx');
const NOUVEAU_WEB = join(WEB, 'src/components/auth/forms/ResetPasswordForm.tsx');
const INSCRIPTION_CODE_WEB = join(WEB, 'src/components/auth/forms/RegisterVerifyForm.tsx');

const OUBLI_MOBILE = join(MOBILE, 'src/app/(auth)/password-forgot.tsx');
const CODE_MOBILE = join(MOBILE, 'src/app/(auth)/password-verify.tsx');
const NOUVEAU_MOBILE = join(MOBILE, 'src/app/(auth)/password-reset.tsx');

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');

const LOCALES = ['fr', 'en'];

function dico(front: string, locale: string): Record<string, Record<string, string>> {
  return JSON.parse(readFileSync(join(front, `messages/${locale}/auth.json`), 'utf8')) as Record<
    string,
    Record<string, string>
  >;
}

describe('les sept écrans existent là où ces fiches les cherchent', () => {
  it.each([
    ['la vue de code partagée du site', VUE_OTP_WEB],
    ['« oublié » du site', OUBLI_WEB],
    ['le code du site', CODE_WEB],
    ['le nouveau mot de passe du site', NOUVEAU_WEB],
    ['« oublié » du téléphone', OUBLI_MOBILE],
    ['le code du téléphone', CODE_MOBILE],
    ['le nouveau mot de passe du téléphone', NOUVEAU_MOBILE],
  ])('%s', (_quoi, chemin) => {
    expect(existsSync(chemin)).toBe(true);
  });
});

describe('① le site n’a plus DEUX écrans de saisie du code (D97 1A)', () => {
  it.each([
    ['le parcours d’inscription', INSCRIPTION_CODE_WEB],
    ['le parcours mot de passe oublié', CODE_WEB],
  ])('%s APPELLE la vue partagée', (_quoi, chemin) => {
    expect(lire(chemin)).toContain('<OtpVerifyView');
  });

  it.each([
    ['le parcours d’inscription', INSCRIPTION_CODE_WEB],
    ['le parcours mot de passe oublié', CODE_WEB],
  ])('%s ne recode NI les cases, NI les minuteries, NI le collage', (_quoi, chemin) => {
    // La mécanique dupliquée, nommée : si l'un de ces mots revient dans un
    // appelant, c'est qu'une troisième copie est en train de naître.
    const source = lire(chemin);
    for (const mecanique of [
      'OTP_LENGTH',
      'handlePaste',
      'startResendTimer',
      'startExpiryTimer',
      'lockTimer',
      'inputsRef',
    ]) {
      expect(`${chemin.split('/').pop()} ne contient pas ${mecanique}: ${source.includes(mecanique)}`).toBe(
        `${chemin.split('/').pop()} ne contient pas ${mecanique}: false`
      );
    }
  });

  it('la vue partagée porte bien les règles de D92', () => {
    const source = lire(VUE_OTP_WEB);
    // Les seuils d'affichage restent PURS et partagés (A223) : la vue les
    // appelle, elle ne les recode pas.
    expect(source).toContain('showValidity(');
    expect(source).toContain('resendPhase(');
    // La 6ᵉ frappe valide, et le focus arrive avec l'écran.
    expect(source).toContain('canAutoVerify');
    expect(source).toContain('inputsRef.current[0]?.focus()');
  });
});

describe('② le parcours « oublié » ne dit jamais qu’un compte existe (ANO-API-08)', () => {
  it('les deux fronts emploient la phrase conditionnelle', () => {
    expect(lire(CODE_WEB)).toContain('sentToIfExists');
    expect(lire(CODE_MOBILE)).toContain('sentToIfExists');
  });

  it('la phrase est la même, mot pour mot, des deux côtés', () => {
    for (const locale of LOCALES) {
      expect(dico(WEB, locale).otp.sentToIfExists).toBe(dico(MOBILE, locale).otp.sentToIfExists);
    }
  });

  it('la note de sécurité de l’écran « oublié » dit la même chose des deux côtés', () => {
    for (const locale of LOCALES) {
      expect(dico(WEB, locale).forgot.securityNote).toBe(dico(MOBILE, locale).forgot.securityNote);
    }
  });
});

describe('③ plus de pastille de sécurité auto-décernée (D91 1A)', () => {
  it('aucun dictionnaire du téléphone n’a plus de `badge` dans ce parcours', () => {
    for (const locale of LOCALES) {
      expect(dico(MOBILE, locale).forgot).not.toHaveProperty('badge');
      expect(dico(MOBILE, locale).otp).not.toHaveProperty('badge');
    }
  });

  it('aucune source ne porte plus ces mots', () => {
    for (const chemin of [OUBLI_WEB, CODE_WEB, NOUVEAU_WEB, VUE_OTP_WEB, OUBLI_MOBILE, NOUVEAU_MOBILE]) {
      const source = lire(chemin);
      expect(source).not.toContain('Récupération sécurisée');
      expect(source).not.toContain('Secure recovery');
      expect(source).not.toContain('Réinitialisation sécurisée');
    }
  });
});

describe('④ le nouveau mot de passe : un seul champ, et le collage autorisé (D91)', () => {
  it('la confirmation a disparu du site', () => {
    const source = lire(NOUVEAU_WEB);
    expect(source).not.toContain('confirm-password');
    expect(source).not.toContain('confirmPassword');
  });

  it('le collage n’est plus interdit', () => {
    // Interdire le collage condamne précisément les mots de passe qu'on
    // souhaite : ceux qu'un gestionnaire génère et que personne ne retape.
    const source = lire(NOUVEAU_WEB);
    expect(source).not.toContain('handleConfirmPaste');
    expect(source).not.toContain('pasteDisabled');
  });

  it('le téléphone n’en a jamais eu', () => {
    // On vise le CHAMP, pas le mot : le fichier a parfaitement le droit
    // d'expliquer en français pourquoi il n'y a pas de confirmation.
    const source = lire(NOUVEAU_MOBILE);
    expect(source).not.toContain('confirmPassword');
    expect(source).not.toContain('passwordConfirm');
  });
});

describe('⑤ les règles de mot de passe ne sont écrites qu’UNE fois (D97 3A)', () => {
  it('le site ne réimplémente plus la politique dans l’écran', () => {
    const source = lire(NOUVEAU_WEB);
    expect(source).not.toContain('validateStrongPassword');
    expect(source).not.toContain('hasSequentialPattern');
    expect(source).not.toContain('looksLikeSimpleDate');
  });

  it('il appelle la source commune, celle de l’inscription et de la jauge', () => {
    const source = lire(NOUVEAU_WEB);
    expect(source).toContain('getPasswordChecks(');
    expect(source).toContain('firstFailingCheck(');
  });

  it('le téléphone appelle la sienne', () => {
    expect(lire(NOUVEAU_MOBILE)).toContain('getPasswordChecks(');
  });
});

describe('⑥ l’expiration se lit sur le CODE, pas sur la prose (D96 4A)', () => {
  it('le site ne cherche plus « expired » dans un message', () => {
    const source = lire(NOUVEAU_WEB);
    expect(source).not.toContain('includes("expired")');
    expect(source).not.toContain("includes('expired')");
  });

  it('les deux fronts nomment le code du serveur', () => {
    expect(lire(NOUVEAU_WEB)).toContain('RESET_SESSION_EXPIRED');
    expect(lire(NOUVEAU_MOBILE)).toContain('RESET_SESSION_EXPIRED');
  });
});

describe('⑦ aucun message brut de l’API sous les yeux de l’Expéditeur', () => {
  it.each([
    ['« oublié »', OUBLI_WEB],
    ['le code', CODE_WEB],
    ['le nouveau mot de passe', NOUVEAU_WEB],
    ['la vue de code partagée', VUE_OTP_WEB],
  ])('%s du site n’affiche plus `getApiErrorMessage`', (_quoi, chemin) => {
    expect(lire(chemin)).not.toContain('getApiErrorMessage');
  });

  it('le téléphone non plus', () => {
    for (const chemin of [OUBLI_MOBILE, NOUVEAU_MOBILE]) {
      expect(lire(chemin)).not.toContain('err.message');
    }
  });
});

describe('⑧ les boutons gardent leur taille et leur mot (D95 4A)', () => {
  it.each([
    ['« oublié »', OUBLI_WEB],
    ['le nouveau mot de passe', NOUVEAU_WEB],
    ['la vue de code partagée', VUE_OTP_WEB],
  ])('%s : pas de libellé de chargement, et le disque se superpose', (_quoi, chemin) => {
    const source = lire(chemin);
    expect(source).not.toContain('ctaLoading');
    expect(source).toContain('aria-busy');
    expect(source).toContain('absolute inset-0 m-auto animate-spin');
  });
});

describe('⑨ un seul discours, mot pour mot', () => {
  const PARTAGES: ReadonlyArray<[string, readonly string[]]> = [
    ['forgot', ['title', 'subtitle', 'securityNote', 'submit', 'backToLogin', 'emailLabel']],
    ['reset', ['title', 'subtitle', 'passwordLabel', 'submit', 'sessionExpired']],
  ];

  it.each(LOCALES)('les textes du parcours sont identiques en %s', (locale) => {
    for (const [espace, cles] of PARTAGES) {
      for (const cle of cles) {
        expect(`${espace}.${cle}: ${dico(WEB, locale)[espace][cle]}`).toBe(
          `${espace}.${cle}: ${dico(MOBILE, locale)[espace][cle]}`
        );
      }
    }
  });

  it('les deux refus du changement disent la même chose', () => {
    for (const locale of LOCALES) {
      for (const code of ['PASSWORD_UNCHANGED', 'PASSWORD_STATE_CHANGED']) {
        const site = (dico(WEB, locale).reset as unknown as { errors: Record<string, string> }).errors;
        const tel = (dico(MOBILE, locale).reset as unknown as { errors: Record<string, string> }).errors;
        expect(site[code]).toBe(tel[code]);
      }
    }
  });
});

describe('⑩ toute clé demandée par un écran existe dans les DEUX dictionnaires', () => {
  /**
   * L'angle mort de `payment-i18n`, appliqué ici : `tsc` ne voit pas une clé
   * de traduction, et le contrôle i18n de la CI compare FR et EN **entre
   * eux** — jamais aux clés que le code réclame. Une clé absente fait lire le
   * CHEMIN de la clé à l'Expéditeur.
   */
  const ECRANS: ReadonlyArray<[string, string, string]> = [
    ['« oublié »', OUBLI_WEB, 'forgot'],
    ['le code', CODE_WEB, 'otp'],
    ['le nouveau mot de passe', NOUVEAU_WEB, 'reset'],
    ['la vue de code partagée', VUE_OTP_WEB, 'otp'],
  ];

  it.each(ECRANS)('%s', (_quoi, chemin, espace) => {
    const cles = [...lire(chemin).matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g)].map((m) => m[1]);
    expect(cles.length).toBeGreaterThan(3);
    for (const locale of LOCALES) {
      for (const cle of cles) {
        const valeur = cle
          .split('.')
          .reduce<unknown>(
            (noeud, part) =>
              noeud !== null && typeof noeud === 'object'
                ? (noeud as Record<string, unknown>)[part]
                : undefined,
            dico(WEB, locale)[espace]
          );
        expect(`${locale} ${espace}.${cle} = ${typeof valeur}`).toBe(`${locale} ${espace}.${cle} = string`);
      }
    }
  });
});

describe('⑪ l’adresse du parcours ne voyage pas en URL, et survit à l’étape suivante', () => {
  it('le site la garde en session, jamais en paramètre', () => {
    // Journaux serveur, historique, referrer, mesure d'audience : une adresse
    // en URL finit dans quatre endroits qu'on ne contrôle pas.
    const source = lire(OUBLI_WEB);
    expect(source).toContain('sessionStorage.setItem("pwd_reset_email"');
    expect(source).not.toMatch(/push\("\/password\/verify\?/);
  });

  it('l’étape du code ne l’efface PAS en partant', () => {
    // Défaut corrigé par D97 : elle l'effaçait juste avant de pousser vers
    // l'écran qui l'AFFICHE (« Pour le compte : »), lequel montrait donc un
    // compte vide. C'est l'étape qui en a fini avec elle qui l'efface.
    const source = lire(CODE_WEB);
    const avantLeDepart = source.slice(0, source.indexOf('router.push("/password/reset")'));
    expect(avantLeDepart).not.toContain('removeItem("pwd_reset_email")');
    expect(lire(NOUVEAU_WEB)).toContain('removeItem("pwd_reset_email")');
  });

  it('le téléphone la garde en mémoire de module', () => {
    expect(lire(OUBLI_MOBILE)).toContain('setPendingReset(');
    expect(lire(CODE_MOBILE)).toContain('getPendingReset()');
  });
});

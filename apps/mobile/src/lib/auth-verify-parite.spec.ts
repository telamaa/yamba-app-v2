/**
 * auth-verify-parite.spec.ts — la vérification du code, et ce qui doit rester
 * vrai des DEUX côtés (D92).
 * ===========================================================================
 * Mêmes raisons qu'`auth-register-parite.spec.ts`, et la même méthode : ces
 * fiches lisent les deux fronts comme du texte, parce que c'est le seul
 * endroit du dépôt où un test peut les voir à la fois.
 *
 * Ce que D92 a trouvé, et que RIEN n'avait vu :
 *   • deux `maskEmail` divergents (le web plafonnait les étoiles à 9, le
 *     mobile n'en plafonnait aucune et publiait donc la longueur exacte de
 *     la partie locale) — deux fonctions qui s'écartent pendant des mois
 *     sans que personne ne le remarque ne portaient rien du tout ;
 *   • deux titres (« Vérification du code » / « Plus qu'une étape ! ») ;
 *   • deux mécaniques (validation d'office ici, clic obligatoire là) ;
 *   • deux formats de compteur (`9:29` / `09:41`).
 *
 * Aucun de ces écarts ne casse quoi que ce soit. Ils se reforment donc en
 * silence, exactement comme ils s'étaient formés.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

const FORMULAIRE_WEB = join(WEB, 'src/components/auth/forms/RegisterVerifyForm.tsx');
const VUE_MOBILE = join(MOBILE, 'src/components/auth/otp-verify-view.tsx');
const ECRAN_MOBILE = join(MOBILE, 'src/app/(auth)/register-verify.tsx');

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');

/**
 * Ces fiches balaient le fichier ENTIER, commentaires compris, et c'est
 * voulu : la doctrine du dépôt (D91, commit `4d3b6854`) dit que lorsqu'un
 * balayage grossier refuse, c'est au CODE de s'adapter — jamais à la fiche
 * d'apprendre une exception. Un commentaire qui CITE la chaîne qu'on vient
 * de retirer la réintroduit dans le fichier : il se reformule.
 */

function otp(front: string, locale: string): Record<string, string> {
  const dictionnaire = JSON.parse(
    readFileSync(join(front, `messages/${locale}/auth.json`), 'utf8')
  ) as { otp: Record<string, string> };
  return dictionnaire.otp;
}

const LOCALES = ['fr', 'en'];

describe('les deux écrans existent là où ces fiches les cherchent', () => {
  it.each([
    ['le formulaire web', FORMULAIRE_WEB],
    ['la vue partagée du mobile', VUE_MOBILE],
    ['l’écran mobile', ECRAN_MOBILE],
  ])('%s', (_quoi, chemin) => {
    // Sans ce garde-fou, un déplacement de fichier rendrait toutes les fiches
    // suivantes vertes pour la pire des raisons : elles ne liraient plus rien.
    expect(existsSync(chemin)).toBe(true);
  });
});

describe('① le masquage de l’adresse a disparu des DEUX fronts (D92 2A)', () => {
  /**
   * On masque une adresse que l'utilisateur n'a PAS tapée (défi de connexion,
   * récupération de compte). Celle-ci a été saisie trente secondes plus tôt
   * sur le même appareil : le masque ne protège de rien et détruit la seule
   * fonction utile de la ligne — attraper la faute de frappe.
   * `c*********a@g***.com` rend `gmial.com` et `gmail.com` identiques.
   */
  it('la fonction n’existe plus dans le code du mobile', () => {
    expect(lire(join(MOBILE, 'src/components/auth/auth-theme.ts'))).not.toContain('maskEmail');
    expect(lire(VUE_MOBILE)).not.toContain('maskEmail');
  });

  it('le formulaire web ne masque plus', () => {
    expect(lire(FORMULAIRE_WEB)).not.toContain('maskEmail');
  });

  it('le module de masquage du web n’existe plus du tout', () => {
    // Les CINQ appels du dépôt affichaient une adresse TAPÉE : aucun ne
    // relevait du motif. Une fonction sans emploi qui reste disponible est
    // une invitation à la rappeler « juste ici ».
    expect(existsSync(join(WEB, 'src/lib/auth/email-mask.ts'))).toBe(false);
  });

  it('les deux fronts proposent « Modifier » À CÔTÉ de l’adresse', () => {
    expect(lire(VUE_MOBILE)).toContain('restartLabel');
    expect(lire(ECRAN_MOBILE)).toContain("t('otp.changeEmail')");
    expect(lire(FORMULAIRE_WEB)).toContain('t("changeEmail")');
    for (const locale of LOCALES) {
      expect(typeof otp(MOBILE, locale).changeEmail).toBe('string');
      expect(typeof otp(WEB, locale).changeEmail).toBe('string');
    }
  });
});

describe('② un seul titre pour une seule étape (D92 3A)', () => {
  /**
   * Le site promettait une étape et en livrait deux : le serveur n'ouvre pas
   * de session à la vérification, et il poussait vers `/login`. Le téléphone
   * enchaînait la connexion — chez lui la promesse était vraie, et c'est lui
   * qui ne la faisait pas. On a aligné la MÉCANIQUE, pas les mots.
   */
  it('les deux dictionnaires disent la même chose, locale par locale', () => {
    for (const locale of LOCALES) {
      expect(otp(WEB, locale).title).toBe(otp(MOBILE, locale).title);
    }
  });

  it('l’ancienne étiquette administrative n’est plus nulle part', () => {
    for (const locale of LOCALES) {
      expect(otp(MOBILE, locale).title).not.toBe('Vérification du code');
      expect(otp(MOBILE, locale).title).not.toBe('Code verification');
    }
  });

  it('le web enchaîne bien la connexion, sinon le titre redevient un mensonge', () => {
    const source = lire(FORMULAIRE_WEB);
    expect(source).toContain('loginUser(');
    expect(source).toContain('readPendingPassword');
  });

  it('le mot de passe du parcours ne touche AUCUN stockage du navigateur', () => {
    // La contrepartie assumée de l'enchaînement : un rechargement le perd, et
    // le repli est la connexion préremplie. Le voir apparaître dans
    // `sessionStorage` serait un abaissement de sécurité silencieux.
    const etat = lire(join(WEB, 'src/lib/auth/register-flow-state.ts'));
    expect(etat).not.toContain('sessionStorage.setItem');
    expect(etat).not.toContain('localStorage');
  });
});

describe('③ la sixième frappe valide, des deux côtés (D92 4A)', () => {
  it('le mobile vérifie d’office', () => {
    expect(lire(VUE_MOBILE)).toContain('verifiedValue.current');
  });

  it('le web aussi — six cases pleines qui ne déclenchent rien sont une impasse', () => {
    const source = lire(FORMULAIRE_WEB);
    expect(source).toContain('canAutoVerify');
    expect(source).toContain('verifiedValue.current');
  });

  it('le web place le focus dans la première case à l’arrivée', () => {
    // Le défaut : le seul `focus()` du fichier vivait dans la branche de
    // succès du renvoi, c'est-à-dire presque jamais.
    const source = lire(FORMULAIRE_WEB);
    const avantLeRenvoi = source.slice(0, source.indexOf('resendOtpMutation'));
    expect(avantLeRenvoi).toContain('inputsRef.current[0]?.focus()');
  });
});

describe('④ les cases du web se voient (D92 5A)', () => {
  /**
   * Mesuré en thème sombre : fond `slate-950` sur une page `slate-950`,
   * bordure `slate-800` → 1,32:1, là où WCAG 2.1 SC 1.4.11 exige 3:1 pour la
   * limite d'un contrôle. L'écran ne disait nulle part où taper.
   */
  it('la case vide n’est plus de la couleur de la page', () => {
    const source = lire(FORMULAIRE_WEB);
    expect(source).not.toContain('dark:bg-slate-950');
    expect(source).toContain('dark:border-slate-600');
  });

  it('aucun troisième vert n’entre dans la charte', () => {
    // La case remplie virait `emerald-500` — la charte n'a que la mangue et
    // le teal.
    expect(lire(FORMULAIRE_WEB)).not.toContain('emerald');
  });
});

describe('⑤ un seul compte à rebours, et l’aide à l’heure (D92 6A)', () => {
  it('les deux fronts tiennent la règle dans un fichier PUR, pas dans l’écran', () => {
    expect(existsSync(join(MOBILE, 'src/lib/otp-display.ts'))).toBe(true);
    expect(existsSync(join(WEB, 'src/lib/auth/otp-display.ts'))).toBe(true);
  });

  it('les deux écrans appellent la règle plutôt que de recoder un seuil', () => {
    expect(lire(VUE_MOBILE)).toContain('showValidity(');
    expect(lire(FORMULAIRE_WEB)).toContain('showValidity(');
    expect(lire(VUE_MOBILE)).toContain('resendPhase(');
    expect(lire(FORMULAIRE_WEB)).toContain('resendPhase(');
  });

  it('les deux règles pures sont rigoureusement les mêmes', () => {
    // La recopie entre fronts est assumée (ils ne partagent pas de paquet
    // d'interface) ; c'est la DIVERGENCE qui ne l'est pas — voir les deux
    // `maskEmail`. On compare donc le code, aux guillemets près.
    const normaliser = (s: string): string =>
      s
        .slice(s.indexOf('export const OTP_EXPIRY_SECONDS'))
        .replace(/["']/g, '"')
        .replace(/\s+/g, ' ')
        .trim();
    expect(normaliser(lire(join(WEB, 'src/lib/auth/otp-display.ts')))).toBe(
      normaliser(lire(join(MOBILE, 'src/lib/otp-display.ts')))
    );
  });

  it('les deux tables de webmails sont rigoureusement les mêmes', () => {
    const table = (chemin: string): Record<string, string> => {
      const source = lire(chemin);
      const corps = source.slice(
        source.indexOf('WEBMAILS'),
        source.indexOf('export function webmailUrl')
      );
      return Object.fromEntries(
        [...corps.matchAll(/["']([\w.@-]+)["']\s*:\s*["']([^"']+)["']/g)].map((m) => [m[1], m[2]])
      );
    };
    const mobile = table(join(MOBILE, 'src/lib/webmail.ts'));
    const web = table(join(WEB, 'src/lib/auth/webmail.ts'));
    expect(Object.keys(mobile).length).toBeGreaterThan(20);
    expect(web).toEqual(mobile);
  });

  it('la phrase de renvoi ne s’ouvre plus sur un non-geste', () => {
    /**
     * « Pas reçu le code ? Vérifie tes spams OU » suivi d'un lien grisé
     * laissait un « ou » pendre dans le vide pendant soixante secondes. La
     * phrase d'attente doit donc se TENIR SEULE : pas de « ou » final.
     */
    for (const front of [MOBILE, WEB]) {
      for (const locale of LOCALES) {
        const attente = otp(front, locale).notReceivedWaiting;
        expect(typeof attente).toBe('string');
        expect(attente.trimEnd()).not.toMatch(/\b(ou|or)$/);
      }
    }
  });
});

describe('⑥ le badge de sécurité ne revient pas sur l’inscription (D92 1A)', () => {
  it('l’écran mobile de vérification d’inscription n’en porte plus', () => {
    expect(lire(ECRAN_MOBILE)).not.toContain("badge={t('otp.badge')}");
  });

  it('le formulaire web non plus', () => {
    const source = lire(FORMULAIRE_WEB);
    expect(source).not.toContain('Vérification sécurisée');
    expect(source).not.toContain('Secure verification');
    expect(source).not.toContain('ShieldCheck');
  });
});

describe('⑥ bis — un seul élément en 700 : le bouton (D91 5A)', () => {
  /**
   * Revue du 10/11 : « affiner la police des textes, pas assez fin, trop de
   * gras ». D91 avait tranché la règle pour l'inscription — titre 600,
   * libellés 500, corps 400, UN SEUL 700 — et l'écran de vérification ne
   * l'avait jamais reçue, exactement comme le badge de sécurité.
   *
   * Quand tout crie, rien ne porte : c'est la graisse du bouton qui le fait
   * avancer, et elle ne vaut que si elle est seule.
   */
  const GLYPHES = ['failureGlyph', 'checkboxMark'];

  it('la trousse du mobile n’a qu’un seul TEXTE en 700 ou plus', () => {
    const source = lire(join(MOBILE, 'src/components/auth/auth-kit.tsx'));
    // Chaque style est lu SÉPARÉMENT : une expression régulière qui part d'un
    // nom de style et cherche la graisse plus loin traverse les blocs voisins
    // et accuse les innocents (mesuré : 3 fautifs annoncés pour 1 réel).
    const lourds = [...source.matchAll(/\n {2}(\w+): \{([\s\S]*?)\n {2}\},/g)]
      .filter((m) => /fontWeight: (?:7|8)00/.test(m[2]))
      .map((m) => m[1])
      // Un glyphe dessiné (une croix, une coche) n'est pas un niveau de
      // lecture : sa graisse est un trait de dessin.
      .filter((nom) => !GLYPHES.includes(nom));
    expect(lourds).toEqual(['ctaLabel']);
  });

  it('le titre d’écran du mobile a reculé à 600', () => {
    const source = lire(join(MOBILE, 'src/components/auth/auth-screen.tsx'));
    expect(/title: \{[\s\S]*?fontWeight: 600/.test(source)).toBe(true);
  });

  it('la vue OTP du mobile ne porte plus aucun 700', () => {
    expect(lire(VUE_MOBILE)).not.toContain('fontWeight: 700');
  });

  it('le formulaire web n’a plus de 800, et son seul gras est le bouton', () => {
    const source = lire(FORMULAIRE_WEB);
    expect(source).not.toContain('font-extrabold');
    const gras = [...source.matchAll(/className="([^"]*font-bold[^"]*)"/g)].map((m) => m[1]);
    expect(gras).toHaveLength(1);
    expect(gras[0]).toContain('bg-[#FF9900]');
  });

  it('les deux fronts traitent « saisis ton code » comme un LIBELLÉ', () => {
    expect(lire(FORMULAIRE_WEB)).toContain('text-[13px] font-medium text-slate-500');
    // Côté mobile le libellé vaut 15 px : même rôle, autre distance de
    // lecture (D91 5A). Ce qui s'aligne est la GRAISSE, pas la taille.
    expect(/enterCode: \{[\s\S]*?fontWeight: 500/.test(lire(VUE_MOBILE))).toBe(true);
  });
});

describe('⑦ les textes du web sont enfin dans le dictionnaire (D92 7A)', () => {
  /**
   * Cause MÉCANIQUE de l'angle mort : le contrôle i18n de la CI ne lit que
   * les dictionnaires. Tant que l'écran portait ses quarante `fr ? … : …`
   * dans le composant, pas une de ses lignes n'était regardée — c'est ainsi
   * que « Secure signup » et « Secure sign-up » ont coexisté (D91).
   */
  it('le `buildCopy` du formulaire a disparu', () => {
    const source = lire(FORMULAIRE_WEB);
    expect(source).not.toContain('function buildCopy');
    expect(source).toContain('useTranslations("auth.otp")');
  });

  it('les deux fronts ont le MÊME espace de noms `otp`', () => {
    for (const locale of LOCALES) {
      expect(typeof otp(WEB, locale)).toBe('object');
      expect(typeof otp(MOBILE, locale)).toBe('object');
    }
  });

  it('les clés que les deux écrans partagent existent des deux côtés', () => {
    const partagees = [
      'title',
      'sentTo',
      'changeEmail',
      'validFor',
      'expired',
      'enterCode',
      'pasteHint',
      'verify',
      'hintEarly',
      'notReceived',
      'notReceivedWaiting',
      'resend',
      'resendIn',
      'openMailbox',
    ];
    for (const locale of LOCALES) {
      for (const cle of partagees) {
        expect(typeof otp(WEB, locale)[cle]).toBe('string');
        expect(typeof otp(MOBILE, locale)[cle]).toBe('string');
      }
    }
  });
});

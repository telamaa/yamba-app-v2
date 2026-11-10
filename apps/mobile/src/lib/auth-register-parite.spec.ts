/**
 * auth-register-parite.spec.ts — l'inscription, et ce qui doit rester vrai
 * des DEUX côtés.
 * ==========================================================================
 * D91 a fermé quatre écarts entre l'inscription du site et celle du
 * téléphone. Aucun des quatre ne casse quoi que ce soit : ils se reforment en
 * silence, exactement comme ils s'étaient formés.
 *
 * La preuve qu'ils le font : avant ce lot, le même badge s'écrivait
 * « Secure signup » sur le site et « Secure sign-up » sur le téléphone. Deux
 * orthographes pour quatre mots, et aucun contrôle pour le dire — les
 * formulaires d'auth du web portent leurs textes en ternaires
 * `fr ? … : …` DANS le composant, donc hors du contrôle i18n de la CI, qui
 * ne lit que les dictionnaires.
 *
 * Ces fiches lisent donc les deux fronts comme du texte. C'est inhabituel —
 * le harnais du mobile regarde une page du site — mais c'est le seul endroit
 * du dépôt où un test peut voir les deux à la fois, et la règle porte
 * justement sur leur accord. (`splash.spec.ts` lit déjà un script de la
 * racine pour la même raison.)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');
const FORMULAIRE_WEB = join(WEB, 'src/components/auth/forms/RegisterForm.tsx');

function dictionnaire(front: string, locale: string): Record<string, never> {
  return JSON.parse(readFileSync(join(front, `messages/${locale}/auth.json`), 'utf8')) as Record<
    string,
    never
  >;
}

function registre(front: string, locale: string): Record<string, string> {
  return (dictionnaire(front, locale) as unknown as { register: Record<string, string> }).register;
}

const sourceWeb = (): string => readFileSync(FORMULAIRE_WEB, 'utf8');

describe('la page d’inscription du site existe là où on la cherche', () => {
  it('le formulaire web est bien au chemin que ces fiches lisent', () => {
    // Sans ce garde-fou, un simple déplacement de fichier rendrait toutes les
    // fiches suivantes vertes pour la pire des raisons : elles ne liraient
    // plus rien.
    expect(existsSync(FORMULAIRE_WEB)).toBe(true);
  });
});

describe('① la mention de sécurité ne revient pas (D91)', () => {
  it('le dictionnaire mobile n’a plus de badge d’inscription', () => {
    for (const locale of ['fr', 'en']) {
      expect(registre(MOBILE, locale)).not.toHaveProperty('badge');
    }
  });

  it('le formulaire web ne porte plus la pilule « Inscription sécurisée »', () => {
    const source = sourceWeb();
    expect(source).not.toContain('Inscription sécurisée');
    expect(source).not.toContain('Secure signup');
  });
});

describe('② aucune ligne de réassurance ajoutée ne revient (revue du 10/11)', () => {
  /**
   * Première intention : remplacer le badge de sécurité par une promesse
   * VÉRIFIABLE sous le bouton — « Gratuit, sans engagement. ». Retirée à la
   * revue d'écran du 10/11 : sur un iPhone, l'écran ne tenait plus sur une
   * page, et une ligne que personne n'a demandée est la première à payer.
   *
   * Ce que la fiche tient n'est donc PAS « le texte est le bon » mais
   * « on n'en rajoute pas » : la page dit ce qu'elle fait, le reste est du
   * bruit que la hauteur d'écran facture.
   */
  it('la clé n’existe dans aucun des quatre dictionnaires', () => {
    for (const front of [MOBILE, WEB]) {
      for (const locale of ['fr', 'en']) {
        expect(registre(front, locale)).not.toHaveProperty('reassurance');
      }
    }
  });
});

describe('③ la confirmation du mot de passe reste supprimée des deux côtés', () => {
  it('le web n’a plus de champ de confirmation', () => {
    expect(sourceWeb()).not.toContain('passwordConfirm');
  });

  it('le web ne bloque plus le collage — NCSC et NIST le déconseillent', () => {
    // Bloquer le collage casse les gestionnaires de mots de passe et pousse
    // vers des mots de passe tapables, donc faibles.
    expect(sourceWeb()).not.toContain('onPaste');
  });
});

describe('④ les deux fronts offrent les MÊMES fournisseurs sociaux', () => {
  /**
   * Arbitrage du 09/11/2026 : Google et Facebook restent à l'écran des deux
   * côtés, inertes, le paramétrage viendra après. La règle que l'on tient
   * ici n'est donc pas « branché ou caché » mais **la parité** : un front qui
   * perdrait un fournisseur que l'autre garde est une divergence, et c'est
   * exactement par là que cette page avait commencé à se dédoubler.
   */
  it('le site propose Google et Facebook', () => {
    const source = sourceWeb();
    expect(source).toContain('<GoogleSignInButton');
    expect(source).toContain('copy.facebook');
  });

  it('le téléphone propose les deux, par le dictionnaire', () => {
    const ecran = readFileSync(join(MOBILE, 'src/app/(auth)/register.tsx'), 'utf8');
    expect(ecran).toContain("t('social.googleShort')");
    expect(ecran).toContain("t('social.facebookShort')");
    for (const locale of ['fr', 'en']) {
      const social = (dictionnaire(MOBILE, locale) as unknown as {
        social: Record<string, string>;
      }).social;
      for (const cle of ['google', 'facebook', 'googleShort', 'facebookShort']) {
        expect(typeof social[cle]).toBe('string');
      }
    }
  });

  it('le libellé COURT ne vole pas le verbe au lecteur d’écran', () => {
    /**
     * La rangée à deux colonnes n'a plus la place d'écrire « Continuer avec
     * Google ». Le nom seul suffit à l'œil — le séparateur juste au-dessus
     * porte le verbe — mais un lecteur d'écran, lui, annonce le bouton HORS
     * de son contexte : sans `accessibilityLabel`, il dirait « Google,
     * bouton », ce qui ne dit pas ce qui va se passer.
     */
    const ecran = readFileSync(join(MOBILE, 'src/app/(auth)/register.tsx'), 'utf8');
    expect(ecran).toContain("accessibilityLabel={t('social.google')}");
    expect(ecran).toContain("accessibilityLabel={t('social.facebook')}");
  });
});

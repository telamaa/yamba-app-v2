/**
 * pied-ecran.spec.ts — la ligne de sortie, et le gabarit unique qui la compose
 * (revue du 10/11, amendement D91 5A / D92).
 * ===========================================================================
 * Trois écrans portent la même ligne tout en bas, et elle y fait exactement le
 * même travail : offrir une porte à qui n'est pas au bon endroit.
 *
 *   • la connexion   — « Pas encore de compte ? » → l'inscription
 *   • l'inscription  — « Déjà un compte ? »       → la connexion
 *   • la bienvenue   — « Plus tard »              → on décline
 *
 * Les trois s'écrivaient différemment : 15 px `medium` + 15 px `bold` sur la
 * connexion, 15 px `semibold` sur la bienvenue, 13 px `regular` sur
 * l'inscription. UN rôle, trois tons — et sur le site, le même pied valait
 * 14 px gras sur la connexion contre 13 px maigres sur l'inscription.
 *
 * **Aucun de ces écarts ne casse quoi que ce soit, et c'est précisément
 * pourquoi ils ont tenu si longtemps.** Un `fontSize` recopié dans un
 * `StyleSheet.create` ne se signale jamais : ni `tsc`, ni le harnais, ni la
 * CI ne savent qu'une autre valeur existe trois fichiers plus loin. Seule une
 * comparaison capture à capture les montre — c'est la méthode de D91, D92 et
 * D95, et c'est une méthode qui demande un humain. Ces fiches prennent le
 * relais : à partir d'ici, le gabarit du pied d'écran est une RÈGLE et non un
 * souvenir de revue.
 *
 * La règle tenue n'est donc pas « 13 px » mais « UNE seule déclaration » :
 * les écrans ne connaissent plus de nombre, ils épandent `FooterLine`. Un
 * écran futur qui recopierait les trois lignes au lieu de l'importer rouvrirait
 * l'écart exactement comme la première fois — la fiche ② refuse l'un comme
 * l'autre.
 *
 * Ce que le gabarit ne porte PAS : l'encre. Les deux premiers mènent à l'écran
 * jumeau et prennent la mangue ; le troisième décline la proposition et garde
 * l'encre grise. Même gabarit, autre intention — une fiche qui exigerait la
 * même couleur partout effacerait cette nuance.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { FooterLine, Font } from '@/constants/typography';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

/** Les trois pieds d'écran du natif : le fichier, et la clé de style. */
const PIEDS_MOBILE: ReadonlyArray<[string, string, string]> = [
  ['la connexion', join(MOBILE, 'src/app/(auth)/login.tsx'), 'footerText'],
  ['la connexion (le lien)', join(MOBILE, 'src/app/(auth)/login.tsx'), 'footerLink'],
  ['l’inscription', join(MOBILE, 'src/app/(auth)/register.tsx'), 'footerText'],
  ['l’inscription (le lien)', join(MOBILE, 'src/app/(auth)/register.tsx'), 'footerLink'],
  ['la bienvenue', join(MOBILE, 'src/components/invite-kit.tsx'), 'tertiaryLabel'],
];

const FORM_CONNEXION_WEB = join(WEB, 'src/components/auth/forms/LoginForm.tsx');
const FORM_INSCRIPTION_WEB = join(WEB, 'src/components/auth/forms/RegisterForm.tsx');

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');

/**
 * Le corps d'une clé de `StyleSheet.create`, commentaires compris.
 *
 * Volontairement grossier — il s'arrête à la première accolade fermante, donc
 * un style qui contiendrait un objet imbriqué (une ombre iOS, par exemple) le
 * tromperait. Aucun des cinq n'en a, et le jour où l'un en aura, c'est la
 * fiche qui doit apprendre, pas le style qui doit se tordre : l'extraction
 * échouerait de façon BRUYANTE (bloc introuvable), jamais en silence.
 */
function blocDeStyle(source: string, cle: string): string {
  const debut = source.indexOf(`  ${cle}: {`);
  if (debut === -1) return '';
  const fin = source.indexOf('\n  },', debut);
  return fin === -1 ? '' : source.slice(debut, fin);
}

/**
 * Le paragraphe du pied, côté web, trouvé par l'EXPRESSION qu'il affiche.
 * On remonte au `<p` qui l'ouvre : c'est lui qui porte les classes.
 *
 * L'ancre est donnée en toutes lettres par l'appelant, et non construite ici
 * à partir d'une clé : les deux formulaires ne lisent pas leurs textes de la
 * même façon (la connexion est passée au dictionnaire en D96, l'inscription
 * porte encore ses ternaires). Une ancre devinée se serait tue le jour de la
 * migration — c'est d'ailleurs ce qui est arrivé, et le garde-fou
 * « le paragraphe n'est pas vide » l'a dit tout de suite.
 */
function paragrapheWeb(source: string, expression: string): string {
  const ancre = source.indexOf(expression);
  if (ancre === -1) return '';
  const ouverture = source.lastIndexOf('<p ', ancre);
  const fermeture = source.indexOf('</p>', ancre);
  return ouverture === -1 || fermeture === -1 ? '' : source.slice(ouverture, fermeture);
}

/** Les sept fichiers que ces fiches lisent — deux du site, cinq du natif. */
const A_LIRE: ReadonlyArray<[string, string]> = [
  ['le formulaire de connexion du site', FORM_CONNEXION_WEB],
  ['le formulaire d’inscription du site', FORM_INSCRIPTION_WEB],
  ...PIEDS_MOBILE.map(([quoi, chemin]): [string, string] => [`l’écran natif : ${quoi}`, chemin]),
];

describe('les pieds d’écran existent là où ces fiches les cherchent', () => {
  it.each(A_LIRE)('%s', (_quoi, chemin) => {
    // Sans ce garde-fou, un déplacement de fichier rendrait toutes les fiches
    // suivantes vertes pour la pire des raisons : elles ne liraient plus rien.
    expect(existsSync(chemin)).toBe(true);
  });
});

describe('① le gabarit dit la taille de la mention légale, et un interligne qui tient', () => {
  it('13 px, graisse de CORPS — un bas d’écran n’a pas à se signaler', () => {
    // 13 px est la taille de la mention légale (D91 7A) : le bas d'écran
    // recule d'un bloc. Et `regular`, parce que sur les deux liens la MANGUE
    // désigne déjà le lien — la graisse le signalerait une seconde fois.
    expect(FooterLine.fontSize).toBe(13);
    expect(FooterLine.fontFamily).toBe(Font.regular);
  });

  it('l’interligne suit la police, pas le nombre (D95)', () => {
    // Le défaut payé le 10/11 : Plus Jakarta se faisait roger ses jambages
    // partout où l'interligne avait été calé sur les métriques de SF Pro. Un
    // `lineHeight` ÉGAL au `fontSize` suffit à couper un « g » ou un « ç ».
    expect(FooterLine.lineHeight).toBe(18);
    expect(FooterLine.lineHeight / FooterLine.fontSize).toBeGreaterThanOrEqual(1.3);
  });

  it('le gabarit ne porte AUCUNE couleur', () => {
    // L'encre dit l'intention : mangue pour les deux portes qui mènent à
    // l'écran jumeau, gris pour celle qui décline. La mettre ici effacerait
    // la nuance au premier écran qui réutiliserait le gabarit.
    expect(Object.keys(FooterLine).sort()).toEqual(['fontFamily', 'fontSize', 'lineHeight']);
  });
});

describe('② aucun écran ne recopie les nombres — les trois épandent le gabarit', () => {
  it.each(PIEDS_MOBILE)('%s épand `FooterLine`', (_quoi, chemin, cle) => {
    const bloc = blocDeStyle(lire(chemin), cle);
    expect(bloc).not.toBe('');
    expect(bloc).toContain('...FooterLine');
  });

  it.each(PIEDS_MOBILE)('%s ne redéclare ni taille, ni interligne, ni police', (_quoi, chemin, cle) => {
    const bloc = blocDeStyle(lire(chemin), cle);
    // Une valeur posée APRÈS l'épandage l'emporterait sans bruit : c'est la
    // façon la plus discrète de rouvrir l'écart qu'on vient de fermer.
    expect(bloc).not.toMatch(/fontSize:/);
    expect(bloc).not.toMatch(/lineHeight:/);
    expect(bloc).not.toMatch(/fontFamily:/);
  });
});

describe('③ le site compose ses deux pieds comme le téléphone', () => {
  it.each([
    ['la connexion', FORM_CONNEXION_WEB, '{t("noAccount")}'],
    ['l’inscription', FORM_INSCRIPTION_WEB, '{copy.haveAccount}'],
  ])('%s porte la taille du gabarit, en clair dans la classe', (_quoi, chemin, ancre) => {
    const paragraphe = paragrapheWeb(lire(chemin), ancre);
    expect(paragraphe).not.toBe('');
    // `text-[13px]` plutôt que `text-sm` : 13 n'existe pas dans l'échelle de
    // Tailwind, et c'est le seul moyen d'écrire LE nombre du gabarit.
    expect(paragraphe).toContain(`text-[${FooterLine.fontSize}px]`);
    expect(paragraphe).not.toContain('text-sm');
  });

  it.each([
    ['la connexion', FORM_CONNEXION_WEB, '{t("noAccount")}'],
    ['l’inscription', FORM_INSCRIPTION_WEB, '{copy.haveAccount}'],
  ])('%s ne met aucune graisse sur le lien', (_quoi, chemin, ancre) => {
    const paragraphe = paragrapheWeb(lire(chemin), ancre);
    expect(paragraphe).not.toContain('font-bold');
    expect(paragraphe).not.toContain('font-semibold');
    // La mangue, elle, reste : c'est elle qui désigne le lien.
    expect(paragraphe).toContain('#FF9900');
  });
});

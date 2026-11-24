/**
 * editeur-de-recherche.spec.ts — l'éditeur dit ce qu'il fait (D103).
 * ===================================================================
 * Cinq défauts relevés sur les captures du 15/11, du plus coûteux au moins
 * visible. Trois se gardent par une RÈGLE (le mois à montrer, l'issue de
 * l'écran ville, la présence du fournisseur d'insets) ; deux sont de la mise
 * en forme et se gardent en épinglant ce qui SURVIT à un changement d'avis —
 * pas l'effet du jour (leçon de D98).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  focusDateOf,
  makeExact,
  makeFlex,
  monthIndexFor,
  monthsFrom,
  startOfDay,
} from '@/lib/search-date';

const MOBILE = resolve(__dirname, '../..');
const SRC = join(MOBILE, 'src');

describe('1A — le fournisseur d’insets existe, et il est SYNCHRONE', () => {
  const racine = readFileSync(join(SRC, 'app/_layout.tsx'), 'utf8');

  it('l’application monte un `SafeAreaProvider`', () => {
    // Le défaut : AUCUN fournisseur dans tout le dépôt, pour vingt-cinq
    // fichiers consommateurs. Sans lui, chaque `SafeAreaView` s'en remet à sa
    // propre vue native — qui rend ZÉRO dans une pile `transparentModal`,
    // d'où le titre du calendrier posé sur l'horloge.
    expect(racine).toContain('SafeAreaProvider');
  });

  it('il reçoit `initialMetrics`, sans quoi il commence lui aussi à zéro', () => {
    // Le fournisseur seul corrige au SECOND rendu : on troque un
    // chevauchement permanent contre un saut visible. Les deux vont ensemble.
    expect(racine).toContain('initialWindowMetrics');
    expect(racine).toMatch(/initialMetrics=\{initialWindowMetrics\}/);
  });

  it('il englobe la pile, pas l’inverse', () => {
    // Un fournisseur monté SOUS la pile ne sert pas les écrans poussés.
    const provider = racine.indexOf('<SafeAreaProvider');
    const pile = racine.indexOf('<Stack');
    expect(provider).toBeGreaterThanOrEqual(0);
    expect(pile).toBeGreaterThan(provider);
  });

  it('tout écran qui lit un inset le fait sous ce fournisseur', () => {
    // Garde-fou : la racine est le SEUL point de montage. Si un deuxième
    // fournisseur apparaît, les insets se mesurent deux fois et divergent.
    expect(racine.match(/<SafeAreaProvider/g)?.length ?? 0).toBe(1);
  });
});

describe('2A — la grille revient sur la période choisie', () => {
  const aujourdhui = startOfDay(new Date());
  const mois = monthsFrom(aujourdhui, 12);

  it('le mois du jour est le premier de la fenêtre', () => {
    expect(monthIndexFor(mois, aujourdhui)).toBe(0);
  });

  it('une date exacte désigne SON mois', () => {
    const dansTroisMois = new Date(
      aujourdhui.getFullYear(),
      aujourdhui.getMonth() + 3,
      10
    );
    expect(monthIndexFor(mois, dansTroisMois)).toBe(3);
  });

  it('une fenêtre flexible désigne le mois de son DÉBUT', () => {
    // Le défaut mesuré : « Cette semaine » annonçait « 15 – 21 novembre » et
    // la grille montrait janvier 2027, sans rien de surligné.
    const semaine = makeFlex('thisWeek', 'fr', aujourdhui);
    const debut = focusDateOf(semaine);
    expect(debut).not.toBeNull();
    expect(monthIndexFor(mois, debut)).toBe(0);
  });

  it('`focusDateOf` distingue les deux modes', () => {
    const exact = makeExact(aujourdhui);
    expect(focusDateOf(exact)).toEqual(aujourdhui);
    expect(focusDateOf(makeFlex('next3Months', 'fr', aujourdhui))).not.toBeNull();
  });

  it('rien de choisi ne fait défiler nulle part', () => {
    // Mieux vaut ne pas bouger que bouger au hasard.
    expect(focusDateOf(null)).toBeNull();
    expect(monthIndexFor(mois, null)).toBeNull();
    expect(monthIndexFor(mois, undefined)).toBeNull();
  });

  it('une cible hors de la fenêtre ne fait pas défiler', () => {
    const dansDixAns = new Date(aujourdhui.getFullYear() + 10, 0, 1);
    expect(monthIndexFor(mois, dansDixAns)).toBeNull();
  });

  it('le calendrier CONSOMME ces règles au lieu de les refaire', () => {
    const calendrier = readFileSync(join(SRC, 'components/search-calendar.tsx'), 'utf8');
    expect(calendrier).toContain('monthIndexFor(');
    expect(calendrier).toContain('focusDateOf(');
    expect(calendrier).toContain('scrollToIndex');
    // Sans ce garde-fou, `scrollToIndex` lève quand le mois visé n'est pas
    // encore monté — et les mois n'ont pas tous la même hauteur.
    expect(calendrier).toContain('onScrollToIndexFailed');
  });
});

describe('3A — l’écran ville offre une issue VISIBLE', () => {
  // Le geste de la page ville vit dans `components/city-picker.tsx` depuis le
  // lot « Publier » : la recherche et la publication le partagent, donc la
  // règle se vérifie là où elle est écrite — une fois, pour les deux.
  const ecran = readFileSync(join(SRC, 'components/city-picker.tsx'), 'utf8');
  const route = readFileSync(join(SRC, 'app/search/city.tsx'), 'utf8');

  it('l’état vide propose d’utiliser ce qui a été tapé', () => {
    // La sortie existait : la touche « rechercher » du clavier
    // (`onSubmitEditing`). Une issue qui n'existe que sur une touche n'est
    // pas une issue — c'est un raccourci pour qui la connaît déjà.
    expect(ecran).toContain('textes.useTyped(');
    expect(ecran).toMatch(/onPress=\{\(\) => commitTexte\(query\)\}/);
    // Et la route fournit bien la phrase, dans sa langue.
    expect(route).toContain("t('city.useTyped'");
  });

  it('elle vit DANS l’état vide, pas ailleurs', () => {
    const vide = ecran.indexOf('ListEmptyComponent');
    expect(vide).toBeGreaterThanOrEqual(0);
    const fin = ecran.indexOf('renderItem=', vide);
    expect(fin).toBeGreaterThan(vide);
    expect(ecran.slice(vide, fin)).toContain('textes.useTyped');
  });

  it('les deux messages distincts sont conservés', () => {
    // « aucune ville » parle de la SAISIE, « indisponibles » parle du
    // SERVICE : les confondre fait dire à l'écran que Paris n'existe pas.
    expect(ecran).toContain('textes.noResult');
    expect(ecran).toContain('textes.unavailable');
    expect(route).toContain("t('city.noResult')");
    expect(route).toContain("t('city.unavailable')");
  });

  it('la clé existe dans les DEUX dictionnaires et porte la ville', () => {
    for (const locale of ['fr', 'en'] as const) {
      const dico = JSON.parse(readFileSync(join(MOBILE, `messages/${locale}/search.json`), 'utf8'));
      expect(typeof dico.city?.useTyped).toBe('string');
      expect(dico.city.useTyped).toContain('{city}');
    }
  });
});

describe('4A/5A — la feuille d’édition', () => {
  const feuille = readFileSync(join(SRC, 'app/search/edit.tsx'), 'utf8');

  it('un champ vide ne porte pas la graisse d’un champ rempli', () => {
    // On épingle ce qui SURVIT à un changement d'avis : la valeur et l'espace
    // réservé ne doivent pas avoir le MÊME type, quel que soit le type choisi.
    expect(feuille).toMatch(/type=\{filled \? 'smallBold' : 'small'\}/);
  });

  it('la couleur CONFIRME la distinction, elle ne la porte pas seule', () => {
    // D99 5C : deux textes de même taille et même graisse qui ne diffèrent
    // que par la couleur ne forment pas une hiérarchie. On vérifie que les
    // DEUX signaux dépendent du même `filled`, sans chercher à découper le
    // fichier — une tranche maligne se trompe de bloc (celle-ci trouvait le
    // libellé du bouton d'envoi, et la fiche partait au rouge pour rien).
    expect(feuille).toMatch(/type=\{filled \? 'smallBold' : 'small'\}/);
    expect(feuille).toMatch(/themeColor=\{filled \? 'text' : 'textSecondary'\}/);
  });

  it('l’action destructrice n’est plus la seule couleur de l’en-tête', () => {
    // « Tout effacer » portait la mangue — celle de l'action PRIMAIRE.
    const entete = feuille.indexOf('styles.header');
    expect(entete).toBeGreaterThanOrEqual(0);
    const fin = feuille.indexOf('</View>', feuille.indexOf('clearAll'));
    expect(fin).toBeGreaterThan(entete);
    expect(feuille.slice(entete, fin)).not.toContain('Brand.mango');
  });

  it('elle reste atteignable et nommée — on ne la cache pas', () => {
    expect(feuille).toContain("t('edit.clearAll')");
    expect(feuille).toContain('onPress={clearSearchDraft}');
  });
});

/**
 * search-card-parite.spec.ts — la carte de résultat, et ce qui doit rester
 * vrai des DEUX côtés (D99).
 * ==========================================================================
 * Née d'une revue d'écran de l'utilisateur, captures des deux fronts en main.
 * Trois défauts y étaient visibles, et le premier ne se voyait QUE parce que
 * les deux applications étaient ouvertes côte à côte : **elles n'annonçaient
 * pas le même prix**. Même trajet, même colis de 2 kg — « ≈ 25 € » sur le
 * site, « ≈ 24,85 € » sur le téléphone.
 *
 * Le calcul était pourtant partagé. Ce qui divergeait, c'était la MISE EN
 * FORME, et il y en avait TROIS : `maximumFractionDigits: 0` sur le site (qui
 * arrondit à l'euro), un `formatCents` local au téléphone en
 * `minimumFractionDigits: 0` (qui écrit « 25 » pour un montant rond), et la
 * règle juste nulle part. Aucun des dix-neuf contrôles ne pouvait le voir :
 * `tsc` type une chaîne, le contrôle i18n compare FR et EN entre eux, et le
 * harnais de recette ne lit pas les centimes.
 *
 * C'est la quatrième fois que ce dépôt paie le même motif — `maskEmail`
 * (D92), la lecture des refus (D96), la liste des pages d'auth (D93) — et
 * cette fois sur un PRIX. D'où ces fiches : elles comparent les deux fronts
 * sur les CHIFFRES et sur les règles, pas sur les intentions.
 *
 * Elles lisent les deux fronts comme du TEXTE, comme les cinq fiches de
 * parité de l'auth : un `import` du code du site créerait une arête dans le
 * graphe Nx, et `targetDefaults.test.dependsOn = ["^build"]` ferait construire
 * user-ui avant chaque lancement des tests du téléphone (53,6 s mesurées).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

const CARTE_NATIVE = join(MOBILE, 'src/components/trip-result-card.tsx');
const RECHERCHE_NATIVE = join(MOBILE, 'src/lib/api/search.api.ts');
const CARTE_WEB = join(WEB, 'src/components/search/TripResultCard.tsx');
const CARTE_WEB_MOBILE = join(WEB, 'src/components/search/TripResultCardMobile.tsx');
const RECHERCHE_WEB = join(WEB, 'src/services/trip.api.ts');
const VUE_WEB = join(WEB, 'src/components/search/SearchResultsView.tsx');

const lire = (chemin: string): string => readFileSync(chemin, 'utf8');

/** Les trois cartes du produit : deux sur le site, une native. */
const TOUTES_LES_CARTES: Array<[string, string]> = [
  ['la carte large du site', CARTE_WEB],
  ['la carte étroite du site', CARTE_WEB_MOBILE],
  ['la carte native', CARTE_NATIVE],
];

describe('D99 1A — une seule mise en forme du prix, et elle est partagée', () => {
  it.each(TOUTES_LES_CARTES)('%s passe par la règle partagée', (_quoi, chemin) => {
    expect(lire(chemin)).toContain('formatAmountFromCents');
  });

  it.each(TOUTES_LES_CARTES)('%s n’arrondit plus à l’euro', (_quoi, chemin) => {
    // Le défaut exact : « ≈ 25 € » sur le site contre « ≈ 24,85 € » sur le
    // téléphone, pour le même trajet et le même colis.
    expect(lire(chemin)).not.toContain('maximumFractionDigits: 0');
  });

  it('le téléphone n’a plus sa propre mise en forme', () => {
    // `formatCents` local, en `minimumFractionDigits: 0` : il écrivait « 25 »
    // là où la règle demande « 25,00 ». Supprimé plutôt que corrigé — une
    // deuxième implémentation d'une règle finit toujours par diverger.
    expect(lire(CARTE_NATIVE)).not.toMatch(/function formatCents\(/);
  });

  it('la règle elle-même est la MÊME des deux côtés, à l’octet près', () => {
    // `pricing-example.ts` est volontairement recopié (ne pas tirer le moteur
    // dans un écran d'atterrissage) ; `pricing-example.spec.ts` compare les
    // deux fichiers entiers. Ici on vérifie que la règle y est bien.
    for (const chemin of [join(MOBILE, 'src/lib/pricing-example.ts'), join(WEB, 'src/lib/pricing-example.ts')]) {
      const source = lire(chemin);
      expect(source).toContain('PRICE_FRACTION_DIGITS = 2');
      expect(source).toContain('minimumFractionDigits: PRICE_FRACTION_DIGITS');
      expect(source).toContain('maximumFractionDigits: PRICE_FRACTION_DIGITS');
    }
  });
});

describe('D99 2A — « Nouveau Voyageur » ne s’affiche plus sur une carte de résultat', () => {
  it.each(TOUTES_LES_CARTES)('%s ne le rend plus', (_quoi, chemin) => {
    // C'était la branche `else` de « a une note » : sur une place de marché
    // jeune, c'était TOUTES les cartes. Un signal de confiance absent est
    // neutre ; un signal NÉGATIF affiché par défaut travaille contre le
    // produit (D91 1A, retournée).
    expect(lire(chemin)).not.toContain('newTripper');
  });

  it('le libellé reste dans les dictionnaires des écrans qui le MÉRITENT', () => {
    // Fiche membre, page du trajet, réservation : là, la question est posée.
    // On ne supprime pas une information, on la met où elle répond.
    const detail = JSON.parse(readFileSync(join(WEB, 'messages/fr/trip-detail.json'), 'utf8')) as Record<string, unknown>;
    expect(typeof detail.newTripper).toBe('string');
  });

  it('et il a quitté le dictionnaire de la RECHERCHE, des deux côtés', () => {
    for (const front of [WEB, MOBILE]) {
      const recherche = JSON.parse(readFileSync(join(front, 'messages/fr/search.json'), 'utf8')) as {
        card?: Record<string, unknown>;
        newTripper?: unknown;
      };
      expect(recherche.card?.newTripper).toBeUndefined();
      expect(recherche.newTripper).toBeUndefined();
    }
  });
});

describe('D99 3A — le gros chiffre est ce que l’envoi coûte', () => {
  it.each(TOUTES_LES_CARTES)('%s affiche le total pour le poids', (_quoi, chemin) => {
    expect(lire(chemin)).toContain('card.totalForWeight');
  });

  it.each(TOUTES_LES_CARTES)('%s ne garde plus de ligne d’exemple', (_quoi, chemin) => {
    // L'information de cette ligne EST devenue le gros chiffre : la garder
    // aurait dit deux fois la même chose, et la page devait s'alléger.
    const source = lire(chemin);
    expect(source).not.toContain('card.example');
    expect(source).not.toContain('exampleForWeight');
    expect(source).not.toContain('exampleParcel');
  });

  it.each(TOUTES_LES_CARTES)('%s ne dit la place restante que si elle CONTRAINT', (_quoi, chemin) => {
    // « 23 kg dispo » sous un colis de 2 kg est du décor : un signal de rareté
    // toujours présent n'est pas un signal.
    expect(lire(chemin)).toContain('LOW_CAPACITY_KG');
  });

  it('le seuil de rareté est le MÊME sur les trois cartes', () => {
    const seuils = TOUTES_LES_CARTES.map(([, chemin]) => {
      const m = /LOW_CAPACITY_KG = (\d+)/.exec(lire(chemin));
      return m ? m[1] : null;
    });
    expect(seuils.every((v) => v !== null)).toBe(true);
    expect(new Set(seuils).size).toBe(1);
  });

  it('le libellé du total dit les deux choses qu’il doit dire', () => {
    // Pour QUEL colis, et qu'il n'y a rien à ajouter ensuite. Le mot « kg » ne
    // doit plus désigner trois notions différentes dans la même colonne.
    for (const front of [WEB, MOBILE]) {
      const fr = JSON.parse(readFileSync(join(front, 'messages/fr/search.json'), 'utf8')) as {
        card: Record<string, string>;
      };
      expect(fr.card.totalForWeight).toContain('{kg}');
      expect(fr.card.totalForWeight).toContain('tout compris');
    }
  });
});

describe('D99 3C — estimer n’est pas filtrer', () => {
  it('les deux fronts demandent une ESTIMATION, pas un filtre', () => {
    expect(lire(RECHERCHE_WEB)).toContain('estimateKg');
    expect(lire(RECHERCHE_NATIVE)).toContain("query.set('estimateKg'");
  });

  it('le site n’envoie l’estimation que tant que rien n’est choisi', () => {
    // Un poids CHOISI l'emporte : il reprend ses deux pouvoirs (filtrer la
    // capacité, trier par prix).
    expect(lire(VUE_WEB)).toContain('estimateKg: weightKg === null ? DEFAULT_ESTIMATE_KG : undefined');
  });

  it('le colis supposé est le colis de RÉFÉRENCE, des deux côtés', () => {
    // Une seule valeur pour l'estimation et pour la projection locale, sinon
    // la carte et son repli parleraient de deux colis différents.
    expect(lire(VUE_WEB)).toContain('PRICING_EXAMPLE_PARAMS.exampleWeightKg');
    expect(lire(RECHERCHE_NATIVE)).toContain('PRICING_EXAMPLE_PARAMS.exampleWeightKg');
  });

  it('la carte lit le poids que le SERVEUR dit avoir utilisé', () => {
    // Pas la prop du front : le serveur renvoie `weightKg` dans le DTO, choisi
    // ou supposé. La carte n'a pas à savoir lequel des deux c'était.
    expect(lire(CARTE_WEB)).toContain('item.weightKg');
    expect(lire(CARTE_WEB_MOBILE)).toContain('item.weightKg');
    expect(lire(CARTE_NATIVE)).toContain('trip.weightKg');
  });

  it('le total du serveur fait foi, la projection locale n’est qu’un repli', () => {
    // Le serveur est le seul à connaître les paramètres de plateforme
    // (`weightPricingFromSettings`) : une estimation calculée côté client
    // diverge le jour où un réglage change, et personne ne le verrait.
    const natif = lire(CARTE_NATIVE);
    expect(natif.indexOf('trip.totalForWeight')).toBeLessThan(natif.indexOf('estimateShipperTotalCents('));
  });
});

describe('D99 4A — la carte est UN objet, pas trois bandes', () => {
  it('la carte large du site n’a plus ni bandeau ni trait', () => {
    const source = lire(CARTE_WEB);
    expect(source).not.toContain('border-b border-slate-100 bg-slate-50/50');
    expect(source).not.toContain('border-t border-slate-100 bg-slate-50/50');
    // Le quatrième trait, à l'intérieur du corps, est parti avec la ligne
    // d'exemple qu'il soulignait.
    expect(source).not.toContain('border-t border-slate-100 pt-1.5');
  });

  it('la carte étroite du site non plus', () => {
    const source = lire(CARTE_WEB_MOBILE);
    expect(source).not.toContain('border-b border-slate-100');
    expect(source).not.toContain('border-t border-slate-100');
  });

  it('la carte native non plus — sinon les deux fronts divergeraient', () => {
    const source = lire(CARTE_NATIVE);
    const entete = source.slice(source.indexOf('  header: {'), source.indexOf('  headerLeft'));
    const pied = source.slice(source.indexOf('  footer: {'), source.indexOf('  travelerName'));
    expect(entete).not.toContain('borderBottomWidth');
    expect(pied).not.toContain('borderTopWidth');
    expect(source).not.toContain('accents.footerBg');
  });

  it('le signal « c’est cliquable » est porté par le survol ET le focus', () => {
    // Les bandeaux y participaient sans le dire ; sans eux, l'état doit
    // porter seul — et le focus clavier doit rester visible (même exigence
    // que les cases de D92).
    const source = lire(CARTE_WEB);
    expect(source).toContain('hover:border-[#FF9900]/40');
    expect(source).toContain('focus-visible:ring-2');
  });
});

describe('D99 4B — la charte n’a que la mangue et le teal', () => {
  it.each(TOUTES_LES_CARTES)('%s ne porte plus de bleu', (_quoi, chemin) => {
    const source = lire(chemin);
    expect(source).not.toContain('bg-blue-50');
    expect(source).not.toContain('text-blue-700');
  });
});

/**
 * nombres-dans-la-langue.spec.ts — un nombre montré s'écrit dans la langue de
 * celui qui le lit (D108), sur les DEUX fronts.
 * ==========================================================================
 * Vu à l'écran le 21/11/2026, simulateur iPhone 15, interface en français :
 *
 *     29,62 €
 *     estimation pour 2.3 kg
 *
 * Une virgule et un point, deux lignes l'une sous l'autre, dans le même bloc.
 * Le prix passait par `formatAmountFromCents` (D99) ; le poids ne passait par
 * RIEN — `t('card.totalForWeight', { kg: 2.3 })` sur un gabarit `{kg}` nu.
 *
 * Le piège est dans ICU et il est contre-intuitif : un argument SIMPLE `{kg}`
 * n'est pas mis en forme. Mesuré avant d'écrire la correction :
 *
 *     new IntlMessageFormat('pour {kg} kg', 'fr').format({ kg: 2.3 })
 *       → « pour 2.3 kg »        ← identique en 'en'
 *
 * Il faut l'annoncer comme un nombre, `{kg, number}`, pour que la locale
 * s'applique. Cette forme existait DÉJÀ dans le dépôt — `booking.json`, sur
 * les deux fronts, sept clés — trois dossiers plus loin. Comme pour
 * `formatExpiresIn` et `formatMemberSince` (A224 lot 3), la bonne version
 * était écrite à côté : devant une classe de défaut, la première question
 * n'est pas « comment » mais « où est-ce déjà corrigé ».
 *
 * Pourquoi 2.3 et pas 2 : le plancher de facturation (D81) n'est pas entier.
 * Un poids rond n'a pas de séparateur, donc le défaut ne se voyait QUE sur le
 * cas par défaut — c'est-à-dire presque toutes les cartes.
 *
 * Ce que ces fiches épinglent est la RÈGLE, pas la correction du jour (leçon
 * D98) : aucun gabarit de poids nu nulle part, aucune mise en forme à la main
 * d'un poids, et le balayage se garde lui-même.
 *
 * Lecture par `readFileSync`, jamais par `import` : une arête vers user-ui
 * ferait construire le site avant les tests du téléphone (D93).
 *
 * PIÈGE, mesuré en écrivant cette fiche, et il vaut pour les SIX fiches de
 * parité du dépôt : `readFileSync` est invisible au graphe Nx. Les fichiers
 * du site ne sont pas des ENTRÉES du projet mobile, donc casser une clé de
 * `apps/user-ui/messages/` ne réinvalide pas le cache : `nx test` rejoue un
 * vert enregistré pendant que `npx jest` du même instant compte deux échecs.
 * Quand on touche à l'AUTRE front, lancer `npx jest` depuis `apps/mobile`,
 * ou `nx test … --skip-nx-cache`. Un contre-test qui ne rougit pas n'a pas
 * prouvé que la règle tient — il a prouvé que rien n'a tourné.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');

/** Les quatre paires de dictionnaires qui portent un poids, les deux fronts. */
const DICTIONNAIRES = [
  join(MOBILE, 'messages/fr/search.json'),
  join(MOBILE, 'messages/en/search.json'),
  join(MOBILE, 'messages/fr/tripDetail.json'),
  join(MOBILE, 'messages/en/tripDetail.json'),
  join(MOBILE, 'messages/fr/booking.json'),
  join(MOBILE, 'messages/en/booking.json'),
  join(WEB, 'messages/fr/search.json'),
  join(WEB, 'messages/en/search.json'),
  join(WEB, 'messages/fr/trip-detail.json'),
  join(WEB, 'messages/en/trip-detail.json'),
  join(WEB, 'messages/fr/booking.json'),
  join(WEB, 'messages/en/booking.json'),
];

const lire = (chemin: string) => readFileSync(chemin, 'utf8');

/** Tous les fichiers de messages des deux fronts, pour le balayage large. */
function tousLesDictionnaires(): string[] {
  const trouves: string[] = [];
  for (const racine of [join(MOBILE, 'messages'), join(WEB, 'messages')]) {
    // `withFileTypes` et non une liste de noms : `messages/` du site contient
    // un `.DS_Store` (macOS), et `readdirSync` sur un FICHIER jette ENOTDIR.
    // Un balayage qui suppose que tout est un dossier meurt sur le premier
    // intrus — ici un fichier que personne n'a écrit ni ne versionne.
    for (const langue of readdirSync(racine, { withFileTypes: true })) {
      if (!langue.isDirectory()) continue;
      const dossier = join(racine, langue.name);
      for (const fichier of readdirSync(dossier)) {
        if (fichier.endsWith('.json')) trouves.push(join(dossier, fichier));
      }
    }
  }
  return trouves;
}

describe('le gabarit : un poids s’annonce comme un nombre', () => {
  it('aucun dictionnaire des deux fronts ne garde un {kg} nu', () => {
    const fautifs = tousLesDictionnaires().filter((f) => lire(f).includes('{kg}'));
    expect(fautifs.map((f) => f.replace(resolve(MOBILE, '../..'), ''))).toEqual([]);
  });

  it('le balayage balaie vraiment — sinon il est vert pour la pire raison', () => {
    // Une fiche qui compte doit prouver qu'elle a compté (doctrine A224 lot 5).
    const tous = tousLesDictionnaires();
    expect(tous.length).toBeGreaterThanOrEqual(20);
    expect(tous.filter((f) => f.includes('/user-ui/')).length).toBeGreaterThanOrEqual(5);
    expect(tous.filter((f) => f.includes('/mobile/')).length).toBeGreaterThanOrEqual(5);
  });

  it('les douze dictionnaires porteurs de poids existent encore', () => {
    // Une liste qui nomme un fichier disparu survit à son objet et ment.
    for (const chemin of DICTIONNAIRES) expect(() => lire(chemin)).not.toThrow();
  });

  it('chaque poids déclaré l’est en {kg, number}', () => {
    for (const chemin of DICTIONNAIRES) {
      const texte = lire(chemin);
      if (!texte.includes('{kg')) continue;
      expect(texte).not.toMatch(/\{kg\s*\}/);
    }
  });
});

describe('le rendu : la langue change le séparateur', () => {
  /**
   * Pourquoi ces fiches n'importent PAS `intl-messageformat`.
   * ---------------------------------------------------------
   * Le harnais (A223) est `testEnvironment: node`, zéro dépendance nouvelle,
   * et n'exempte qu'UN paquet de `transformIgnorePatterns`, nommé à la main.
   * `intl-messageformat` est publié en ESM : l'importer ici exigeait une
   * seconde exemption, donc faire grossir le harnais pour tester… une
   * bibliothèque tierce. Sa doctrine écrite dit l'inverse : sortir la règle.
   *
   * Or `{kg, number}` délègue à `Intl.NumberFormat` — qui est dans Node. On
   * épingle donc le moteur réellement responsable du séparateur, et la
   * mesure du défaut d'origine reste reproductible à la main :
   *
   *   node -e "const {IntlMessageFormat}=require('intl-messageformat');
   *            console.log(new IntlMessageFormat('pour {kg} kg','fr')
   *                          .format({kg:2.3}))"
   *   → « pour 2.3 kg »   (identique en 'en' : l'argument simple ne se met
   *                        jamais en forme — c'est la CAUSE du défaut)
   */
  it('le séparateur décimal suit la langue, et c’est tout l’enjeu', () => {
    expect(new Intl.NumberFormat('fr').format(2.3)).toBe('2,3');
    expect(new Intl.NumberFormat('en').format(2.3)).toBe('2.3');
  });

  it('un poids ROND ne gagne pas de décimale — pourquoi le défaut a vécu', () => {
    // Sans décimale, les deux langues écrivent pareil : le défaut ne se
    // voyait QUE sur le plancher de facturation (2,3 kg, D81), c'est-à-dire
    // sur presque toutes les cartes, mais jamais sur un exemple rond.
    expect(new Intl.NumberFormat('fr').format(2)).toBe('2');
    expect(new Intl.NumberFormat('en').format(2)).toBe('2');
  });

  it('la concaténation à la main, elle, ne suit aucune langue', () => {
    // Ce que faisaient `toFixed(1)` et `String(kg)` : un point, toujours.
    expect((2.3).toFixed(1)).toBe('2.3');
    expect(String(2.3)).toBe('2.3');
  });

  it('les clés françaises des deux fronts annoncent bien un nombre', () => {
    const paires: Array<[string, string]> = [
      [join(MOBILE, 'messages/fr/search.json'), 'card.totalForWeight'],
      [join(WEB, 'messages/fr/search.json'), 'card.totalForWeight'],
      [join(MOBILE, 'messages/fr/search.json'), 'filters.lightParcel'],
      [join(WEB, 'messages/fr/search.json'), 'filters.lightParcel'],
      [join(MOBILE, 'messages/fr/tripDetail.json'), 'co2.amount'],
      [join(WEB, 'messages/fr/trip-detail.json'), 'co2.saved'],
    ];
    for (const [chemin, cle] of paires) {
      const dico = JSON.parse(lire(chemin));
      const gabarit = cle.split('.').reduce<any>((o, k) => o?.[k], dico);
      expect(typeof gabarit).toBe('string');
      expect(gabarit).toContain('{kg, number}');
    }
  });

  it('les deux fronts disent la MÊME chose de l’estimation', () => {
    // D99 bis : deux fronts corrigés dans la même passe avaient quand même
    // divergé. On compare le gabarit lui-même, pas l'intention.
    const natif = JSON.parse(lire(join(MOBILE, 'messages/fr/search.json')));
    const site = JSON.parse(lire(join(WEB, 'messages/fr/search.json')));
    expect(natif.card.totalForWeight).toBe(site.card.totalForWeight);
    expect(natif.filters.lightParcel).toBe(site.filters.lightParcel);
  });
});

describe('les sites d’appel : un poids n’est jamais mis en forme à la main', () => {
  const PORTEURS = [
    join(MOBILE, 'src/components/trip-result-card.tsx'),
    join(MOBILE, 'src/app/trip/[id].tsx'),
    join(MOBILE, 'src/app/(tabs)/index.tsx'),
    join(WEB, 'src/components/search/TripResultCard.tsx'),
    join(WEB, 'src/components/search/TripResultCardMobile.tsx'),
    join(WEB, 'src/components/trips/detail/OfferCard.tsx'),
    join(WEB, 'src/components/trips/detail/ItineraryCard.tsx'),
    join(WEB, 'src/components/trips/detail/BookingSummaryCard.tsx'),
  ];

  it('aucun des huit écrans ne passe un poids déjà mis en forme à un message', () => {
    // `toFixed` rend une CHAÎNE à point ; une chaîne dans {kg, number} ne se
    // localise plus — et « 12,5 » y donnerait NaN.
    for (const chemin of PORTEURS) {
      const source = lire(chemin);
      expect(source).not.toMatch(/kg:\s*[\w.]*\.toFixed\(/);
      expect(source).not.toMatch(/kg:\s*[\w.]*\.toLocaleString\(/);
      expect(source).not.toMatch(/kg:\s*format\w*Kg\(/);
    }
  });

  it('les huit écrans existent encore', () => {
    for (const chemin of PORTEURS) expect(() => lire(chemin)).not.toThrow();
  });

  it('l’arrondi du CO₂ rend un NOMBRE, et porte le même nom des deux côtés', () => {
    const natif = lire(join(MOBILE, 'src/lib/number-format.ts'));
    const site = lire(join(WEB, 'src/lib/number-format.ts'));
    for (const source of [natif, site]) {
      expect(source).toContain('export function roundToTenth(value: number): number');
      expect(source).toContain('Math.round(value * 10) / 10');
    }
  });

  it('le CO₂ des deux fronts passe par cet arrondi, pas par toFixed', () => {
    const natif = lire(join(MOBILE, 'src/app/trip/[id].tsx'));
    const itineraire = lire(join(WEB, 'src/components/trips/detail/ItineraryCard.tsx'));
    const resume = lire(join(WEB, 'src/components/trips/detail/BookingSummaryCard.tsx'));
    expect(natif).toContain("t('co2.amount', { kg: roundToTenth(co2) })");
    expect(itineraire).toContain('t("co2.saved", { kg: roundToTenth(co2Saved) })');
    expect(resume).toContain('t("booking.trust.co2", { kg: roundToTenth(co2Saved) })');
  });
});

describe('la règle a UNE adresse, et les deux fronts en ont la même copie', () => {
  const REGLE_NATIVE = join(MOBILE, 'src/lib/number-format.ts');
  const REGLE_WEB = join(WEB, 'src/lib/number-format.ts');

  it('les deux copies sont identiques OCTET POUR OCTET', () => {
    // Quatrième fichier de ce motif après `pricing-example.ts` (D99),
    // `search-facets.ts` (D100) et `parcel-weight.ts` (D101). La duplication
    // est VOULUE — le téléphone ne tire pas un paquet partagé dans un écran
    // d'atterrissage — et c'est cette fiche qui en paie le prix.
    expect(readFileSync(REGLE_NATIVE)).toEqual(readFileSync(REGLE_WEB));
  });

  it('elle n’importe rien : une règle pure reste chargeable partout', () => {
    // `search.api.ts` tire `expo-constants`, que le harnais ne sait pas lire
    // (D102). Une règle qui doit vivre dans les deux fronts n'importe rien.
    expect(lire(REGLE_NATIVE)).not.toMatch(/^\s*import /m);
  });

  it('elle porte les trois fonctions, et le site les utilise vraiment', () => {
    for (const chemin of [REGLE_NATIVE, REGLE_WEB]) {
      const source = lire(chemin);
      for (const nom of ['formatRating', 'roundToTenth', 'intlTagFor']) {
        expect(source).toContain(`export function ${nom}`);
      }
    }
  });
});

describe('les notes : aucune n’est plus mise en forme à la main', () => {
  /**
   * Vingt endroits mettaient une note en forme, de TROIS façons : `toFixed(1)`
   * nu (point toujours, faux en français), `toFixed(1).replace('.', ',')`
   * inconditionnel (virgule toujours, faux en anglais), et deux mises en forme
   * conscientes de la langue écrites à la main. Résultat à l'écran : le site
   * et le téléphone n'affichaient pas la même note pour le même Voyageur.
   *
   * Le balayage lit les SOURCES des deux fronts. Il tolère `toFixed` sur une
   * taille de fichier (KB/MB) : valeur nommée dehors par D108, à traiter avec
   * son propre parcours.
   */
  /**
   * La source SANS ses commentaires. Le balayage cherche une FORME DE CODE :
   * un commentaire qui nomme la forme interdite — et `number-format.ts` en
   * contient deux, puisque c'est lui qui l'interdit — n'est pas une
   * infraction. Cinquième fois ce mois-ci qu'une fiche vise un mot et touche
   * la phrase qui l'explique (A224 l'avait payé dès sa première fiche).
   */
  const sansCommentaires = (chemin: string) =>
    lire(chemin)
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  function fichiersSources(racine: string): string[] {
    const trouves: string[] = [];
    const parcourir = (dossier: string) => {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, e.name);
        if (e.isDirectory()) {
          if (e.name === 'node_modules') continue;
          parcourir(chemin);
        } else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.spec.ts')) {
          trouves.push(chemin);
        }
      }
    };
    parcourir(racine);
    return trouves;
  }

  const SOURCES = [
    ...fichiersSources(join(MOBILE, 'src')),
    ...fichiersSources(join(WEB, 'src')),
  ];

  it('le balayage voit vraiment les deux fronts', () => {
    // Un balayage qui ne balaie rien est vert pour la pire raison.
    expect(SOURCES.filter((f) => f.includes('/mobile/')).length).toBeGreaterThanOrEqual(50);
    expect(SOURCES.filter((f) => f.includes('/user-ui/')).length).toBeGreaterThanOrEqual(100);
  });

  it('aucun `.replace` ne substitue un séparateur décimal à la main', () => {
    const fautifs = SOURCES.filter((f) => {
      const source = sansCommentaires(f);
      return /\.replace\(\s*["'`]\.["'`]\s*,\s*["'`],["'`]/.test(source)
        || /\.replace\(\s*["'`]\.["'`]\s*,\s*\w+\s*===\s*["'`]fr["'`]/.test(source);
    });
    // `booking.state.ts` est nommé dans D108 : c'est une valeur de SAISIE,
    // relue par l'analyseur du formulaire, pas un nombre affiché.
    const attendus = fautifs.filter((f) => !f.endsWith('booking.state.ts'));
    expect(attendus.map((f) => f.split('/src/')[1])).toEqual([]);
  });

  it('aucune note ne passe par `toFixed`', () => {
    const fautifs = SOURCES.filter((f) =>
      /(rating|Rating|ratingsAvg)[^;\n]*\.toFixed\(/.test(sansCommentaires(f))
    );
    expect(fautifs.map((f) => f.split('/src/')[1])).toEqual([]);
  });

  it('la règle est bien celle qui sert, des deux côtés', () => {
    const natif = lire(join(MOBILE, 'src/components/trip-result-card.tsx'));
    const site = lire(join(WEB, 'src/components/search/TripResultCard.tsx'));
    for (const source of [natif, site]) {
      expect(source).toContain('formatRating(');
      expect(source).toContain('number-format');
    }
  });
});

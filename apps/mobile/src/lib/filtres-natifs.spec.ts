/**
 * filtres-natifs.spec.ts — les familles et la confiance sur le téléphone (D102).
 * ==============================================================================
 * Le serveur renvoyait SEPT champs de facettes ; `SearchFacets` n'en déclarait
 * DEUX. Cinq compteurs voyageaient à chaque recherche et étaient abandonnés au
 * `JSON.parse` — rien à ajouter côté serveur pour ce lot, le contrat était
 * simplement tenu d'un seul côté.
 *
 * D101 avait posé la moitié de la question (« qui sait ÉMETTRE ce paramètre ? »).
 * Ce fichier pose l'autre : **qui sait LIRE cette réponse ?**
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { SEARCH_FAMILIES, TRUST_FILTERS } from '@/lib/search-filters';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');
const TRIP = resolve(MOBILE, '../trip-service');

/** Les valeurs d'une liste `const X = [...] as const`. */
function litLaListe(source: string, ancre: string): string[] {
  const debut = source.indexOf(ancre);
  expect(debut).toBeGreaterThanOrEqual(0); // D98 — sans la garde, la tranche serait VIDE
  const fin = source.indexOf('] as const', debut);
  expect(fin).toBeGreaterThan(debut);
  return [...source.slice(debut, fin).matchAll(/["']([A-Z_]+)["']/g)].map((m) => m[1]);
}

describe('2A — les TROIS copies de la liste des familles sont la même', () => {
  const contrat = readFileSync(join(TRIP, 'src/dto/trip-search.dto.ts'), 'utf8');
  const site = readFileSync(join(WEB, 'src/components/search/search-results.types.ts'), 'utf8');

  it('le contrat, le site et le téléphone nomment les mêmes familles, dans le même ordre', () => {
    // Deux copies existaient déjà sans que rien ne les compare : une famille
    // ajoutée au serveur et oubliée sur un front disparaîtrait de ses filtres,
    // sans erreur et sans log. Le téléphone en est la troisième.
    const duContrat = litLaListe(contrat, 'export const PARCEL_FAMILIES');
    expect(duContrat.length).toBeGreaterThanOrEqual(8);
    expect(litLaListe(site, 'export const SEARCH_FAMILIES')).toEqual(duContrat);
    expect([...SEARCH_FAMILIES]).toEqual(duContrat);
  });

  it('chaque famille a son libellé dans les DEUX langues du téléphone', () => {
    // Angle mort connu (D83, `payment-i18n.spec.ts`) : une clé CALCULÉE
    // (`families.${f}`) se type toujours, et le contrôle i18n de la CI compare
    // FR et EN entre EUX — deux dictionnaires pareillement incomplets passent.
    for (const locale of ['fr', 'en'] as const) {
      const dico = JSON.parse(
        readFileSync(join(MOBILE, `messages/${locale}/search.json`), 'utf8')
      );
      for (const famille of SEARCH_FAMILIES) {
        expect(typeof dico.families?.[famille]).toBe('string');
        expect(dico.families[famille].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('1B — les quatre signaux de confiance', () => {
  it('le téléphone les nomme comme le site', () => {
    expect([...TRUST_FILTERS]).toEqual([
      'superTripper',
      'profileVerified',
      'instantBooking',
      'verifiedTicket',
    ]);
  });

  it('chacun a son libellé dans les deux langues', () => {
    for (const locale of ['fr', 'en'] as const) {
      const dico = JSON.parse(
        readFileSync(join(MOBILE, `messages/${locale}/search.json`), 'utf8')
      );
      for (const cle of TRUST_FILTERS) {
        expect(typeof dico.badges?.[cle]).toBe('string');
      }
    }
  });

  it('les libellés sont MOT POUR MOT ceux du site', () => {
    // Un même filtre ne change pas de nom d'un front à l'autre : c'est par là
    // que `maskEmail` (D92) et la mise en forme d'un prix (D99 1A) ont dérivé.
    for (const locale of ['fr', 'en'] as const) {
      const duSite = JSON.parse(
        readFileSync(join(WEB, `messages/${locale}/search.json`), 'utf8')
      );
      const duTel = JSON.parse(
        readFileSync(join(MOBILE, `messages/${locale}/search.json`), 'utf8')
      );
      for (const cle of TRUST_FILTERS) {
        expect(duTel.badges[cle]).toBe(duSite.badges[cle]);
      }
      for (const famille of SEARCH_FAMILIES) {
        expect(duTel.families[famille]).toBe(duSite.families[famille]);
      }
    }
  });
});

describe('1A — QUI sait LIRE la réponse du serveur', () => {
  const api = readFileSync(join(MOBILE, 'src/lib/api/search.api.ts'), 'utf8');
  const controleur = readFileSync(
    join(TRIP, 'src/controllers/trip-search.controller.ts'),
    'utf8'
  );

  it('le type de facettes du téléphone déclare TOUT ce que le serveur renvoie', () => {
    // Le défaut : cinq compteurs servis à chaque recherche, et jetés.
    for (const champ of [
      'totalCount',
      'modeCount',
      'superTripperCount',
      'profileVerifiedCount',
      'instantBookingCount',
      'verifiedTicketCount',
      'familyCounts',
    ]) {
      expect(controleur).toContain(champ);
      expect(api).toContain(champ);
    }
  });

  it('le téléphone sait ÉMETTRE les cinq filtres, comme le site', () => {
    const apiWeb = readFileSync(join(WEB, 'src/services/trip.api.ts'), 'utf8');
    for (const param of [
      'superTripper',
      'profileVerified',
      'instantBooking',
      'verifiedTicket',
      'families',
    ]) {
      expect(api).toContain(`query.set('${param}'`);
      expect(apiWeb).toContain(`qs.set("${param}"`);
    }
  });

  it('les filtres partent AUSSI avec les facettes, sinon les comptes mentent', () => {
    // « Combien de trajets en train » n'a de sens que parmi les filtres déjà
    // posés : les deux requêtes doivent voir le même périmètre.
    const debut = api.indexOf('function baseQuery');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = api.indexOf('export async function searchTrips', debut);
    expect(fin).toBeGreaterThan(debut);
    const corps = api.slice(debut, fin);
    expect(corps).toContain("query.set('superTripper'");
    expect(corps).toContain("query.set('families'");
  });
});

describe('3A/4A — l’écran réutilise les règles déjà écrites', () => {
  const ecran = readFileSync(join(MOBILE, 'src/app/(tabs)/index.tsx'), 'utf8');

  it('les nouvelles pastilles passent par la règle du zéro de D100', () => {
    // La règle avait été sortie dans un module partagé pour que le prochain
    // écran n'ait pas à la redécouvrir. C'est le premier à en profiter.
    expect(ecran.match(/isEmptyFacet\(/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it('la section « confiance » disparaît avec son contenu', () => {
    expect(ecran).toContain('trustVisibles.length > 0 &&');
  });

  it('l’indicateur de filtres compte les deux nouveaux', () => {
    const debut = ecran.indexOf('const filtersActive');
    expect(debut).toBeGreaterThanOrEqual(0);
    const fin = ecran.indexOf(';', debut);
    expect(fin).toBeGreaterThan(debut);
    const regle = ecran.slice(debut, fin);
    expect(regle).toContain('families.length > 0');
    expect(regle).toContain('TRUST_FILTERS.some');
  });

  it('la feuille DÉFILE, puisqu’elle porte quatre sections', () => {
    const debut = ecran.indexOf("{t('filters.title')}");
    expect(debut).toBeGreaterThanOrEqual(0);
    expect(ecran.slice(debut, debut + 600)).toContain('<ScrollView');
  });
});

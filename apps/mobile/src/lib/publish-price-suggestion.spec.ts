/**
 * publish-price-suggestion.spec.ts — la fourchette du marché (D111 ter).
 * ========================================================================
 * Le dernier écart entre les deux fronts : le site montrait une fourchette
 * par corridor sous le curseur de prix, le téléphone rien — et c'est l'écran
 * qui décide du revenu du Voyageur.
 *
 * Trois choses gardées ici :
 *   ① les NOMBRES sont ceux du site, lus dans son fichier à l'exécution ;
 *   ② le moteur de corridors est la MÊME copie des deux côtés, à l'octet ;
 *   ③ un corridor inconnu ne produit PAS une médiane déguisée en mesure.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { corridorBasePerKg, DEFAULT_BASE_PER_KG } from '@/lib/pricing-corridors';
import {
  SUGGESTION_V1,
  arrondiCommercial,
  bornesDeLaJauge,
  fourchetteDuCorridor,
  positionSurLaJauge,
  verdictDePrix,
} from '@/lib/publish-price-suggestion';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');
const CONFIG_DU_SITE = readFileSync(
  join(WEB, 'src/components/trips/create/create-trip.config.ts'),
  'utf8'
);

/** Un nombre nommé dans `PRICE_SUGGESTION_V1` côté site. */
function duSite(champ: string): number {
  const debut = CONFIG_DU_SITE.indexOf('export const PRICE_SUGGESTION_V1');
  expect(debut).toBeGreaterThanOrEqual(0); // D98 — sans garde, une tranche vide passe tout
  const bloc = CONFIG_DU_SITE.slice(debut, CONFIG_DU_SITE.indexOf('} as const', debut));
  const trouve = bloc.match(new RegExp(`${champ}:\\s*(-?[0-9.]+)`));
  expect(trouve).not.toBeNull();
  return Number((trouve as RegExpMatchArray)[1]);
}

const PARIS = { countryCode: 'FR', lat: 48.8566, lng: 2.3522 };
const DUBAI = { countryCode: 'AE', lat: 25.2048, lng: 55.2708 };
const LYON = { countryCode: 'FR', lat: 45.764, lng: 4.8357 };
const LOIN = new Date(2027, 0, 15);
const MAINTENANT = new Date(2026, 10, 25, 9, 0);

describe('① les modificateurs sont ceux du site', () => {
  it('les quatre pourcentages, nombre pour nombre', () => {
    expect(SUGGESTION_V1.basPct).toBe(duSite('lowPct'));
    expect(SUGGESTION_V1.hautPct).toBe(duSite('highPct'));
    expect(SUGGESTION_V1.volDirectMod).toBe(duSite('directFlightMod'));
    expect(SUGGESTION_V1.departSous3JoursMod).toBe(duSite('departureWithin3DaysMod'));
    expect(SUGGESTION_V1.departSous7JoursMod).toBe(duSite('departureWithin7DaysMod'));
  });

  it('et la base de repli vient du moteur partagé, pas d’un nombre recopié', () => {
    expect(SUGGESTION_V1.baseParDefaut).toBe(DEFAULT_BASE_PER_KG);
  });
});

describe('② les deux copies du moteur de corridors sont la MÊME', () => {
  it('octet pour octet', () => {
    // Cinquième fichier du motif (pricing-example, search-facets,
    // parcel-weight, number-format) : un import par-dessus la frontière d'un
    // projet est une dépendance de BUILD (D93).
    const ici = readFileSync(join(MOBILE, 'src/lib/pricing-corridors.ts'), 'utf8');
    const la = readFileSync(join(WEB, 'src/lib/pricing-corridors.ts'), 'utf8');
    expect(la).toBe(ici);
  });
});

describe('③ un corridor INCONNU ne se déguise pas en mesure', () => {
  it('sans aucun code pays, la fourchette n’est pas « précise »', () => {
    const f = fourchetteDuCorridor(
      { countryCode: null, lat: null, lng: null },
      { countryCode: null, lat: null, lng: null },
      { volDirect: false, dateDepart: null, maintenant: MAINTENANT }
    );
    expect(f.precis).toBe(false);
    expect(f.mediane).toBe(DEFAULT_BASE_PER_KG);
  });

  it('un seul code pays connu suffit à sortir du repli', () => {
    const f = fourchetteDuCorridor(PARIS, { countryCode: null, lat: null, lng: null }, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    expect(f.precis).toBe(true);
  });

  it('aucune ville du tout : on ne jette pas, on retombe', () => {
    const f = fourchetteDuCorridor(null, null, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    expect(f.precis).toBe(false);
    expect(f.mediane).toBeGreaterThan(0);
  });
});

describe('④ la fourchette suit le corridor et les modificateurs', () => {
  it('un long-courrier ne vaut pas un trajet intérieur', () => {
    const lointain = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    const interieur = fourchetteDuCorridor(PARIS, LYON, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    expect(lointain.mediane).toBeGreaterThan(interieur.mediane);
    expect(interieur.corridor.domestique).toBe(true);
    expect(lointain.corridor.domestique).toBe(false);
  });

  it('la base est bien celle du moteur de corridors', () => {
    const attendu = corridorBasePerKg('FR', 'AE', 5000).base;
    const f = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    // Même ordre de grandeur : la distance exacte est calculée en interne.
    expect(Math.abs(f.mediane - attendu)).toBeLessThan(attendu * 0.3);
  });

  it('un vol DIRECT vaut 5 % de plus', () => {
    const direct = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: true,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    const escale = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    expect(direct.mediane).toBeGreaterThan(escale.mediane);
    expect(direct.mediane / escale.mediane).toBeCloseTo(1 + SUGGESTION_V1.volDirectMod, 2);
  });

  it('un départ IMMINENT fait BAISSER la suggestion — et c’est voulu', () => {
    // Côté offre, un départ proche laisse moins de temps pour vendre ses
    // kilos. (La prime d'urgence existe, mais côté demande.)
    const demain = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: '2026-11-26',
      maintenant: MAINTENANT,
    });
    const dansUnMois = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: '2026-12-25',
      maintenant: MAINTENANT,
    });
    expect(demain.mediane).toBeLessThan(dansUnMois.mediane);
  });

  it('les trois paliers de délai : ≤ 3 jours, ≤ 7 jours, au-delà', () => {
    const a = (date: string) =>
      fourchetteDuCorridor(PARIS, DUBAI, {
        volDirect: false,
        dateDepart: date,
        maintenant: MAINTENANT,
      }).mediane;
    expect(a('2026-11-27')).toBeLessThan(a('2026-11-30')); // 2 j < 5 j
    expect(a('2026-11-30')).toBeLessThan(a('2026-12-20')); // 5 j < 25 j
  });

  it('une date ILLISIBLE ne casse rien et n’applique aucun modificateur', () => {
    const f = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: 'pas-une-date',
      maintenant: MAINTENANT,
    });
    const sansDate = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: false,
      dateDepart: null,
      maintenant: MAINTENANT,
    });
    expect(f.mediane).toBe(sansDate.mediane);
  });

  it('l’horloge est REÇUE : la même entrée rend toujours la même sortie', () => {
    const une = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: true,
      dateDepart: '2026-12-01',
      maintenant: MAINTENANT,
    });
    const deux = fourchetteDuCorridor(PARIS, DUBAI, {
      volDirect: true,
      dateDepart: '2026-12-01',
      maintenant: MAINTENANT,
    });
    expect(une).toEqual(deux);
  });

  it('bas < médiane < haut, toujours', () => {
    for (const date of [null, '2026-11-26', '2027-01-15']) {
      const f = fourchetteDuCorridor(PARIS, DUBAI, {
        volDirect: true,
        dateDepart: date,
        maintenant: MAINTENANT,
      });
      expect(f.bas).toBeLessThan(f.mediane);
      expect(f.mediane).toBeLessThan(f.haut);
    }
  });
});

describe('⑤ le verdict, et la jauge', () => {
  const f = fourchetteDuCorridor(PARIS, DUBAI, {
    volDirect: false,
    dateDepart: LOIN.toISOString().slice(0, 10),
    maintenant: MAINTENANT,
  });

  it('en dessous, dedans, au-dessus', () => {
    expect(verdictDePrix(f.bas - 1, f)).toBe('bas');
    expect(verdictDePrix(f.mediane, f)).toBe('juste');
    expect(verdictDePrix(f.haut + 1, f)).toBe('haut');
  });

  it('les BORNES de la fourchette sont « justes » — on ne punit pas l’exactitude', () => {
    expect(verdictDePrix(f.bas, f)).toBe('juste');
    expect(verdictDePrix(f.haut, f)).toBe('juste');
  });

  it('la jauge laisse une marge : un prix hors fourchette se voit DÉPASSER', () => {
    const bornes = bornesDeLaJauge(f);
    expect(bornes.min).toBeLessThan(f.bas);
    expect(bornes.max).toBeGreaterThan(f.haut);
  });

  it('la position reste toujours dans [0, 1]', () => {
    expect(positionSurLaJauge(0, f)).toBe(0);
    expect(positionSurLaJauge(999, f)).toBe(1);
    expect(positionSurLaJauge(f.mediane, f)).toBeGreaterThan(0);
    expect(positionSurLaJauge(f.mediane, f)).toBeLessThan(1);
  });

  it('une fourchette PLATE ne rend pas `NaN` — elle centre le repère', () => {
    // `NaN` traverse toutes les comparaisons sans en déclencher une seule :
    // une position `NaN` donnerait un `left: NaN%` silencieux.
    const plate = { ...f, bas: 10, mediane: 10, haut: 10 };
    expect(Number.isFinite(positionSurLaJauge(10, plate))).toBe(true);
  });

  it('l’arrondi commercial tombe sur un demi-euro', () => {
    expect(arrondiCommercial(11.47)).toBe(11.5);
    expect(arrondiCommercial(11.2)).toBe(11);
    expect(arrondiCommercial(9.76)).toBe(10);
  });
});

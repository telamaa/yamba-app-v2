/**
 * publish-pricing.spec.ts — l'offre du Voyageur (lot « Publier »).
 * =================================================================
 * Ces nombres décident d'un revenu. Les fiches gardent trois choses :
 *   ① ils sont ceux du SITE, lus dans son fichier à l'exécution — deux fronts
 *     qui ne s'accordent pas sur les bornes d'un tarif publient deux offres
 *     différentes pour un même geste ;
 *   ② le pas-à-pas ne sort jamais du domaine, et ne fabrique pas de
 *     flottants à quinze décimales ;
 *   ③ un forfait que la capacité ne peut pas contenir est SUSPENDU — pas
 *     fautif, pas effacé (RG-B-29).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  CAPACITES_USUELLES_KG,
  CAPACITE_MAX_KG,
  CAPACITE_MIN_KG,
  CAPACITE_PAS_KG,
  FRANCHISE_CABINE_KG,
  FRANCHISE_SOUTE_KG,
  PRIX_MAX_PAR_KG,
  PRIX_MIN_PAR_KG,
  PRIX_PAS_PAR_KG,
  PRIX_USUELS_PAR_KG,
  SURCHARGE_MAX_PCT,
  SURCHARGE_MIN_PCT,
  SURCHARGE_PAS_PCT,
  cranCapacite,
  cranPrix,
  cranSurcharge,
  forfaitActif,
  forfaitParKilo,
  gainSiToutPartCents,
  manquesOffre,
  peutCranerCapacite,
  peutCranerPrix,
  rameneCapacite,
  ramenePrix,
} from '@/lib/publish-pricing';

const MOBILE = resolve(__dirname, '../..');
const WEB = resolve(MOBILE, '../user-ui');
const CONFIG_DU_SITE = readFileSync(
  join(WEB, 'src/components/trips/create/create-trip.config.ts'),
  'utf8'
);

/** `export const X = { min: 5, max: 20, step: 0.5 }` → les trois nombres. */
function litLaBorne(nom: string): { min: number; max: number; step: number } {
  const debut = CONFIG_DU_SITE.indexOf(`export const ${nom} =`);
  expect(debut).toBeGreaterThanOrEqual(0); // D98 — sans garde, une tranche vide passe tout
  const fin = CONFIG_DU_SITE.indexOf('}', debut);
  expect(fin).toBeGreaterThan(debut);
  const tranche = CONFIG_DU_SITE.slice(debut, fin);
  const nombre = (champ: string) => {
    const trouve = tranche.match(new RegExp(`${champ}:\\s*([0-9.]+)`));
    expect(trouve).not.toBeNull();
    return Number((trouve as RegExpMatchArray)[1]);
  };
  return { min: nombre('min'), max: nombre('max'), step: nombre('step') };
}

describe('① les bornes sont celles du site, pas les nôtres', () => {
  it('le prix au kilo : mêmes min, max et pas', () => {
    expect(litLaBorne('PRICE_PER_KG_RANGE')).toEqual({
      min: PRIX_MIN_PAR_KG,
      max: PRIX_MAX_PAR_KG,
      step: PRIX_PAS_PAR_KG,
    });
  });

  it('la capacité : mêmes min, max et pas', () => {
    expect(litLaBorne('CAPACITY_KG_RANGE')).toEqual({
      min: CAPACITE_MIN_KG,
      max: CAPACITE_MAX_KG,
      step: CAPACITE_PAS_KG,
    });
  });

  it('le supplément : mêmes min, max et pas', () => {
    expect(litLaBorne('SURCHARGE_PCT_RANGE')).toEqual({
      min: SURCHARGE_MIN_PCT,
      max: SURCHARGE_MAX_PCT,
      step: SURCHARGE_PAS_PCT,
    });
  });

  it('les deux franchises de bagage sont celles du site', () => {
    expect(CONFIG_DU_SITE).toContain(`export const CHECKED_BAG_KG = ${FRANCHISE_SOUTE_KG}`);
    expect(CONFIG_DU_SITE).toContain(`export const CABIN_BAG_KG = ${FRANCHISE_CABINE_KG}`);
  });

  it('les valeurs d’usage tombent DANS le domaine et sur un cran', () => {
    // Une valeur d'usage hors domaine serait ramenée en silence au tap : la
    // pastille afficherait 23 et poserait 20.
    for (const prix of PRIX_USUELS_PAR_KG) expect(ramenePrix(prix)).toBe(prix);
    for (const kg of CAPACITES_USUELLES_KG) expect(rameneCapacite(kg)).toBe(kg);
  });

  it('les capacités d’usage contiennent les deux franchises', () => {
    // Sinon le forfait « bagage entier » reste suspendu sans qu'aucun geste
    // d'usage ne permette de le débloquer.
    expect(CAPACITES_USUELLES_KG).toContain(FRANCHISE_SOUTE_KG);
    expect(CAPACITES_USUELLES_KG).toContain(FRANCHISE_CABINE_KG);
  });
});

describe('② le pas-à-pas reste dans le monde réel', () => {
  it('il ne franchit jamais les bornes', () => {
    expect(cranPrix(PRIX_MIN_PAR_KG, -1)).toBe(PRIX_MIN_PAR_KG);
    expect(cranPrix(PRIX_MAX_PAR_KG, 1)).toBe(PRIX_MAX_PAR_KG);
    expect(cranCapacite(CAPACITE_MIN_KG, -1)).toBe(CAPACITE_MIN_KG);
    expect(cranCapacite(CAPACITE_MAX_KG, 1)).toBe(CAPACITE_MAX_KG);
  });

  it('le bouton s’éteint exactement là où le cran ne change plus rien', () => {
    expect(peutCranerPrix(PRIX_MIN_PAR_KG, -1)).toBe(false);
    expect(peutCranerPrix(PRIX_MIN_PAR_KG, 1)).toBe(true);
    expect(peutCranerCapacite(CAPACITE_MAX_KG, 1)).toBe(false);
  });

  it('il ne fabrique pas de 10.500000000000002', () => {
    let prix = PRIX_MIN_PAR_KG;
    for (let i = 0; i < 30; i += 1) prix = cranPrix(prix, 1);
    expect(prix).toBe(PRIX_MAX_PAR_KG);
    expect(String(prix)).not.toContain('000000');
  });

  it('une valeur hors domaine est ramenée, pas refusée', () => {
    expect(ramenePrix(0)).toBe(PRIX_MIN_PAR_KG);
    expect(ramenePrix(999)).toBe(PRIX_MAX_PAR_KG);
    expect(ramenePrix(10.3)).toBe(10.5);
    expect(rameneCapacite(7.4)).toBe(7);
  });

  it('le supplément avance de cinq en cinq, entre 5 et 50', () => {
    expect(cranSurcharge(20, 1)).toBe(25);
    expect(cranSurcharge(SURCHARGE_MIN_PCT, -1)).toBe(SURCHARGE_MIN_PCT);
    expect(cranSurcharge(SURCHARGE_MAX_PCT, 1)).toBe(SURCHARGE_MAX_PCT);
  });
});

describe('③ ce que ça rapporte', () => {
  it('le gain est en CENTS entiers — jamais un flottant monétaire', () => {
    expect(gainSiToutPartCents(9.5, 12)).toBe(11400);
    expect(Number.isInteger(gainSiToutPartCents(10.5, 7) as number)).toBe(true);
  });

  it('sans prix ou sans capacité, il n’y a pas de gain — et surtout pas zéro', () => {
    // Zéro est un MONTANT : il dirait « ton trajet ne rapporte rien », là où
    // la vérité est « tu n'as pas encore fixé ton prix ».
    expect(gainSiToutPartCents(null, 12)).toBeNull();
    expect(gainSiToutPartCents(10, null)).toBeNull();
    expect(gainSiToutPartCents(0, 12)).toBeNull();
  });

  it('la commission n’est PAS retranchée (D16 : son prix est son net)', () => {
    expect(gainSiToutPartCents(10, 10)).toBe(10000);
  });
});

describe('④ un forfait suspendu n’est pas un forfait fautif (RG-B-29)', () => {
  it('il faut un prix ET une capacité qui contienne la franchise', () => {
    expect(forfaitActif(40, FRANCHISE_SOUTE_KG, 23)).toBe(true);
    expect(forfaitActif(40, FRANCHISE_SOUTE_KG, 12)).toBe(false);
    expect(forfaitActif(null, FRANCHISE_SOUTE_KG, 30)).toBe(false);
    expect(forfaitActif(0, FRANCHISE_SOUTE_KG, 30)).toBe(false);
  });

  it('une capacité trop petite ne rend PAS l’étape fautive', () => {
    const manques = manquesOffre({
      prixParKiloEur: 10,
      capaciteKg: 12,
      forfaitSouteEur: 40,
      forfaitCabineEur: null,
    });
    expect(manques).toEqual([]);
  });

  it('un forfait à zéro, lui, est bien une erreur', () => {
    expect(
      manquesOffre({ prixParKiloEur: 10, capaciteKg: 12, forfaitSouteEur: 0, forfaitCabineEur: null })
    ).toEqual(['forfaitSoute']);
  });

  it('le prix et la capacité manquants sont nommés séparément', () => {
    expect(
      manquesOffre({
        prixParKiloEur: null,
        capaciteKg: null,
        forfaitSouteEur: null,
        forfaitCabineEur: null,
      })
    ).toEqual(['prix', 'capacite']);
  });

  it('le forfait se relit en €/kg — c’est ce qui montre qu’on brade', () => {
    expect(forfaitParKilo(46, FRANCHISE_SOUTE_KG)).toBe(2);
    expect(forfaitParKilo(null, FRANCHISE_SOUTE_KG)).toBeNull();
  });
});

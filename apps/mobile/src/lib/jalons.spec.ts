/**
 * jalons.spec.ts — le récit du transport (D116, A39).
 * =====================================================
 * Ce que ces fiches tiennent :
 *   ① les trois crans, dans l'ordre du SERVEUR (la copie confrontée au
 *     contrat réel) ;
 *   ② un seul geste offert — le suivant — parce que le serveur refuse tout
 *     saut et qu'un refus sans explication est un cul-de-sac ;
 *   ③ la lecture défensive des événements : doublons, désordre, cran
 *     inconnu, liste absente ;
 *   ④ ils restent FACULTATIFS : ne rien cocher n'empêche pas de remettre.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { TrackingStepSchema } from '@packages/api-contracts';

import {
  JALONS,
  jalonEnvoyable,
  jalonSuivant,
  jalonsConfirmes,
} from '@/lib/jalons';

const MOBILE = resolve(__dirname, '../..');
const SERVEUR = resolve(MOBILE, '../deal-service');

describe('① les trois crans, dans l’ordre du serveur', () => {
  it('la copie dit la même chose que le contrat Zod', () => {
    expect([...JALONS]).toEqual([...TrackingStepSchema.options]);
  });

  it('et le même ordre que `TRACKING_SEQUENCE`, lu dans le serveur', () => {
    // La SÉQUENCE est la règle, et elle vit dans la machine à états. Lue
    // avec `readFileSync` : un import à travers une frontière de projet est
    // une dépendance de build (D93).
    const machine = readFileSync(
      join(SERVEUR, 'src/services/booking-state-machine.ts'),
      'utf8'
    );
    const debut = machine.indexOf('export const TRACKING_SEQUENCE = [');
    expect(debut).toBeGreaterThan(-1);
    const fin = machine.indexOf('] as const', debut);
    const ordre = [...machine.slice(debut, fin).matchAll(/"([A-Z_]+)"|'([A-Z_]+)'/g)].map(
      (m) => m[1] ?? m[2]
    );
    expect(ordre).toEqual([...JALONS]);
  });
});

describe('② un seul geste : le suivant', () => {
  it('rien de confirmé → le premier cran', () => {
    expect(jalonSuivant([])).toBe('AT_AIRPORT');
  });

  it('deux confirmés → le troisième', () => {
    expect(jalonSuivant(['AT_AIRPORT', 'FLIGHT_DEPARTED'])).toBe('FLIGHT_ARRIVED');
  });

  it('tout confirmé → plus rien à proposer', () => {
    expect(jalonSuivant([...JALONS])).toBeNull();
  });

  it('un cran qui SAUTE son tour n’est pas envoyable', () => {
    // Le serveur répondrait `TRACKING_STEP_NOT_ALLOWED`, et le Voyageur
    // lirait un refus que rien n'explique.
    expect(jalonEnvoyable([], 'FLIGHT_ARRIVED')).toBe(false);
    expect(jalonEnvoyable([], 'AT_AIRPORT')).toBe(true);
  });

  it('un cran DÉJÀ confirmé n’est pas envoyable deux fois', () => {
    expect(jalonEnvoyable(['AT_AIRPORT'], 'AT_AIRPORT')).toBe(false);
  });

  it('la garde est APPELÉE par l’écran, pas seulement écrite ici', () => {
    // Une garde que personne n'appelle est un commentaire (D110). Celle-ci
    // sert à l'appui, pas au rendu : `jalonSuivant` décide de ce qui est
    // AFFICHÉ, et le cran peut avoir été confirmé entre le rendu et le
    // doigt — double appui, ou relecture arrivée entre-temps.
    //
    // Une fonction `avancementDesJalons` (« N sur 3 ») vivait ici à côté,
    // testée et affichée nulle part : l'écran montre LES TROIS crans, et un
    // compteur posé devant trois lignes visibles compte ce qu'on voit déjà.
    const ecran = readFileSync(join(MOBILE, 'src/app/deal/[id]/deliver.tsx'), 'utf8');
    expect(ecran).toContain('jalonEnvoyable');
    expect(ecran).toMatch(/if \(!jalonEnvoyable\([\s\S]{0,40}\)\) return;/);
  });
});

describe('③ la lecture des événements est défensive', () => {
  it('une liste absente ne confirme rien', () => {
    for (const brut of [undefined, null, 'nawak', 42, {}]) {
      expect(jalonsConfirmes(brut)).toEqual([]);
    }
  });

  it('elle lit le champ `step` des événements servis', () => {
    expect(
      jalonsConfirmes([{ step: 'AT_AIRPORT', at: '2026-11-27T10:00:00.000Z' }])
    ).toEqual(['AT_AIRPORT']);
  });

  it('un DOUBLON ne compte pas deux fois', () => {
    // L'app lit une liste d'ÉVÉNEMENTS, pas un ensemble : deux lignes pour
    // le même cran décaleraient le geste suivant.
    expect(jalonsConfirmes([{ step: 'AT_AIRPORT' }, { step: 'AT_AIRPORT' }])).toEqual([
      'AT_AIRPORT',
    ]);
    expect(jalonSuivant(jalonsConfirmes([{ step: 'AT_AIRPORT' }, { step: 'AT_AIRPORT' }]))).toBe(
      'FLIGHT_DEPARTED'
    );
  });

  it('le DÉSORDRE est remis dans l’ordre du récit', () => {
    // Deux événements écrits dans la même seconde peuvent revenir inversés.
    expect(
      jalonsConfirmes([{ step: 'FLIGHT_DEPARTED' }, { step: 'AT_AIRPORT' }])
    ).toEqual(['AT_AIRPORT', 'FLIGHT_DEPARTED']);
  });

  it('un cran INCONNU est ignoré, et ne décale pas la séquence', () => {
    // Un cran ajouté côté serveur avant que l'app ne le connaisse ferait
    // sinon proposer le mauvais geste suivant.
    const confirmes = jalonsConfirmes([{ step: 'AT_AIRPORT' }, { step: 'TELEPORTED' }]);
    expect(confirmes).toEqual(['AT_AIRPORT']);
    expect(jalonSuivant(confirmes)).toBe('FLIGHT_DEPARTED');
  });

  it('un événement sans `step` lisible est ignoré', () => {
    expect(jalonsConfirmes([{ at: '2026-11-27T10:00:00.000Z' }, null, 7])).toEqual([]);
  });
});

describe('④ les jalons sont facultatifs', () => {
  const ecran = readFileSync(join(MOBILE, 'src/app/deal/[id]/deliver.tsx'), 'utf8');

  it('aucun jalon n’est exigé pour remettre', () => {
    // Ils servent l'Expéditeur, qui regarde son suivi pendant le vol ; ils
    // ne sont pas une condition du métier. La liste des manques de la remise
    // ne les mentionne donc nulle part.
    const regle = readFileSync(join(MOBILE, 'src/lib/remise.ts'), 'utf8');
    expect(regle).not.toContain('jalon');
    expect(regle).not.toContain('JALONS');
  });

  it('l’écran n’offre QUE le cran suivant', () => {
    expect(ecran).toContain('jalonSuivant');
    // Pas de case à cocher par cran : trois cases inviteraient un refus.
    expect(ecran).not.toMatch(/JALONS\.map[\s\S]{0,400}onToggleAction/);
  });

  it('un jalon refusé ne bloque pas la remise, et le dit', () => {
    expect(ecran).toContain("t('milestones.failed')");
    const dict = JSON.parse(
      readFileSync(join(MOBILE, 'messages/fr/deliver.json'), 'utf8')
    ) as { milestones: { failed: string } };
    expect(dict.milestones.failed).toContain('remettre');
  });
});

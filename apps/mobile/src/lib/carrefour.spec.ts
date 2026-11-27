/**
 * carrefour.spec.ts — ce qui attend le membre, les deux faces (D114).
 * =====================================================================
 * Ce que ces fiches tiennent :
 *   ① l'ordre est NOMMÉ, pas numéroté — et il ne contient que des choses
 *     que l'app sait faire AUJOURD'HUI ;
 *   ② le tri : par type d'abord, par échéance ensuite ;
 *   ③ la tête de pile, parce qu'un carrefour n'est pas une quatrième liste ;
 *   ④ UNE source — le badge et le carrefour ne peuvent pas se contredire.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { ORDRE, TETE_DE_PILE, choseQuiAttendent, compteDesChoses, teteDePile } from '@/lib/carrefour';
import type { DemandeDeLaListe } from '@/lib/mes-demandes';
import type { EnvoiDeLaListe } from '@/lib/mes-envois';

const MOBILE = resolve(__dirname, '../..');

function envoi(extra: Partial<EnvoiDeLaListe> = {}): EnvoiDeLaListe {
  return {
    id: 'envoi-1',
    statut: 'DELIVERED',
    depart: 'Paris',
    arrivee: 'Dubaï',
    dateDepart: '2026-11-25',
    heureDepart: '21:00',
    voyageur: 'Thomas N.',
    totalCents: 4250,
    devise: 'EUR',
    actions: ['confirmEarly'],
    peutNoter: false,
    noterAvant: null,
    expireLe: null,
    ...extra,
  };
}

function demande(extra: Partial<DemandeDeLaListe> = {}): DemandeDeLaListe {
  return {
    id: 'demande-1',
    statut: 'PENDING',
    depart: 'Paris',
    arrivee: 'Brazzaville',
    dateDepart: '2026-12-02',
    heureDepart: '08:00',
    expediteur: 'Aminata D.',
    colis: { source: 'famille', code: 'CLOTHES_TEXTILE' },
    poidsKg: 5,
    gainCents: 4500,
    devise: 'EUR',
    expireLe: '2026-11-28T10:00:00.000Z',
    actions: ['accept', 'decline'],
    ...extra,
  };
}

describe('① l’ordre est nommé, et il ne promet que l’existant', () => {
  it('quatre choses, dans cet ordre', () => {
    // Le site classe par { RESPOND: 0, PICKUP: 1, DELIVER: 1, RATE: 3 } :
    // une échelle à trous, où personne ne sait ce que vaudrait un 2. Une
    // liste de noms se lit, et s'étend en INSÉRANT un mot — ce que D115 a
    // fait, exactement là où sa raison le place.
    expect(ORDRE).toEqual(['repondre', 'prendre', 'confirmer', 'noter']);
  });

  it('PRENDRE EN CHARGE est entrée le jour où son écran est né (D115)', () => {
    // D114 l'avait laissée dehors parce que l'écran n'existait pas, et cette
    // fiche avait promis d'être la première à le rappeler. L'écran existe :
    // elle vérifie maintenant que la PORTE existe aussi, sans quoi on aurait
    // remplacé « un geste sans écran » par « un geste sans chemin ».
    expect(ORDRE).toContain('prendre');
    const regle = readFileSync(join(MOBILE, 'src/lib/carrefour.ts'), 'utf8');
    expect(regle).toContain("'pickup'");
    const onglet = readFileSync(join(MOBILE, 'src/app/(tabs)/activity.tsx'), 'utf8');
    expect(onglet).toContain("'/deal/[id]/pickup'");
  });

  it('REMETTRE n’y est toujours PAS — son écran n’existe pas (D116)', () => {
    // Ce n'est pas un oubli : c'est la même règle qui tient. Annoncer un
    // geste dont l'écran n'existe pas recrée une porte vers rien.
    expect(ORDRE).not.toContain('remettre');
    const regle = readFileSync(join(MOBILE, 'src/lib/carrefour.ts'), 'utf8');
    expect(regle).not.toContain("'deliver'");
  });

  it('une demande ACCEPTÉE qu’on peut prendre en charge attend quelque chose', () => {
    const choses = choseQuiAttendent(
      [],
      [demande({ statut: 'ACCEPTED', expireLe: null, actions: ['pickup', 'refusePickup'] })]
    );
    expect(choses.map((c) => c.type)).toEqual(['prendre']);
  });

  it('prendre en charge passe APRÈS répondre et AVANT confirmer', () => {
    // Quelqu'un attend debout avec un colis : ce geste passe devant tout ce
    // qui peut se faire assis. Mais répondre reste devant — une demande sans
    // réponse meurt en 24 h et l'Expéditeur perd son colis.
    const choses = choseQuiAttendent(
      [envoi({ id: 'a-confirmer', actions: ['confirmEarly'] })],
      [
        demande({ id: 'a-prendre', statut: 'ACCEPTED', expireLe: null, actions: ['pickup'] }),
        demande({ id: 'a-repondre' }),
      ]
    );
    expect(choses.map((c) => c.id)).toEqual(['a-repondre', 'a-prendre', 'a-confirmer']);
  });

  it('une prise en charge n’affiche AUCUN compte à rebours', () => {
    // L'app ne reçoit du trajet qu'une date locale, pas un instant : un
    // « dans 3 h » calculé là-dessus serait inventé (D100).
    const [chose] = choseQuiAttendent(
      [],
      [demande({ statut: 'ACCEPTED', expireLe: null, actions: ['pickup'] })]
    );
    expect(chose.echeance).toBeNull();
  });

  it('une demande qui n’attend plus de réponse n’attend rien', () => {
    expect(choseQuiAttendent([], [demande({ actions: [] })])).toEqual([]);
  });

  it('un envoi sans geste qui le fasse avancer n’attend rien', () => {
    expect(choseQuiAttendent([envoi({ actions: [], peutNoter: false })], [])).toEqual([]);
  });

  it('un colis EN ROUTE n’attend rien — c’est au Voyageur d’agir', () => {
    expect(
      choseQuiAttendent([envoi({ statut: 'PICKED_UP', actions: ['dispute'] })], [])
    ).toEqual([]);
  });
});

describe('② le tri : le type d’abord, l’échéance ensuite', () => {
  it('répondre passe avant confirmer, qui passe avant noter', () => {
    // RÉPONDRE est le seul où quelqu'un d'AUTRE perd quelque chose si l'on
    // tarde. CONFIRMER débloque l'argent du Voyageur. NOTER n'attend personne.
    const choses = choseQuiAttendent(
      [
        envoi({ id: 'a-noter', actions: [], peutNoter: true }),
        envoi({ id: 'a-confirmer', actions: ['confirmEarly'] }),
      ],
      [demande({ id: 'a-repondre' })]
    );
    expect(choses.map((c) => c.id)).toEqual(['a-repondre', 'a-confirmer', 'a-noter']);
  });

  it('à type égal, l’échéance la plus proche d’abord', () => {
    const choses = choseQuiAttendent(
      [],
      [
        demande({ id: 'tard', expireLe: '2026-11-28T20:00:00.000Z' }),
        demande({ id: 'tot', expireLe: '2026-11-28T06:00:00.000Z' }),
      ]
    );
    expect(choses.map((c) => c.id)).toEqual(['tot', 'tard']);
  });

  it('sans échéance, on passe APRÈS celles qui en ont — mais jamais devant un autre type', () => {
    const choses = choseQuiAttendent(
      [envoi({ id: 'confirmer-sans-date', actions: ['confirmEarly'] })],
      [demande({ id: 'repondre-sans-date', expireLe: null })]
    );
    // Le colis à confirmer n'a pas de date, la demande non plus : c'est le
    // TYPE qui tranche, et l'argent de quelqu'un dort derrière « répondre ».
    expect(choses.map((c) => c.id)).toEqual(['repondre-sans-date', 'confirmer-sans-date']);
  });

  it('une échéance illisible ne fait pas remonter la ligne au hasard', () => {
    const choses = choseQuiAttendent(
      [],
      [
        demande({ id: 'cassee', expireLe: 'pas une date' }),
        demande({ id: 'bonne', expireLe: '2026-11-28T06:00:00.000Z' }),
      ]
    );
    expect(choses[0].id).toBe('bonne');
  });

  it('rien ne donne rien, et le compte le dit', () => {
    expect(choseQuiAttendent([], [])).toEqual([]);
    expect(compteDesChoses([])).toBe(0);
  });
});

describe('③ la tête de pile — un carrefour n’est pas une quatrième liste', () => {
  const beaucoup = Array.from({ length: 7 }, (_, i) =>
    demande({ id: `d${i}`, expireLe: `2026-11-28T0${i}:00:00.000Z` })
  );

  it('quatre visibles, le reste annoncé', () => {
    const { visibles, reste } = teteDePile(choseQuiAttendent([], beaucoup));
    expect(visibles).toHaveLength(TETE_DE_PILE);
    expect(reste).toBe(3);
    expect(visibles.map((c) => c.id)).toEqual(['d0', 'd1', 'd2', 'd3']);
  });

  it('moins que la tête : rien derrière, et pas de nombre négatif', () => {
    const { visibles, reste } = teteDePile(choseQuiAttendent([], [demande()]));
    expect(visibles).toHaveLength(1);
    expect(reste).toBe(0);
  });
});

describe('④ UNE source : le badge ne peut pas contredire l’écran', () => {
  const contexte = readFileSync(join(MOBILE, 'src/lib/activite-context.tsx'), 'utf8');

  it('les compteurs DÉRIVENT des listes projetées', () => {
    expect(contexte).toContain("sectionDeLaDemande(d) === 'aRepondre'");
    expect(contexte).toContain("sectionDeLEnvoi(e) === 'aTraiter'");
  });

  it('le hook à état local a DISPARU — il refaisait les requêtes par appelant', () => {
    // Trois consommateurs, trois `useState`/`useEffect`, donc jusqu'à trois
    // jeux d'appels à chaque passage au premier plan — et trois lectures à
    // trois instants peuvent se contredire.
    let existe = true;
    try {
      readFileSync(join(MOBILE, 'src/hooks/use-tab-badges.ts'), 'utf8');
    } catch {
      existe = false;
    }
    expect(existe).toBe(false);
  });

  it('les trois appelants lisent le fournisseur', () => {
    for (const fichier of [
      'src/components/tab-bar.tsx',
      'src/app/(tabs)/messages.tsx',
      'src/app/(tabs)/activity.tsx',
    ]) {
      const source = readFileSync(join(MOBILE, fichier), 'utf8');
      expect(source).toContain("from '@/lib/activite-context'");
      expect(source).not.toContain('use-tab-badges');
    }
  });

  it('le fournisseur est MONTÉ, et une seule fois', () => {
    // Deux fournisseurs liraient deux fois et divergeraient — le défaut que
    // D103 a payé avec les `SafeAreaProvider`.
    const pile = readFileSync(join(MOBILE, 'src/app/_layout.tsx'), 'utf8');
    expect(pile.match(/<ActiviteProvider>/g) ?? []).toHaveLength(1);
  });

  it('l’onglet montre son vide comme une BONNE nouvelle', () => {
    const onglet = readFileSync(join(MOBILE, 'src/app/(tabs)/activity.tsx'), 'utf8');
    expect(onglet).toContain("t('activity.nothingWaiting')");
    // La section disparaît plutôt que d'afficher un « 0 » permanent : un
    // signal toujours présent n'est pas un signal.
    expect(onglet).toContain('attendent.length > 0');
  });
});

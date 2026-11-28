/**
 * phone-prefixes.spec.ts — le numéro du destinataire, en E.164.
 * =============================================================
 * C'est par ce numéro que transite le code de livraison (D43) : un numéro
 * fabriqué « à moitié valide » se paie au rendez-vous, quand le colis attend
 * à la gare. Les trois nettoyages de `toE164` viennent de ce que les gens
 * tapent vraiment — ils sont donc testés sur de vraies saisies.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  PHONE_PREFIXES,
  ZERO_DACHEMINEMENT,
  retireLeZero,
  toE164,
} from '@/lib/phone-prefixes';

describe('la liste des indicatifs', () => {
  it('commence par la France — c’est le défaut du brouillon', () => {
    expect(PHONE_PREFIXES[0].prefix).toBe('+33');
  });

  it('n’a ni doublon de préfixe ni doublon de pays', () => {
    expect(new Set(PHONE_PREFIXES.map((p) => p.prefix)).size).toBe(PHONE_PREFIXES.length);
    expect(new Set(PHONE_PREFIXES.map((p) => p.code)).size).toBe(PHONE_PREFIXES.length);
  });

  it('porte les deux libellés pour chaque entrée (aucun `fr ? … : …` possible)', () => {
    for (const entry of PHONE_PREFIXES) {
      expect(entry.labelFr.length).toBeGreaterThan(0);
      expect(entry.labelEn.length).toBeGreaterThan(0);
      expect(entry.prefix.startsWith('+')).toBe(true);
      expect(entry.code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('couvre les marchés de lancement (France, Congo, RD Congo)', () => {
    const prefixes = PHONE_PREFIXES.map((p) => p.prefix);
    expect(prefixes).toContain('+33');
    expect(prefixes).toContain('+242');
    expect(prefixes).toContain('+243');
  });
});

describe('toE164 — les trois nettoyages payés sur de vraies saisies', () => {
  it('un numéro français tapé avec des espaces et son zéro national', () => {
    expect(toE164('+33', '06 42 18 81 12')).toBe('+33642188112');
  });

  it('le « 00 » international retapé devant', () => {
    expect(toE164('+33', '0033642188112')).toBe('+33642188112');
  });

  it('l’indicatif retapé en double', () => {
    expect(toE164('+33', '33642188112')).toBe('+33642188112');
    // D121 — cette ligne attendait `+24260000000`, c'est-à-dire le numéro
    // AMPUTÉ : une fiche verte avait encodé le défaut dans son attendu,
    // alors même que deux `it.failing` voisines le dénonçaient. Le garde
    // écrit à l'avance a tenu ; **le voisin, lui, avait déjà adopté le
    // défaut comme norme.** C'est précisément ce qu'A223 redoutait en
    // refusant de l'épingler par un test vert — et ça s'est produit à
    // trois lignes de là.
    expect(toE164('+242', '242060000000')).toBe('+242060000000');
  });

  it('les séparateurs les plus courants sont ignorés', () => {
    expect(toE164('+33', '06.42.18.81.12')).toBe('+33642188112');
    expect(toE164('+33', '06-42-18-81-12')).toBe('+33642188112');
    expect(toE164('+33', '(0)642188112')).toBe('+33642188112');
  });

  it('le préfixe peut arriver sans son plus', () => {
    expect(toE164('33', '0642188112')).toBe('+33642188112');
  });

  it('refuse plutôt que de fabriquer un numéro à moitié valide', () => {
    expect(toE164('+33', '')).toBeNull();
    expect(toE164('', '0642188112')).toBeNull();
    expect(toE164('+33', 'abcd')).toBeNull();
    // Trop court pour être un E.164 (il faut au moins 7 chiffres en tout).
    expect(toE164('+33', '12')).toBeNull();
    // Trop long (E.164 s'arrête à 15 chiffres).
    expect(toE164('+33', '1234567890123456')).toBeNull();
  });

  it('le « 00 » de tête n’est pas le zéro national — les deux se cumulent', () => {
    // Titre précédent : « ne rend jamais un numéro qui commence par zéro
    // après l'indicatif ». C'était une règle UNIVERSELLE, et elle était
    // fausse : au Congo, le numéro commence justement par zéro (D121).
    expect(toE164('+33', '00642188112')).toBe('+33642188112');
  });

  /* ── Le défaut trouvé le premier jour (A223), corrigé cinq semaines plus tard (D121) ──
     Le « zéro national » n'existe pas partout. En France, en Belgique, au
     Royaume-Uni, au Maroc, en RD Congo, le 0 est un préfixe d'ACHEMINEMENT
     qu'on retire pour passer en E.164. Mais au Congo-Brazzaville (+242) et
     en Côte d'Ivoire (+225), il n'y en a PAS : le 0 appartient au numéro de
     l'abonné, et le retirer fabriquait un numéro injoignable.

     La portée ne tient à aucun corridor en particulier — **Yamba est
     internationale et n'a pas de corridor de référence** (correction de
     l'utilisateur, 28/11/2026 ; la formule venait d'ici et s'était recopiée
     dans trois documents). Elle tient à ceci : c'est par ce numéro que le
     DESTINATAIRE reçoit le code de livraison (D43), donc dans les pays
     concernés le colis arrivait et le code n'arrivait pas. Le serveur ne
     pouvait pas rattraper : il ne contrôle que la FORME E.164
     (`^\+[1-9]\d{6,14}$`), que le numéro amputé respecte.

     CES DEUX FICHES ONT VÉCU CINQ SEMAINES EN `it.failing`, portant
     l'attendu CORRECT : vertes tant que le défaut était là, rouges le jour
     de la correction — ce qui a obligé à lever le `.failing` plutôt qu'à
     l'oublier. **Un défaut épinglé par un test vert serait devenu la
     doctrine.** Et c'est arrivé quand même, trois lignes plus haut : la
     fiche de l'indicatif retapé en double attendait, elle, le numéro
     AMPUTÉ. Le garde écrit à l'avance a tenu ; son voisin avait déjà adopté
     le défaut comme norme. ── */

  it('un numéro congolais garde son zéro (+242, pas de préfixe d’acheminement)', () => {
    expect(toE164('+242', '06 000 0000')).toBe('+242060000000');
  });

  it('un numéro ivoirien garde son zéro (+225, dix chiffres depuis 2021)', () => {
    expect(toE164('+225', '07 00 00 00 00')).toBe('+2250700000000');
  });
});

describe('la table des préfixes d’acheminement (D121)', () => {
  it('chaque pays de la liste a une entrée dans la table', () => {
    // Un pays proposé au choix de l'utilisateur sans règle de zéro
    // retomberait sur le défaut sans que personne l'ait décidé.
    const sansRegle = PHONE_PREFIXES.filter((p) => !(p.code in ZERO_DACHEMINEMENT));
    expect(`sans règle → ${sansRegle.map((p) => p.code).join(', ') || 'aucun'}`).toBe(
      'sans règle → aucun'
    );
  });

  it('les DEUX pays établis gardent leur zéro, et eux seuls pour l’instant', () => {
    // On corrige ce qui est PROUVÉ. Une table remplie à l'intuition
    // casserait des pays qui marchent pour en réparer deux.
    const gardent = Object.entries(ZERO_DACHEMINEMENT)
      .filter(([, retire]) => !retire)
      .map(([code]) => code)
      .sort();
    expect(gardent).toEqual(['CG', 'CI']);
  });

  it('chaque `false` porte sa PREUVE en commentaire', () => {
    // Une exception sans raison écrite est une omission déguisée (A224
    // lot 5). Ici, chacune doit dire d'où vient la certitude.
    const source = readFileSync(join(__dirname, 'phone-prefixes.ts'), 'utf8');
    const table = source.slice(
      source.indexOf('export const ZERO_DACHEMINEMENT'),
      source.indexOf('export function retireLeZero')
    );
    expect(table.length).toBeGreaterThan(400);
    expect(table).toContain('+242061234567');
    expect(table).toContain('2021');
  });

  it('un pays INCONNU retombe sur le comportement d’avant le lot', () => {
    // Le serveur peut servir un indicatif que l'app ne connaît pas encore :
    // on ne change pas de règle sur une absence.
    expect(retireLeZero('ZZ')).toBe(true);
    expect(retireLeZero('CG')).toBe(false);
  });

  it('les deux fronts portent la MÊME table', () => {
    // Un pays ajouté d'un seul côté serait un numéro juste ici et faux
    // là-bas — et c'est le DESTINATAIRE qui le paierait.
    const site = readFileSync(
      resolve(__dirname, '../../../user-ui/src/components/booking/booking.config.ts'),
      'utf8'
    );
    for (const [code, retire] of Object.entries(ZERO_DACHEMINEMENT)) {
      expect(`${code} → ${site.includes(`${code}: ${retire},`)}`).toBe(`${code} → true`);
    }
  });

  it('le retrait ne mange plus QU’UN zéro', () => {
    // `^0+` amputait aussi les fautes de frappe à deux zéros : un préfixe
    // d'acheminement est UN chiffre.
    expect(toE164('+33', '006 42 18 81 12')).toBe('+33642188112');
  });
});

/**
 * phone-prefixes.spec.ts — le numéro du destinataire, en E.164.
 * =============================================================
 * C'est par ce numéro que transite le code de livraison (D43) : un numéro
 * fabriqué « à moitié valide » se paie au rendez-vous, quand le colis attend
 * à la gare. Les trois nettoyages de `toE164` viennent de ce que les gens
 * tapent vraiment — ils sont donc testés sur de vraies saisies.
 */
import { PHONE_PREFIXES, toE164 } from '@/lib/phone-prefixes';

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
    expect(toE164('+242', '242060000000')).toBe('+24260000000');
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

  it('ne rend jamais un numéro qui commence par zéro après l’indicatif', () => {
    expect(toE164('+33', '00642188112')).toBe('+33642188112');
  });

  /* ── Le défaut que ce harnais a trouvé, premier jour (A223) ─────────────────
     Le « zéro national » n'existe pas partout. En France, en Belgique, au
     Royaume-Uni, au Maroc, en RD Congo, le 0 est un préfixe d'ACHEMINEMENT
     qu'on retire pour passer en E.164 — c'est la règle qu'applique
     `toE164`. Mais au Congo-Brazzaville (+242) et en Côte d'Ivoire (+225),
     il n'y a PAS de préfixe d'acheminement : le 0 appartient au numéro de
     l'abonné, et le retirer fabrique un numéro injoignable.

     La portée est la pire possible : Brazzaville est le corridor de
     référence de Yamba, et c'est par ce numéro que le DESTINATAIRE reçoit le
     code de livraison (D43). Le serveur ne peut pas rattraper : il ne
     contrôle que la FORME E.164 (`^\+[1-9]\d{6,14}$`), que le numéro
     amputé respecte. Et le défaut est dans le MIROIR web autant qu'ici
     (`apps/user-ui/src/components/booking/booking.config.ts`, même fonction
     ligne pour ligne).

     Le corriger demande une table de préfixes d'acheminement par pays —
     c'est-à-dire une règle métier, donc une entrée au registre et un lot à
     part, sur les DEUX fronts. En attendant, ces deux fiches portent
     l'attendu CORRECT en `it.failing` : elles restent vertes tant que le
     défaut est là, et deviennent ROUGES le jour où il est corrigé — ce qui
     obligera à retirer le `.failing` plutôt qu'à l'oublier. Un défaut épinglé
     par un test vert deviendrait la doctrine ; celui-ci ne peut pas. ── */

  it.failing('AXE — un numéro congolais garde son zéro (+242, pas de préfixe d’acheminement)', () => {
    expect(toE164('+242', '06 000 0000')).toBe('+242060000000');
  });

  it.failing('AXE — un numéro ivoirien garde son zéro (+225, dix chiffres depuis 2021)', () => {
    expect(toE164('+225', '07 00 00 00 00')).toBe('+2250700000000');
  });
});

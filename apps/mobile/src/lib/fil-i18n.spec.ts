/**
 * fil-i18n.spec.ts — les clés CALCULÉES du fil (D117 8A, leçon D83).
 * ====================================================================
 * L'angle mort que rien d'autre ne couvre :
 *   • `tsc` ne voit rien — un gabarit de chaîne se type toujours ;
 *   • le contrôle i18n de la CI compare FR et EN **entre eux** : deux
 *     dictionnaires qui OUBLIENT la même clé sont parfaitement miroir ;
 *   • le harnais ne rend aucun composant.
 *
 * Une clé absente ne plante pas : elle fait lire au membre le CHEMIN de la
 * clé (« system.meetup.proposed »). C'est le défaut que `payment-i18n.spec.ts`
 * a trouvé sur 58 fiches au lot D83.
 *
 * Les clés calculées de ce lot, et d'où elles viennent :
 *   `system.${message.systemKey}`        ← écrit par message-service
 *   `closed.${acces.motif}`              ← `motifDeFermeture`
 *   `errors.${cleDuRefus(code)}`         ← les refus du serveur
 *   `report.reasons.${motif}`            ← la liste fermée du contrat
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { MESSAGE_REPORT_REASONS } from '@packages/api-contracts';

import { MOTIFS_DE_SIGNALEMENT, cleDuRefus, motifDeFermeture } from '@/lib/fil';

const MOBILE = resolve(__dirname, '../..');
const LOCALES = ['fr', 'en'] as const;

function dictionnaire(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(MOBILE, `messages/${locale}/messaging.json`), 'utf8')
  ) as Record<string, unknown>;
}

/** Suit un chemin pointé, comme `use-intl` le fait au rendu. */
function auChemin(dico: Record<string, unknown>, chemin: string): unknown {
  return chemin
    .split('.')
    .reduce<unknown>(
      (noeud, cle) =>
        typeof noeud === 'object' && noeud !== null
          ? (noeud as Record<string, unknown>)[cle]
          : undefined,
      dico
    );
}

describe('les clés CALCULÉES existent dans les DEUX dictionnaires', () => {
  it('les trois messages SYSTÈME du serveur sont traduits', () => {
    // Les clés sont écrites par `message-service`. On les lit À LA SOURCE
    // plutôt que de les recopier : une quatrième ajoutée là-bas doit faire
    // rougir ici, pas s'afficher en clair chez le membre.
    const service = readFileSync(
      resolve(MOBILE, '../message-service/src/services/conversation.service.ts'),
      'utf8'
    );
    const cles = [...service.matchAll(/systemKey: *['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(cles.length).toBeGreaterThanOrEqual(3);

    for (const locale of LOCALES) {
      const dico = dictionnaire(locale);
      for (const cle of new Set(cles)) {
        expect(typeof auChemin(dico, `system.${cle}`)).toBe('string');
      }
    }
  });

  it('les trois motifs de fermeture ont leur phrase', () => {
    const motifs = ['DISPUTE_OPEN', 'WRITE_WINDOW_OVER', 'UNE_RAISON_INCONNUE']
      .map(motifDeFermeture)
      .filter((m): m is NonNullable<ReturnType<typeof motifDeFermeture>> => m !== null);
    expect(motifs).toEqual(['litige', 'fenetre', 'autre']);

    for (const locale of LOCALES) {
      const dico = dictionnaire(locale);
      for (const motif of motifs) {
        expect(typeof auChemin(dico, `closed.${motif}`)).toBe('string');
      }
    }
  });

  it('les trois refus du serveur ont leur phrase', () => {
    const cles = [
      cleDuRefus('DELIVERY_CODE_IN_MESSAGE'),
      cleDuRefus('CONVERSATION_READ_ONLY'),
      cleDuRefus('QUOI_QUE_CE_SOIT'),
    ];
    expect(new Set(cles).size).toBe(3);

    for (const locale of LOCALES) {
      const dico = dictionnaire(locale);
      for (const cle of cles) {
        expect(typeof auChemin(dico, `errors.${cle}`)).toBe('string');
      }
    }
  });

  it('les motifs de signalement sont ceux du CONTRAT, et tous traduits', () => {
    // La liste est recopiée faute de pouvoir importer le contrat depuis un
    // écran (A223). La fiche, elle, peut : elle confronte la copie au Zod.
    expect([...MOTIFS_DE_SIGNALEMENT]).toEqual([...MESSAGE_REPORT_REASONS]);

    for (const locale of LOCALES) {
      const dico = dictionnaire(locale);
      for (const motif of MOTIFS_DE_SIGNALEMENT) {
        expect(typeof auChemin(dico, `report.reasons.${motif}`)).toBe('string');
      }
    }
  });

  it('« Arnaque suspectée » se dit PAREIL sur les deux fronts', () => {
    // Décision de recette du 15/09 : le mot est le même partout, sinon deux
    // écrans décrivent le même signalement avec deux noms.
    const site = JSON.parse(
      readFileSync(resolve(MOBILE, '../user-ui/messages/fr/messaging.json'), 'utf8')
    ) as Record<string, unknown>;
    expect(auChemin(dictionnaire('fr'), 'report.reasons.SCAM')).toBe(
      auChemin(site, 'report.reasons.SCAM')
    );
  });
});

describe('aucune clé du dictionnaire ne porte de point', () => {
  it('les clés SYSTÈME sont NICHÉES, jamais écrites « meetup.proposed »', () => {
    // Piège maison (#174) : `use-intl` comme next-intl refuse une clé
    // contenant un point — le namespace entier est refusé AU RENDU. Les
    // clés du serveur en portent un, donc elles doivent être nichées pour
    // que le chemin calculé les atteigne.
    const parcourir = (noeud: unknown, chemin: string): void => {
      if (typeof noeud !== 'object' || noeud === null) return;
      for (const [cle, valeur] of Object.entries(noeud as Record<string, unknown>)) {
        expect(cle).not.toContain('.');
        parcourir(valeur, `${chemin}.${cle}`);
      }
    };
    for (const locale of LOCALES) parcourir(dictionnaire(locale), '');
  });
});

describe('ce que l’écran dit, il le dit dans les deux langues', () => {
  it('chaque clé littérale appelée par les écrans du fil existe', () => {
    // Balayage des `t('…')` littéraux des trois fichiers du lot. Les clés
    // CALCULÉES sont couvertes plus haut ; celles-ci sont les autres.
    const fichiers = [
      'src/app/conversation/[id].tsx',
      'src/app/(tabs)/messages.tsx',
      'src/components/message-report-sheet.tsx',
    ];
    const cles = new Set<string>();
    for (const fichier of fichiers) {
      const source = readFileSync(join(MOBILE, fichier), 'utf8');
      for (const trouve of source.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) cles.add(trouve[1]);
    }
    // Un balayage qui ne balaie rien serait vert pour la pire raison.
    expect(cles.size).toBeGreaterThanOrEqual(15);

    for (const locale of LOCALES) {
      const dico = dictionnaire(locale);
      for (const cle of cles) {
        expect(`${cle} → ${typeof auChemin(dico, cle)}`).toBe(`${cle} → string`);
      }
    }
  });
});

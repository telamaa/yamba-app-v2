/**
 * mes-demandes.spec.ts — les demandes reçues par le Voyageur (D113).
 * ====================================================================
 * Ce que ces fiches tiennent :
 *   ① la projection ne fait pas confiance à ce que sert la base ;
 *   ② « À répondre » se déduit de ce que le SERVEUR accorde ;
 *   ③ LE TRI SUIT L'HORLOGE — c'est ce qui distingue cette liste de
 *      « Mes envois », et c'est trop facile à « harmoniser » par mégarde ;
 *   ④ l'urgence a trois crans, et se tait quand il n'y a rien à dire ;
 *   ⑤ le contrat dans les deux sens, la porte, et les deux choses que cet
 *      écran ne doit JAMAIS montrer : le total payé et le destinataire.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  SECTIONS,
  compteARepondre,
  demandeDeLApi,
  grouperLesDemandes,
  peut,
  sectionDeLaDemande,
  urgenceDeLaDemande,
  type DemandeDeLaListe,
} from '@/lib/mes-demandes';

const MOBILE = resolve(__dirname, '../..');

/**
 * Le code SANS ses commentaires.
 *
 * Sans ce dépouillement, une fiche qui interdit un mot rougit sur le
 * commentaire qui EXPLIQUE pourquoi ce mot est interdit — c'est arrivé ici
 * même au premier jet, et c'est la sixième fois du mois que ce dépôt
 * confond une orthographe et un usage (A224 lot 5, D110…). On vise ce que
 * le code FAIT, jamais ce qu'il raconte.
 */
function sansCommentaires(source: string): string {
  const net = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // Un dépouillement qui vide tout passerait toutes les fiches suivantes.
  expect(net.length).toBeGreaterThan(source.length / 3);
  return net;
}
const MIDI = Date.parse('2026-11-27T12:00:00.000Z');

function brut(extra: Record<string, unknown> = {}) {
  return {
    id: 'demande-1',
    status: 'PENDING',
    trip: {
      originCity: 'Paris',
      destinationCity: 'Brazzaville',
      departureAt: '2026-12-02T07:00:00.000Z',
      originTimezone: 'Europe/Paris',
    },
    parcel: { categoryFamily: 'CLOTHES_TEXTILE', declaredValueCents: 12000 },
    pricing: { weightKg: 5, transportCents: 4500, currencyCode: 'EUR' },
    shipper: { id: 'e1', firstName: 'Aminata', lastInitial: 'D' },
    allowedActions: ['accept', 'decline'],
    expiresAt: '2026-11-28T10:00:00.000Z',
    ...extra,
  };
}

function projete(extra: Record<string, unknown> = {}): DemandeDeLaListe {
  const demande = demandeDeLApi(brut(extra));
  expect(demande).not.toBeNull();
  return demande as DemandeDeLaListe;
}

describe('① la projection ne fait pas confiance à la base', () => {
  it('lit ce qu’elle reconnaît, et date dans le fuseau du LIEU', () => {
    expect(projete()).toEqual({
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
    });
  });

  it('jette une ligne sans identifiant ou sans statut connu', () => {
    expect(demandeDeLApi({ status: 'PENDING' })).toBeNull();
    expect(demandeDeLApi({ id: 'x', status: 'EN_VOL' })).toBeNull();
    expect(demandeDeLApi(null)).toBeNull();
  });

  it('la règle rend un CODE et dit d’où il vient — elle ne traduit pas', () => {
    // Deux populations cohabitent, comme pour les dates (D112) : les
    // réservations récentes portent une famille D14, les anciennes une
    // catégorie legacy (A29). Mesuré sur la base de recette :
    // `categoryFamily` est null sur les treize réservations du seed.
    expect(
      projete({ parcel: { categoryFamily: 'DOCUMENTS_PAPERS', category: 'DOCUMENTS' } }).colis
    ).toEqual({ source: 'famille', code: 'DOCUMENTS_PAPERS' });
    expect(projete({ parcel: { category: 'OTHER_ELECTRONICS' } }).colis).toEqual({
      source: 'categorie',
      code: 'OTHER_ELECTRONICS',
    });
  });

  it('sans rien de lisible, `null` — jamais un code brut', () => {
    // Afficher « OTHER_ELECTRONICS » à un Voyageur, c'est lui faire lire un
    // identifiant technique : le défaut D83.
    expect(projete({ parcel: {} }).colis).toBeNull();
    expect(projete({ parcel: { categoryFamily: '   ' } }).colis).toBeNull();
  });

  it('une demande sans colis décrit, sans gain et sans Expéditeur reste LISIBLE', () => {
    const d = projete({ parcel: undefined, pricing: undefined, shipper: undefined });
    expect(d.colis).toBeNull();
    expect(d.poidsKg).toBeNull();
    expect(d.gainCents).toBeNull();
    expect(d.devise).toBe('EUR');
    expect(d.expediteur).toBe('');
  });

  it('les gestes inconnus de l’app sont ignorés, pas recopiés', () => {
    expect(projete({ allowedActions: ['accept', 'confirmEarly', 7, null] }).actions).toEqual([
      'accept',
    ]);
  });

  it('l’échéance n’existe QUE pour une demande en attente', () => {
    expect(projete({ status: 'ACCEPTED' }).expireLe).toBeNull();
    expect(projete({ status: 'EXPIRED', allowedActions: [] }).expireLe).toBeNull();
  });
});

describe('② « À répondre » = ce que le SERVEUR accorde', () => {
  it('une demande acceptable est à répondre', () => {
    expect(sectionDeLaDemande(projete())).toBe('aRepondre');
  });

  it('sans `accept`, elle ne l’est plus — même si elle est encore PENDING', () => {
    // Capacité épuisée, compte restreint, trajet annulé : seul le serveur
    // le sait. Proposer « Accepter » serait promettre un refus.
    expect(sectionDeLaDemande(projete({ allowedActions: [] }))).toBe('enCours');
  });

  it('acceptée, en route, remise : « en cours »', () => {
    for (const statut of ['ACCEPTED', 'PICKED_UP', 'DELIVERED', 'DISPUTED']) {
      expect(sectionDeLaDemande(projete({ status: statut, allowedActions: [] }))).toBe('enCours');
    }
  });

  it('les quatre fins de parcours tombent dans « Passées »', () => {
    for (const statut of ['COMPLETED', 'DECLINED', 'EXPIRED', 'CANCELLED']) {
      expect(sectionDeLaDemande(projete({ status: statut, allowedActions: [] }))).toBe('passees');
    }
  });

  it('`peut` lit la liste du serveur, il ne la devine pas', () => {
    expect(peut(projete(), 'accept')).toBe(true);
    expect(peut(projete({ allowedActions: ['decline'] }), 'accept')).toBe(false);
  });
});

describe('③ le tri suit l’HORLOGE, pas la création', () => {
  it('il n’y a que trois sections, dans cet ordre', () => {
    expect(SECTIONS).toEqual(['aRepondre', 'enCours', 'passees']);
  });

  it('« à répondre » est triée par échéance CROISSANTE', () => {
    // LA différence avec « Mes envois », qui garde l'ordre du serveur. Ici
    // attendre coûte quelque chose à quelqu'un d'autre : celle qui tombe en
    // premier se répond en premier.
    const groupes = grouperLesDemandes([
      projete({ id: 'tard', expiresAt: '2026-11-28T20:00:00.000Z' }),
      projete({ id: 'tot', expiresAt: '2026-11-28T06:00:00.000Z' }),
      projete({ id: 'milieu', expiresAt: '2026-11-28T12:00:00.000Z' }),
    ]);
    expect(groupes[0].demandes.map((d) => d.id)).toEqual(['tot', 'milieu', 'tard']);
  });

  it('une échéance absente ou illisible passe en DERNIER, jamais au milieu', () => {
    const groupes = grouperLesDemandes([
      projete({ id: 'sans', expiresAt: undefined }),
      projete({ id: 'cassee', expiresAt: 'pas une date' }),
      projete({ id: 'avec', expiresAt: '2026-11-28T06:00:00.000Z' }),
    ]);
    expect(groupes[0].demandes[0].id).toBe('avec');
    expect(groupes[0].demandes.slice(1).map((d) => d.id).sort()).toEqual(['cassee', 'sans']);
  });

  it('les autres sections gardent l’ordre du serveur', () => {
    const groupes = grouperLesDemandes([
      projete({ id: 'recente', status: 'ACCEPTED', allowedActions: [] }),
      projete({ id: 'vieille', status: 'ACCEPTED', allowedActions: [] }),
    ]);
    expect(groupes[0].demandes.map((d) => d.id)).toEqual(['recente', 'vieille']);
  });

  it('une section sans demande DISPARAÎT', () => {
    expect(grouperLesDemandes([projete()]).map((g) => g.section)).toEqual(['aRepondre']);
  });

  it('le compte en tête ne compte QUE ce qui attend une réponse', () => {
    expect(
      compteARepondre([
        projete({ id: 'a' }),
        projete({ id: 'b', status: 'ACCEPTED', allowedActions: [] }),
        projete({ id: 'c', status: 'EXPIRED', allowedActions: [] }),
      ])
    ).toBe(1);
  });
});

describe('④ l’urgence a trois crans, et se tait quand il n’y a rien à dire', () => {
  it('moins de 3 h : « bientôt »', () => {
    expect(urgenceDeLaDemande(projete({ expiresAt: '2026-11-27T14:30:00.000Z' }), MIDI)).toBe(
      'bientot'
    );
  });

  it('moins de 12 h : « aujourd’hui »', () => {
    expect(urgenceDeLaDemande(projete({ expiresAt: '2026-11-27T20:00:00.000Z' }), MIDI)).toBe(
      'aujourdhui'
    );
  });

  it('au-delà : « calme »', () => {
    expect(urgenceDeLaDemande(projete({ expiresAt: '2026-11-28T10:00:00.000Z' }), MIDI)).toBe(
      'calme'
    );
  });

  it('les bornes appartiennent au cran le plus URGENT', () => {
    // Exactement 3 h restantes : « bientôt », pas « aujourd'hui ». Une borne
    // qui penche vers le calme fait rater la dernière heure utile.
    expect(urgenceDeLaDemande(projete({ expiresAt: '2026-11-27T15:00:00.000Z' }), MIDI)).toBe(
      'bientot'
    );
    expect(urgenceDeLaDemande(projete({ expiresAt: '2026-11-28T00:00:00.000Z' }), MIDI)).toBe(
      'aujourdhui'
    );
  });

  it('échue : plus d’urgence — le serveur l’aura expirée', () => {
    expect(urgenceDeLaDemande(projete({ expiresAt: '2026-11-27T11:59:00.000Z' }), MIDI)).toBeNull();
  });

  it('pas d’horloge, pas d’urgence — une demande acceptée n’est pas « calme »', () => {
    // `calme` dirait « tu as le temps » à propos d'une décision déjà prise.
    expect(
      urgenceDeLaDemande(projete({ status: 'ACCEPTED', allowedActions: [] }), MIDI)
    ).toBeNull();
  });

  it('une échéance illisible ne rend jamais NaN', () => {
    // Toute comparaison avec NaN est fausse : sans cette garde, la valeur
    // traverse la cascade sans qu'aucune condition l'ait choisie (A224 l. 3).
    expect(urgenceDeLaDemande(projete({ expiresAt: 'nawak' }), MIDI)).toBeNull();
  });
});

describe('⑤ le contrat, la porte, et ce qui ne doit JAMAIS s’afficher', () => {
  const api = readFileSync(join(MOBILE, 'src/lib/api/my-deals.api.ts'), 'utf8');
  const liste = readFileSync(join(MOBILE, 'src/app/deals/mine.tsx'), 'utf8');
  // `deal/[id].tsx` est devenu `deal/[id]/index.tsx` en D115 : la demande
  // n'est plus un écran seul, c'est une PILE (la demande, puis l'inspection).
  const fiche = readFileSync(join(MOBILE, 'src/app/deal/[id]/index.tsx'), 'utf8');

  it('l’app sait ÉMETTRE les trois appels', () => {
    expect(api).toContain("'/me/deals'");
    expect(api).toMatch(/\/accept`/);
    expect(api).toMatch(/\/decline`/);
  });

  it('la LISTE ne sait pas répondre — les deux réponses sont sur la fiche', () => {
    // On n'accepte pas depuis une ligne : accepter engage le Voyageur ET
    // déclenche le débit de l'Expéditeur (D39).
    expect(liste).not.toContain('accepterLaDemande');
    expect(liste).not.toContain('refuserLaDemande');
    expect(fiche).toContain('accepterLaDemande');
    expect(fiche).toContain('refuserLaDemande');
  });

  it('refuser CONFIRME, accepter DIT ce qu’il engage', () => {
    expect(fiche).toContain('declineTitle');
    expect(fiche).toContain("t('detail.commitment')");
  });

  it('aucun écran ne recompose un TOTAL payé par l’Expéditeur', () => {
    // La vue Voyageur ne porte que `transportCents` (A13). Ce que l'app ne
    // reçoit pas, elle ne l'invente pas.
    for (const source of [liste, fiche]) {
      expect(sansCommentaires(source)).not.toContain('totalShipperCents');
      expect(sansCommentaires(source)).not.toContain('commissionCents');
    }
  });

  it('aucun écran ne lit le DESTINATAIRE', () => {
    // `recipientForCarrier` minimise côté serveur (ANO-API-15). Filtrer ici
    // créerait une SECONDE règle de confidentialité, fausse un jour.
    for (const source of [liste, fiche]) {
      expect(sansCommentaires(source)).not.toContain('recipient');
    }
  });

  it('la porte existe : l’onglet Activité mène à la liste', () => {
    const onglet = readFileSync(join(MOBILE, 'src/app/(tabs)/activity.tsx'), 'utf8');
    expect(onglet).toContain("'/deals/mine'");
    const pile = readFileSync(join(MOBILE, 'src/app/_layout.tsx'), 'utf8');
    expect(pile).toContain('name="deals/mine"');
    // `deal` déclare une PILE depuis D115 (la demande, puis l'inspection) :
    // ce qui compte est que la pile soit déclarée, pas son nombre d'écrans.
    expect(pile).toContain('name="deal"');
  });

  it('la coquille « arrive dans un prochain lot » a DISPARU le jour où elle mentait', () => {
    // Une coquille honnête cesse de l'être le jour où le parcours existe.
    // La fiche ne vise QUE celle de l'onglet Activité : « Messages » et
    // « Profil » gardent la leur, et elles disent encore la vérité —
    // condamner le mot partout reviendrait à interdire d'être honnête.
    const onglet = readFileSync(join(MOBILE, 'src/app/(tabs)/activity.tsx'), 'utf8');
    expect(sansCommentaires(onglet)).not.toContain("t('activity.note')");
    const textes = JSON.parse(
      readFileSync(join(MOBILE, 'messages/fr/tabs.json'), 'utf8')
    ) as { activity: Record<string, unknown> };
    expect(textes.activity.note).toBeUndefined();
  });
});

describe('⑥ le mot du colis existe dans les DEUX langues', () => {
  // Les clés sont CALCULÉES (`families.${code}` / `categories.${code}`) :
  // angle mort que ni `tsc` (un gabarit se type toujours) ni le contrôle
  // i18n de la CI (il compare FR et EN entre EUX) ne couvre. Une clé absente
  // fait lire le CHEMIN de la clé au Voyageur — le défaut D83.
  const dico = (locale: 'fr' | 'en') =>
    JSON.parse(readFileSync(join(MOBILE, `messages/${locale}/myDeals.json`), 'utf8')) as {
      families: Record<string, string>;
      categories: Record<string, string>;
    };

  it('les huit familles D14 et les douze catégories legacy sont là, des deux côtés', () => {
    for (const locale of ['fr', 'en'] as const) {
      const d = dico(locale);
      expect(Object.keys(d.families)).toHaveLength(8);
      expect(Object.keys(d.categories)).toHaveLength(12);
      for (const mot of [...Object.values(d.families), ...Object.values(d.categories)]) {
        expect(mot.trim().length).toBeGreaterThan(0);
      }
    }
    expect(Object.keys(dico('fr').families)).toEqual(Object.keys(dico('en').families));
    expect(Object.keys(dico('fr').categories)).toEqual(Object.keys(dico('en').categories));
  });

  it('les familles sont MOT POUR MOT celles des autres écrans du mobile', () => {
    // Elles sont recopiées plutôt que partagées — le mobile en porte déjà
    // trois copies (booking, tripDetail, search) et une quatrième ne change
    // rien à la dette, qui est NOMMÉE au registre. Ce que cette fiche
    // empêche, c'est la DÉRIVE : deux écrans qui nomment différemment la
    // même famille (défaut mesuré par D102, « Dry & sealed food »).
    for (const locale of ['fr', 'en'] as const) {
      const search = JSON.parse(
        readFileSync(join(MOBILE, `messages/${locale}/search.json`), 'utf8')
      ) as { families: Record<string, string> };
      expect(dico(locale).families).toEqual(search.families);
    }
  });

  it('les catégories sont MOT POUR MOT celles du site', () => {
    for (const locale of ['fr', 'en'] as const) {
      const web = JSON.parse(
        readFileSync(resolve(MOBILE, '../user-ui', `messages/${locale}/shipments.json`), 'utf8')
      ) as { categories: Record<string, string> };
      expect(dico(locale).categories).toEqual(web.categories);
    }
  });

  it('aucun écran n’affiche un code brut', () => {
    for (const fichier of ['src/app/deals/mine.tsx', 'src/app/deal/[id]/index.tsx']) {
      const source = sansCommentaires(readFileSync(join(MOBILE, fichier), 'utf8'));
      expect(source).toContain('motDuColis');
      expect(source).not.toMatch(/demande\.colis\.code/);
    }
  });
});

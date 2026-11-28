/**
 * prise-en-charge.spec.ts — l'inspection du colis (D115).
 * =========================================================
 * Ce que ces fiches tiennent :
 *   ① la COPIE du contrat : cinq points, cinq raisons, trois bornes — et
 *     dans le MÊME ORDRE que le site (la leçon D99 bis : la fiche de parité
 *     comparait les règles et les seuils, jamais l'ordre) ;
 *   ② ce qui MANQUE est une liste, pas un booléen — un bouton muet est un
 *     cul-de-sac (A209) ;
 *   ③ le corps envoyé : les cinq points dans l'ordre du contrat, les URL
 *     seules, et une remarque vide qui vaut `null` ;
 *   ④ ce que l'écran n'a pas le droit de faire : afficher le code (INV-1),
 *     choisir une raison libre, ou recopier une quatrième fois la prise de
 *     photo.
 *
 * Le contrat est IMPORTÉ ici (le `tsconfig.spec.json` du mobile déclare
 * `@packages/api-contracts`, A223) : c'est le seul endroit du mobile qui
 * puisse confronter la copie à l'original. Le SITE, lui, est lu avec
 * `readFileSync` et jamais importé — un import à travers une frontière de
 * projet est une dépendance de build (D93).
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  PICKUP_CHECKLIST_ITEMS,
  PICKUP_PHOTOS_MAX,
  PICKUP_PHOTOS_MIN,
  PickupRefusalReasonSchema,
  ConfirmPickupRequestSchema,
} from '@packages/api-contracts';

import type { PhotoLocale } from '@/lib/photos';
import {
  NOTES_MAX,
  PHOTOS_MAX,
  PHOTOS_MIN,
  POINTS_INSPECTION,
  RAISONS_REFUS,
  basculerPoint,
  corpsDeLaPriseEnCharge,
  manquesDeLaPriseEnCharge,
  pointsManquants,
  type FormulairePriseEnCharge,
} from '@/lib/prise-en-charge';

const MOBILE = resolve(__dirname, '../..');
const SITE = resolve(__dirname, '../../../user-ui');

function photo(extra: Partial<PhotoLocale> = {}): PhotoLocale {
  return {
    id: 'asset-1',
    uri: 'file:///colis-1.jpg',
    uploading: false,
    url: 'https://ik.imagekit.io/yamba/colis-1.jpg',
    errorCode: null,
    ...extra,
  };
}

function formulaire(extra: Partial<FormulairePriseEnCharge> = {}): FormulairePriseEnCharge {
  return {
    points: [...POINTS_INSPECTION],
    photos: [photo()],
    notes: '',
    ...extra,
  };
}

describe('① la copie dit la même chose que le contrat, dans le même ordre', () => {
  it('les cinq points, DANS L’ORDRE du contrat', () => {
    expect([...POINTS_INSPECTION]).toEqual([...PICKUP_CHECKLIST_ITEMS]);
  });

  it('les cinq raisons de refus, dans l’ordre du contrat', () => {
    expect([...RAISONS_REFUS]).toEqual([...PickupRefusalReasonSchema.options]);
  });

  it('les bornes de photos sont celles du serveur', () => {
    expect(PHOTOS_MIN).toBe(PICKUP_PHOTOS_MIN);
    expect(PHOTOS_MAX).toBe(PICKUP_PHOTOS_MAX);
  });

  it('les 500 caractères de remarque sont ceux du serveur', () => {
    // Mesuré sur le schéma lui-même plutôt que recopié : un plafond écrit
    // deux fois dérive (D100 — « un défaut écrit des DEUX côtés d'un
    // contrat dérive »).
    const refus = ConfirmPickupRequestSchema.safeParse({
      checklist: [...PICKUP_CHECKLIST_ITEMS],
      photoUrls: ['https://ik.imagekit.io/yamba/a.jpg'],
      notes: 'x'.repeat(NOTES_MAX + 1),
    });
    const accepte = ConfirmPickupRequestSchema.safeParse({
      checklist: [...PICKUP_CHECKLIST_ITEMS],
      photoUrls: ['https://ik.imagekit.io/yamba/a.jpg'],
      notes: 'x'.repeat(NOTES_MAX),
    });
    expect(refus.success).toBe(false);
    expect(accepte.success).toBe(true);
  });

  it('LE SITE affiche les mêmes cinq points dans le même ordre', () => {
    // Deux fronts qui montrent les mêmes cases dans deux ordres différents
    // sont le défaut D99 bis. Le site est LU, jamais importé (D93).
    const web = readFileSync(
      join(SITE, 'src/components/carrier/deal/views/pickup/PickupChecklist.tsx'),
      'utf8'
    );
    const ordreDuSite = [...web.matchAll(/"([A-Z_]+)",/g)]
      .map((m) => m[1])
      .filter((code) => (PICKUP_CHECKLIST_ITEMS as readonly string[]).includes(code));
    expect(ordreDuSite).toEqual([...POINTS_INSPECTION]);
  });

  it('LE SITE propose les mêmes cinq raisons, dans le même ordre', () => {
    const web = readFileSync(
      join(SITE, 'src/components/carrier/deal/views/pickup/PickupRefuseDialog.tsx'),
      'utf8'
    );
    const ordreDuSite = [...web.matchAll(/"([A-Z_]+)",/g)]
      .map((m) => m[1])
      .filter((code) => (RAISONS_REFUS as readonly string[]).includes(code));
    expect(ordreDuSite).toEqual([...RAISONS_REFUS]);
  });
});

describe('② ce qui manque est une LISTE, et l’écran la dit', () => {
  it('un formulaire vide manque de tout, les points d’abord', () => {
    const manques = manquesDeLaPriseEnCharge({ points: [], photos: [], notes: '' });
    expect(manques[0]).toEqual({ quoi: 'points', combien: 5 });
    expect(manques[1]).toEqual({ quoi: 'photo' });
  });

  it('le COMBIEN est juste — c’est lui que le bouton annonce', () => {
    const manques = manquesDeLaPriseEnCharge({
      points: ['CONTENT_MATCHES', 'WEIGHT_OK', 'NO_FORBIDDEN'],
      photos: [photo()],
      notes: '',
    });
    expect(manques).toEqual([{ quoi: 'points', combien: 2 }]);
  });

  it('un formulaire complet ne manque de rien', () => {
    expect(manquesDeLaPriseEnCharge(formulaire())).toEqual([]);
  });

  it('un téléversement EN VOL n’est pas un échec — et il n’est pas prêt non plus', () => {
    const manques = manquesDeLaPriseEnCharge(
      formulaire({ photos: [photo({ uploading: true, url: null })] })
    );
    expect(manques).toEqual([{ quoi: 'televersement' }]);
  });

  it('un téléversement ÉCHOUÉ bloque — on ne part pas sans sa preuve', () => {
    const manques = manquesDeLaPriseEnCharge(
      formulaire({ photos: [photo({ url: null, errorCode: 'FAILED' })] })
    );
    expect(manques).toEqual([{ quoi: 'echec' }]);
  });

  it('une remarque trop longue dit DE COMBIEN elle dépasse', () => {
    // Le site, lui, n'a aucun plafond sur son `textarea` : la confirmation
    // part, le serveur refuse, et l'avertissement arrive après les photos.
    const manques = manquesDeLaPriseEnCharge(
      formulaire({ notes: 'x'.repeat(NOTES_MAX + 12) })
    );
    expect(manques).toEqual([{ quoi: 'notes', deTrop: 12 }]);
  });

  it('les espaces de tête et de queue ne comptent pas dans le plafond', () => {
    expect(
      manquesDeLaPriseEnCharge(formulaire({ notes: `   ${'x'.repeat(NOTES_MAX)}   ` }))
    ).toEqual([]);
  });

  it('un point cochÉ puis décoché revient dans les manquants, sans changer l’ordre', () => {
    const apres = basculerPoint(basculerPoint([], 'PACKAGING_OK'), 'PACKAGING_OK');
    expect(apres).toEqual([]);
    expect(pointsManquants(['WEIGHT_OK'])).toEqual([
      'CONTENT_MATCHES',
      'NO_FORBIDDEN',
      'PACKAGING_OK',
      'ITEMS_IDENTIFIED',
    ]);
  });
});

describe('③ le corps envoyé, et ce qu’il ne contient pas', () => {
  it('rien n’est envoyé tant qu’il manque quelque chose', () => {
    // Rendre `null` plutôt que jeter : l'écran a DÉJÀ la liste des manques,
    // et une question ne lève pas d'exception pour dire « pas encore ».
    expect(corpsDeLaPriseEnCharge({ points: [], photos: [photo()], notes: '' })).toBeNull();
  });

  it('les cinq points partent dans l’ordre du CONTRAT, pas dans celui des gestes', () => {
    // Le site envoie `Array.from(checked)`, soit l'ordre des clics : une
    // liste stable se relit mieux dans un dossier de litige.
    const corps = corpsDeLaPriseEnCharge(
      formulaire({ points: ['ITEMS_IDENTIFIED', ...POINTS_INSPECTION.slice(0, 4)] })
    );
    expect(corps?.checklist).toEqual([...PICKUP_CHECKLIST_ITEMS]);
  });

  it('le corps est accepté par le contrat, tel quel', () => {
    const corps = corpsDeLaPriseEnCharge(formulaire({ notes: '  Coin du carton enfoncé  ' }));
    expect(ConfirmPickupRequestSchema.safeParse(corps).success).toBe(true);
    expect(corps?.notes).toBe('Coin du carton enfoncé');
  });

  it('une remarque vide vaut `null`, jamais une chaîne vide', () => {
    expect(corpsDeLaPriseEnCharge(formulaire({ notes: '   ' }))?.notes).toBeNull();
  });

  it('seules les URL partent — jamais une URI locale', () => {
    const corps = corpsDeLaPriseEnCharge(
      formulaire({ photos: [photo({ id: 'a' }), photo({ id: 'b', url: 'https://ik/b.jpg' })] })
    );
    expect(corps?.photoUrls).toEqual(['https://ik.imagekit.io/yamba/colis-1.jpg', 'https://ik/b.jpg']);
    expect(JSON.stringify(corps)).not.toContain('file://');
  });
});

describe('④ ce que l’écran n’a pas le droit de faire', () => {
  const ecran = readFileSync(join(MOBILE, 'src/app/deal/[id]/pickup.tsx'), 'utf8');
  const api = readFileSync(join(MOBILE, 'src/lib/api/my-deals.api.ts'), 'utf8');

  it('il n’affiche NI ne demande le code de livraison (INV-1, D43)', () => {
    // Le serveur le génère à la prise en charge et le révèle à l'Expéditeur
    // SEUL. C'est au lot suivant que le Voyageur le SAISIRA, dicté par le
    // destinataire.
    //
    // Premier jet de cette fiche : `not.toMatch(/\bcode\b\s*[:=]/)`. Elle a
    // rougi sur `erreur.code === 'TRANSITION_NOT_ALLOWED'` — SIXIÈME fois ce
    // mois-ci qu'une fiche vise une ORTHOGRAPHE au lieu d'un USAGE dans ce
    // dépôt. On vise donc les trois façons d'afficher ou de saisir un code à
    // six chiffres, pas le mot « code ».
    expect(ecran).not.toContain('deliveryCode');
    expect(ecran).not.toContain('maxLength={6}');
    expect(ecran).not.toContain('number-pad');
    // Et le corps envoyé ne porte aucun champ `code` : seul le serveur en
    // fabrique un.
    const corps = corpsDeLaPriseEnCharge(formulaire());
    expect(Object.keys(corps ?? {})).toEqual(['checklist', 'photoUrls', 'notes']);
  });

  it('il lit le DROIT dans `allowedActions`, jamais dans un statut', () => {
    expect(ecran).toContain("peut(demande, 'pickup')");
    expect(ecran).not.toContain("'ACCEPTED'");
  });

  it('l’app sait ÉMETTRE les deux appels du contrat', () => {
    // La parité se mesure par le CONTRAT que chaque front sait exercer
    // (D101), pas écran par écran.
    expect(api).toMatch(/\/pickup`/);
    expect(api).toMatch(/\/pickup\/refuse`/);
  });

  it('le refus n’offre AUCUN texte libre — cinq raisons, ou aucune', () => {
    expect(api).toContain('raison === null ? {} : { reason: raison }');
    for (const code of RAISONS_REFUS) expect(ecran).not.toContain(`'${code}'`);
    expect(ecran).toContain('RAISONS_REFUS.map');
  });

  it('les clés CALCULÉES existent dans les DEUX dictionnaires (leçon D83)', () => {
    // Ni `tsc` (un gabarit se type toujours), ni le contrôle i18n de la CI
    // (il compare FR et EN entre EUX) ne voit une clé absente : l'écran
    // ferait alors lire le CHEMIN de la clé au Voyageur.
    for (const locale of ['fr', 'en']) {
      const dict = JSON.parse(
        readFileSync(join(MOBILE, `messages/${locale}/pickup.json`), 'utf8')
      ) as Record<string, Record<string, string>>;
      for (const point of POINTS_INSPECTION) expect(dict.items[point]).toBeTruthy();
      for (const raison of RAISONS_REFUS) expect(dict.reasons[raison]).toBeTruthy();
      for (const code of ['INVALID_TYPE', 'TOO_LARGE', 'FAILED'])
        expect(dict.uploadErrors[code]).toBeTruthy();
      for (const manque of ['points', 'photo', 'televersement', 'echec', 'notes'])
        expect(dict.missing[manque]).toBeTruthy();
      // Le poids n'est pas toujours servi : la phrase existe sans lui.
      expect(dict.itemWeightUnknown).toBeTruthy();
    }
  });

  it('l’appareil photo passe AVANT la photothèque', () => {
    // On est devant le colis : la photo se prend, elle ne se cherche pas.
    const etagere = readFileSync(join(MOBILE, 'src/components/photo-shelf.tsx'), 'utf8');
    expect(etagere.indexOf('textes.prendre')).toBeLessThan(etagere.indexOf('textes.photothèque'));
  });

  it('la prise de photo n’a pas été recopiée une QUATRIÈME fois', () => {
    // On factorise au moment où l'on devient le quatrième, pas le deuxième.
    // Les copies existantes survivent — nommées, COMPTÉES, pas corrigées :
    // une dette comptée se rembourse, une dette promise s'oublie. Le
    // prochain qui en ajoute une rougit ici.
    //
    // ET LE COMPTE A CORRIGÉ LA DÉCISION QUI L'A DEMANDÉ. D115 3A annonçait
    // « recopiée TROIS fois » ; mesure : trois écrans SÉLECTIONNENT une
    // image, mais seuls DEUX ouvrent l'appareil photo —
    // `publish-trip/review.tsx` ne prend pas de photo, il joint un BILLET,
    // qui est un fichier déjà reçu. La nuance n'est pas comptable : un
    // billet ne se photographie pas, donc ce troisième écran n'était pas
    // candidat au composant. Un constat se COMPTE (D105/D110).
    const copies = (motif: string) =>
      ['src/app/booking/content.tsx', 'src/app/shipment/[id]/report.tsx', 'src/app/publish-trip/review.tsx'].filter(
        (chemin) => readFileSync(join(MOBILE, chemin), 'utf8').includes(motif)
      );
    expect(copies('launchImageLibraryAsync')).toHaveLength(3);
    expect(copies('launchCameraAsync')).toEqual([
      'src/app/booking/content.tsx',
      'src/app/shipment/[id]/report.tsx',
    ]);

    // Et l'écran neuf n'en est pas une : il passe par le hook partagé.
    expect(ecran).not.toContain('launchCameraAsync');
    expect(ecran).not.toContain('launchImageLibraryAsync');
    expect(ecran).toContain('usePhotos');
  });
});

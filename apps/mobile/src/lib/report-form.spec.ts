/**
 * report-form.spec.ts — le signalement d'A222, et le contrat qu'il RECOPIE.
 * =========================================================================
 * Ce module miroite `booking-settlement.schema.ts` et `booking.enums.ts` sans
 * les importer : `@packages/api-contracts` embarque zod, que Metro n'a pas à
 * tirer dans le bundle. A222 l'a consigné noir sur blanc — « toute divergence
 * serait un bug ici ».
 *
 * C'est exactement ce que cette fiche transforme en garde-fou : sous Node, zod
 * est gratuit. Le contrat est donc IMPORTÉ ici, et confronté constante par
 * constante à la copie du mobile. Le jour où le serveur passe la description à
 * soixante caractères ou ajoute un septième motif, c'est ce fichier qui le
 * dit — pas un Expéditeur devant un refus 400 qu'aucun écran n'explique.
 */
import {
  DISPUTE_CATEGORIES as CONTRACT_CATEGORIES,
  DISPUTE_DESIRED_OUTCOMES as CONTRACT_OUTCOMES,
  DISPUTE_MAX_DESCRIPTION_LENGTH,
  DISPUTE_MIN_DESCRIPTION_LENGTH,
  DISPUTE_PHOTOS_MAX,
  DisputeDealRequestSchema,
} from '@packages/api-contracts';

import {
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  DISPUTE_CATEGORIES,
  DISPUTE_DESIRED_OUTCOMES,
  PHOTOS_MAX,
  allowedCategories,
  canSubmitReport,
  categoryLocked,
  describeDescription,
  photoSlotsLeft,
  photosReady,
  reportBlockers,
  reportFailureKey,
  type ReportForm,
  type ReportPhoto,
} from '@/lib/report-form';

/* ── Une preuve, telle que l'écran la tient ───────────────────────────────── */

function aPhoto(patch: Partial<ReportPhoto> = {}): ReportPhoto {
  return {
    id: 'file:///tmp/preuve-1.jpg',
    uri: 'file:///tmp/preuve-1.jpg',
    uploading: false,
    url: 'https://ik.imagekit.io/yamba/deals/dispute/preuve-1.jpg',
    errorCode: null,
    ...patch,
  };
}

const LONG_ENOUGH = 'Le colis est arrivé avec un angle enfoncé et le contenu ne tient plus dedans.';

function aForm(patch: Partial<ReportForm> = {}): ReportForm {
  return {
    category: 'DAMAGED',
    description: LONG_ENOUGH,
    photos: [aPhoto()],
    outcome: 'PARTIAL_REFUND',
    pledgeAccepted: true,
    ...patch,
  };
}

describe('les constantes RECOPIÉES disent la même chose que le contrat', () => {
  it('les six motifs, dans le MÊME ordre (l’ordre est celui de l’affichage)', () => {
    expect([...DISPUTE_CATEGORIES]).toEqual([...CONTRACT_CATEGORIES]);
  });

  it('les quatre solutions souhaitées, à l’identique', () => {
    expect([...DISPUTE_DESIRED_OUTCOMES]).toEqual([...CONTRACT_OUTCOMES]);
  });

  it('les trois bornes du serveur : 50, 2000, 5 photos', () => {
    expect(DESCRIPTION_MIN_LENGTH).toBe(DISPUTE_MIN_DESCRIPTION_LENGTH);
    expect(DESCRIPTION_MAX_LENGTH).toBe(DISPUTE_MAX_DESCRIPTION_LENGTH);
    expect(PHOTOS_MAX).toBe(DISPUTE_PHOTOS_MAX);
  });
});

describe('ce que l’écran laisse envoyer, le contrat l’ACCEPTE', () => {
  it('un dossier que `canSubmitReport` autorise passe le schéma zod du serveur', () => {
    const form = aForm();
    expect(canSubmitReport(form)).toBe(true);
    const parsed = DisputeDealRequestSchema.safeParse({
      category: form.category,
      description: form.description,
      pledgeAccepted: form.pledgeAccepted,
      photoUrls: form.photos.map((p) => p.url),
      desiredOutcome: form.outcome,
    });
    expect(parsed.success).toBe(true);
  });

  it('une description d’exactement 50 caractères passe des DEUX côtés', () => {
    const exactly50 = 'a'.repeat(DESCRIPTION_MIN_LENGTH);
    expect(describeDescription(exactly50).ok).toBe(true);
    expect(
      DisputeDealRequestSchema.safeParse({
        category: 'DAMAGED',
        description: exactly50,
        pledgeAccepted: true,
        photoUrls: [],
      }).success
    ).toBe(true);
  });

  it('49 caractères sont refusés des DEUX côtés — l’écran ne laisse pas partir un 400', () => {
    const tooShort = 'a'.repeat(DESCRIPTION_MIN_LENGTH - 1);
    expect(describeDescription(tooShort).ok).toBe(false);
    expect(
      DisputeDealRequestSchema.safeParse({
        category: 'DAMAGED',
        description: tooShort,
        pledgeAccepted: true,
        photoUrls: [],
      }).success
    ).toBe(false);
  });

  it('l’engagement d’honneur n’est pas une case cosmétique : le contrat exige `true`', () => {
    expect(canSubmitReport(aForm({ pledgeAccepted: false }))).toBe(false);
    expect(
      DisputeDealRequestSchema.safeParse({
        category: 'DAMAGED',
        description: LONG_ENOUGH,
        pledgeAccepted: false,
        photoUrls: [],
      }).success
    ).toBe(false);
  });
});

describe('allowedCategories — D51, le motif imposé en transit', () => {
  it('en transit, seul « jamais livré » a un sens', () => {
    expect(allowedCategories('PICKED_UP')).toEqual(['NOT_DELIVERED']);
    expect(categoryLocked('PICKED_UP')).toBe(true);
  });

  it('après la livraison, les six motifs sont ouverts', () => {
    expect(allowedCategories('DELIVERED')).toEqual([...DISPUTE_CATEGORIES]);
    expect(categoryLocked('DELIVERED')).toBe(false);
  });

  it('les motifs imposés sont TOUS recevables par le contrat', () => {
    for (const category of allowedCategories('PICKED_UP')) {
      expect(CONTRACT_CATEGORIES).toContain(category);
    }
  });
});

describe('describeDescription — le compteur compte ce que le SERVEUR mesure', () => {
  it('trime avant de compter : des espaces ne font pas un compteur vert', () => {
    const padded = `   ${'a'.repeat(DESCRIPTION_MIN_LENGTH - 2)}   `;
    const state = describeDescription(padded);
    expect(state.length).toBe(DESCRIPTION_MIN_LENGTH - 2);
    expect(state.ok).toBe(false);
    expect(state.missing).toBe(2);
  });

  it('`missing` tombe à 0 et n’est jamais négatif', () => {
    expect(describeDescription('a'.repeat(DESCRIPTION_MIN_LENGTH + 10)).missing).toBe(0);
  });

  it('`full` parle de la saisie BRUTE : c’est le champ qui cesse d’accepter', () => {
    expect(describeDescription('a'.repeat(DESCRIPTION_MAX_LENGTH)).full).toBe(true);
    expect(describeDescription('a'.repeat(DESCRIPTION_MAX_LENGTH - 1)).full).toBe(false);
  });
});

describe('les preuves — rien à moitié fait (RG-P-13)', () => {
  it('cinq emplacements au départ, zéro quand elles sont toutes prises', () => {
    expect(photoSlotsLeft([])).toBe(PHOTOS_MAX);
    expect(photoSlotsLeft(Array.from({ length: PHOTOS_MAX }, () => aPhoto()))).toBe(0);
  });

  it('jamais un nombre négatif d’emplacements, même avec une photo de trop', () => {
    expect(photoSlotsLeft(Array.from({ length: PHOTOS_MAX + 1 }, () => aPhoto()))).toBe(0);
  });

  it('aucune photo = prêt : les preuves sont recommandées, pas obligatoires', () => {
    expect(photosReady([])).toBe(true);
  });

  it('un téléversement EN VOL bloque : le dossier partirait sans sa preuve', () => {
    expect(photosReady([aPhoto({ uploading: true, url: null })])).toBe(false);
  });

  it('un téléversement en ÉCHEC bloque aussi — et il le dit par son code', () => {
    expect(photosReady([aPhoto({ url: null, errorCode: 'TOO_LARGE' })])).toBe(false);
  });

  it('une photo en ligne mais marquée en échec reste un blocage', () => {
    expect(photosReady([aPhoto({ errorCode: 'FAILED' })])).toBe(false);
  });
});

describe('reportBlockers — ce qui manque, dans l’ordre où l’écran le lit', () => {
  it('un dossier complet ne bloque sur rien', () => {
    expect(reportBlockers(aForm())).toEqual([]);
  });

  it('un formulaire vide bloque sur les quatre conditions, dans l’ordre', () => {
    const empty = aForm({
      category: null,
      description: '',
      photos: [aPhoto({ uploading: true, url: null })],
      pledgeAccepted: false,
    });
    expect(reportBlockers(empty)).toEqual(['category', 'description', 'photos', 'pledge']);
  });

  it('la solution souhaitée n’est PAS un blocage — elle informe la médiation', () => {
    expect(reportBlockers(aForm({ outcome: null }))).toEqual([]);
  });

  it('`canSubmitReport` est exactement « aucun blocage »', () => {
    expect(canSubmitReport(aForm({ category: null }))).toBe(false);
    expect(canSubmitReport(aForm())).toBe(true);
  });
});

describe('reportFailureKey — un refus DÉFINITIF ferme le formulaire', () => {
  it('le deal a bougé entre la lecture et le clic : réessayer ne changera rien', () => {
    expect(reportFailureKey('TRANSITION_NOT_ALLOWED', 409)).toBe('conflict');
  });

  it('le colis est reparti en transit : le motif n’est plus recevable', () => {
    expect(reportFailureKey('DISPUTE_CATEGORY_NOT_ALLOWED', 409)).toBe('categoryRefused');
  });

  it('ce n’est pas mon envoi : même issue, l’écran se ferme', () => {
    expect(reportFailureKey('SHIPPER_ONLY', 403)).toBe('conflict');
  });

  it('une validation garde la feuille ouverte sur son bouton', () => {
    expect(reportFailureKey(null, 400)).toBe('validation');
  });

  it('une panne aussi — et jamais le message serveur, qui est pour les journaux', () => {
    expect(reportFailureKey(null, 500)).toBe('generic');
    expect(reportFailureKey('UN_CODE_INCONNU', 500)).toBe('generic');
  });

  it('un code métier connu l’emporte sur le statut HTTP', () => {
    expect(reportFailureKey('TRANSITION_NOT_ALLOWED', 400)).toBe('conflict');
  });
});

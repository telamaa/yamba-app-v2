/**
 * photos.spec.ts — l'état d'un lot de photos (D115).
 * ====================================================
 * Ce que ces fiches tiennent :
 *   ① rien à moitié fait — « prêt » veut dire : toutes en ligne, aucune en
 *     vol, aucune en échec ;
 *   ② l'identité locale, qui empêche de téléverser deux fois la même image
 *     et surtout de consommer deux places ;
 *   ③ le plafond, qui est le contrat du serveur et non une préférence ;
 *   ④ le RÉESSAI, le seul geste que les trois copies existantes ne savent
 *     pas faire — et le plus utile, debout devant un colis ouvert.
 */
import {
  ajouterPhotos,
  auMoinsUnEchec,
  marquerPhoto,
  photosPretes,
  placesLibres,
  reessayerPhoto,
  retirerPhoto,
  televersementEnCours,
  urlsDesPhotos,
  type PhotoLocale,
} from '@/lib/photos';

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

describe('① prêt veut dire : rien à moitié fait', () => {
  it('un lot VIDE est prêt — c’est à l’appelant d’en exiger une', () => {
    // La prise en charge en exige une (contrat), la remise n'en exige
    // aucune (A76) : ce module ne tranche pas pour eux.
    expect(photosPretes([])).toBe(true);
  });

  it('une photo EN VOL n’est pas prête', () => {
    expect(photosPretes([photo({ uploading: true, url: null })])).toBe(false);
  });

  it('une photo en ÉCHEC n’est pas prête, même avec une URL', () => {
    // Le cas tordu : un réessai qui échoue après un premier succès. L'URL
    // existe, le code d'échec aussi — et c'est l'échec qui décide.
    expect(photosPretes([photo({ errorCode: 'FAILED' })])).toBe(false);
  });

  it('une photo sans URL n’est pas prête, même si elle ne travaille plus', () => {
    expect(photosPretes([photo({ url: null })])).toBe(false);
  });

  it('les deux questions d’état se répondent séparément', () => {
    const lot = [photo({ id: 'a', uploading: true, url: null }), photo({ id: 'b' })];
    expect(televersementEnCours(lot)).toBe(true);
    expect(auMoinsUnEchec(lot)).toBe(false);
    expect(auMoinsUnEchec([photo({ errorCode: 'TOO_LARGE' })])).toBe(true);
  });

  it('les URL sortent dans l’ORDRE d’ajout, sans les absentes', () => {
    const urls = urlsDesPhotos([
      photo({ id: 'a', url: 'https://ik/a.jpg' }),
      photo({ id: 'b', uploading: true, url: null }),
      photo({ id: 'c', url: 'https://ik/c.jpg' }),
    ]);
    expect(urls).toEqual(['https://ik/a.jpg', 'https://ik/c.jpg']);
  });
});

describe('② l’identité locale : la même image ne part pas deux fois', () => {
  it('rechoisir la même photo ne consomme pas une place', () => {
    const lot = [photo({ id: 'asset-1' })];
    const apres = ajouterPhotos(lot, [{ id: 'asset-1', uri: 'file:///colis-1.jpg' }], 5);
    expect(apres).toHaveLength(1);
  });

  it('une nouvelle photo entre EN VOL, sans URL ni échec', () => {
    const [ajoutee] = ajouterPhotos([], [{ id: 'asset-9', uri: 'file:///x.jpg' }], 5);
    expect(ajoutee).toEqual({
      id: 'asset-9',
      uri: 'file:///x.jpg',
      uploading: true,
      url: null,
      errorCode: null,
    });
  });

  it('les photos déjà là ne sont pas touchées', () => {
    const avant = [photo({ id: 'a' })];
    const apres = ajouterPhotos(avant, [{ id: 'b', uri: 'file:///b.jpg' }], 5);
    expect(apres[0]).toBe(avant[0]);
  });
});

describe('③ le plafond est le contrat, pas une préférence', () => {
  it('les places libres ne descendent jamais sous zéro', () => {
    expect(placesLibres([photo({ id: 'a' }), photo({ id: 'b' })], 1)).toBe(0);
  });

  it('un lot plein n’accepte plus rien', () => {
    const plein = [photo({ id: 'a' })];
    expect(ajouterPhotos(plein, [{ id: 'b', uri: 'file:///b.jpg' }], 1)).toEqual(plein);
  });

  it('on ajoute ce qui TIENT, pas tout ou rien', () => {
    // Choisir trois images quand il reste deux places en garde deux : le
    // refus global obligerait à recommencer la sélection.
    const apres = ajouterPhotos(
      [photo({ id: 'a' })],
      [
        { id: 'b', uri: 'file:///b.jpg' },
        { id: 'c', uri: 'file:///c.jpg' },
        { id: 'd', uri: 'file:///d.jpg' },
      ],
      3
    );
    expect(apres.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('④ marquer, retirer, RÉESSAYER', () => {
  const lot = [photo({ id: 'a', uploading: true, url: null }), photo({ id: 'b' })];

  it('un succès ne marque QUE sa photo', () => {
    const apres = marquerPhoto(lot, 'a', { ok: true, url: 'https://ik/a.jpg' });
    expect(apres[0]).toEqual(
      expect.objectContaining({ uploading: false, url: 'https://ik/a.jpg', errorCode: null })
    );
    expect(apres[1]).toBe(lot[1]);
  });

  it('un échec garde la photo à l’écran, avec son code', () => {
    // Elle reste visible : c'est elle qu'on réessaie, et le code dit pourquoi.
    const apres = marquerPhoto(lot, 'a', { ok: false, code: 'TOO_LARGE' });
    expect(apres[0]).toEqual(
      expect.objectContaining({ uploading: false, url: null, errorCode: 'TOO_LARGE' })
    );
  });

  it('un résultat qui arrive pour une photo RETIRÉE ne ressuscite rien', () => {
    // Le téléversement est en vol : retirer la photo puis recevoir sa
    // réponse est le cas ordinaire, pas une bizarrerie.
    const apres = marquerPhoto(retirerPhoto(lot, 'a'), 'a', { ok: true, url: 'https://ik/a.jpg' });
    expect(apres.map((p) => p.id)).toEqual(['b']);
  });

  it('une photo en échec part sans bloquer l’envoi', () => {
    const avec = [photo({ id: 'a', errorCode: 'FAILED', url: null })];
    expect(photosPretes(retirerPhoto(avec, 'a'))).toBe(true);
  });

  it('le réessai EFFACE l’échec et remet en vol', () => {
    // Sans l'effacement, `photosPretes` resterait faux pendant tout le
    // second envoi et le bouton dirait « une photo n'est pas partie » alors
    // qu'elle est en train de partir.
    const enEchec = [photo({ id: 'a', url: null, errorCode: 'FAILED' })];
    const [reprise] = reessayerPhoto(enEchec, 'a');
    expect(reprise).toEqual(
      expect.objectContaining({ uploading: true, url: null, errorCode: null })
    );
  });

  it('un réessai sur une photo inconnue ne change rien', () => {
    const lotB = [photo({ id: 'b' })];
    expect(reessayerPhoto(lotB, 'inconnue')).toEqual(lotB);
  });
});

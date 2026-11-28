/**
 * use-photos.ts — choisir, téléverser, réessayer (D115).
 * ========================================================
 * Le collage entre `expo-image-picker`, ImageKit et l'état pur de
 * `lib/photos.ts`. Tout ce qui se DÉCIDE est dans le module pur ; ici il
 * n'y a que des effets.
 *
 * LA PERMISSION SE DEMANDE AU GESTE, ET SÉPARÉMENT PAR SOURCE : accepter
 * l'appareil photo ne doit pas ouvrir toute la photothèque. (Reprise fidèle
 * de `report.tsx`, qui l'avait déjà raison.)
 *
 * Le refus de permission remonte à l'appelant (`onRefus`) : il a ses propres
 * mots, et ce hook n'a pas à connaître de dictionnaire.
 */
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';

import {
  ajouterPhotos,
  marquerPhoto,
  reessayerPhoto,
  retirerPhoto,
  type PhotoLocale,
  type ResultatTeleversement,
} from '@/lib/photos';

export type SourcePhoto = 'camera' | 'photothèque';

type UploadablePhoto = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
};

/**
 * L'identité locale d'une image. `assetId` quand le système le donne,
 * l'URI sinon — c'est elle qui empêche de téléverser deux fois la même
 * photo rechoisie dans la photothèque.
 */
function identite(asset: ImagePicker.ImagePickerAsset): string {
  return asset.assetId ?? asset.uri;
}

export function usePhotos({
  max,
  televerser,
  onRefus,
}: {
  max: number;
  televerser: (photo: UploadablePhoto) => Promise<ResultatTeleversement>;
  onRefus: (source: SourcePhoto) => void;
}) {
  const [photos, setPhotos] = useState<readonly PhotoLocale[]>([]);

  /**
   * Le MIROIR de l'état, pour lire sans rendre.
   *
   * Sans lui, on serait tenté de lire l'état DANS un `setPhotos(avant => …)`
   * et d'y lancer les téléversements au passage. Un « updater » doit être
   * PUR : React peut le rejouer (mode strict), et un effet qui s'y glisse
   * part deux fois. C'est la règle CQS que ce dépôt a payée en D83 — une
   * lecture qui écrit provoque « Cannot update a component while rendering
   * a different component ».
   */
  const courant = useRef<readonly PhotoLocale[]>([]);
  const poser = useCallback((suite: readonly PhotoLocale[]) => {
    courant.current = suite;
    setPhotos(suite);
  }, []);

  const envoyer = useCallback(
    (id: string, photo: UploadablePhoto) => {
      void televerser(photo).then((resultat) => {
        poser(marquerPhoto(courant.current, id, resultat));
      });
    },
    [televerser, poser]
  );

  const choisir = useCallback(
    async (source: SourcePhoto) => {
      // La permission se demande AU GESTE, et séparément par source.
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        onRefus(source);
        return;
      }

      // Le nombre de places est relu ICI, APRÈS l'attente de la permission :
      // l'état capturé à l'entrée de la fonction serait périmé.
      const places = Math.max(0, max - courant.current.length);
      if (places === 0) return;

      const resultat =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              selectionLimit: places,
              allowsMultipleSelection: true,
            });
      if (resultat.canceled) return;

      const candidates = resultat.assets.map((asset) => ({
        id: identite(asset),
        uri: asset.uri,
        // Gardés DÈS la sélection : l'asset d'origine n'est plus là ensuite.
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? null,
        sizeBytes: asset.fileSize ?? null,
      }));

      const avant = courant.current;
      const apres = ajouterPhotos(avant, candidates, max);
      poser(apres);

      // On n'envoie QUE ce qui vient d'entrer : `ajouterPhotos` écarte les
      // doublons et le trop-plein, et c'est LUI qui fait foi — recompter ici
      // serait une seconde règle, fausse un jour.
      const nouvelles = new Set(apres.slice(avant.length).map((p) => p.id));
      for (const candidate of candidates) {
        if (nouvelles.has(candidate.id)) envoyer(candidate.id, candidate);
      }
    },
    [max, onRefus, envoyer]
  );

  const retirer = useCallback(
    (id: string) => {
      poser(retirerPhoto(courant.current, id));
    },
    [poser]
  );

  const reessayer = useCallback(
    (id: string) => {
      const photo = courant.current.find((p) => p.id === id);
      if (photo === undefined) return;
      poser(reessayerPhoto(courant.current, id));
      envoyer(id, { uri: photo.uri, fileName: null, mimeType: null, sizeBytes: null });
    },
    [envoyer, poser]
  );

  return { photos, choisir, retirer, reessayer };
}

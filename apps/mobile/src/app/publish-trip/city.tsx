/**
 * publish-trip/city.tsx — la ville de départ ou d'arrivée du TRAJET publié.
 * =====================================================================
 * Même page que la recherche, même composant (`components/city-picker.tsx`) :
 * seul diffère ce qu'on fait du choix. Ici on garde la VILLE et son PAYS
 * séparément, et pas seulement le libellé — le serveur attend `originCity`
 * (requis) et `originCountry` (facultatif) en deux champs distincts
 * (`createTripSchema`).
 *
 * CE QUE LE TÉLÉPHONE NE PEUT PAS ENVOYER, ET QU'IL N'INVENTE PAS : le
 * `placeId`, le code pays ISO et les coordonnées. Le site les obtient du SDK
 * Google chargé dans le navigateur ; le relais Places (A211) ne rend que deux
 * chaînes. Conséquence à connaître — et à trancher au lot suivant : la
 * suggestion de prix par corridor a besoin du code pays et des coordonnées.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { useTranslations } from 'use-intl';

import { CityPicker, type VilleSaisie } from '@/components/city-picker';
import { useTopInset } from '@/hooks/use-top-inset';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';

export default function PublishCityScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const cible: 'depart' | 'arrivee' = field === 'to' ? 'arrivee' : 'depart';

  const t = useTranslations('publish');
  const topInset = useTopInset();
  const draft = usePublishDraft();

  const onPick = useCallback(
    (ville: VilleSaisie) => {
      setPublishDraft({ [cible]: ville } as { depart: VilleSaisie } | { arrivee: VilleSaisie });
      router.back();
    },
    [cible]
  );

  return (
    <CityPicker
      title={cible === 'arrivee' ? t('route.to') : t('route.from')}
      placeholder={cible === 'arrivee' ? t('route.toPlaceholder') : t('route.fromPlaceholder')}
      initial={(cible === 'arrivee' ? draft.arrivee : draft.depart)?.libelle ?? ''}
      topInset={topInset}
      textes={{
        back: t('back'),
        clear: t('city.clear'),
        noResult: t('city.noResult'),
        unavailable: t('city.unavailable'),
        useTyped: (city) => t('city.useTyped', { city }),
      }}
      onCloseAction={() => router.back()}
      onPickAction={onPick}
    />
  );
}

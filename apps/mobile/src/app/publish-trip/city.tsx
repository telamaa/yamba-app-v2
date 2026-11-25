/**
 * publish-trip/city.tsx — la ville de départ ou d'arrivée du TRAJET publié.
 * =====================================================================
 * Même page que la recherche, même composant (`components/city-picker.tsx`) :
 * seul diffère ce qu'on fait du choix. Ici on garde la VILLE et son PAYS
 * séparément, et pas seulement le libellé — le serveur attend `originCity`
 * (requis) et `originCountry` (facultatif) en deux champs distincts
 * (`createTripSchema`).
 *
 * CE QUE LE CHOIX DÉCLENCHE, DEPUIS D111 ter : un appel à
 * `GET /places/details`, UNE fois, avec le MÊME jeton de session que
 * l'autocomplétion — Google facture alors l'ensemble comme une seule
 * session. Il rend le code pays et les coordonnées, c'est-à-dire la ZONE du
 * corridor et la distance : sans eux, pas de fourchette de prix.
 *
 * L'ÉCRAN NE L'ATTEND PAS. Il se referme immédiatement avec la ville, et le
 * détail arrive après — le brouillon est une mémoire de module, un écran
 * dépilé n'empêche pas de l'enrichir. Faire patienter sur un réseau lent
 * pour un CONFORT serait payer deux fois : l'attente, et l'échec possible.
 *
 * LA RÉPONSE EN RETARD EST JETÉE si la ville a changé entre-temps — même
 * règle que la liste de suggestions, pour la même raison : deux choix
 * rapprochés, deux réponses, et celle d'avant écraserait celle d'après.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { useLocale, useTranslations } from 'use-intl';

import { CityPicker, type VilleSaisie } from '@/components/city-picker';
import { useTopInset } from '@/hooks/use-top-inset';
import { fetchPlaceDetails } from '@/lib/api/places.api';
import { getPublishDraft, setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import type { VilleChoisie } from '@/lib/publish-trip';

export default function PublishCityScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const cible: 'depart' | 'arrivee' = field === 'to' ? 'arrivee' : 'depart';

  const t = useTranslations('publish');
  const locale = useLocale();
  const topInset = useTopInset();
  const draft = usePublishDraft();

  const onPick = useCallback(
    (ville: VilleSaisie, contexte: { jetonDeSession: string }) => {
      const choisie: VilleChoisie = { ...ville, countryCode: null, lat: null, lng: null };
      setPublishDraft({ [cible]: choisie } as Partial<{ depart: VilleChoisie; arrivee: VilleChoisie }>);
      router.back();

      // Le détail arrive APRÈS la fermeture : il enrichit, il ne retient pas.
      if (ville.placeId.length === 0) return;
      void fetchPlaceDetails(ville.placeId, locale, contexte.jetonDeSession).then((details) => {
        if (details === null) return;
        // La ville a-t-elle changé pendant l'appel ? Alors ce détail n'est
        // plus le sien.
        const courante = getPublishDraft()[cible];
        if (courante === null || courante.placeId !== ville.placeId) return;
        setPublishDraft({
          [cible]: {
            ...courante,
            // Le pays en toutes lettres de Google est plus fiable que le
            // dernier segment du contexte : on le prend quand il existe.
            pays: details.country ?? courante.pays,
            countryCode: details.countryCode,
            lat: details.lat,
            lng: details.lng,
          },
        } as Partial<{ depart: VilleChoisie; arrivee: VilleChoisie }>);
      });
    },
    [cible, locale]
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

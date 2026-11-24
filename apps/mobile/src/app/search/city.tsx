/**
 * search/city.tsx — choisir le départ ou la destination de la RECHERCHE.
 * =======================================================================
 * Réf. capture 13/10 21h23. Le geste — page pleine, en-tête « ‹ Départ »,
 * saisie nue, suggestions dessous — vit depuis le lot « publier un trajet »
 * dans `components/city-picker.tsx` : la publication demandait exactement le
 * même écran, et ce dépôt a payé trois fois (D88/D97/A224) ce que coûte une
 * SECONDE copie d'un écran juste. Cette route ne garde donc que ce qui lui
 * est propre : ses mots, et ce qu'elle fait du choix.
 *
 * Ce qu'elle fait du choix, justement : la recherche ne retient que le
 * LIBELLÉ normalisé « Ville, Pays » — `placeSearchTerm` (trip-service) ne
 * garde que le premier segment avant la virgule, le pays n'est qu'une aide à
 * la lecture (WEB-ACC-9).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { useTranslations } from 'use-intl';

import { CityPicker } from '@/components/city-picker';
import { useTopInset } from '@/hooks/use-top-inset';
import { getSearchDraft, setSearchDraft } from '@/lib/search-draft';

export default function CitySearchScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const target: 'from' | 'to' = field === 'to' ? 'to' : 'from';

  const t = useTranslations('search');
  const topInset = useTopInset();

  const onPick = useCallback(
    (ville: { libelle: string }) => {
      setSearchDraft({ [target]: ville.libelle.trim() } as { from: string } | { to: string });
      router.back();
    },
    [target]
  );

  return (
    <CityPicker
      title={target === 'to' ? t('form.toLabel') : t('form.fromLabel')}
      placeholder={target === 'to' ? t('form.toPlaceholder') : t('form.fromPlaceholder')}
      initial={getSearchDraft()[target]}
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

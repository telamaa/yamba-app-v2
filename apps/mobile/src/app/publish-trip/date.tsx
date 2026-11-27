/**
 * publish-trip/date.tsx — la date de départ ou d'arrivée, dans le calendrier maison.
 * =============================================================================
 * Le MÊME calendrier que la recherche (`components/search-calendar.tsx`,
 * A207) : mois qui défilent au pouce, grille à la charte, zéro dépendance.
 * Il est déjà le calendrier du produit — en poser un second pour la
 * publication, c'est deux calendriers qui divergeront.
 *
 * Il sait peindre une FENÊTRE (« je suis flexible ») : la publication ne s'en
 * sert pas. Un Voyageur part un jour précis — c'est son billet qui le dit.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BackButton } from '@/components/back-button';
import { SearchCalendar } from '@/components/search-calendar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTopInset } from '@/hooks/use-top-inset';
import { setPublishDraft, usePublishDraft } from '@/lib/publish-draft';
import { dateIso } from '@/lib/publish-trip';

export default function PublishDateScreen() {
  const { field } = useLocalSearchParams<{ field?: string }>();
  const cible: 'dateDepart' | 'dateArrivee' = field === 'arrival' ? 'dateArrivee' : 'dateDepart';

  const t = useTranslations('publish');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const topInset = useTopInset();
  const draft = usePublishDraft();

  const choisi = draft[cible];

  const onPickDay = useCallback(
    (jour: Date) => {
      setPublishDraft({ [cible]: dateIso(jour) } as { dateDepart: string } | { dateArrivee: string });
      router.back();
    },
    [cible]
  );

  const titre = cible === 'dateArrivee' ? t('when.arrivalDate') : t('when.departureDate');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.column} edges={['left', 'right']}>
        {/* D107 — la marge haute ne vient pas du seul inset mesuré. */}
        <View
          style={[
            styles.header,
            { borderBottomColor: theme.backgroundElement, paddingTop: topInset + Spacing.two },
          ]}>
          <BackButton label={t('back')} onPress={() => router.back()} />
          <ThemedText type="subtitle" style={styles.title}>
            {titre}
          </ThemedText>
        </View>

        <SearchCalendar
          value={choisi === null ? null : { mode: 'exact', date: new Date(`${choisi}T12:00:00`) }}
          onPickDayAction={onPickDay}
          locale={locale}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  column: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
  },
});

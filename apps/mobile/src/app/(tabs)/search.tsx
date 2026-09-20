/**
 * search.tsx — l'onglet Rechercher (lot recherche D36).
 * =====================================================
 * Public, comme la recherche web. Formulaire ville de départ / destination /
 * fenêtre de dates (puces : toutes, aujourd'hui, demain, 7 jours — un vrai
 * calendrier viendra avec le parcours de réservation), résultats RÉELS de
 * `GET /trips/search` paginés au curseur. Le serveur décide de tout : filtres,
 * tri, textes localisés, comptage de la demande (une recherche mobile pèse
 * dans les stats comme une recherche web). La carte s'arrête AVANT la page
 * trajet — lot suivant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripResultCard } from '@/components/trip-result-card';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  searchTrips,
  type SearchPage,
  type SearchParams,
  type TripSearchResult,
} from '@/lib/api/search.api';

const PAGE_SIZE = 20;

/** Fenêtres de départ proposées en puces. */
const DATE_WINDOWS = ['any', 'today', 'tomorrow', 'week'] as const;
type DateWindow = (typeof DATE_WINDOWS)[number];

function windowBounds(window: DateWindow): { dateFrom?: string; dateTo?: string } {
  if (window === 'any') return {};
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const plusDays = (d: Date, n: number) => new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
  const today = startOfDay(new Date());
  if (window === 'today') {
    return { dateFrom: today.toISOString(), dateTo: plusDays(today, 1).toISOString() };
  }
  if (window === 'tomorrow') {
    return {
      dateFrom: plusDays(today, 1).toISOString(),
      dateTo: plusDays(today, 2).toISOString(),
    };
  }
  return { dateFrom: today.toISOString(), dateTo: plusDays(today, 8).toISOString() };
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; correlationId: string | null }
  | { kind: 'results'; page: SearchPage; loadingMore: boolean };

export default function SearchScreen() {
  const t = useTranslations('search');
  const theme = useTheme();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dateWindow, setDateWindow] = useState<DateWindow>('any');
  const [state, setState] = useState<SearchState>({ kind: 'idle' });

  const currentParams = useCallback(
    () => ({
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      ...windowBounds(dateWindow),
      limit: PAGE_SIZE,
    }),
    [from, to, dateWindow]
  );

  const runSearchWith = useCallback(
    async (params: SearchParams) => {
      setState({ kind: 'loading' });
      try {
        const page = await searchTrips(params);
        setState({ kind: 'results', page, loadingMore: false });
      } catch (err) {
        setState({
          kind: 'error',
          message: err instanceof ApiError ? err.message : t('error.network'),
          correlationId: err instanceof ApiError ? err.correlationId : null,
        });
      }
    },
    [t]
  );

  const runSearch = useCallback(
    () => runSearchWith(currentParams()),
    [runSearchWith, currentParams]
  );

  // Préremplissage depuis l'accueil (lot accueil) : un corridor touché arrive
  // en paramètres de route avec une GRAINE — rejouée seulement quand elle
  // change, pour que retaper le même corridor relance bien la recherche sans
  // qu'un simple retour sur l'onglet ne la rejoue.
  const prefill = useLocalSearchParams<{ from?: string; to?: string; seed?: string }>();
  const appliedSeed = useRef<string | null>(null);
  useEffect(() => {
    if (typeof prefill.seed !== 'string' || prefill.seed === appliedSeed.current) return;
    appliedSeed.current = prefill.seed;
    const nextFrom = typeof prefill.from === 'string' ? prefill.from : '';
    const nextTo = typeof prefill.to === 'string' ? prefill.to : '';
    setFrom(nextFrom);
    setTo(nextTo);
    setDateWindow('any');
    void runSearchWith({
      from: nextFrom.trim() || undefined,
      to: nextTo.trim() || undefined,
      limit: PAGE_SIZE,
    });
  }, [prefill.seed, prefill.from, prefill.to, runSearchWith]);

  const loadMore = useCallback(async () => {
    if (state.kind !== 'results' || state.loadingMore || state.page.nextCursor === null) return;
    setState({ ...state, loadingMore: true });
    try {
      const next = await searchTrips({ ...currentParams(), cursor: state.page.nextCursor });
      setState({
        kind: 'results',
        page: {
          trips: [...state.page.trips, ...next.trips],
          nextCursor: next.nextCursor,
          totalCount: next.totalCount,
        },
        loadingMore: false,
      });
    } catch {
      // La page suivante a échoué : on garde ce qu'on a, le scroll retentera.
      setState({ ...state, loadingMore: false });
    }
  }, [state, currentParams]);

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.form}>
          <TextInput
            style={inputStyle}
            placeholder={t('form.fromPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            value={from}
            onChangeText={setFrom}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('form.toPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="words"
            value={to}
            onChangeText={setTo}
            returnKeyType="search"
            onSubmitEditing={runSearch}
          />
          <View style={styles.chips}>
            {DATE_WINDOWS.map((window) => {
              const selected = dateWindow === window;
              return (
                <Pressable
                  key={window}
                  onPress={() => setDateWindow(window)}
                  style={[
                    styles.chip,
                    { backgroundColor: selected ? Brand.mango : theme.backgroundElement },
                  ]}>
                  <ThemedText
                    type="small"
                    style={selected ? styles.chipLabelSelected : undefined}>
                    {t(`form.dates.${window}`)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={runSearch}
            disabled={state.kind === 'loading'}
            style={({ pressed }) => [
              styles.submit,
              (state.kind === 'loading' || pressed) && styles.submitDimmed,
            ]}>
            <ThemedText style={styles.submitLabel}>{t('form.submit')}</ThemedText>
          </Pressable>
        </View>

        {state.kind === 'idle' && (
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {t('prompt')}
          </ThemedText>
        )}

        {state.kind === 'loading' && <ActivityIndicator color={Brand.mango} style={styles.spinner} />}

        {state.kind === 'error' && (
          <View style={styles.stateBlock}>
            <ThemedText style={styles.centered}>{state.message}</ThemedText>
            {state.correlationId !== null && (
              <ThemedText type="code" themeColor="textSecondary" style={styles.centered}>
                {state.correlationId}
              </ThemedText>
            )}
            <Pressable onPress={runSearch}>
              <ThemedText type="linkPrimary">{t('error.retry')}</ThemedText>
            </Pressable>
          </View>
        )}

        {state.kind === 'results' && state.page.trips.length === 0 && (
          <View style={styles.stateBlock}>
            <ThemedText type="smallBold" style={styles.centered}>
              {t('empty.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {t('empty.body')}
            </ThemedText>
          </View>
        )}

        {state.kind === 'results' && state.page.trips.length > 0 && (
          <FlatList<TripSearchResult>
            data={state.page.trips}
            keyExtractor={(trip) => trip.id}
            renderItem={({ item }) => <TripResultCard trip={item} />}
            ListHeaderComponent={
              <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                {t('results', { count: state.page.totalCount })}
              </ThemedText>
            }
            ListFooterComponent={
              state.loadingMore ? <ActivityIndicator color={Brand.mango} style={styles.spinner} /> : null
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        )}
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
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  form: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  chipLabelSelected: {
    color: '#ffffff',
    fontWeight: 700,
  },
  submit: {
    backgroundColor: Brand.mango,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitDimmed: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#ffffff',
    fontWeight: 700,
  },
  centered: {
    textAlign: 'center',
  },
  stateBlock: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  spinner: {
    paddingTop: Spacing.four,
  },
  count: {
    paddingBottom: Spacing.two,
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.five,
  },
});

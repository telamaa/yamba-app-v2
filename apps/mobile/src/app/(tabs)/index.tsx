/**
 * (tabs)/index.tsx — Rechercher, l'onglet d'ATTERRISSAGE (lot recherche-first).
 * =============================================================================
 * L'app est recherche-first (la référence l'a validé dix ans) : l'onglet
 * Accueil a disparu, la croix de l'écran de bienvenue et la connexion
 * atterrissent ICI. Le formulaire est la carte du site en natif : Départ /
 * Destination / Date empilés avec leurs libellés, la date par le VRAI
 * sélecteur de chaque OS (`NativeDateField`), un seul bouton. Après une
 * recherche, la carte se REPLIE en pilule récap (route · date · Modifier) —
 * l'écran respire pour les résultats. Au repos, les corridors réels
 * (« En ce moment ») rendent l'écran vivant : un toucher remplit les champs
 * et lance la recherche — même écran, zéro navigation. Le serveur décide de
 * tout (RG-MOB-13/14) : filtres, tri, textes localisés, comptage.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { CityPicker } from '@/components/city-picker';
import { NativeDateField } from '@/components/native-date-field';
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
import { formatLongDate } from '@/lib/trip-format';

const PAGE_SIZE = 20;

/** Même dérivation que l'accueil web (échantillon publié, agrégé à l'affichage). */
const MAX_CORRIDORS = 6;
const CORRIDORS_SAMPLE = 50;

type Corridor = { fromCity: string; toCity: string; count: number };

function deriveCorridors(trips: TripSearchResult[]): Corridor[] {
  const byKey = new Map<string, Corridor>();
  for (const trip of trips) {
    const key = `${trip.fromCity}→${trip.toCity}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      byKey.set(key, { fromCity: trip.fromCity, toCity: trip.toCity, count: 1 });
    }
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count).slice(0, MAX_CORRIDORS);
}

/** Le jour choisi, en bornes serveur : du minuit local au minuit suivant. */
function dayBounds(day: Date): { dateFrom: string; dateTo: string } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
}

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; correlationId: string | null }
  | { kind: 'results'; page: SearchPage; loadingMore: boolean };

export default function SearchScreen() {
  const t = useTranslations('search');
  const theme = useTheme();
  const locale = useLocale() as SupportedLocale;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Quel champ ville est en saisie plein écran (motif natif, réf. captures).
  const [cityPicker, setCityPicker] = useState<'from' | 'to' | null>(null);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  // null tant que rien de vrai à montrer (chargement, panne, zéro trajet).
  const [corridors, setCorridors] = useState<Corridor[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    searchTrips({ limit: CORRIDORS_SAMPLE })
      .then((page) => {
        if (cancelled) return;
        const derived = deriveCorridors(page.trips);
        setCorridors(derived.length > 0 ? derived : null);
      })
      .catch(() => {
        // API en panne : la section s'efface, l'écran ne casse pas.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const paramsFor = useCallback(
    (nextFrom: string, nextTo: string, nextDate: Date | null): SearchParams => ({
      from: nextFrom.trim() || undefined,
      to: nextTo.trim() || undefined,
      ...(nextDate !== null ? dayBounds(nextDate) : {}),
      limit: PAGE_SIZE,
    }),
    []
  );

  const runSearchWith = useCallback(
    async (params: SearchParams) => {
      setState({ kind: 'loading' });
      setFormCollapsed(true);
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
    () => runSearchWith(paramsFor(from, to, date)),
    [runSearchWith, paramsFor, from, to, date]
  );

  const openCorridor = useCallback(
    (corridor: Corridor) => {
      setFrom(corridor.fromCity);
      setTo(corridor.toCity);
      setDate(null);
      void runSearchWith(paramsFor(corridor.fromCity, corridor.toCity, null));
    },
    [runSearchWith, paramsFor]
  );

  const loadMore = useCallback(async () => {
    if (state.kind !== 'results' || state.loadingMore || state.page.nextCursor === null) return;
    setState({ ...state, loadingMore: true });
    try {
      const next = await searchTrips({
        ...paramsFor(from, to, date),
        cursor: state.page.nextCursor,
      });
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
  }, [state, paramsFor, from, to, date]);

  const summaryRoute =
    from.trim() && to.trim()
      ? `${from.trim()} → ${to.trim()}`
      : from.trim() || to.trim() || t('summary.everywhere');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {formCollapsed ? (
          <Pressable onPress={() => setFormCollapsed(false)}>
            <ThemedView type="backgroundElement" style={styles.summary}>
              <View style={styles.summaryTexts}>
                <ThemedText type="smallBold" numberOfLines={1} style={styles.summaryRoute}>
                  {summaryRoute}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {date !== null ? formatLongDate(date.toISOString(), locale) : t('form.dateAny')}
                </ThemedText>
              </View>
              <ThemedText type="linkPrimary">{t('summary.edit')}</ThemedText>
            </ThemedView>
          </Pressable>
        ) : (
          <ThemedView type="backgroundElement" style={styles.form}>
            <Pressable style={styles.fieldRow} onPress={() => setCityPicker('from')}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                {t('form.fromLabel')}
              </ThemedText>
              <ThemedText
                style={styles.fieldValue}
                themeColor={from ? undefined : 'textSecondary'}
                numberOfLines={1}>
                {from || t('form.fromPlaceholder')}
              </ThemedText>
            </Pressable>
            <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
            <Pressable style={styles.fieldRow} onPress={() => setCityPicker('to')}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                {t('form.toLabel')}
              </ThemedText>
              <ThemedText
                style={styles.fieldValue}
                themeColor={to ? undefined : 'textSecondary'}
                numberOfLines={1}>
                {to || t('form.toPlaceholder')}
              </ThemedText>
            </Pressable>
            <View style={[styles.separator, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.dateRow}>
              <Pressable style={styles.dateTouch} onPress={() => setPickerOpen(true)}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  {t('form.dateLabel')}
                </ThemedText>
                <ThemedText
                  style={styles.dateValue}
                  themeColor={date !== null ? undefined : 'textSecondary'}>
                  {date !== null
                    ? formatLongDate(date.toISOString(), locale)
                    : t('form.datePlaceholder')}
                </ThemedText>
              </Pressable>
              {date !== null && (
                <Pressable
                  onPress={() => setDate(null)}
                  hitSlop={Spacing.two}
                  accessibilityLabel={t('form.dateClear')}>
                  <ThemedText themeColor="textSecondary">✕</ThemedText>
                </Pressable>
              )}
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
          </ThemedView>
        )}

        <CityPicker
          visible={cityPicker !== null}
          label={cityPicker === 'to' ? t('form.toLabel') : t('form.fromLabel')}
          placeholder={cityPicker === 'to' ? t('form.toPlaceholder') : t('form.fromPlaceholder')}
          initialValue={cityPicker === 'to' ? to : from}
          onPickAction={(city) => {
            if (cityPicker === 'to') setTo(city);
            else setFrom(city);
            setCityPicker(null);
          }}
          onCloseAction={() => setCityPicker(null)}
        />

        <NativeDateField
          visible={pickerOpen}
          initialDate={date}
          onPickAction={(picked) => {
            setDate(picked);
            setPickerOpen(false);
          }}
          onDismissAction={() => setPickerOpen(false)}
        />

        {state.kind === 'idle' && (
          <View style={styles.idle}>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {t('prompt')}
            </ThemedText>
            {corridors !== null && (
              <View style={styles.corridors}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.corridorsLabel}>
                  {t('corridors.label')}
                </ThemedText>
                <ThemedText type="smallBold">{t('corridors.title')}</ThemedText>
                {corridors.map((corridor) => (
                  <Pressable
                    key={`${corridor.fromCity}→${corridor.toCity}`}
                    onPress={() => openCorridor(corridor)}
                    style={({ pressed }) => pressed && styles.pressed}>
                    <ThemedView type="backgroundElement" style={styles.corridorChip}>
                      <ThemedText type="smallBold" style={styles.corridorRoute}>
                        {corridor.fromCity} <ThemedText style={styles.arrow}>→</ThemedText>{' '}
                        {corridor.toCity}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('corridors.tripCount', { count: corridor.count })}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
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
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  fieldRow: {
    gap: 2,
    paddingVertical: 2,
  },
  fieldLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fieldValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dateTouch: {
    flex: 1,
    gap: 2,
  },
  dateValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  submit: {
    backgroundColor: Brand.mango,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  submitDimmed: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#151718',
    fontSize: 15,
    fontWeight: 600,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  summaryTexts: {
    flex: 1,
    gap: 1,
  },
  summaryRoute: {
    flexShrink: 1,
  },
  idle: {
    gap: Spacing.four,
    paddingTop: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  corridors: {
    gap: Spacing.two,
  },
  corridorsLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  corridorChip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  corridorRoute: {
    flexShrink: 1,
  },
  arrow: {
    color: Brand.mango,
  },
  pressed: {
    opacity: 0.7,
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

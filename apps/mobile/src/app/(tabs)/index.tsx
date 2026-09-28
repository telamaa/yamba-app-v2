/**
 * (tabs)/index.tsx — Rechercher, l'onglet d'ATTERRISSAGE (lot recherche-first).
 * =============================================================================
 * L'app est recherche-first (la référence l'a validé dix ans) : l'onglet
 * Accueil a disparu, la croix de l'écran de bienvenue et la connexion
 * atterrissent ICI. Le formulaire est la carte du site en natif : Départ /
 * Destination / Date empilés avec leurs libellés, la date par le VRAI
 * sélecteur de chaque OS (`NativeDateField`), un seul bouton. Après une
 * recherche, la carte se REPLIE en pilule récap (route · date · Modifier) —
 * l'écran respire pour les résultats. En mode résultats, la pilule et les
 * pastilles transport RESTENT collées en haut sur un fond flouté (expo-blur :
 * matériau chrome iOS ; Android passe par `BlurTargetView` + `blurMethod`,
 * repli translucide avant Android 12) — la liste défile dessous, jusque sous
 * la barre de statut (motif iOS/Airbnb). Au repos, les corridors réels
 * (« En ce moment ») rendent l'écran vivant : un toucher remplit les champs
 * et lance la recherche — même écran, zéro navigation. Le serveur décide de
 * tout (RG-MOB-13/14) : filtres, tri, textes localisés, comptage.
 */
import { Ionicons } from '@expo/vector-icons';
import { BlurTargetView, BlurView } from 'expo-blur';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { CityPicker } from '@/components/city-picker';
import { NativeDateField } from '@/components/native-date-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripResultCard } from '@/components/trip-result-card';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  getSearchFacets,
  searchTrips,
  type SearchFacets,
  type SearchPage,
  type SearchParams,
  type SearchSort,
  type SearchTransportFilter,
  type TripSearchResult,
} from '@/lib/api/search.api';
import { formatLongDate } from '@/lib/trip-format';
import { consumeBrowseOnLanding } from '@/lib/welcome-state';

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

/** Les quatre pastilles transport, dans l'ordre du web (TransportModeTabs). */
const TRANSPORT_TABS: Array<{
  key: SearchTransportFilter;
  icon: 'airplane-outline' | 'train-outline' | 'car-outline' | null;
}> = [
  { key: 'all', icon: null },
  { key: 'plane', icon: 'airplane-outline' },
  { key: 'train', icon: 'train-outline' },
  { key: 'car', icon: 'car-outline' },
];

const SORT_OPTIONS: SearchSort[] = ['earliest', 'lowestPrice', 'bestRated'];

export default function SearchScreen() {
  const t = useTranslations('search');
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const locale = useLocale() as SupportedLocale;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Quel champ ville est en saisie plein écran (motif natif, réf. captures).
  const [cityPicker, setCityPicker] = useState<'from' | 'to' | null>(null);
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [state, setState] = useState<SearchState>({ kind: 'idle' });
  // Pastille transport active + tri (serveur) — persistent d'une recherche à l'autre.
  const [mode, setMode] = useState<SearchTransportFilter>('all');
  const [sort, setSort] = useState<SearchSort>('earliest');
  // Comptes par transport (facettes serveur) : rafraîchis sur les recherches
  // STRUCTURANTES (villes/date), jamais au toucher d'une pastille.
  const [facets, setFacets] = useState<SearchFacets | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // null tant que rien de vrai à montrer (chargement, panne, zéro trajet).
  const [corridors, setCorridors] = useState<Corridor[] | null>(null);
  // En-tête collant flouté (mode liste) : hauteur mesurée pour dégager le
  // haut de la liste, encoche gérée à la main (le SafeAreaView ne pousse
  // plus le haut — la liste doit passer SOUS la barre de statut).
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  // La cible Android du flou (iOS floute nativement ce qui passe dessous).
  const blurTargetRef = useRef<View | null>(null);

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
    (
      nextFrom: string,
      nextTo: string,
      nextDate: Date | null,
      nextMode: SearchTransportFilter,
      nextSort: SearchSort
    ): SearchParams => ({
      from: nextFrom.trim() || undefined,
      to: nextTo.trim() || undefined,
      ...(nextDate !== null ? dayBounds(nextDate) : {}),
      mode: nextMode,
      sort: nextSort,
      limit: PAGE_SIZE,
    }),
    []
  );

  const runSearchWith = useCallback(
    async (params: SearchParams, refreshFacets: boolean) => {
      setState({ kind: 'loading' });
      setFormCollapsed(true);
      if (refreshFacets) {
        // Fire-and-forget : en panne, on garde les derniers comptes plutôt
        // que de casser la recherche (miroir de useSearchFacets).
        getSearchFacets({
          from: params.from,
          to: params.to,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
        })
          .then(setFacets)
          .catch(() => {});
      }
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
    () => runSearchWith(paramsFor(from, to, date, mode, sort), true),
    [runSearchWith, paramsFor, from, to, date, mode, sort]
  );

  // Une pastille = la MÊME recherche, filtrée par transport côté serveur.
  const pickMode = useCallback(
    (next: SearchTransportFilter) => {
      if (next === mode) return;
      setMode(next);
      void runSearchWith(paramsFor(from, to, date, next, sort), false);
    },
    [mode, runSearchWith, paramsFor, from, to, date, sort]
  );

  const pickSort = useCallback(
    (next: SearchSort) => {
      setFiltersOpen(false);
      if (next === sort) return;
      setSort(next);
      void runSearchWith(paramsFor(from, to, date, mode, next), false);
    },
    [sort, runSearchWith, paramsFor, from, to, date, mode]
  );

  // Le X de l'atterrissage → résultats DIRECTS (motif Airbnb, cf.
  // welcome-state) : la recherche large part d'elle-même, la pilule lit
  // « Partout · Toutes les dates ». Une seule fois, à l'arrivée.
  useEffect(() => {
    if (consumeBrowseOnLanding()) {
      void runSearchWith(paramsFor('', '', null, 'all', 'earliest'), true);
    }
    // Au montage uniquement : le drapeau est un geste d'atterrissage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCorridor = useCallback(
    (corridor: Corridor) => {
      setFrom(corridor.fromCity);
      setTo(corridor.toCity);
      setDate(null);
      void runSearchWith(paramsFor(corridor.fromCity, corridor.toCity, null, mode, sort), true);
    },
    [runSearchWith, paramsFor, mode, sort]
  );

  const loadMore = useCallback(async () => {
    if (state.kind !== 'results' || state.loadingMore || state.page.nextCursor === null) return;
    setState({ ...state, loadingMore: true });
    try {
      const next = await searchTrips({
        ...paramsFor(from, to, date, mode, sort),
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
  }, [state, paramsFor, from, to, date, mode, sort]);

  const hasFrom = from.trim().length > 0;
  const hasTo = to.trim().length > 0;
  // Barre récap (miroir web, MobileSearchExperience mode « summary ») : les
  // libellés Départ/Destination servent de placeholders dans la route.
  const summaryRoute = `${from.trim() || t('form.fromLabel')} → ${to.trim() || t('form.toLabel')}`;
  const summaryDate =
    date !== null ? formatLongDate(date.toISOString(), locale) : t('form.datePlaceholder');
  // Titre dynamique de la page de résultats (miroir de SearchResultsView).
  const dynamicTitle =
    hasFrom && hasTo
      ? t('title.fromTo', { from: from.trim(), to: to.trim() })
      : hasFrom
        ? t('title.fromOnly', { from: from.trim() })
        : hasTo
          ? t('title.toOnly', { to: to.trim() })
          : date !== null
            ? t('title.dateOnly', { date: formatLongDate(date.toISOString(), locale) })
            : t('title.noFilter');
  const modeCounts = facets?.modeCount ?? { all: 0, plane: 0, train: 0, car: 0 };

  // La barre du haut : pilule récap + bouton Filtres, ou le formulaire
  // déplié — partagée entre le flux normal et l'en-tête collant du mode liste.
  const searchBar = formCollapsed ? (
    <View style={styles.summaryRow}>
      {/* La pilule rouvre le formulaire ; le bouton ouvre les filtres.
          Les styles vivent SUR les Pressable (pas de ThemedView flex
          dans un parent à hauteur auto : Yoga rendait la pilule vide). */}
      <Pressable
        onPress={() => setFormCollapsed(false)}
        style={({ pressed }) => [
          styles.summary,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <View style={styles.summaryTexts}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {summaryRoute}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {summaryDate}
          </ThemedText>
        </View>
      </Pressable>
      <Pressable
        onPress={() => setFiltersOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('filters.title')}
        style={({ pressed }) => [
          styles.filtersButton,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="options-outline" size={18} color={theme.text} />
        <ThemedText type="smallBold">{t('filters.title')}</ThemedText>
      </Pressable>
    </View>
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
  );

  // Pastilles transport : collées sous la barre récap en mode résultats —
  // elles restent le chemin de sortie d'un filtre à zéro résultat.
  const transportTabs = state.kind !== 'results' ? null : (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabsScroll}
      contentContainerStyle={styles.tabs}>
      {TRANSPORT_TABS.map((tab) => {
        const active = mode === tab.key;
        const activeText = dark ? '#FFB84D' : theme.text;
        return (
          <Pressable
            key={tab.key}
            onPress={() => pickMode(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.tab,
              active
                ? {
                    backgroundColor: dark ? 'rgba(255,153,0,0.15)' : '#FFF6E8',
                    borderColor: 'rgba(255,153,0,0.5)',
                  }
                : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
            ]}>
            {tab.icon !== null && (
              <Ionicons
                name={tab.icon}
                size={13}
                color={active ? activeText : theme.textSecondary}
              />
            )}
            <ThemedText
              type="smallBold"
              style={{ color: active ? activeText : theme.textSecondary }}>
              {t(`tabs.${tab.key}`)}
            </ThemedText>
            <View
              style={[
                styles.tabCount,
                { backgroundColor: active ? 'rgba(255,153,0,0.2)' : theme.backgroundSelected },
              ]}>
              <ThemedText
                style={[
                  styles.tabCountText,
                  { color: active ? (dark ? '#FFB84D' : '#B45309') : theme.textSecondary },
                ]}>
                {modeCounts[tab.key]}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // Titre + sous-titre : eux DÉFILENT avec la liste (seuls la barre récap et
  // les pastilles collent) — réf. capture 17h08 pour les textes.
  const resultsTitle = (
    <View style={styles.resultsHeader}>
      <ThemedText type="subtitle">{dynamicTitle}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('subtitleHint')}
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {state.kind === 'results' && state.page.trips.length > 0 ? (
          <>
            {/* La cible du flou Android : tout ce qui passe sous l'en-tête.
                Sur iOS c'est un simple View, le flou est natif. */}
            <BlurTargetView ref={blurTargetRef} style={styles.listArea}>
              <FlatList<TripSearchResult>
                data={state.page.trips}
                keyExtractor={(trip) => trip.id}
                renderItem={({ item }) => <TripResultCard trip={item} />}
                ListHeaderComponent={
                  <View>
                    {resultsTitle}
                    <ThemedText type="small" themeColor="textSecondary" style={styles.count}>
                      {t('results', { count: state.page.totalCount })}
                    </ThemedText>
                  </View>
                }
                ListFooterComponent={
                  state.loadingMore ? (
                    <ActivityIndicator color={Brand.mango} style={styles.spinner} />
                  ) : null
                }
                onEndReached={loadMore}
                onEndReachedThreshold={0.4}
                contentContainerStyle={[styles.list, { paddingTop: headerHeight }]}
                scrollIndicatorInsets={{ top: Math.max(0, headerHeight - insets.top) }}
                keyboardShouldPersistTaps="handled"
              />
            </BlurTargetView>
            {/* L'en-tête collant : barre récap (ou formulaire rouvert) +
                pastilles sur fond flouté, encoche comprise. Sa hauteur mesurée
                dégage le haut de la liste (une frame de latence, invisible). */}
            <View
              style={styles.stickyHeader}
              onLayout={(event) => setHeaderHeight(Math.round(event.nativeEvent.layout.height))}>
              <BlurView
                style={StyleSheet.absoluteFill}
                tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
                intensity={90}
                blurMethod="dimezisBlurViewSdk31Plus"
                blurTarget={blurTargetRef}
              />
              <View style={[styles.stickyContent, { paddingTop: insets.top }]}>
                {searchBar}
                {transportTabs}
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.flowArea, { paddingTop: insets.top }]}>
            {searchBar}
            {transportTabs}

            {state.kind === 'idle' && (
              <View style={styles.idle}>
                <ThemedText themeColor="textSecondary" style={styles.centered}>
                  {t('prompt')}
                </ThemedText>
                {corridors !== null && (
                  <View style={styles.corridors}>
                    <ThemedText
                      type="small"
                      themeColor="textSecondary"
                      style={styles.corridorsLabel}>
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

            {state.kind === 'loading' && (
              <ActivityIndicator color={Brand.mango} style={styles.spinner} />
            )}

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
              <View>
                {resultsTitle}
                <View style={styles.stateBlock}>
                  <ThemedText type="smallBold" style={styles.centered}>
                    {t('empty.title')}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.centered}>
                    {t('empty.body')}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
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

        {/* Feuille « Filtres » : le tri serveur pour l'instant — les familles,
            le poids et les horaires suivront avec le formulaire de filtres. */}
        <Modal
          visible={filtersOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setFiltersOpen(false)}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setFiltersOpen(false)}
            accessibilityRole="button"
          />
          <ThemedView style={styles.sheet}>
            <View style={[styles.sheetHandle, { backgroundColor: theme.backgroundSelected }]} />
            <ThemedText type="smallBold" style={styles.sheetTitle}>
              {t('filters.title')}
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sheetSection}>
              {t('filters.sortBy')}
            </ThemedText>
            {SORT_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => pickSort(option)}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === option }}
                style={({ pressed }) => [styles.sortRow, pressed && styles.pressed]}>
                <ThemedText>{t(`filters.${option}`)}</ThemedText>
                {sort === option && <Ionicons name="checkmark" size={18} color={Brand.mango} />}
              </Pressable>
            ))}
          </ThemedView>
        </Modal>
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
  // Le flux « sans liste » (repos, chargement, panne, zéro trajet) : le haut
  // sûr y est un padding manuel — le SafeAreaView ne porte plus l'encoche,
  // pour que la liste du mode résultats puisse passer dessous.
  flowArea: {
    flex: 1,
  },
  listArea: {
    flex: 1,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  stickyContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
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
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
  },
  summary: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  summaryTexts: {
    flex: 1,
    gap: 1,
  },
  filtersButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
  },
  resultsHeader: {
    gap: Spacing.one,
    paddingBottom: Spacing.two,
  },
  tabsScroll: {
    marginTop: Spacing.two,
    marginHorizontal: -Spacing.four,
  },
  tabs: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.one,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabCount: {
    minWidth: 20,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabCountText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  sheetTitle: {
    textAlign: 'center',
    fontSize: 15,
    marginBottom: Spacing.three,
  },
  sheetSection: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.one,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
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
    // La barre d'onglets FLOTTE sur le contenu : sans cette marge, la
    // dernière carte meurt dessous (capture du 28/09 au soir). Le haut est
    // dégagé dynamiquement par la hauteur mesurée de l'en-tête collant.
    paddingBottom: BottomTabInset + Spacing.six,
  },
});

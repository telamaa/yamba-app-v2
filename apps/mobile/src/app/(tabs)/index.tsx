/**
 * (tabs)/index.tsx — Rechercher, l'onglet d'ATTERRISSAGE (lot recherche-first).
 * =============================================================================
 * L'app est recherche-first (la référence l'a validé dix ans) : l'onglet
 * Accueil a disparu, la croix de l'écran de bienvenue et la connexion
 * atterrissent ICI. L'écran n'ÉDITE plus la recherche lui-même : il porte
 * la pilule récap (route · date) et les résultats ; tout l'ajustement vit
 * dans l'éditeur `/search/*` — la feuille « Modifier la recherche », puis
 * une page pleine par champ (réf. captures 13/10 21h22-21h23). Il reste
 * seul maître de l'appel serveur : la feuille lève un signal
 * (`requestSearch()`), l'écran lance la recherche avec ses pastilles, son
 * tri et sa pagination. En mode résultats, la pilule et les
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
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ProfileAvatarButton } from '@/components/profile-avatar-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripResultCard } from '@/components/trip-result-card';
import { BottomTabInset, Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { dateBounds, summaryLabel, type SearchDate } from '@/lib/search-date';
import { cityLabel } from '@/lib/trip-format';
import { getSearchDraft, setSearchDraft, subscribeSearchDraft } from '@/lib/search-draft';
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
type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string; correlationId: string | null }
  | {
      kind: 'results';
      page: SearchPage;
      loadingMore: boolean;
      /** Une pastille ou un tri qu'on rejoue : la liste RESTE montée et
       *  se fond, au lieu de démonter l'écran pour un spinner nu. */
      refreshing: boolean;
    };

/** Les quatre pastilles transport, dans l'ordre du web (TransportModeTabs). */
// Les pastilles ne portent plus d'icône de transport : le MOT la dit déjà
// (« Avion », « Train », « Voiture »), et l'icône coûtait ~19 pt par pastille.
// C'est ce qui faisait déborder la rangée et COUPER un mot au ras du bouton
// « Filtres » (capture du 16/10 23h51 : « Tr »). Les icônes restent sur la
// carte de résultat et la fiche, où elles ne sont pas redondantes.
const TRANSPORT_TABS: SearchTransportFilter[] = ['all', 'plane', 'train', 'car'];

const SORT_OPTIONS: SearchSort[] = ['earliest', 'lowestPrice', 'bestRated'];

export default function SearchScreen() {
  const t = useTranslations('search');
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const locale = useLocale() as SupportedLocale;
  // Départ, destination et date se choisissent dans des PAGES poussées
  // (`/search/city`, `/search/date`) : une page ne retourne pas de valeur,
  // elle écrit dans le brouillon partagé et cet écran s'y abonne.
  const draft = useSyncExternalStore(subscribeSearchDraft, getSearchDraft, getSearchDraft);
  const { from, to, date } = draft;
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
      nextDate: SearchDate | null,
      nextMode: SearchTransportFilter,
      nextSort: SearchSort
    ): SearchParams => ({
      from: nextFrom.trim() || undefined,
      to: nextTo.trim() || undefined,
      ...(nextDate !== null ? dateBounds(nextDate) : {}),
      mode: nextMode,
      sort: nextSort,
      limit: PAGE_SIZE,
    }),
    []
  );

  // ── Le filtrage ne doit pas se SENTIR ──────────────────────────────
  // Trois gestes, tous en `useNativeDriver` (le moteur déjà éprouvé ici,
  // cf. les points pulsés A209) : la liste se fond au lieu de disparaître,
  // une barre balaie sous les pastilles pour dire « ça travaille », et la
  // liste remonte en haut PENDANT qu'elle est estompée — donc sans saut
  // visible. Reanimated est installé mais jamais importé dans l'app : on
  // n'inaugure pas un moteur non éprouvé pour un fondu.
  const listRef = useRef<FlatList<TripSearchResult>>(null);
  const pendingScrollTop = useRef(false);
  const listOpacity = useRef(new Animated.Value(1)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const sweepWidth = useMemo(() => Dimensions.get('window').width, []);
  const refreshing = state.kind === 'results' && state.refreshing;

  useEffect(() => {
    Animated.timing(listOpacity, {
      toValue: refreshing ? 0.32 : 1,
      // Sortie franche, retour plus doux : l'arrivée des résultats se
      // remarque, leur départ non.
      duration: refreshing ? 120 : 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [refreshing, listOpacity]);

  useEffect(() => {
    if (!refreshing) return;
    sweep.setValue(0);
    const loop = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: 850,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [refreshing, sweep]);

  // Nouveaux résultats après un re-filtrage : on remonte en haut tant que la
  // liste est estompée — le saut est invisible.
  useEffect(() => {
    if (state.kind !== 'results' || state.refreshing || !pendingScrollTop.current) return;
    pendingScrollTop.current = false;
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [state]);

  const runSearchWith = useCallback(
    async (params: SearchParams, refreshFacets: boolean, keepResults = false) => {
      // Changer de pastille n'est pas une nouvelle recherche : la liste reste
      // à l'écran et se fond pendant l'aller-retour. Repasser par `loading`
      // démontait l'en-tête collant ET la liste — le clignotement du 11/10.
      if (keepResults) {
        setState((prev) =>
          prev.kind === 'results' ? { ...prev, refreshing: true } : { kind: 'loading' }
        );
        pendingScrollTop.current = true;
      } else {
        setState({ kind: 'loading' });
      }
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
        setState({ kind: 'results', page, loadingMore: false, refreshing: false });
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

  // « Rechercher » dans la feuille : elle ne connaît pas cet écran, elle
  // incrémente un compteur dans le brouillon. On sert chaque valeur UNE fois
  // — la référence évite de redéclencher la recherche à chaque rendu de la
  // fonction `runSearch` (dont l'identité change à chaque frappe du draft).
  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;
  const servedNonce = useRef(draft.submitNonce);
  useEffect(() => {
    if (draft.submitNonce === servedNonce.current) return;
    servedNonce.current = draft.submitNonce;
    void runSearchRef.current();
  }, [draft.submitNonce]);

  // Une pastille = la MÊME recherche, filtrée par transport côté serveur.
  const pickMode = useCallback(
    (next: SearchTransportFilter) => {
      if (next === mode) return;
      setMode(next);
      void runSearchWith(paramsFor(from, to, date, next, sort), false, true);
    },
    [mode, runSearchWith, paramsFor, from, to, date, sort]
  );

  const pickSort = useCallback(
    (next: SearchSort) => {
      setFiltersOpen(false);
      if (next === sort) return;
      setSort(next);
      void runSearchWith(paramsFor(from, to, date, mode, next), false, true);
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
      setSearchDraft({ from: corridor.fromCity, to: corridor.toCity, date: null });
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
        refreshing: false,
      });
    } catch {
      // La page suivante a échoué : on garde ce qu'on a, le scroll retentera.
      setState({ ...state, loadingMore: false });
    }
  }, [state, paramsFor, from, to, date, mode, sort]);

  const hasFrom = from.trim().length > 0;
  const hasTo = to.trim().length > 0;
  // Barre récap : elle décrit un ÉTAT, jamais des libellés de champ. La
  // version précédente empruntait « Départ → Destination » au formulaire —
  // en gras, ça se lisait comme une route CHOISIE, et « Choisis une date »
  // donnait un ORDRE dans un résumé. La recherche large se NOMME, comme
  // A209/A210 l'ont gravé : « Partout · Toutes les dates ».
  // Ville SEULE dans le résumé : l'autocomplétion enregistre « Paris,
  // France » (ce que le serveur attend), illisible dans une pilule.
  const anywhere = t('recap.anywhere');
  const summaryRoute =
    hasFrom || hasTo
      ? `${hasFrom ? cityLabel(from) : anywhere} → ${hasTo ? cityLabel(to) : anywhere}`
      : anywhere;
  // « Cette semaine » plutôt que « 13 – 19 octobre » : un raccourci se nomme
  // par l'intention choisie, pas par ses bornes.
  const summaryDate = summaryLabel(date, locale, {
    any: t('recap.anyDate'),
    flex: {
      thisWeek: t('date.thisWeek'),
      thisMonth: t('date.thisMonth'),
      next3Months: t('date.next3Months'),
    },
  });
  // Titre de la page de résultats : il NOMME la recherche, ou il n'existe
  // pas. Le titre générique (« Tous les trajets disponibles ») a été purgé
  // le 16/10 — la pastille « Tout » et la pilule « Partout » le disaient
  // déjà, et il coûtait une ligne de 24 pt à chaque recherche large.
  const dynamicTitle =
    hasFrom && hasTo
      ? t('title.fromTo', { from: cityLabel(from), to: cityLabel(to) })
      : hasFrom
        ? t('title.fromOnly', { from: cityLabel(from) })
        : hasTo
          ? t('title.toOnly', { to: cityLabel(to) })
          : date !== null
            ? t('title.dateOnly', { date: summaryDate })
            : null;
  const modeCounts = facets?.modeCount ?? { all: 0, plane: 0, train: 0, car: 0 };
  // Le bouton « Filtres » n'a plus de mot pour s'expliquer : il doit donc
  // DIRE quand un filtre est posé — sinon un tri actif devient invisible.
  const filtersActive = sort !== 'earliest';

  // La barre du haut : la pilule récap (elle OUVRE l'éditeur) et la pastille
  // de profil — partagée entre le flux normal et l'en-tête collant du mode
  // liste. L'écran ne contient plus de formulaire : éditer, c'est ouvrir
  // `/search/edit` (réf. capture 13/10 21h22).
  const searchBar = (
    <View style={styles.summaryRow}>
      {/* Les styles vivent SUR le Pressable (pas de ThemedView flex dans un
          parent à hauteur auto : Yoga rendait la pilule vide). */}
      <Pressable
        onPress={() => router.push('/search/edit')}
        accessibilityRole="button"
        accessibilityLabel={t('edit.title')}
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
      <ProfileAvatarButton />
    </View>
  );

  // Pastilles transport : collées sous la barre récap, DANS l'en-tête collant
  // et nulle part ailleurs — elles restent le chemin de sortie d'un filtre à
  // zéro résultat. Le mode résultats est le seul à les monter (l'en-tête
  // collant n'existe que là), d'où l'absence de garde sur `state.kind`.
  const transportTabs = (
    <View style={styles.tabsRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}>
      {TRANSPORT_TABS.map((key) => {
        const active = mode === key;
        const activeText = dark ? '#FFB84D' : theme.text;
        const count = modeCounts[key];
        return (
          <Pressable
            key={key}
            onPress={() => pickMode(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.tab,
              pressed && styles.pressed,
              // Un mode SANS trajet reste tapable (c'est le chemin de sortie
              // d'un filtre à zéro) mais s'efface : il ne doit pas avoir le
              // même poids qu'un mode qui a de l'offre.
              count === 0 && !active && styles.tabEmpty,
              active
                ? {
                    backgroundColor: dark ? 'rgba(255,153,0,0.15)' : '#FFF6E8',
                    borderColor: 'rgba(255,153,0,0.5)',
                  }
                : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
            ]}>
            <ThemedText
              type="smallBold"
              style={{ color: active ? activeText : theme.textSecondary }}>
              {t(`tabs.${key}`)}
            </ThemedText>
            {/* Le compte en TEXTE, plus en pastille dans la pastille : même
                information, ~16 pt de moins par pastille. */}
            <ThemedText
              style={[
                styles.tabCount,
                { color: active ? (dark ? '#FFB84D' : '#B45309') : theme.textSecondary },
              ]}>
              {count}
            </ThemedText>
          </Pressable>
        );
      })}
      </ScrollView>
      {/* « Filtres » vit avec les filtres, épinglé HORS du défilement — et
          réduit à son ICÔNE : le mot coûtait ~50 pt sur une rangée qui
          débordait déjà. Le point mangue dit qu'un filtre est posé, ce que
          le mot ne disait pas davantage. */}
      <View style={[styles.filtersDivider, { backgroundColor: theme.backgroundSelected }]} />
      <Pressable
        onPress={() => setFiltersOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={filtersActive ? t('filters.active') : t('filters.title')}
        style={({ pressed }) => [
          styles.filtersButton,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="options-outline" size={18} color={theme.text} />
        {filtersActive && <View style={[styles.filtersDot, { borderColor: theme.backgroundElement }]} />}
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        {state.kind === 'results' ? (
          <>
            {/* La cible du flou Android : tout ce qui passe sous l'en-tête.
                Sur iOS c'est un simple View, le flou est natif. */}
            <BlurTargetView ref={blurTargetRef} style={styles.listArea}>
              <Animated.View style={[styles.listArea, { opacity: listOpacity }]}>
              <FlatList<TripSearchResult>
                ref={listRef}
                data={state.page.trips}
                keyExtractor={(trip) => trip.id}
                renderItem={({ item }) => <TripResultCard trip={item} />}
                // Le titre et le compte DÉFILENT avec la liste (seuls la
                // barre récap et les pastilles collent). Deux coupes du
                // 16/10, ~60 pt récupérés en haut d'un écran de 844 :
                // le sous-titre « Affinez avec un départ… » (il expliquait
                // UNE fois et coûtait deux lignes à CHAQUE recherche — et
                // c'était le seul vouvoiement de l'app), et le titre
                // générique, que la pastille « Tout » et la pilule
                // « Partout » disaient déjà. Un titre qui NOMME la
                // recherche reste : lui porte une information.
                ListHeaderComponent={
                  state.page.trips.length > 0 ? (
                    <View style={styles.resultsHeader}>
                      {dynamicTitle !== null && (
                        <ThemedText type="subtitle">{dynamicTitle}</ThemedText>
                      )}
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('results', { count: state.page.totalCount })}
                      </ThemedText>
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.empty}>
                    <View
                      style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
                      <Ionicons name="search-outline" size={26} color={theme.textSecondary} />
                    </View>
                    <ThemedText type="smallBold" style={styles.centered}>
                      {t('empty.title')}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.centered}>
                      {t('empty.body')}
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
                contentContainerStyle={[
                  styles.list,
                  { paddingTop: headerHeight },
                  // Centrer l'état vide sur la zone RÉELLEMENT visible : sans
                  // cela, le padding de l'en-tête collant décale le bloc vers
                  // le bas et il n'est plus au milieu de l'écran.
                  state.page.trips.length === 0 && { paddingBottom: headerHeight },
                ]}
                scrollIndicatorInsets={{ top: Math.max(0, headerHeight - insets.top) }}
                keyboardShouldPersistTaps="handled"
              />
              </Animated.View>
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
                {/* 2 px qui balaient : l'app DIT qu'elle travaille sans rien
                    masquer. Invisible (hauteur réservée) au repos. */}
                <View style={styles.sweepTrack}>
                  {refreshing && (
                    <Animated.View
                      style={[
                        styles.sweepBar,
                        {
                          width: sweepWidth * 0.34,
                          transform: [
                            {
                              translateX: sweep.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-sweepWidth * 0.34, sweepWidth],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  )}
                </View>
              </View>
            </View>
          </>
        ) : (
          <View style={[styles.flowArea, { paddingTop: insets.top }]}>
            {searchBar}

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
          </View>
        )}

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
  summaryRow: {
    flexDirection: 'row',
    // 'center' et non 'stretch' : la pastille Profil a une hauteur FIXE,
    // en 'stretch' elle se collait en haut de la rangée (décalée de ~13 px
    // sur la capture du 11/10 22h19). `summary` garde son minHeight.
    alignItems: 'center',
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
  // Même gabarit que `tab` — hauteur, rayon, espacement : il vit dans la
  // rangée des pastilles, il en parle la langue. Il faisait 52 px de haut
  // et un rayon de 22 contre ~34 px et 999 pour les pastilles : deux
  // langages visuels dans une même rangée (capture du 11/10 22h19).
  filtersButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Le carré de 36 est 3 pt plus haut qu'une pastille : la marge basse
    // passe de 4 à 2 pour que la rangée garde exactement sa hauteur.
    marginBottom: Spacing.half,
  },
  // Le point qui remplace le mot : un filtre posé doit se voir sans être lu.
  filtersDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: Brand.mango,
  },
  resultsHeader: {
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  tabsScroll: {
    flexGrow: 1,
    flexShrink: 1,
    // Débord à GAUCHE seulement : les pastilles touchent le bord de l'écran
    // quand on défile, mais la zone s'ARRÊTE avant « Filtres ». Le débord à
    // droite les faisait glisser SOUS le bouton (« Train » coupé, capture
    // du 11/10 22h19).
    marginLeft: -Spacing.four,
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    paddingBottom: Spacing.one,
  },
  // Le séparateur qui dit « ce qui suit n'est pas une pastille » (motif
  // Airbnb : catégories qui défilent, bouton Filtres épinglé derrière un
  // trait).
  filtersDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: Spacing.one,
    marginBottom: Spacing.two,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tabEmpty: {
    opacity: 0.5,
  },
  tabCount: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 700,
    fontVariant: ['tabular-nums'],
  },
  sweepTrack: {
    height: 2,
    overflow: 'hidden',
    marginHorizontal: -Spacing.four,
  },
  sweepBar: {
    height: 2,
    borderRadius: 1,
    backgroundColor: Brand.mango,
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
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  spinner: {
    paddingTop: Spacing.four,
  },
  list: {
    gap: Spacing.two,
    // Occupe la fenêtre même vide : c'est ce qui permet à l'état vide de se
    // centrer au lieu de se tasser sous l'en-tête.
    flexGrow: 1,
    // La barre d'onglets FLOTTE sur le contenu : sans cette marge, la
    // dernière carte meurt dessous (capture du 28/09 au soir). Le haut est
    // dégagé dynamiquement par la hauteur mesurée de l'en-tête collant.
    paddingBottom: BottomTabInset + Spacing.six,
  },
});

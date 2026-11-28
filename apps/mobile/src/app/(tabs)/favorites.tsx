/**
 * favorites.tsx — l'onglet « Favoris » (A210).
 * ============================================
 * Il regroupe les TROIS objets de la même famille — ce que j'ai mis de côté,
 * ce que j'attends, qui je suis — là où le cœur des cartes de résultat ne
 * menait nulle part (l'impasse consignée en A205).
 *
 *   • Trajets   → `GET /trips/favorites`  (D46) — MÊME DTO que la recherche,
 *                 donc la carte de résultat est réutilisée TELLE QUELLE.
 *   • Souhaits  → `GET /saved-routes`     — les alertes de route.
 *   • Voyageurs → `GET /me/following`     — les abonnements.
 *
 * AUCUN endpoint mobile (A204/A205) : les trois existaient déjà en production.
 *
 * Un favori SURVIT à la fin du trajet (D46) : les passés ne sont jamais
 * supprimés, ils sont REPLIÉS sous les actifs — la demande utilisateur
 * (« les annonces encore en ligne ») est servie sans contredire la décision.
 *
 * Derrière la porte d'identité (A58/A63) : l'onglet reste VISIBLE et montre
 * la porte, jamais un onglet caché.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { IdentityGate } from '@/components/identity-gate';
import { EtatVide } from '@/components/etat-vide';
import { HeaderActions } from '@/components/header-actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripResultCard } from '@/components/trip-result-card';
import { Brand, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTabBarHideOnScroll } from '@/lib/tab-bar-visibility';
import { ApiError } from '@/lib/api/client';
import {
  deleteSavedRoute,
  listFavoriteTrips,
  listMyFollowing,
  listSavedRoutes,
  setSavedRouteEmail,
  type FollowedCarrier,
  type SavedRoute,
} from '@/lib/api/favorite.api';
import type { TripSearchResult } from '@/lib/api/search.api';
import { formatLongDate, getInitials } from '@/lib/trip-format';
import { formatRating, intlTagFor } from '@/lib/number-format';

const SEGMENTS = ['trips', 'wishes', 'carriers'] as const;
type Segment = (typeof SEGMENTS)[number];

type Data = {
  trips: TripSearchResult[];
  wishes: SavedRoute[];
  carriers: FollowedCarrier[];
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string; correlationId: string | null }
  | { kind: 'loaded'; data: Data };

export default function FavoritesScreen() {
  return (
    <IdentityGate destination="favorites">
      <FavoritesContent />
    </IdentityGate>
  );
}

function FavoritesContent() {
  const t = useTranslations('favorites');
  const [segment, setSegment] = useState<Segment>('trips');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  // D88 — le défilement escamote la barre d'onglets (worklet, fil d'interface).
  const onScroll = useTabBarHideOnScroll();

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      // Les trois segments en PARALLÈLE : l'onglet s'ouvre en un seul
      // aller-retour perçu, et basculer de segment n'attend rien.
      const [favorites, wishes, carriers] = await Promise.all([
        listFavoriteTrips(),
        listSavedRoutes(),
        listMyFollowing(),
      ]);
      setState({
        kind: 'loaded',
        data: { trips: favorites.trips, wishes, carriers },
      });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof ApiError ? err.message : t('error.body'),
        correlationId: err instanceof ApiError ? err.correlationId : null,
      });
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.titleRow}>
          {/* `title` et non `subtitle` : le même cran que la porte
              d'identité, pour que le nom de la page ne saute pas d'une taille
              à l'autre au moment où la session s'ouvre. */}
          <ThemedText type="title" style={styles.title}>
            {t('title')}
          </ThemedText>
          <HeaderActions />
        </View>

        <SegmentedControl current={segment} onSelectAction={setSegment} />

        {state.kind === 'loading' && <ActivityIndicator color={Brand.mango} style={styles.spinner} />}

        {state.kind === 'error' && (
          <View style={styles.stateBlock}>
            <ThemedText style={styles.centered}>{state.message}</ThemedText>
            {state.correlationId !== null && (
              <ThemedText type="code" themeColor="textSecondary" style={styles.centered}>
                {state.correlationId}
              </ThemedText>
            )}
            <Pressable onPress={load}>
              <ThemedText type="linkPrimary">{t('error.retry')}</ThemedText>
            </Pressable>
          </View>
        )}

        {/* `Reanimated.ScrollView` et non `ScrollView` : seul un conteneur
            animé sait appeler le worklet de défilement. */}
        {state.kind === 'loaded' && (
          <Reanimated.ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}>
            {segment === 'trips' && <TripsSegment trips={state.data.trips} />}
            {segment === 'wishes' && <WishesSegment wishes={state.data.wishes} onChangedAction={load} />}
            {segment === 'carriers' && <CarriersSegment carriers={state.data.carriers} />}
          </Reanimated.ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

/* ── Le sélecteur de segment ─────────────────────────────────────────────── */

function SegmentedControl({
  current,
  onSelectAction,
}: {
  current: Segment;
  onSelectAction: (segment: Segment) => void;
}) {
  const t = useTranslations('favorites');
  const theme = useTheme();

  return (
    <View style={[styles.segments, { backgroundColor: theme.backgroundElement }]}>
      {SEGMENTS.map((key) => {
        const active = key === current;
        return (
          <Pressable
            key={key}
            onPress={() => onSelectAction(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[
              styles.segment,
              active && { backgroundColor: theme.background },
            ]}>
            <ThemedText
              type="smallBold"
              themeColor={active ? 'text' : 'textSecondary'}>
              {t(`segments.${key}`)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Segment « Trajets » ─────────────────────────────────────────────────── */

function TripsSegment({ trips }: { trips: TripSearchResult[] }) {
  const t = useTranslations('favorites');
  const [showPast, setShowPast] = useState(false);

  // D46 : un favori survit à la fin du trajet. On montre les ENCORE EN LIGNE,
  // et les passés restent accessibles d'un toucher — jamais supprimés.
  const now = Date.now();
  const isPast = (trip: TripSearchResult) =>
    typeof trip.departureAt === 'string' && new Date(trip.departureAt).getTime() <= now;
  const active = trips.filter((trip) => !isPast(trip));
  const past = trips.filter(isPast);

  if (trips.length === 0) {
    return <EtatVide icon="heart-outline" titre={t('trips.emptyTitle')} corps={t('trips.emptyBody')} />;
  }

  return (
    <View style={styles.list}>
      {active.map((trip) => (
        <TripResultCard key={trip.id} trip={trip} />
      ))}

      {past.length > 0 && (
        <>
          <Pressable
            onPress={() => setShowPast((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPast }}
            style={styles.pastToggle}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('past', { count: past.length })}
            </ThemedText>
            <Ionicons name={showPast ? 'chevron-up' : 'chevron-down'} size={14} color="#94A3B8" />
          </Pressable>
          {showPast && past.map((trip) => <TripResultCard key={trip.id} trip={trip} />)}
        </>
      )}
    </View>
  );
}

/* ── Segment « Souhaits » ────────────────────────────────────────────────── */

function WishesSegment({
  wishes,
  onChangedAction,
}: {
  wishes: SavedRoute[];
  onChangedAction: () => void;
}) {
  const t = useTranslations('favorites');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  /** L'alerte dont la suppression attend une confirmation. */
  const [aSupprimer, setASupprimer] = useState<string | null>(null);
  const [geste, setGeste] = useState(false);

  const basculerEmail = useCallback(
    async (alerte: SavedRoute) => {
      if (geste) return;
      setGeste(true);
      try {
        await setSavedRouteEmail(alerte.id, !alerte.emailEnabled);
        onChangedAction();
      } finally {
        setGeste(false);
      }
    },
    [geste, onChangedAction]
  );

  const supprimer = useCallback(
    async (id: string) => {
      if (geste) return;
      setGeste(true);
      try {
        await deleteSavedRoute(id);
        setASupprimer(null);
        onChangedAction();
      } finally {
        setGeste(false);
      }
    },
    [geste, onChangedAction]
  );

  if (wishes.length === 0) {
    return (
      <EtatVide
        icon="notifications-outline"
        titre={t('wishes.emptyTitle')}
        corps={t('wishes.emptyBody')}
      />
    );
  }

  return (
    <View style={styles.list}>
      {wishes.map((wish) => (
        <ThemedView key={wish.id} type="backgroundElement" style={styles.card}>
          {/* D125 1D — la pastille « En pause » est partie : `isActive` est créé
              à `true`, filtré sur `true`, et écrit à `false` NULLE PART (ni
              route membre, ni cron, ni admin). Elle nommait un état que rien
              dans le produit ne peut produire — le défaut de D100. */}
          <ThemedText type="smallBold" style={styles.route}>
            {wish.originCity} <ThemedText style={styles.arrow}>→</ThemedText> {wish.destinationCity}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {wish.earliestDate
              ? formatLongDate(wish.earliestDate, locale)
              : t('wishes.anyDate')}
            {wish.includeNearby ? ` · ${t('wishes.nearby')}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('wishes.expires', { date: formatLongDate(wish.expiresAt, locale) })}
          </ThemedText>

          {/* D125 1C — les deux gestes que le serveur sait faire, et rien de
              plus : la bascule porte sur l'E-MAIL (le seul interrupteur que
              `PATCH /saved-routes/:id` accepte), et la suppression demande une
              confirmation — on ne détruit pas sur un effleurement. */}
          <View style={styles.wishActions}>
            <Pressable
              onPress={() => void basculerEmail(wish)}
              disabled={geste}
              accessibilityRole="switch"
              accessibilityState={{ checked: wish.emailEnabled, disabled: geste }}
              accessibilityLabel={t('wishes.emailToggle')}
              style={[styles.wishAction, { borderColor: theme.backgroundSelected }]}>
              <Ionicons
                name={wish.emailEnabled ? 'mail' : 'mail-outline'}
                size={15}
                color={wish.emailEnabled ? Brand.mango : theme.textSecondary}
              />
              <ThemedText type="small">
                {wish.emailEnabled ? t('wishes.emailOn') : t('wishes.emailOff')}
              </ThemedText>
            </Pressable>

            {aSupprimer === wish.id ? (
              <View style={styles.wishConfirm}>
                <Pressable
                  onPress={() => void supprimer(wish.id)}
                  disabled={geste}
                  accessibilityRole="button"
                  style={[styles.wishAction, { borderColor: Brand.mango }]}>
                  <ThemedText type="small">{t('wishes.deleteConfirm')}</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => setASupprimer(null)}
                  accessibilityRole="button"
                  style={[styles.wishAction, { borderColor: theme.backgroundSelected }]}>
                  <ThemedText type="small">{t('wishes.deleteCancel')}</ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setASupprimer(wish.id)}
                disabled={geste}
                accessibilityRole="button"
                accessibilityLabel={t('wishes.delete')}
                style={[styles.wishAction, { borderColor: theme.backgroundSelected }]}>
                <Ionicons name="trash-outline" size={15} color={theme.textSecondary} />
                <ThemedText type="small">{t('wishes.delete')}</ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>
      ))}
    </View>
  );
}

/* ── Segment « Voyageurs » ───────────────────────────────────────────────── */

function CarriersSegment({ carriers }: { carriers: FollowedCarrier[] }) {
  const t = useTranslations('favorites');
  const locale = useLocale();
  const theme = useTheme();

  if (carriers.length === 0) {
    return (
      <EtatVide
        icon="people-outline"
        titre={t('carriers.emptyTitle')}
        corps={t('carriers.emptyBody')}
      />
    );
  }

  return (
    <View style={styles.list}>
      {/* La fiche profil public n'existe pas encore dans l'app : la carte
          INFORME sans naviguer — on ne promet jamais une navigation absente
          (doctrine A205). Elle deviendra touchable avec son lot. */}
      {carriers.map(({ user, nextTrip }) => (
        <View key={user.id}>
          <ThemedView type="backgroundElement" style={[styles.card, styles.carrierCard]}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatar,
                  styles.avatarFallback,
                  { backgroundColor: theme.backgroundSelected },
                ]}>
                <ThemedText type="smallBold">
                  {getInitials(user.firstName, user.lastInitial)}
                </ThemedText>
              </View>
            )}
            <View style={styles.carrierIdentity}>
              <ThemedText type="smallBold">
                {user.firstName} {user.lastInitial ? `${user.lastInitial}.` : ''}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {user.carrierRatingCount > 0
                  ? `★ ${formatRating(user.carrierRatingAvg ?? 0, intlTagFor(locale))} · ${t('carriers.trips', { count: user.totalTripsPublished })}`
                  : t('carriers.newCarrier')}
              </ThemedText>
              <ThemedText type="small" themeColor={nextTrip ? 'tint' : 'textSecondary'}>
                {nextTrip
                  ? t('carriers.nextTrip', {
                      route: `${nextTrip.originCity} → ${nextTrip.destinationCity}`,
                    })
                  : t('carriers.noNextTrip')}
              </ThemedText>
            </View>
          </ThemedView>
        </View>
      ))}
    </View>
  );
}

/* ── L'état vide, commun aux trois segments ──────────────────────────────── */

const styles = StyleSheet.create({
  wishActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  wishConfirm: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  wishAction: {
    // 44 pt de haut : la cible tactile minimale de l'application.
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
  },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flexShrink: 1,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  segments: {
    flexDirection: 'row',
    borderRadius: 999,
    padding: 3,
    gap: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderRadius: 999,
  },
  scroll: {
    // La barre d'onglets FLOTTE sur le contenu (leçon du 28/09).
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.six,
    flexGrow: 1,
  },
  list: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  route: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  arrow: {
    color: Brand.mango,
  },
  carrierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  carrierIdentity: {
    flex: 1,
    gap: Spacing.half,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
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
});

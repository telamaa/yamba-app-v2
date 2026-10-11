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
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { IdentityGate } from '@/components/identity-gate';
import { ProfileAvatarButton } from '@/components/profile-avatar-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TripResultCard } from '@/components/trip-result-card';
import { Brand, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  listFavoriteTrips,
  listMyFollowing,
  listSavedRoutes,
  type FollowedCarrier,
  type SavedRoute,
} from '@/lib/api/favorite.api';
import type { TripSearchResult } from '@/lib/api/search.api';
import { formatLongDate, getInitials } from '@/lib/trip-format';

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
    <IdentityGate>
      <FavoritesContent />
    </IdentityGate>
  );
}

function FavoritesContent() {
  const t = useTranslations('favorites');
  const [segment, setSegment] = useState<Segment>('trips');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

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
          <ThemedText type="subtitle" style={styles.title}>
            {t('title')}
          </ThemedText>
          <ProfileAvatarButton />
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

        {state.kind === 'loaded' && (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}>
            {segment === 'trips' && <TripsSegment trips={state.data.trips} />}
            {segment === 'wishes' && <WishesSegment wishes={state.data.wishes} />}
            {segment === 'carriers' && <CarriersSegment carriers={state.data.carriers} />}
          </ScrollView>
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
    return <EmptyBlock icon="heart-outline" title={t('trips.emptyTitle')} body={t('trips.emptyBody')} />;
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

function WishesSegment({ wishes }: { wishes: SavedRoute[] }) {
  const t = useTranslations('favorites');
  const locale = useLocale() as SupportedLocale;

  if (wishes.length === 0) {
    return (
      <EmptyBlock
        icon="notifications-outline"
        title={t('wishes.emptyTitle')}
        body={t('wishes.emptyBody')}
      />
    );
  }

  return (
    <View style={styles.list}>
      {wishes.map((wish) => (
        <ThemedView key={wish.id} type="backgroundElement" style={styles.card}>
          <View style={styles.cardHead}>
            <ThemedText type="smallBold" style={styles.route}>
              {wish.originCity} <ThemedText style={styles.arrow}>→</ThemedText> {wish.destinationCity}
            </ThemedText>
            {!wish.isActive && (
              <ThemedText type="small" themeColor="textSecondary">
                {t('wishes.paused')}
              </ThemedText>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {wish.earliestDate
              ? formatLongDate(wish.earliestDate, locale)
              : t('wishes.anyDate')}
            {wish.includeNearby ? ` · ${t('wishes.nearby')}` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('wishes.expires', { date: formatLongDate(wish.expiresAt, locale) })}
          </ThemedText>
        </ThemedView>
      ))}
    </View>
  );
}

/* ── Segment « Voyageurs » ───────────────────────────────────────────────── */

function CarriersSegment({ carriers }: { carriers: FollowedCarrier[] }) {
  const t = useTranslations('favorites');
  const theme = useTheme();

  if (carriers.length === 0) {
    return (
      <EmptyBlock
        icon="people-outline"
        title={t('carriers.emptyTitle')}
        body={t('carriers.emptyBody')}
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
                  ? `★ ${(user.carrierRatingAvg ?? 0).toFixed(1)} · ${t('carriers.trips', { count: user.totalTripsPublished })}`
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

function EmptyBlock({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name={icon} size={26} color={theme.textSecondary} />
      </View>
      <ThemedText type="smallBold" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centered}>
        {body}
      </ThemedText>
    </View>
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

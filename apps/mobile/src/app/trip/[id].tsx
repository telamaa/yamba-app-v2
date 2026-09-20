/**
 * trip/[id].tsx — la fiche publique d'un trajet (lot page trajet D36).
 * ====================================================================
 * Poussée par-dessus les onglets depuis une carte de résultat. Publique,
 * comme la page web (`TripDetailView`) dont elle reprend les blocs :
 * itinéraire, offre €/kg avec les 8 familles (D14) OU catégories legacy,
 * lieux de remise/livraison, conditions, profil du Voyageur. Elle s'arrête
 * AVANT le wizard de réservation (lot suivant) : aucun bouton « Réserver »,
 * une ligne honnête renvoie vers le site. Le serveur décide de tout
 * (RG-MOB-1) : visibilité, comptage de la vue (A205), prix en cents.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { getPublicTrip, type PublicTrip, type TripLocationPoint } from '@/lib/api/trip.api';
import { estimateShipperTotalCents, MIN_PARCEL_PRICE_EUR, PRICING_EXAMPLE_PARAMS } from '@/lib/pricing-example';
import {
  formatLocalTime,
  formatLongDate,
  formatMemberSince,
  formatPrice,
  formatPriceShort,
  formatTripDuration,
  getInitials,
  isPopular,
} from '@/lib/trip-format';

/** Les 8 familles D14, dans l'ordre d'affichage du web (`OfferCard`). */
const FAMILY_KEYS = [
  'DOCUMENTS_PAPERS',
  'CLOTHES_TEXTILE',
  'FOOD_DRY_SEALED',
  'ELECTRONICS_DEVICES',
  'COSMETICS_CARE',
  'PARTS_TOOLS',
  'TOYS_CHILDCARE',
  'MISC_ACCESSORIES',
] as const;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string; correlationId: string | null }
  | { kind: 'loaded'; trip: PublicTrip };

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('tripDetail');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const trip = await getPublicTrip(String(id));
      setState({ kind: 'loaded', trip });
    } catch (err) {
      // 404 = introuvable OU plus visible (masqué, dépublié… indiscernables
      // à dessein, ANO-API-02) : même écran calme pour tous ces cas.
      if (err instanceof ApiError && err.status === 404) {
        setState({ kind: 'notFound' });
        return;
      }
      setState({
        kind: 'error',
        message: err instanceof ApiError ? err.message : t('error.network'),
        correlationId: err instanceof ApiError ? err.correlationId : null,
      });
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={Spacing.two}>
          <ThemedText type="linkPrimary">‹ {t('back')}</ThemedText>
        </Pressable>

        {state.kind === 'loading' && <ActivityIndicator color={Brand.mango} style={styles.spinner} />}

        {state.kind === 'notFound' && (
          <View style={styles.stateBlock}>
            <ThemedText type="smallBold" style={styles.centered}>
              {t('notFound.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {t('notFound.body')}
            </ThemedText>
          </View>
        )}

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

        {state.kind === 'loaded' && <TripDetailContent trip={state.trip} />}
      </SafeAreaView>
    </ThemedView>
  );
}

function TripDetailContent({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Header trip={trip} />
      <ItineraryCard trip={trip} />
      <OfferCard trip={trip} />
      <CategoriesCard trip={trip} />
      <LocationsCard trip={trip} />
      <ConditionsCard />
      <TripperCard trip={trip} />
      {trip.notes ? (
        <Card title={t('notes.title')}>
          <ThemedText type="small" themeColor="textSecondary">
            {trip.notes}
          </ThemedText>
        </Card>
      ) : null}
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {t('bookingSoon')}
      </ThemedText>
    </ScrollView>
  );
}

/* ── Blocs ───────────────────────────────────────────────────────────────── */

function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {title ? <ThemedText type="smallBold">{title}</ThemedText> : null}
      {children}
    </ThemedView>
  );
}

function Chip({ label, tone }: { label: string; tone: 'teal' | 'mango' | 'muted' | 'refused' }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.chip,
        tone === 'teal' && styles.chipTeal,
        tone === 'mango' && styles.chipMango,
        (tone === 'muted' || tone === 'refused') && { backgroundColor: theme.backgroundSelected },
      ]}>
      <ThemedText
        type="small"
        themeColor={tone === 'refused' ? 'textSecondary' : 'text'}
        style={tone === 'refused' ? styles.struck : undefined}>
        {label}
      </ThemedText>
    </View>
  );
}

function Header({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');

  return (
    <View style={styles.header}>
      <ThemedText type="subtitle" style={styles.route}>
        {trip.origin.city} → {trip.destination.city}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('trippedBy', {
          firstName: trip.tripper.firstName,
          lastInitial: trip.tripper.lastInitial,
        })}
      </ThemedText>
      {(typeof trip.viewsCount === 'number' && trip.viewsCount > 0) || trip.ticketVerified ? (
        <View style={styles.chips}>
          {typeof trip.viewsCount === 'number' && trip.viewsCount > 0 && (
            <Chip label={t('views', { count: trip.viewsCount })} tone="muted" />
          )}
          {isPopular(trip.viewsCount) && <Chip label={t('badges.popular')} tone="mango" />}
          {trip.ticketVerified && <Chip label={t('badges.verifiedTicket')} tone="teal" />}
        </View>
      ) : null}
    </View>
  );
}

function ItineraryCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;

  const departureTime = formatLocalTime(trip.dates.departureAt, trip.dates.departureTimeLocal);
  const arrivalTime = formatLocalTime(trip.dates.arrivalAt, trip.dates.arrivalTimeLocal);
  const duration = formatTripDuration(trip.dates);

  const transportLabel = trip.transportMode ? t(`transport.${trip.transportMode}`) : null;
  let variantLabel: string | null = null;
  let citiesLine: string | null = null;
  if (trip.transportMode === 'PLANE' && trip.flightType) {
    variantLabel = trip.flightType === 'DIRECT' ? t('transport.flightDirect') : t('transport.flightWithLayover');
    if (trip.flightLayoverCities.length > 0)
      citiesLine = t('itinerary.layovers', { cities: trip.flightLayoverCities.join(', ') });
  } else if (trip.transportMode === 'TRAIN' && trip.trainTripType) {
    variantLabel =
      trip.trainTripType === 'DIRECT'
        ? t('transport.trainDirect')
        : trip.trainTripType === 'WITH_CONNECTION'
          ? t('transport.trainWithConnection')
          : t('transport.trainWithIntermediateStops');
    if (trip.trainStopCities.length > 0)
      citiesLine = t('itinerary.stops', { cities: trip.trainStopCities.join(', ') });
  } else if (trip.transportMode === 'CAR' && trip.carTripFlexibility === 'DETOUR_BY_AGREEMENT') {
    variantLabel = t('transport.carDetour');
  }

  return (
    <Card title={t('itinerary.title')}>
      <ThemedText type="small">{formatLongDate(trip.dates.departureAt, locale)}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {departureTime}
        {arrivalTime ? ` – ${arrivalTime}` : ''}
        {duration ? ` · ${t('itinerary.duration', { duration })}` : ''}
      </ThemedText>
      {transportLabel && (
        <ThemedText type="small" themeColor="textSecondary">
          {transportLabel}
          {variantLabel ? ` · ${variantLabel}` : ''}
        </ThemedText>
      )}
      {citiesLine && (
        <ThemedText type="small" themeColor="textSecondary">
          {citiesLine}
        </ThemedText>
      )}
    </Card>
  );
}

function OfferCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;

  const perKgCents = trip.pricePerKgCents != null && trip.pricePerKgCents > 0 ? trip.pricePerKgCents : null;
  if (perKgCents === null) return null;

  const remaining = typeof trip.remainingKg === 'number' ? trip.remainingKg : null;
  const exampleKg = PRICING_EXAMPLE_PARAMS.exampleWeightKg;
  const example = estimateShipperTotalCents(perKgCents, exampleKg).totalCents;
  const conditions = new Map((trip.familyConditions ?? []).map((c) => [c.familyKey, c]));

  return (
    <Card title={t('offer.title', { firstName: trip.tripper.firstName })}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('offer.hint')}
      </ThemedText>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('offer.perKg')}
          </ThemedText>
          <ThemedText type="smallBold" style={styles.statValue}>
            {formatPrice(perKgCents, trip.currencyCode, locale)}/kg
          </ThemedText>
        </View>
        {remaining !== null && (
          <View style={styles.stat}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('offer.available')}
            </ThemedText>
            {/* `tint` = teal lisible dans les deux thèmes (le #0F766E pur est illisible en sombre). */}
            <ThemedText type="smallBold" themeColor="tint" style={styles.statValue}>
              {remaining} kg
            </ThemedText>
          </View>
        )}
      </View>

      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {t('offer.estimateLabel', { kg: exampleKg })}
        </ThemedText>
        <ThemedText type="smallBold">
          ≈ {formatPrice(example, trip.currencyCode, locale)}{' '}
          <ThemedText type="small" themeColor="textSecondary">
            {t('offer.allIn')}
          </ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('offer.finalAtBooking')} {t('offer.lightParcel', { min: MIN_PARCEL_PRICE_EUR })}
        </ThemedText>
      </View>

      <View>
        <ThemedText type="small" themeColor="textSecondary">
          {t('offer.families')}
        </ThemedText>
        <View style={styles.chips}>
          {FAMILY_KEYS.map((key) => {
            const c = conditions.get(key);
            const label = t(`offer.family.${key}`);
            if (c?.mode === 'REFUSE') return <Chip key={key} label={label} tone="refused" />;
            if (c?.mode === 'SURCHARGE')
              return (
                <Chip
                  key={key}
                  label={`${label} ${t('offer.surcharge', { pct: c.surchargePct ?? 0 })}`}
                  tone="mango"
                />
              );
            return <Chip key={key} label={`${label} ✓`} tone="teal" />;
          })}
        </View>
      </View>

      {trip.checkedBag23PriceCents || trip.cabinBag12PriceCents ? (
        <View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('offer.bags')}
          </ThemedText>
          {trip.checkedBag23PriceCents ? (
            <ThemedText type="small">
              {t('offer.checkedBag')} · {formatPriceShort(trip.checkedBag23PriceCents, trip.currencyCode, locale)}
            </ThemedText>
          ) : null}
          {trip.cabinBag12PriceCents ? (
            <ThemedText type="small">
              {t('offer.cabinBag')} · {formatPriceShort(trip.cabinBag12PriceCents, trip.currencyCode, locale)}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function CategoriesCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;

  // Le moteur PER_KG a sa propre carte : celle-ci est la fiche legacy.
  const perKg = trip.pricePerKgCents != null && trip.pricePerKgCents > 0;
  if (perKg || trip.categoryConditions.length === 0) return null;

  return (
    <Card title={t('categories.title', { firstName: trip.tripper.firstName })}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('categories.hint')}
      </ThemedText>
      {trip.categoryConditions.map((cond) => (
        <View key={cond.category} style={styles.row}>
          <ThemedText type="small" style={styles.rowLabel}>
            {t(`categories.label.${cond.category}`)}
          </ThemedText>
          <ThemedText type="smallBold">
            {formatPriceShort(cond.priceAmountCents, trip.currencyCode, locale)}
          </ThemedText>
        </View>
      ))}
    </Card>
  );
}

function LocationList({ title, points }: { title: string; points: TripLocationPoint[] }) {
  const t = useTranslations('tripDetail');
  if (points.length === 0) return null;
  return (
    <View style={styles.locationGroup}>
      <ThemedText type="small" themeColor="textSecondary">
        {title}
      </ThemedText>
      {points.map((point, index) => {
        const flexLabel =
          point.flexibility === 'RADIUS'
            ? point.radiusKm
              ? t('locations.flex.RADIUS', { km: point.radiusKm })
              : null
            : t(`locations.flex.${point.flexibility}`);
        return (
          <View key={`${point.kind}-${index}`}>
            <ThemedText type="small">
              {t(`locations.kind.${point.kind}`)}
              {flexLabel ? ` · ${flexLabel}` : ''}
            </ThemedText>
            {point.details ? (
              <ThemedText type="small" themeColor="textSecondary">
                {point.details}
              </ThemedText>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function LocationsCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  if (trip.pickupLocations.length === 0 && trip.deliveryLocations.length === 0) return null;
  return (
    <Card>
      <LocationList title={t('locations.pickupTitle')} points={trip.pickupLocations} />
      <LocationList title={t('locations.deliveryTitle')} points={trip.deliveryLocations} />
    </Card>
  );
}

function ConditionsCard() {
  const t = useTranslations('tripDetail');
  return (
    <Card title={t('conditions.title')}>
      <ThemedText type="small" themeColor="textSecondary">
        {t('conditions.cancellationTitle')}
      </ThemedText>
      <ThemedText type="small">• {t('conditions.cancellationFull')}</ThemedText>
      <ThemedText type="small">• {t('conditions.cancellationHalf')}</ThemedText>
      <ThemedText type="small">• {t('conditions.cancellationNone')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.conditionsSecondTitle}>
        {t('conditions.prohibitedTitle')}
      </ThemedText>
      <ThemedText type="small">{t('conditions.prohibitedDescription')}</ThemedText>
    </Card>
  );
}

function TripperCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const carrier = trip.tripper.carrier;
  // Pitfall 19/09 : le narrowing ne traverse pas une constante booléenne —
  // on capture la VALEUR (le carrier noté), pas le verdict.
  const ratedCarrier = carrier !== null && carrier.ratingsCount > 0 ? carrier : null;

  return (
    <Card title={t('tripper.title')}>
      <View style={styles.tripperRow}>
        {trip.tripper.avatarUrl ? (
          <Image source={{ uri: trip.tripper.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">
              {getInitials(trip.tripper.firstName, trip.tripper.lastInitial)}
            </ThemedText>
          </View>
        )}
        <View style={styles.tripperIdentity}>
          <ThemedText type="smallBold">
            {trip.tripper.firstName} {trip.tripper.lastInitial ? `${trip.tripper.lastInitial}.` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('tripper.memberSince', { date: formatMemberSince(trip.tripper.memberSince, locale) })}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {ratedCarrier !== null
              ? t('tripper.rating', {
                  rating: ratedCarrier.ratingsAvg.toFixed(1),
                  count: ratedCarrier.ratingsCount,
                })
              : t('tripper.newTripper')}
          </ThemedText>
        </View>
      </View>

      {carrier !== null && (carrier.isSuperCarrier || carrier.isVerified) && (
        <View style={styles.chips}>
          {carrier.isSuperCarrier && <Chip label={t('badges.superTripper')} tone="mango" />}
          {carrier.isVerified && <Chip label={t('badges.profileVerified')} tone="teal" />}
        </View>
      )}

      {carrier !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          {t('tripper.tripsPublished', { count: carrier.totalTripsPublished })} ·{' '}
          {t('tripper.parcelsCarried', { count: carrier.totalParcelsCarried })}
        </ThemedText>
      )}

      {carrier?.bio ? (
        <ThemedText type="small" themeColor="textSecondary">
          {carrier.bio}
        </ThemedText>
      ) : null}
    </Card>
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
  back: {
    paddingTop: Spacing.two,
    alignSelf: 'flex-start',
  },
  scroll: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.one,
  },
  route: {
    fontSize: 24,
    lineHeight: 32,
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  chipTeal: {
    backgroundColor: 'rgba(15, 118, 110, 0.14)',
  },
  chipMango: {
    backgroundColor: 'rgba(255, 153, 0, 0.16)',
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.five,
  },
  stat: {
    gap: Spacing.half,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 26,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  rowLabel: {
    flexShrink: 1,
  },
  locationGroup: {
    gap: Spacing.one,
  },
  conditionsSecondTitle: {
    paddingTop: Spacing.two,
  },
  tripperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  tripperIdentity: {
    flex: 1,
    gap: Spacing.half,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
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

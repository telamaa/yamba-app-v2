/**
 * trip/[id].tsx — la fiche publique d'un trajet (lot fiche détaillée).
 * =====================================================================
 * Réf. captures 13/10 22h42-22h43 : le site est le scénario, le rendu est
 * natif. Dans l'ordre : l'en-tête (route en gros, auteur, vues, cœur), la
 * carte ITINÉRAIRE avec sa frise verticale et la pastille de transport, le
 * VOYAGEUR (avatar, ancienneté, badges, empreinte évitée, « Discuter »
 * annoncé), l'OFFRE (prix au kilo, kilos restants, estimation, familles de
 * colis), les LIEUX de remise et de livraison, les CONDITIONS, puis
 * « Signaler cette annonce ».
 *
 * Deux choix d'adaptation, assumés :
 *   • une BARRE D'ACTION COLLANTE en bas (prix + action), comme le site :
 *     sur un téléphone, le prix et le geste suivant ne doivent jamais
 *     demander de remonter. Tant que le wizard de réservation n'existe pas,
 *     son bouton DIT « bientôt réservable » en gris neutre — jamais un
 *     bouton mangue qui ne fait rien (A203, doctrine A209 du bouton inerte) ;
 *   • AUCUN chevron vers le profil public du Voyageur : l'écran n'existe pas
 *     dans l'app, et on ne promet pas une navigation absente (A210 (iii)).
 *
 * Le serveur décide de tout (RG-MOB-1) : visibilité (404 indiscernable),
 * comptage de la vue (A205), prix en CENTS.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ReportSheet } from '@/components/report-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { addTripFavorite, removeTripFavorite } from '@/lib/api/favorite.api';
import { getPublicTrip, type PublicTrip, type TripLocationPoint } from '@/lib/api/trip.api';
import {
  estimateShipperTotalCents,
  MIN_PARCEL_PRICE_EUR,
  PRICING_EXAMPLE_PARAMS,
} from '@/lib/pricing-example';
import { useSession } from '@/lib/session-context';
import {
  calculateCO2SavedKg,
  formatLocalTime,
  formatLongDate,
  formatMemberSince,
  formatPrice,
  formatPriceShort,
  formatTripDuration,
  getInitials,
  isPopular,
} from '@/lib/trip-format';

/** Les 8 familles D14, dans l'ordre d'affichage du web (`OfferCard`), avec
 *  l'icône qui les désigne sur la capture — un pictogramme par famille rend
 *  la liste balayable sans la lire. */
const FAMILIES: { key: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'DOCUMENTS_PAPERS', icon: 'document-text-outline' },
  { key: 'CLOTHES_TEXTILE', icon: 'shirt-outline' },
  { key: 'FOOD_DRY_SEALED', icon: 'cube-outline' },
  { key: 'ELECTRONICS_DEVICES', icon: 'phone-portrait-outline' },
  { key: 'COSMETICS_CARE', icon: 'sparkles-outline' },
  { key: 'PARTS_TOOLS', icon: 'construct-outline' },
  { key: 'TOYS_CHILDCARE', icon: 'happy-outline' },
  { key: 'MISC_ACCESSORIES', icon: 'bag-handle-outline' },
];

const TRANSPORT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  PLANE: 'airplane',
  TRAIN: 'train',
  CAR: 'car-sport',
};

const LOCATION_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  AIRPORT: 'airplane-outline',
  TRAIN_STATION: 'train-outline',
  CITY_AREA: 'business-outline',
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string; correlationId: string | null }
  | { kind: 'loaded'; trip: PublicTrip };

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('tripDetail');
  const theme = useTheme();
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
        {state.kind === 'loading' && (
          <ActivityIndicator color={Brand.mango} style={styles.spinner} />
        )}

        {state.kind === 'notFound' && (
          <>
            <TopBar />
            <View style={styles.stateBlock}>
              <ThemedText type="smallBold" style={styles.centered}>
                {t('notFound.title')}
              </ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.centered}>
                {t('notFound.body')}
              </ThemedText>
            </View>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <TopBar />
            <View style={styles.stateBlock}>
              <ThemedText style={styles.centered}>{state.message}</ThemedText>
              {state.correlationId !== null && (
                <ThemedText type="code" themeColor="textSecondary" style={styles.centered}>
                  {state.correlationId}
                </ThemedText>
              )}
              <Pressable onPress={load} accessibilityRole="button">
                <ThemedText type="linkPrimary">{t('error.retry')}</ThemedText>
              </Pressable>
            </View>
          </>
        )}

        {state.kind === 'loaded' && <TripDetailContent trip={state.trip} />}
      </SafeAreaView>
      {/* Le filet de la barre collante remonte au-dessus du contenu. */}
      {state.kind === 'loaded' && (
        <BottomBar trip={state.trip} background={theme.background} border={theme.backgroundElement} />
      )}
    </ThemedView>
  );
}

/** La rangée du haut : retour, et le cœur quand le trajet est chargé. */
function TopBar({ trip }: { trip?: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();

  return (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t('back')}
        style={({ pressed }) => [styles.iconButton, { backgroundColor: theme.backgroundElement }, pressed && styles.pressed]}>
        <Ionicons name="chevron-back" size={22} color={theme.text} />
      </Pressable>
      {trip ? <FavoriteButton trip={trip} /> : null}
    </View>
  );
}

/** Le cœur (D46), optimiste : un toucher inverse localement, l'API tranche,
 *  l'erreur remet comme avant. Un visiteur part vers la connexion. */
function FavoriteButton({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();
  const { status } = useSession();
  const [override, setOverride] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const favorite = override ?? trip.isFavorite ?? false;

  const toggle = async () => {
    if (pending) return;
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    const next = !favorite;
    setOverride(next);
    setPending(true);
    try {
      await (next ? addTripFavorite(trip.id) : removeTripFavorite(trip.id));
    } catch (err) {
      setOverride(!next);
      const code = err instanceof ApiError ? err.code : null;
      Alert.alert(
        code === 'OWN_TRIP'
          ? t('favorite.ownTrip')
          : code === 'TRIP_NOT_FAVORITABLE'
            ? t('favorite.notFavoritable')
            : t('favorite.error')
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={favorite ? t('favorite.remove') : t('favorite.add')}
      accessibilityState={{ selected: favorite }}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <Ionicons
        name={favorite ? 'heart' : 'heart-outline'}
        size={20}
        color={favorite ? Brand.mango : theme.text}
      />
    </Pressable>
  );
}

function TripDetailContent({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <TopBar trip={trip} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          // La barre collante ne doit jamais couvrir la dernière ligne.
          { paddingBottom: BOTTOM_BAR_HEIGHT + Math.max(insets.bottom, Spacing.three) + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}>
        <Header trip={trip} />
        <ItineraryCard trip={trip} />
        <TripperCard trip={trip} />
        <OfferCard trip={trip} />
        <CategoriesCard trip={trip} />
        <LocationsCard trip={trip} />
        <ConditionsCard />
        {trip.notes ? (
          <Card title={t('notes.title')}>
            <ThemedText type="small" themeColor="textSecondary">
              {trip.notes}
            </ThemedText>
          </Card>
        ) : null}

        <Pressable
          onPress={() => setReportOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.reportLink, pressed && styles.pressed]}>
          <Ionicons name="flag-outline" size={13} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.reportLabel}>
            {t('report.title.TRIP')}
          </ThemedText>
        </Pressable>
      </ScrollView>

      <ReportSheet
        visible={reportOpen}
        targetType="TRIP"
        targetRef={trip.id}
        onCloseAction={() => setReportOpen(false)}
      />
    </>
  );
}

/* ── La barre d'action collante ──────────────────────────────────────────── */

const BOTTOM_BAR_HEIGHT = 64;

function BottomBar({
  trip,
  background,
  border,
}: {
  trip: PublicTrip;
  background: string;
  border: string;
}) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();
  const locale = useLocale() as SupportedLocale;
  const insets = useSafeAreaInsets();

  const perKgCents =
    trip.pricePerKgCents != null && trip.pricePerKgCents > 0 ? trip.pricePerKgCents : null;

  return (
    <View
      style={[
        styles.bottomBar,
        {
          backgroundColor: background,
          borderTopColor: border,
          paddingBottom: Math.max(insets.bottom, Spacing.three),
        },
      ]}>
      <View style={styles.bottomPrice}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
          {perKgCents !== null ? t('offer.perKg') : t('bar.from')}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.bottomPriceValue}>
          {perKgCents !== null
            ? formatPrice(perKgCents, trip.currencyCode, locale)
            : formatPrice(trip.minPriceCents ?? 0, trip.currencyCode, locale)}
          <ThemedText type="small" themeColor="textSecondary">
            {perKgCents !== null ? '/kg' : ''}
          </ThemedText>
        </ThemedText>
      </View>
      {/* Le wizard de réservation n'existe pas encore : le bouton le DIT, en
          gris neutre franc (A209) — jamais une mangue qui ne mène nulle part.
          Le jour du lot, ce bloc devient le CTA, la barre ne bouge pas. */}
      <View
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.bottomCta, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('bar.soon')}
        </ThemedText>
      </View>
    </View>
  );
}

/* ── Blocs ───────────────────────────────────────────────────────────────── */

function Card({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      {title ? <ThemedText type="smallBold" style={styles.cardTitle}>{title}</ThemedText> : null}
      {subtitle ? (
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      ) : null}
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
      <ThemedText type="title" style={styles.route}>
        {trip.origin.city} <ThemedText style={styles.routeArrow}>→</ThemedText>{' '}
        {trip.destination.city}
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
            <Chip label={`👁 ${t('views', { count: trip.viewsCount })}`} tone="muted" />
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
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  const departureTime = formatLocalTime(trip.dates.departureAt, trip.dates.departureTimeLocal);
  const arrivalTime = formatLocalTime(trip.dates.arrivalAt, trip.dates.arrivalTimeLocal);
  const duration = formatTripDuration(trip.dates);

  // La pastille de transport dit le mode ET sa variante en un mot (« Train
  // direct »), comme sur le site : deux informations, une seule ligne.
  let variantLabel: string | null = null;
  let citiesLine: string | null = null;
  if (trip.transportMode === 'PLANE' && trip.flightType) {
    variantLabel =
      trip.flightType === 'DIRECT' ? t('transport.flightDirect') : t('transport.flightWithLayover');
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
  const badgeLabel =
    variantLabel ?? (trip.transportMode ? t(`transport.${trip.transportMode}`) : null);

  return (
    <Card>
      <View style={styles.itineraryHead}>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={15} color={theme.textSecondary} />
          <ThemedText type="smallBold" style={styles.dateLabel}>
            {formatLongDate(trip.dates.departureAt, locale)}
          </ThemedText>
        </View>
        {badgeLabel !== null && trip.transportMode !== null && (
          <View
            style={[
              styles.transportBadge,
              { backgroundColor: dark ? 'rgba(255,153,0,0.18)' : '#FFF1DB' },
            ]}>
            <Ionicons
              name={TRANSPORT_ICONS[trip.transportMode] ?? 'navigate'}
              size={13}
              color={dark ? '#FFB84D' : '#9A3412'}
            />
            <ThemedText type="small" style={{ color: dark ? '#FFB84D' : '#9A3412' }}>
              {badgeLabel}
            </ThemedText>
          </View>
        )}
      </View>

      {/* La frise : heures à gauche, rail au centre, lieux à droite — la
          lecture verticale d'un billet, pas deux lignes de texte. */}
      <View style={styles.timeline}>
        <View style={styles.timelineTimes}>
          <ThemedText type="smallBold" style={styles.time}>
            {departureTime}
          </ThemedText>
          <View style={styles.timelineMiddle}>
            {duration !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                {duration}
              </ThemedText>
            )}
          </View>
          <ThemedText type="smallBold" style={styles.time}>
            {arrivalTime}
          </ThemedText>
        </View>

        <View style={styles.timelineRail}>
          <View style={[styles.dotHollow, { borderColor: Brand.mango, backgroundColor: theme.backgroundElement }]} />
          <View style={[styles.rail, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.dotFull, { backgroundColor: Brand.mango }]} />
        </View>

        <View style={styles.timelinePlaces}>
          <View style={styles.place}>
            <ThemedText type="smallBold" style={styles.placeCity} numberOfLines={1}>
              {trip.origin.city}
            </ThemedText>
            {trip.origin.country ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {trip.origin.country}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.timelineMiddle} />
          <View style={styles.place}>
            <ThemedText type="smallBold" style={styles.placeCity} numberOfLines={1}>
              {trip.destination.city}
            </ThemedText>
            {trip.destination.country ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {trip.destination.country}
              </ThemedText>
            ) : null}
          </View>
        </View>
      </View>

      {citiesLine !== null && (
        <ThemedText type="small" themeColor="textSecondary">
          {citiesLine}
        </ThemedText>
      )}
    </Card>
  );
}

function TripperCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const carrier = trip.tripper.carrier;
  // Pitfall 19/09 : le narrowing ne traverse pas une constante booléenne —
  // on capture la VALEUR (le carrier noté), pas le verdict.
  const ratedCarrier = carrier !== null && carrier.ratingsCount > 0 ? carrier : null;

  const co2 = calculateCO2SavedKg(
    trip.transportMode,
    { lat: trip.origin.lat, lng: trip.origin.lng },
    { lat: trip.destination.lat, lng: trip.destination.lng },
    PRICING_EXAMPLE_PARAMS.exampleWeightKg
  );

  return (
    <Card>
      <View style={styles.tripperRow}>
        {trip.tripper.avatarUrl ? (
          <Image source={{ uri: trip.tripper.avatarUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: theme.backgroundSelected, borderColor: Brand.mango },
            ]}>
            <ThemedText type="smallBold" style={styles.avatarInitials}>
              {getInitials(trip.tripper.firstName, trip.tripper.lastInitial)}
            </ThemedText>
          </View>
        )}
        {/* Pas de chevron : la fiche profil publique n'existe pas dans
            l'app — on informe sans promettre de navigation (A210). */}
        <View style={styles.tripperIdentity}>
          <View style={styles.tripperNameRow}>
            <ThemedText type="smallBold" style={styles.tripperName}>
              {trip.tripper.firstName}
              {trip.tripper.lastInitial ? ` ${trip.tripper.lastInitial}.` : ''}
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
          <ThemedText type="small" themeColor="textSecondary">
            {t('tripper.memberSince', { date: formatMemberSince(trip.tripper.memberSince, locale) })}
          </ThemedText>
          {carrier !== null && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('tripper.tripsPublished', { count: carrier.totalTripsPublished })} ·{' '}
              {t('tripper.parcelsCarried', { count: carrier.totalParcelsCarried })}
            </ThemedText>
          )}
        </View>
      </View>

      {carrier !== null && (carrier.isSuperCarrier || carrier.isVerified) && (
        <View style={styles.chips}>
          {carrier.isSuperCarrier && <Chip label={t('badges.superTripper')} tone="mango" />}
          {carrier.isVerified && <Chip label={t('badges.profileVerified')} tone="teal" />}
        </View>
      )}

      {carrier?.bio ? (
        <ThemedText type="small" themeColor="textSecondary">
          {carrier.bio}
        </ThemedText>
      ) : null}

      {co2 !== null && (
        <View style={[styles.co2, { backgroundColor: dark ? 'rgba(16,185,129,0.12)' : '#ECFDF5' }]}>
          <Ionicons name="leaf-outline" size={15} color={dark ? '#34D399' : '#047857'} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.co2Text}>
            {t('co2.prefix')}{' '}
            <ThemedText type="smallBold" style={{ color: dark ? '#34D399' : '#047857' }}>
              {t('co2.amount', { kg: co2.toFixed(1) })}
            </ThemedText>{' '}
            {t('co2.suffix', { weight: PRICING_EXAMPLE_PARAMS.exampleWeightKg })}
          </ThemedText>
        </View>
      )}

      {/* Le chat n'ouvre qu'une fois la réservation ACCEPTÉE (chantier F) :
          la ligne existe, inerte, et DIT pourquoi — jamais un bouton muet. */}
      <View style={[styles.chatRow, { borderColor: theme.backgroundSelected }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.chatLabel}>
          {t('chat.cta', { firstName: trip.tripper.firstName })}
        </ThemedText>
        <Chip label={t('chat.soon')} tone="mango" />
      </View>
    </Card>
  );
}

function OfferCard({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  const perKgCents =
    trip.pricePerKgCents != null && trip.pricePerKgCents > 0 ? trip.pricePerKgCents : null;
  if (perKgCents === null) return null;

  const remaining = typeof trip.remainingKg === 'number' ? trip.remainingKg : null;
  const exampleKg = PRICING_EXAMPLE_PARAMS.exampleWeightKg;
  const example = estimateShipperTotalCents(perKgCents, exampleKg).totalCents;
  const conditions = new Map((trip.familyConditions ?? []).map((c) => [c.familyKey, c]));

  return (
    <Card title={t('offer.title', { firstName: trip.tripper.firstName })} subtitle={t('offer.hint')}>
      {/* Le bloc PRIX : deux colonnes, un filet, l'estimation. C'est le cœur
          de la décision — il mérite son propre encadré dans la carte. */}
      <View style={[styles.priceBox, { backgroundColor: theme.background }]}>
        <View style={styles.priceRow}>
          <View style={styles.priceCell}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
              {t('offer.perKg')}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.priceValue}>
              {formatPrice(perKgCents, trip.currencyCode, locale)}
              <ThemedText type="small" themeColor="textSecondary">
                /kg
              </ThemedText>
            </ThemedText>
          </View>
          {remaining !== null && (
            <View style={styles.priceCell}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
                {t('offer.available')}
              </ThemedText>
              {/* `tint` = teal lisible dans les deux thèmes. */}
              <ThemedText type="smallBold" themeColor="tint" style={styles.priceValue}>
                {remaining}
                <ThemedText type="small" themeColor="textSecondary">
                  {' '}
                  kg
                </ThemedText>
              </ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.priceDivider, { backgroundColor: theme.backgroundSelected }]} />

        <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
          {t('offer.estimateLabel', { kg: exampleKg })}
        </ThemedText>
        <ThemedText type="smallBold" style={styles.estimate}>
          ≈ {formatPrice(example, trip.currencyCode, locale)}{' '}
          <ThemedText type="small" themeColor="textSecondary">
            {t('offer.allIn')}
          </ThemedText>
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('offer.finalAtBooking')}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('offer.lightParcel', { min: MIN_PARCEL_PRICE_EUR })}
        </ThemedText>
      </View>

      <View>
        <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
          {t('offer.families')}
        </ThemedText>
        <View style={styles.chips}>
          {FAMILIES.map(({ key, icon }) => {
            const condition = conditions.get(key);
            const label = t(`offer.family.${key}`);
            const refused = condition?.mode === 'REFUSE';
            const surcharge = condition?.mode === 'SURCHARGE';
            const color = refused
              ? theme.textSecondary
              : surcharge
                ? dark
                  ? '#FFB84D'
                  : '#9A3412'
                : theme.text;
            return (
              <View
                key={key}
                style={[
                  styles.familyChip,
                  surcharge
                    ? {
                        backgroundColor: dark ? 'rgba(255,153,0,0.12)' : '#FFF6E8',
                        borderColor: 'rgba(255,153,0,0.5)',
                      }
                    : { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                ]}>
                <Ionicons name={icon} size={13} color={color} />
                <ThemedText
                  type="small"
                  style={[{ color }, refused && styles.struck]}
                  numberOfLines={1}>
                  {label}
                </ThemedText>
                {refused ? (
                  <Ionicons name="close" size={13} color={theme.textSecondary} />
                ) : surcharge ? (
                  <ThemedText type="smallBold" style={{ color }}>
                    {t('offer.surcharge', { pct: condition?.surchargePct ?? 0 })}
                  </ThemedText>
                ) : (
                  <Ionicons name="checkmark" size={13} color={theme.tint} />
                )}
              </View>
            );
          })}
        </View>
      </View>

      {trip.checkedBag23PriceCents || trip.cabinBag12PriceCents ? (
        <View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
            {t('offer.bags')}
          </ThemedText>
          {trip.checkedBag23PriceCents ? (
            <View style={styles.row}>
              <ThemedText type="small" style={styles.rowLabel}>
                {t('offer.checkedBag')}
              </ThemedText>
              <ThemedText type="smallBold">
                {formatPriceShort(trip.checkedBag23PriceCents, trip.currencyCode, locale)}
              </ThemedText>
            </View>
          ) : null}
          {trip.cabinBag12PriceCents ? (
            <View style={styles.row}>
              <ThemedText type="small" style={styles.rowLabel}>
                {t('offer.cabinBag')}
              </ThemedText>
              <ThemedText type="smallBold">
                {formatPriceShort(trip.cabinBag12PriceCents, trip.currencyCode, locale)}
              </ThemedText>
            </View>
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
    <Card
      title={t('categories.title', { firstName: trip.tripper.firstName })}
      subtitle={t('categories.hint')}>
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
  const theme = useTheme();
  if (points.length === 0) return null;

  return (
    <View style={styles.locationGroup}>
      <View style={styles.locationGroupHead}>
        <Ionicons name="cube-outline" size={14} color={Brand.mango} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
          {title}
        </ThemedText>
      </View>
      {points.map((point, index) => {
        const flexLabel =
          point.flexibility === 'RADIUS'
            ? point.radiusKm
              ? t('locations.flex.RADIUS', { km: point.radiusKm })
              : null
            : t(`locations.flex.${point.flexibility}`);
        return (
          <View
            key={`${point.kind}-${index}`}
            style={[styles.locationCard, { borderColor: theme.backgroundSelected }]}>
            <Ionicons
              name={LOCATION_ICONS[point.kind] ?? 'location-outline'}
              size={16}
              color={Brand.mango}
              style={styles.locationIcon}
            />
            <View style={styles.locationTexts}>
              <ThemedText type="smallBold" style={styles.locationTitle}>
                {t(`locations.kind.${point.kind}`)}
              </ThemedText>
              {point.details ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {point.details}
                </ThemedText>
              ) : null}
              {flexLabel !== null && (
                <View style={styles.locationFlex}>
                  <Chip label={flexLabel} tone="teal" />
                </View>
              )}
            </View>
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
    <Card title={t('locations.title')} subtitle={t('locations.subtitle')}>
      <LocationList title={t('locations.pickupTitle')} points={trip.pickupLocations} />
      <LocationList title={t('locations.deliveryTitle')} points={trip.deliveryLocations} />
    </Card>
  );
}

function ConditionBullet({ ok, children }: { ok: boolean; children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bullet}>
      <Ionicons
        name={ok ? 'checkmark' : 'close'}
        size={15}
        color={ok ? theme.tint : theme.textSecondary}
      />
      <ThemedText
        type="small"
        themeColor={ok ? 'text' : 'textSecondary'}
        style={styles.bulletText}>
        {children}
      </ThemedText>
    </View>
  );
}

function ConditionsCard() {
  const t = useTranslations('tripDetail');
  return (
    <Card title={t('conditions.title')}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
        {t('conditions.cancellationTitle')}
      </ThemedText>
      <ConditionBullet ok>{t('conditions.cancellationFull')}</ConditionBullet>
      <ConditionBullet ok>{t('conditions.cancellationHalf')}</ConditionBullet>
      <ConditionBullet ok={false}>{t('conditions.cancellationNone')}</ConditionBullet>
      <ThemedText
        type="small"
        themeColor="textSecondary"
        style={[styles.overline, styles.conditionsSecondTitle]}>
        {t('conditions.prohibitedTitle')}
      </ThemedText>
      <ThemedText type="small">{t('conditions.prohibitedDescription')}</ThemedText>
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
    paddingHorizontal: Spacing.three,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  route: {
    fontSize: 26,
    lineHeight: 34,
  },
  routeArrow: {
    color: Brand.mango,
    fontSize: 24,
    fontWeight: 800,
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  /* Itinéraire */
  itineraryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  dateLabel: {
    fontSize: 14,
    flexShrink: 1,
  },
  transportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  timeline: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  timelineTimes: {
    width: 54,
    alignItems: 'flex-end',
  },
  time: {
    fontSize: 17,
    lineHeight: 22,
  },
  timelineMiddle: {
    height: 44,
    justifyContent: 'center',
  },
  timelineRail: {
    width: 14,
    alignItems: 'center',
    paddingTop: 5,
  },
  dotHollow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  rail: {
    width: 2,
    height: 44,
  },
  dotFull: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelinePlaces: {
    flex: 1,
  },
  place: {
    minHeight: 22,
  },
  placeCity: {
    fontSize: 17,
    lineHeight: 22,
  },
  /* Voyageur */
  tripperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarInitials: {
    fontSize: 15,
  },
  tripperIdentity: {
    flex: 1,
    gap: 1,
  },
  tripperNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  tripperName: {
    fontSize: 15,
  },
  co2: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.two,
  },
  co2Text: {
    flex: 1,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chatLabel: {
    flex: 1,
  },
  /* Offre */
  priceBox: {
    borderRadius: 14,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  priceCell: {
    flex: 1,
    gap: 2,
  },
  priceValue: {
    fontSize: 24,
    lineHeight: 30,
  },
  priceDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  estimate: {
    fontSize: 18,
    lineHeight: 24,
  },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: 2,
  },
  rowLabel: {
    flex: 1,
  },
  /* Lieux */
  locationGroup: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  locationGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  locationCard: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
  },
  locationIcon: {
    paddingTop: 2,
  },
  locationTexts: {
    flex: 1,
    gap: 2,
  },
  locationTitle: {
    fontSize: 15,
  },
  locationFlex: {
    flexDirection: 'row',
    paddingTop: Spacing.one,
  },
  /* Conditions */
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  bulletText: {
    flex: 1,
  },
  conditionsSecondTitle: {
    paddingTop: Spacing.two,
  },
  /* Signalement */
  reportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
  },
  reportLabel: {
    textDecorationLine: 'underline',
  },
  /* Barre collante */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomPrice: {
    gap: 1,
  },
  bottomPriceValue: {
    fontSize: 20,
    lineHeight: 26,
  },
  bottomCta: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* États */
  spinner: {
    paddingTop: Spacing.five,
  },
  stateBlock: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
    alignItems: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});

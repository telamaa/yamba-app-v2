/**
 * trip/[id].tsx — la fiche publique d'un trajet.
 * ===============================================
 * Refonte du 13/10 au soir, sur les captures de l'implémentation : la
 * première version transposait les CARTES du site (cinq boîtes grises
 * empilées sur fond noir). Tout y avait le même poids, donc rien n'en
 * avait : « pas très sexy et un peu trop chargé », et c'était juste.
 *
 * La règle de cette version : **une page à PLAT, des sections séparées par
 * un filet, et UNE SEULE carte — le prix.** C'est la grammaire des fiches
 * natives (Airbnb, Booking) : la carte redevient un signal parce qu'elle
 * est unique. Trois autres leviers de densité :
 *   • ce qui se lit AVANT de décider reste visible (route, horaires,
 *     Voyageur, prix, lieux) ; ce qui se lit APRÈS se replie derrière un
 *     dépliant (détails du prix, familles refusées, conditions) ;
 *   • les lieux sont des LIGNES, pas des cartes bordées ;
 *   • les 8 familles ne s'affichent plus toutes : on montre ce que le
 *     Voyageur accepte, et on replie ce qu'il refuse.
 *
 * Le serveur décide de tout (RG-MOB-1) : visibilité (404 indiscernable),
 * comptage de la vue (A205), prix en CENTS. Et on ne promet rien qui
 * n'existe pas (A203) : pas de chevron vers un profil public absent de
 * l'app (A210), et la barre du bas DIT que la réservation arrive — elle
 * deviendra le vrai « Réserver » au lot suivant, sans bouger d'un pixel.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

/** Les 8 familles D14, dans l'ordre du site, avec le pictogramme qui les
 *  désigne — une liste d'icônes se balaie, une liste de mots se lit. */
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

/* La frise partage UNE grille entre ses trois colonnes : sans hauteurs
   communes, la ville tombait sous son point (défaut vu sur la capture
   23h02). Ville + pays = 44 ; l'écart entre les deux arrêts = 28. */
const STOP_ROW_HEIGHT = 44;
const STOP_GAP_HEIGHT = 28;

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
      {state.kind === 'loaded' && (
        <BottomBar
          trip={state.trip}
          background={theme.background}
          border={theme.backgroundElement}
        />
      )}
    </ThemedView>
  );
}

/* ── Chrome ──────────────────────────────────────────────────────────────── */

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
        style={({ pressed }) => [
          styles.iconButton,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
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
          { paddingBottom: BOTTOM_BAR_HEIGHT + Math.max(insets.bottom, Spacing.three) },
        ]}
        showsVerticalScrollIndicator={false}>
        <Hero trip={trip} />
        <Itinerary trip={trip} />
        <Tripper trip={trip} />
        <Offer trip={trip} />
        <LegacyCategories trip={trip} />
        <Places trip={trip} />
        <Conditions />
        {trip.notes ? (
          <Section>
            <Disclosure title={t('notes.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {trip.notes}
              </ThemedText>
            </Disclosure>
          </Section>
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

/* ── Grammaire de la page : sections, filets, dépliants ──────────────────── */

/** Une section = un filet en haut et de l'air. Aucune boîte : le fond de la
 *  page suffit à séparer, et la seule carte de l'écran reste le prix. */
function Section({ title, children }: { title?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: theme.backgroundElement }]}>
      {title ? (
        <ThemedText type="smallBold" style={styles.sectionTitle}>
          {title}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

/** Un dépliant pour ce qui se lit APRÈS avoir décidé (détails du prix,
 *  familles refusées, conditions) : présent, jamais encombrant. */
function Disclosure({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <Pressable
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.disclosureHead, pressed && styles.pressed]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.disclosureTitle}>
          {title}
          {count !== undefined ? ` (${count})` : ''}
        </ThemedText>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

function Chip({ label, tone }: { label: string; tone: 'teal' | 'mango' | 'muted' }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.chip,
        tone === 'teal' && styles.chipTeal,
        tone === 'mango' && styles.chipMango,
        tone === 'muted' && { backgroundColor: theme.backgroundElement },
      ]}>
      <ThemedText type="small" themeColor={tone === 'muted' ? 'textSecondary' : 'text'}>
        {label}
      </ThemedText>
    </View>
  );
}

/* ── Blocs ───────────────────────────────────────────────────────────────── */

function Hero({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();

  const views = typeof trip.viewsCount === 'number' && trip.viewsCount > 0 ? trip.viewsCount : null;

  return (
    <View style={styles.hero}>
      <ThemedText type="title" style={styles.route}>
        {trip.origin.city} <ThemedText style={styles.routeArrow}>→</ThemedText>{' '}
        {trip.destination.city}
      </ThemedText>
      {/* UNE ligne de méta, en icônes vectorielles : l'emoji œil de la
          première version jurait au milieu d'une interface dessinée. */}
      <View style={styles.metaRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('trippedBy', {
            firstName: trip.tripper.firstName,
            lastInitial: trip.tripper.lastInitial,
          })}
        </ThemedText>
        {views !== null && (
          <View style={styles.metaItem}>
            <Ionicons name="eye-outline" size={13} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('views', { count: views })}
            </ThemedText>
          </View>
        )}
        {isPopular(trip.viewsCount) && (
          <View style={styles.metaItem}>
            <Ionicons name="flame-outline" size={13} color={Brand.mango} />
            <ThemedText type="small" style={{ color: Brand.mango }}>
              {t('badges.popular')}
            </ThemedText>
          </View>
        )}
        {trip.ticketVerified && (
          <View style={styles.metaItem}>
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.tint} />
            <ThemedText type="small" themeColor="tint">
              {t('badges.verifiedTicket')}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
}

function Itinerary({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';

  const departureTime = formatLocalTime(trip.dates.departureAt, trip.dates.departureTimeLocal);
  const arrivalTime = formatLocalTime(trip.dates.arrivalAt, trip.dates.arrivalTimeLocal);
  const duration = formatTripDuration(trip.dates);

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
    <Section>
      <View style={styles.itineraryHead}>
        <ThemedText type="smallBold" style={styles.dateLabel} numberOfLines={1}>
          {formatLongDate(trip.dates.departureAt, locale)}
        </ThemedText>
        {badgeLabel !== null && trip.transportMode !== null && (
          <View
            style={[
              styles.transportBadge,
              { backgroundColor: dark ? 'rgba(255,153,0,0.18)' : '#FFF1DB' },
            ]}>
            <Ionicons
              name={TRANSPORT_ICONS[trip.transportMode] ?? 'navigate'}
              size={12}
              color={dark ? '#FFB84D' : '#9A3412'}
            />
            <ThemedText type="small" style={{ color: dark ? '#FFB84D' : '#9A3412' }}>
              {badgeLabel}
            </ThemedText>
          </View>
        )}
      </View>

      {/* Trois colonnes, UNE grille : heures, rail, lieux partagent les
          mêmes hauteurs de rangée — c'est ce qui garantit que la ville est
          en face de son point. */}
      <View style={styles.timeline}>
        <View style={styles.timelineTimes}>
          <View style={styles.stopRow}>
            <ThemedText type="smallBold" style={styles.time}>
              {departureTime}
            </ThemedText>
          </View>
          <View style={styles.gapRow}>
            {duration !== null && (
              <ThemedText type="small" themeColor="textSecondary">
                {duration}
              </ThemedText>
            )}
          </View>
          <View style={styles.stopRow}>
            <ThemedText type="smallBold" style={styles.time}>
              {arrivalTime}
            </ThemedText>
          </View>
        </View>

        <View style={styles.timelineRail}>
          <View
            style={[
              styles.dotHollow,
              { borderColor: Brand.mango, backgroundColor: theme.background },
            ]}
          />
          <View style={[styles.rail, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.dotFull, { backgroundColor: Brand.mango }]} />
        </View>

        <View style={styles.timelinePlaces}>
          <View style={styles.stopRow}>
            <ThemedText type="smallBold" style={styles.placeCity} numberOfLines={1}>
              {trip.origin.city}
            </ThemedText>
            {trip.origin.country ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {trip.origin.country}
              </ThemedText>
            ) : null}
          </View>
          <View style={styles.gapRow} />
          <View style={styles.stopRow}>
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
    </Section>
  );
}

function Tripper({ trip }: { trip: PublicTrip }) {
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
    <Section>
      <View style={styles.tripperRow}>
        {trip.tripper.avatarUrl ? (
          <Image source={{ uri: trip.tripper.avatarUrl }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarFallback,
              { backgroundColor: theme.backgroundElement, borderColor: Brand.mango },
            ]}>
            <ThemedText type="smallBold">
              {getInitials(trip.tripper.firstName, trip.tripper.lastInitial)}
            </ThemedText>
          </View>
        )}
        {/* Pas de chevron : la fiche profil publique n'existe pas dans
            l'app — on informe sans promettre de navigation (A210). */}
        <View style={styles.tripperIdentity}>
          <ThemedText type="smallBold" style={styles.tripperName} numberOfLines={1}>
            {trip.tripper.firstName}
            {trip.tripper.lastInitial ? ` ${trip.tripper.lastInitial}.` : ''}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {ratedCarrier !== null
              ? t('tripper.rating', {
                  rating: ratedCarrier.ratingsAvg.toFixed(1),
                  count: ratedCarrier.ratingsCount,
                })
              : t('tripper.newTripper')}
            {' · '}
            {t('tripper.memberSince', {
              date: formatMemberSince(trip.tripper.memberSince, locale),
            })}
          </ThemedText>
        </View>
        {/* Les deux marqueurs de confiance du Voyageur, à droite de sa
            ligne : le bouclier (profil vérifié) et la pastille Super
            Voyageur. Ils sont rares — ils méritent d'être vus sans
            alourdir. */}
        {carrier !== null && carrier.isVerified && (
          <Ionicons name="shield-checkmark" size={16} color={theme.tint} />
        )}
        {carrier !== null && carrier.isSuperCarrier && (
          <Chip label={t('badges.superTripper')} tone="mango" />
        )}
      </View>

      {carrier?.bio ? (
        // Deux lignes : une présentation s'entrevoit, elle ne s'étale pas.
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
          {carrier.bio}
        </ThemedText>
      ) : null}

      {co2 !== null && (
        <View style={styles.co2Row}>
          <Ionicons name="leaf-outline" size={14} color={dark ? '#34D399' : '#047857'} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.co2Text} numberOfLines={1}>
            {t('co2.amount', { kg: co2.toFixed(1) })}
          </ThemedText>
        </View>
      )}
    </Section>
  );
}

function Offer({ trip }: { trip: PublicTrip }) {
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

  const refused = FAMILIES.filter(({ key }) => conditions.get(key)?.mode === 'REFUSE');
  const allowed = FAMILIES.filter(({ key }) => conditions.get(key)?.mode !== 'REFUSE');

  return (
    <Section>
      {/* LA carte de l'écran — la seule. Teintée mangue : c'est l'endroit où
          se prend la décision. */}
      <View
        style={[
          styles.priceCard,
          {
            backgroundColor: dark ? 'rgba(255,153,0,0.08)' : '#FFF8EE',
            borderColor: dark ? 'rgba(255,153,0,0.25)' : '#FFE2BC',
          },
        ]}>
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
                <ThemedText type="small" themeColor="textSecondary"> kg</ThemedText>
              </ThemedText>
            </View>
          )}
        </View>

        {/* L'estimation en UNE phrase : le chiffre d'abord, la mention
            « tout compris » en gris — trois paragraphes noyaient le prix. */}
        <ThemedText type="small" themeColor="textSecondary">
          {t('offer.estimateShort', {
            kg: exampleKg,
            price: formatPrice(example, trip.currencyCode, locale),
          })}
        </ThemedText>

        <Disclosure title={t('offer.priceDetails')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('offer.finalAtBooking')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('offer.lightParcel', { min: MIN_PARCEL_PRICE_EUR })}
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
        </Disclosure>
      </View>

      <ThemedText type="smallBold" style={styles.blockTitle}>
        {t('offer.title', { firstName: trip.tripper.firstName })}
      </ThemedText>
      {/* Ce que le Voyageur ACCEPTE : c'est l'information utile. Ce qu'il
          refuse se replie — huit familles affichées, c'étaient huit lignes
          de bruit pour une qui concerne l'expéditeur. */}
      <View style={styles.familyWrap}>
        {allowed.map(({ key, icon }) => {
          const condition = conditions.get(key);
          const surcharge = condition?.mode === 'SURCHARGE';
          const color = surcharge ? (dark ? '#FFB84D' : '#9A3412') : theme.text;
          return (
            <View
              key={key}
              style={[
                styles.familyChip,
                surcharge
                  ? {
                      backgroundColor: dark ? 'rgba(255,153,0,0.12)' : '#FFF6E8',
                      borderColor: 'rgba(255,153,0,0.45)',
                    }
                  : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
              ]}>
              <Ionicons name={icon} size={12} color={color} />
              <ThemedText type="small" style={{ color }} numberOfLines={1}>
                {t(`offer.family.${key}`)}
              </ThemedText>
              {surcharge && (
                <ThemedText type="smallBold" style={{ color }}>
                  {t('offer.surcharge', { pct: condition?.surchargePct ?? 0 })}
                </ThemedText>
              )}
            </View>
          );
        })}
      </View>
      {refused.length > 0 && (
        <Disclosure title={t('offer.refusedFamilies')} count={refused.length}>
          <View style={styles.familyWrap}>
            {refused.map(({ key, icon }) => (
              <View
                key={key}
                style={[
                  styles.familyChip,
                  { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
                ]}>
                <Ionicons name={icon} size={12} color={theme.textSecondary} />
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.struck}
                  numberOfLines={1}>
                  {t(`offer.family.${key}`)}
                </ThemedText>
              </View>
            ))}
          </View>
        </Disclosure>
      )}
    </Section>
  );
}

function LegacyCategories({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  const locale = useLocale() as SupportedLocale;

  // Le moteur PER_KG a son propre bloc : celui-ci est la fiche legacy.
  const perKg = trip.pricePerKgCents != null && trip.pricePerKgCents > 0;
  if (perKg || trip.categoryConditions.length === 0) return null;

  return (
    <Section title={t('categories.title', { firstName: trip.tripper.firstName })}>
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
    </Section>
  );
}

/** Un lieu = une LIGNE (icône, titre · détail, souplesse à droite). Les
 *  cartes bordées de la première version faisaient quatre pavés pour quatre
 *  informations d'une ligne chacune. */
function PlaceRow({ point }: { point: TripLocationPoint }) {
  const t = useTranslations('tripDetail');
  const theme = useTheme();

  const flexLabel =
    point.flexibility === 'RADIUS'
      ? point.radiusKm
        ? t('locations.flex.RADIUS', { km: point.radiusKm })
        : null
      : t(`locations.flex.${point.flexibility}`);

  return (
    <View style={styles.placeRow}>
      <Ionicons
        name={LOCATION_ICONS[point.kind] ?? 'location-outline'}
        size={16}
        color={theme.textSecondary}
      />
      <View style={styles.placeTexts}>
        <ThemedText type="small" numberOfLines={1}>
          {t(`locations.kind.${point.kind}`)}
          {point.details ? (
            <ThemedText type="small" themeColor="textSecondary">
              {' · '}
              {point.details}
            </ThemedText>
          ) : null}
        </ThemedText>
      </View>
      {flexLabel !== null && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.placeFlex}>
          {flexLabel}
        </ThemedText>
      )}
    </View>
  );
}

function Places({ trip }: { trip: PublicTrip }) {
  const t = useTranslations('tripDetail');
  if (trip.pickupLocations.length === 0 && trip.deliveryLocations.length === 0) return null;

  return (
    <Section title={t('locations.title')}>
      {trip.pickupLocations.length > 0 && (
        <View style={styles.placeGroup}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
            {t('locations.pickupTitle')}
          </ThemedText>
          {trip.pickupLocations.map((point, index) => (
            <PlaceRow key={`pickup-${point.kind}-${index}`} point={point} />
          ))}
        </View>
      )}
      {trip.deliveryLocations.length > 0 && (
        <View style={styles.placeGroup}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.overline}>
            {t('locations.deliveryTitle')}
          </ThemedText>
          {trip.deliveryLocations.map((point, index) => (
            <PlaceRow key={`delivery-${point.kind}-${index}`} point={point} />
          ))}
        </View>
      )}
    </Section>
  );
}

function ConditionBullet({ ok, children }: { ok: boolean; children: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bullet}>
      <Ionicons
        name={ok ? 'checkmark' : 'close'}
        size={14}
        color={ok ? theme.tint : theme.textSecondary}
      />
      <ThemedText type="small" themeColor="textSecondary" style={styles.bulletText}>
        {children}
      </ThemedText>
    </View>
  );
}

function Conditions() {
  const t = useTranslations('tripDetail');
  return (
    <Section>
      {/* Replié : c'est ce qu'on lit APRÈS avoir choisi, pas avant. */}
      <Disclosure title={t('conditions.title')}>
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
        <ThemedText type="small" themeColor="textSecondary">
          {t('conditions.prohibitedDescription')}
        </ThemedText>
      </Disclosure>
    </Section>
  );
}

/* ── La barre d'action collante ──────────────────────────────────────────── */

const BOTTOM_BAR_HEIGHT = 56;

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
          paddingBottom: Math.max(insets.bottom, Spacing.two),
        },
      ]}>
      <View style={styles.bottomPrice}>
        <ThemedText type="smallBold" style={styles.bottomPriceValue}>
          {perKgCents !== null
            ? formatPrice(perKgCents, trip.currencyCode, locale)
            : formatPrice(trip.minPriceCents ?? 0, trip.currencyCode, locale)}
          <ThemedText type="small" themeColor="textSecondary">
            {perKgCents !== null ? '/kg' : ''}
          </ThemedText>
        </ThemedText>
      </View>
      {/* Le wizard de réservation n'existe pas encore : l'état est DIT, en
          pastille discrète — un grand pavé gris était l'élément le plus
          visible de l'écran pour la seule chose qu'on ne peut pas faire.
          Au lot réservation, cette pastille devient le CTA mangue. */}
      <View
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        style={[styles.bottomPill, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          {t('bar.soon')}
        </ThemedText>
      </View>
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
    paddingTop: Spacing.two,
  },
  /* Hero */
  hero: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  /* Sections */
  section: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  blockTitle: {
    fontSize: 15,
    lineHeight: 22,
    paddingTop: Spacing.two,
  },
  overline: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  disclosureHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  disclosureTitle: {
    flex: 1,
  },
  disclosureBody: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  /* Itinéraire */
  itineraryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
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
    paddingVertical: 3,
  },
  timeline: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  timelineTimes: {
    width: 50,
    alignItems: 'flex-end',
  },
  timelineRail: {
    width: 12,
    alignItems: 'center',
    // Le point se centre sur la rangée : (hauteur de rangée − point) / 2.
    paddingVertical: (STOP_ROW_HEIGHT - 12) / 2,
  },
  timelinePlaces: {
    flex: 1,
  },
  stopRow: {
    height: STOP_ROW_HEIGHT,
    justifyContent: 'center',
  },
  gapRow: {
    height: STOP_GAP_HEIGHT,
    justifyContent: 'center',
  },
  time: {
    fontSize: 17,
    lineHeight: 22,
  },
  dotHollow: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  rail: {
    width: 2,
    flex: 1,
  },
  dotFull: {
    width: 12,
    height: 12,
    borderRadius: 6,
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
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  tripperIdentity: {
    flex: 1,
    gap: 1,
  },
  tripperName: {
    fontSize: 15,
  },
  co2Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  co2Text: {
    flex: 1,
  },
  /* Offre */
  priceCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
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
    fontSize: 26,
    lineHeight: 32,
  },
  familyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  familyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  },
  rowLabel: {
    flex: 1,
  },
  /* Lieux */
  placeGroup: {
    gap: Spacing.one,
    paddingTop: Spacing.one,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 6,
  },
  placeTexts: {
    flex: 1,
  },
  placeFlex: {
    flexShrink: 0,
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
    paddingVertical: Spacing.four,
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
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomPrice: {
    gap: 1,
  },
  bottomPriceValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  bottomPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: Spacing.three,
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

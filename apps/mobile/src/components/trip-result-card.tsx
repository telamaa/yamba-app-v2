/**
 * trip-result-card.tsx — une carte de résultat de recherche (lot résultats).
 * ==========================================================================
 * Transposition NATIVE, à l'identique, de la carte du web mobile
 * (`apps/user-ui/src/components/search/TripResultCardMobile.tsx`, capture du
 * 28/09 à 17h08 — GO utilisateur, remplace la piste SNCF Connect) :
 * — en-tête : pastille transport (icône + libellé) · date · alerte places
 *   restantes (≤ 3) · CŒUR favori (D46) ;
 * — corps en quatre colonnes : départ (ville / pays / heure), durée sur un
 *   trait à deux points (gris → mangue) avec Direct/escales, arrivée alignée
 *   à droite (+1 le lendemain), bloc prix (« prix au kilo » + kg dispo, ou
 *   « dès » pour le moteur legacy) ;
 * — pied : avatar (photo ou initiales, anneau mangue superTripper) · prénom +
 *   initiale · note ★ ou « Nouveau Voyageur » · badge vues (« Populaire » à
 *   20, D5/C-PR6) · aperçu des catégories · chevron.
 * Que du VRAI (RG-MOB-1) : tout vient du DTO serveur — date localisée, prix
 * en euros, initiale seule (privacy). Le cœur bascule en OPTIMISTE puis
 * l'API tranche (miroir de useFavoriteMutations) ; visiteur → feuille de
 * connexion. La carte OUVRE la fiche (`/trip/[id]`), vue comptée serveur.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { addTripFavorite, removeTripFavorite } from '@/lib/api/favorite.api';
import { ApiError } from '@/lib/api/client';
import type { SearchParcelCategory, TripSearchResult } from '@/lib/api/search.api';
import { countryName } from '@/lib/country-name';
import { useSession } from '@/lib/session-context';
import { getInitials, isPopular } from '@/lib/trip-format';

export function TripResultCard({ trip }: { trip: TripSearchResult }) {
  const t = useTranslations('search');
  const locale = useLocale();
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const accents = dark ? Accents.dark : Accents.light;
  const { status } = useSession();

  // Cœur optimiste (D46) : le serveur a dit `isFavorite`, un toucher inverse
  // localement, l'API tranche — en erreur on remet comme avant (miroir web).
  const [favoriteOverride, setFavoriteOverride] = useState<boolean | null>(null);
  const [favoritePending, setFavoritePending] = useState(false);
  const favorite = favoriteOverride ?? trip.isFavorite ?? false;

  const toggleFavorite = async () => {
    if (favoritePending) return;
    if (status !== 'authenticated') {
      // Visiteur : la feuille de connexion (équivalent natif de l'AuthGateModal).
      router.push('/login');
      return;
    }
    const next = !favorite;
    setFavoriteOverride(next);
    setFavoritePending(true);
    try {
      await (next ? addTripFavorite(trip.id) : removeTripFavorite(trip.id));
    } catch (err) {
      setFavoriteOverride(!next);
      const code = err instanceof ApiError ? err.code : null;
      Alert.alert(
        code === 'OWN_TRIP'
          ? t('card.favoriteOwnTrip')
          : code === 'TRIP_NOT_FAVORITABLE'
            ? t('card.favoriteNotFavoritable')
            : t('card.favoriteError')
      );
    } finally {
      setFavoritePending(false);
    }
  };

  // Pays localisé pour le visiteur (le texte stocké est figé dans la locale
  // du créateur) — jamais le code brut.
  const fromCountry = countryName(trip.fromCountryCode, locale);
  const toCountry = countryName(trip.toCountryCode, locale);
  const currency = trip.currency ?? '€';
  // La constante intermédiaire porte le narrowing pour TS.
  const perKgPrice = trip.pricePerKg != null && trip.pricePerKg > 0 ? trip.pricePerKg : null;
  const showRemainingAlert = typeof trip.remainingSlots === 'number' && trip.remainingSlots <= 3;
  const categories = trip.allowedCategories ?? [];
  const visibleCategories = categories.slice(0, 2);
  const categoryOverflow = categories.length - visibleCategories.length;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView type="backgroundElement" style={styles.card}>
        {/* ── En-tête : transport + date + alerte + cœur ── */}
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <View style={styles.headerLeft}>
            <View style={[styles.modeChip, { backgroundColor: theme.backgroundSelected }]}>
              <Ionicons name={transportIcon(trip.transportMode)} size={12} color={theme.text} />
              <ThemedText type="small" style={styles.modeLabel}>
                {t(`card.mode.${trip.transportMode}`)}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.date}>
              {trip.travelDate}
            </ThemedText>
          </View>
          <View style={styles.headerRight}>
            {showRemainingAlert && (
              <View style={[styles.alertPill, { backgroundColor: accents.alertBg }]}>
                <Ionicons name="alert-circle" size={9} color={accents.alertText} />
                <ThemedText style={[styles.alertText, { color: accents.alertText }]}>
                  {t('card.remainingSlots', { count: trip.remainingSlots ?? 0 })}
                </ThemedText>
              </View>
            )}
            <Pressable
              onPress={toggleFavorite}
              hitSlop={Spacing.one}
              accessibilityRole="button"
              accessibilityState={{ selected: favorite }}
              accessibilityLabel={favorite ? t('card.favoriteRemove') : t('card.favoriteAdd')}
              style={({ pressed }) => [
                styles.heart,
                { backgroundColor: accents.heartBg, borderColor: accents.heartRing },
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name={favorite ? 'heart' : 'heart-outline'}
                size={16}
                color={favorite ? Brand.mango : theme.textSecondary}
              />
            </Pressable>
          </View>
        </View>

        {/* ── Corps : départ · durée · arrivée · prix ── */}
        <View style={styles.body}>
          {/* Départ — la VILLE d'abord : c'est l'info de décision de
              l'Expéditeur, l'heure est secondaire. */}
          <View style={styles.endpoint}>
            <ThemedText style={styles.city} numberOfLines={1}>
              {trip.fromCity}
            </ThemedText>
            {fromCountry && (
              <ThemedText
                numberOfLines={1}
                style={[styles.country, { color: theme.textSecondary }]}>
                {fromCountry}
              </ThemedText>
            )}
            <ThemedText style={[styles.time, { color: theme.textSecondary }]}>
              {trip.departureTime}
            </ThemedText>
          </View>

          {/* Durée sur le trait : point gris → point mangue, Direct/escales. */}
          <View style={styles.middle}>
            {typeof trip.durationMinutes === 'number' && (
              <ThemedText style={[styles.duration, { color: theme.textSecondary }]}>
                {formatDuration(trip.durationMinutes)}
              </ThemedText>
            )}
            <View style={[styles.line, { backgroundColor: accents.line }]}>
              <View style={[styles.lineDot, styles.lineDotLeft, { backgroundColor: accents.lineDot }]} />
              <View style={[styles.lineDot, styles.lineDotRight, { backgroundColor: Brand.mango }]} />
            </View>
            <ThemedText style={[styles.stops, { color: theme.textSecondary }]}>
              {trip.stopovers && trip.stopovers > 0
                ? t('card.stopovers', { count: trip.stopovers })
                : t('card.direct')}
            </ThemedText>
          </View>

          {/* Arrivée */}
          <View style={[styles.endpoint, styles.endpointRight]}>
            <ThemedText style={styles.city} numberOfLines={1}>
              {trip.toCity}
            </ThemedText>
            {toCountry && (
              <ThemedText
                numberOfLines={1}
                style={[styles.country, { color: theme.textSecondary }]}>
                {toCountry}
              </ThemedText>
            )}
            <View style={styles.arrivalRow}>
              <ThemedText style={[styles.time, { color: theme.textSecondary }]}>
                {trip.arrivalTime ?? ''}
              </ThemedText>
              {trip.arrivalTime != null && trip.nextDay === true && (
                <View style={[styles.nextDay, { backgroundColor: accents.nextDayBg }]}>
                  <ThemedText style={[styles.nextDayText, { color: accents.nextDayText }]}>
                    +1
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* Prix — PER_KG (D13) ou legacy « dès ». Seul élément en 18. */}
          <View style={styles.priceBlock}>
            {perKgPrice !== null ? (
              <>
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                  {t('card.perKgLabel')}
                </ThemedText>
                <ThemedText style={styles.price}>
                  {formatTwoDecimals(perKgPrice, locale)}
                  {currency}
                  <ThemedText style={[styles.priceUnit, { color: theme.textSecondary }]}>
                    /kg
                  </ThemedText>
                </ThemedText>
                {trip.remainingKg != null && (
                  <ThemedText style={[styles.remainingKg, { color: theme.tint }]}>
                    {t('card.remainingKg', { kg: trip.remainingKg })}
                  </ThemedText>
                )}
              </>
            ) : (
              <>
                <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                  {t('card.fromPrice')}
                </ThemedText>
                <ThemedText style={styles.price}>
                  {trip.minPrice}
                  {currency}
                </ThemedText>
              </>
            )}
          </View>
        </View>

        {/* ── Pied : Voyageur + signaux + catégories + chevron ── */}
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.backgroundSelected, backgroundColor: accents.footerBg },
          ]}>
          <View style={styles.traveler}>
            <TravelerAvatar trip={trip} dark={dark} />
            <View style={styles.travelerTexts}>
              <ThemedText style={styles.travelerName} numberOfLines={1}>
                {trip.travelerFirstName}
                {trip.travelerLastName ? ` ${trip.travelerLastName.charAt(0)}.` : ''}
              </ThemedText>
              {typeof trip.rating === 'number' ? (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={styles.travelerMeta}>
                  <ThemedText style={[styles.star, { color: Brand.mango }]}>★</ThemedText>{' '}
                  {formatRating(trip.rating, locale)}
                  {typeof trip.reviewCount === 'number' ? ` (${trip.reviewCount})` : ''}
                </ThemedText>
              ) : (
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  numberOfLines={1}
                  style={styles.travelerMeta}>
                  {t('card.newTripper')}
                </ThemedText>
              )}
            </View>
          </View>

          <View style={styles.footerRight}>
            {/* D5 / C-PR6 — pastille « n vues », « Populaire » à partir de 20. */}
            {typeof trip.viewsCount === 'number' && trip.viewsCount > 0 && (
              <View
                style={[
                  styles.viewsPill,
                  { backgroundColor: isPopular(trip.viewsCount) ? accents.popularBg : accents.viewsBg },
                ]}>
                <Ionicons
                  name="eye-outline"
                  size={10}
                  color={isPopular(trip.viewsCount) ? accents.popularText : accents.viewsText}
                />
                <ThemedText
                  style={[
                    styles.viewsText,
                    { color: isPopular(trip.viewsCount) ? accents.popularText : accents.viewsText },
                  ]}>
                  {isPopular(trip.viewsCount) ? t('card.popular') : trip.viewsCount}
                </ThemedText>
              </View>
            )}
            {visibleCategories.map((cat) => (
              <View key={cat} style={[styles.categoryCircle, { backgroundColor: accents.viewsBg }]}>
                <Ionicons name={categoryIcon(cat)} size={11} color={accents.categoryIcon} />
              </View>
            ))}
            {categoryOverflow > 0 && (
              <ThemedText style={[styles.categoryOverflow, { color: theme.textSecondary }]}>
                +{categoryOverflow}
              </ThemedText>
            )}
            <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
          </View>
        </View>
      </ThemedView>
    </Pressable>
  );
}

/** Avatar : photo, sinon initiales sur fond orange ; anneau mangue plein pour
 *  un superTripper (le dégradé conique du web n'existe pas en natif sans lib). */
function TravelerAvatar({ trip, dark }: { trip: TripSearchResult; dark: boolean }) {
  const accents = dark ? Accents.dark : Accents.light;
  const avatar = trip.travelerAvatarUrl ? (
    <Image source={{ uri: trip.travelerAvatarUrl }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: accents.avatarBg }]}>
      <ThemedText style={[styles.avatarInitials, { color: accents.avatarText }]}>
        {getInitials(trip.travelerFirstName ?? '', trip.travelerLastName?.charAt(0) ?? '')}
      </ThemedText>
    </View>
  );
  if (trip.superTripper !== true) return avatar;
  return <View style={styles.superRing}>{avatar}</View>;
}

// ── Aides ────────────────────────────────────────────────────────────────

function transportIcon(mode: TripSearchResult['transportMode']) {
  if (mode === 'plane') return 'airplane-outline' as const;
  if (mode === 'train') return 'train-outline' as const;
  return 'car-outline' as const;
}

function categoryIcon(cat: SearchParcelCategory) {
  switch (cat) {
    case 'clothes':
      return 'shirt-outline' as const;
    case 'documents':
      return 'document-text-outline' as const;
    case 'books':
      return 'book-outline' as const;
    default:
      return 'cube-outline' as const;
  }
}

/** « 7 h », « 6 h 30 » — même forme que la carte web (formatDuration). */
function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** « 10,00 » / "10.00" — deux décimales, virgule en français (miroir web). */
function formatTwoDecimals(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Hermes sans données Intl : chiffre lisible, jamais un crash.
    return value.toFixed(2);
  }
}

/** « 4,8 » en français, "4.8" ailleurs. */
function formatRating(rating: number, locale: string): string {
  const fixed = rating.toFixed(1);
  return locale === 'fr' ? fixed.replace('.', ',') : fixed;
}

/** Accents hors jetons de thème — mêmes valeurs que les classes de la carte
 *  web (slate / red / orange Tailwind, mangue #FF9900). */
const Accents = {
  light: {
    alertBg: '#FEF2F2',
    alertText: '#B91C1C',
    nextDayBg: '#FFEDD5',
    nextDayText: '#9A3412',
    avatarBg: '#FFEDD5',
    avatarText: '#C2410C',
    popularBg: '#FFF6E8',
    popularText: '#B45309',
    viewsBg: '#E8EAEE',
    viewsText: '#475569',
    categoryIcon: '#64748B',
    line: '#D8DCE2',
    lineDot: '#94A3B8',
    heartBg: 'rgba(255,255,255,0.9)',
    heartRing: '#E2E8F0',
    footerBg: 'rgba(248,250,252,0.4)',
  },
  dark: {
    alertBg: 'rgba(69,10,10,0.4)',
    alertText: '#F87171',
    nextDayBg: 'rgba(255,153,0,0.2)',
    nextDayText: '#FFB84D',
    avatarBg: 'rgba(124,45,18,0.4)',
    avatarText: '#FDBA74',
    popularBg: 'rgba(255,153,0,0.15)',
    popularText: '#FFB84D',
    viewsBg: '#2E3135',
    viewsText: '#CBD5E1',
    categoryIcon: '#94A3B8',
    line: '#3A3F45',
    lineDot: '#94A3B8',
    heartBg: 'rgba(15,23,42,0.9)',
    heartRing: '#334155',
    footerBg: 'rgba(2,6,23,0.35)',
  },
} as const;

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexShrink: 1,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  modeLabel: {
    fontSize: 12,
  },
  date: {
    fontSize: 12,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  alertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  alertText: {
    fontSize: 11,
    lineHeight: 14,
  },
  heart: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  endpoint: {
    flex: 1,
    gap: 2,
  },
  endpointRight: {
    alignItems: 'flex-end',
  },
  city: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: 600,
  },
  country: {
    fontSize: 10,
    lineHeight: 13,
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
  },
  arrivalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
  },
  nextDay: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  nextDayText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: 500,
  },
  middle: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 4,
    gap: 4,
  },
  duration: {
    fontSize: 10,
    lineHeight: 13,
  },
  line: {
    alignSelf: 'stretch',
    height: 1,
    marginHorizontal: 6,
  },
  lineDot: {
    position: 'absolute',
    top: -1.5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  lineDotLeft: {
    left: 0,
  },
  lineDotRight: {
    right: 0,
  },
  stops: {
    fontSize: 9,
    lineHeight: 12,
  },
  priceBlock: {
    minWidth: 50,
    alignItems: 'flex-end',
    gap: 2,
  },
  priceLabel: {
    fontSize: 9,
    lineHeight: 11,
  },
  price: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: 600,
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: 500,
  },
  remainingKg: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: 500,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
  },
  traveler: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
    minWidth: 0,
  },
  travelerTexts: {
    flex: 1,
    gap: 1,
  },
  travelerName: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: 600,
  },
  travelerMeta: {
    fontSize: 11,
    lineHeight: 14,
  },
  star: {
    fontSize: 11,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: 600,
  },
  superRing: {
    padding: 1.5,
    borderRadius: 16,
    backgroundColor: Brand.mango,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewsText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: 600,
  },
  categoryCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryOverflow: {
    fontSize: 10,
    fontWeight: 600,
    paddingHorizontal: 2,
  },
  pressed: {
    opacity: 0.7,
  },
});

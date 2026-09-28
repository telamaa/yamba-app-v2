/**
 * trip-result-card.tsx — une carte de résultat de recherche (lot résultats).
 * ==========================================================================
 * Design ÉPURÉ « V2 drapeaux », validé sur maquette le 28/09 au soir
 * (`context/captures/proposition-carte-epuree.png`) — supersède la
 * transposition littérale de la carte web (trop chargée : 11 éléments) :
 * — en-tête : pastille transport · date · alerte places (≤ 3) · CŒUR (D46) ;
 * — la ROUTE en pleine largeur, en gras : « 🇫🇷 Paris → 🇨🇬 Brazzaville » —
 *   le pays devient un DRAPEAU (zéro ligne consommée, lève Congo/RDC), les
 *   villes longues passent à la ligne, jamais tronquées ;
 * — UNE ligne d'horaires : « 01:51 → 07:51⁺¹ · 7 h · Direct » ;
 * — le prix seul à droite, sans libellé (« /kg » suffit), les kg dispo en
 *   teal dessous (info de décision, gardée sur demande) ;
 * — pied : avatar (photo/initiales, anneau mangue superTripper), « Prénom N.
 *   · ★ 4,8 (12) » ou « Nouveau Voyageur », badge vues (« Populaire » à 20,
 *   D5/C-PR6), chevron. Les mini-catégories vivent sur la fiche.
 * Que du VRAI (RG-MOB-1) : tout vient du DTO serveur. Le cœur bascule en
 * OPTIMISTE puis l'API tranche ; visiteur → feuille de connexion. La carte
 * OUVRE la fiche (`/trip/[id]`), vue comptée par le serveur.
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
import type { TripSearchResult } from '@/lib/api/search.api';
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

  const fromFlag = flagEmoji(trip.fromCountryCode);
  const toFlag = flagEmoji(trip.toCountryCode);
  // Les drapeaux sont muets pour VoiceOver : la route parlée nomme les pays.
  const routeLabel = [
    countryName(trip.fromCountryCode, locale),
    trip.fromCity,
    '→',
    countryName(trip.toCountryCode, locale),
    trip.toCity,
  ]
    .filter(Boolean)
    .join(' ');

  const currency = trip.currency ?? '€';
  // La constante intermédiaire porte le narrowing pour TS.
  const perKgPrice = trip.pricePerKg != null && trip.pricePerKg > 0 ? trip.pricePerKg : null;
  const duration =
    typeof trip.durationMinutes === 'number' ? formatDuration(trip.durationMinutes) : null;
  const showRemainingAlert = typeof trip.remainingSlots === 'number' && trip.remainingSlots <= 3;

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

        {/* ── Corps : route en pleine largeur + prix à droite ── */}
        <View style={styles.body}>
          <View style={styles.routeBlock}>
            <ThemedText style={styles.route} accessibilityLabel={routeLabel}>
              {fromFlag !== null && <ThemedText style={styles.flag}>{fromFlag} </ThemedText>}
              {trip.fromCity}
              <ThemedText style={[styles.route, { color: Brand.mango }]}> → </ThemedText>
              {toFlag !== null && <ThemedText style={styles.flag}>{toFlag} </ThemedText>}
              {trip.toCity}
            </ThemedText>
            <ThemedText style={[styles.meta, { color: theme.textSecondary }]}>
              {trip.departureTime}
              {trip.arrivalTime != null && (
                <>
                  {' → '}
                  {trip.arrivalTime}
                  {trip.nextDay === true && (
                    <ThemedText style={[styles.plusOne, { color: accents.plusOne }]}>
                      {' '}
                      +1
                    </ThemedText>
                  )}
                </>
              )}
              {duration !== null ? ` · ${duration}` : ''}
              {' · '}
              {trip.stopovers && trip.stopovers > 0
                ? t('card.stopovers', { count: trip.stopovers })
                : t('card.direct')}
            </ThemedText>
          </View>

          {/* Prix — PER_KG (D13) ou legacy « dès ». Seul élément en 18. */}
          <View style={styles.priceBlock}>
            {perKgPrice !== null ? (
              <>
                <ThemedText style={styles.price}>
                  {formatTwoDecimals(perKgPrice, locale)} {currency}
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
                <ThemedText style={[styles.fromLabel, { color: theme.textSecondary }]}>
                  {t('card.fromPrice')}
                </ThemedText>
                <ThemedText style={styles.price}>
                  {trip.minPrice} {currency}
                </ThemedText>
              </>
            )}
          </View>
        </View>

        {/* ── Pied : Voyageur + vues + chevron ── */}
        <View
          style={[
            styles.footer,
            { borderTopColor: theme.backgroundSelected, backgroundColor: accents.footerBg },
          ]}>
          <TravelerAvatar trip={trip} dark={dark} />
          <ThemedText style={styles.travelerName} numberOfLines={1}>
            {trip.travelerFirstName}
            {trip.travelerLastName ? ` ${trip.travelerLastName.charAt(0)}.` : ''}
            <ThemedText style={[styles.travelerMeta, { color: theme.textSecondary }]}> · </ThemedText>
            {typeof trip.rating === 'number' ? (
              <>
                <ThemedText style={[styles.travelerMeta, { color: Brand.mango }]}>★</ThemedText>
                <ThemedText style={[styles.travelerMeta, { color: theme.textSecondary }]}>
                  {' '}
                  {formatRating(trip.rating, locale)}
                  {typeof trip.reviewCount === 'number' ? ` (${trip.reviewCount})` : ''}
                </ThemedText>
              </>
            ) : (
              <ThemedText style={[styles.travelerMeta, { color: theme.textSecondary }]}>
                {t('card.newTripper')}
              </ThemedText>
            )}
          </ThemedText>

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

/** Code ISO 3166-1 alpha-2 → drapeau émoji (indicateurs régionaux). */
function flagEmoji(code: string | null | undefined): string | null {
  if (!code || code.length !== 2) return null;
  const upper = code.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

/** « 7 h », « 9 h 35 » — même forme que la carte web (formatDuration). */
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

/** Accents hors jetons de thème — mêmes valeurs que la maquette validée
 *  (slate / red / orange Tailwind, mangue #FF9900). */
const Accents = {
  light: {
    alertBg: '#FEF2F2',
    alertText: '#B91C1C',
    plusOne: '#9A3412',
    avatarBg: '#FFEDD5',
    avatarText: '#C2410C',
    popularBg: '#FFF6E8',
    popularText: '#B45309',
    viewsBg: '#E8EAEE',
    viewsText: '#475569',
    heartBg: 'rgba(255,255,255,0.9)',
    heartRing: '#E2E8F0',
    footerBg: 'rgba(248,250,252,0.4)',
  },
  dark: {
    alertBg: 'rgba(69,10,10,0.4)',
    alertText: '#F87171',
    plusOne: '#FFB84D',
    avatarBg: 'rgba(124,45,18,0.4)',
    avatarText: '#FDBA74',
    popularBg: 'rgba(255,153,0,0.15)',
    popularText: '#FFB84D',
    viewsBg: '#2E3135',
    viewsText: '#CBD5E1',
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
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  routeBlock: {
    flex: 1,
    minWidth: 0,
  },
  route: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: 600,
    letterSpacing: -0.2,
  },
  flag: {
    fontSize: 14,
    lineHeight: 21,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  plusOne: {
    fontSize: 10,
    lineHeight: 18,
    fontWeight: 600,
  },
  priceBlock: {
    alignItems: 'flex-end',
    gap: 2,
    flexShrink: 0,
  },
  fromLabel: {
    fontSize: 11,
    lineHeight: 13,
  },
  price: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: 700,
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: 500,
  },
  remainingKg: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: 500,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: Spacing.two,
  },
  travelerName: {
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: 600,
  },
  travelerMeta: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: 500,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    borderRadius: 15,
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
  pressed: {
    opacity: 0.7,
  },
});

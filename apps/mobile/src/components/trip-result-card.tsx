/**
 * trip-result-card.tsx — une carte de résultat de recherche (lot résultats).
 * ==========================================================================
 * Référence SNCF Connect (capture du 28/09) : la colonne des horaires à
 * gauche (départ, durée, arrivée) le long d'une timeline pointillée, les
 * villes EN ENTIER à côté (revue sur captures — jamais de « Bruxel… »), le
 * prix en évidence à droite, et un PIED séparé par un filet : le contexte
 * (mode · date) à gauche, le Voyageur (avatar, prénom, note) à droite.
 * Que du VRAI, comme avant : tout vient du DTO serveur (RG-MOB-1) — date déjà
 * localisée, prix en euros, durée en minutes. La carte OUVRE la fiche
 * (`/trip/[id]`), où la vue est comptée par le serveur, comme sur le web.
 */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { TripSearchResult } from '@/lib/api/search.api';
import { countryName } from '@/lib/country-name';
import { formatMinutesDuration } from '@/lib/trip-format';

export function TripResultCard({ trip }: { trip: TripSearchResult }) {
  const t = useTranslations('search');
  const locale = useLocale();
  const theme = useTheme();
  // Pays localisé pour le visiteur, comme sur le web (le corridor est souvent
  // international — « Brazzaville » seul ne dit pas Congo ou RDC).
  const fromCountry = countryName(trip.fromCountryCode, locale);
  const toCountry = countryName(trip.toCountryCode, locale);
  const currency = trip.currency ?? '€';
  // La constante intermédiaire porte le narrowing : `perKg && trip.pricePerKg`
  // ne suffit pas à TS dans l'appel de traduction.
  const perKgPrice = trip.pricePerKg != null && trip.pricePerKg > 0 ? trip.pricePerKg : null;
  const duration =
    trip.durationMinutes != null ? formatMinutesDuration(trip.durationMinutes) : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.body}>
          <View style={styles.journey}>
            {/* Départ */}
            <View style={styles.leg}>
              <ThemedText style={styles.time}>{trip.departureTime}</ThemedText>
              <View style={styles.glyph}>
                <View style={[styles.ring, { borderColor: theme.text }]} />
              </View>
              <View style={styles.cityBlock}>
                <ThemedText style={styles.city}>{trip.fromCity}</ThemedText>
                {fromCountry && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {fromCountry}
                  </ThemedText>
                )}
              </View>
            </View>
            {/* Durée le long des pointillés */}
            <View style={styles.legMiddle}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.timeCol}>
                {duration ?? ''}
              </ThemedText>
              <View style={[styles.glyph, styles.dotsColumn]}>
                <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
                <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
                <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
              </View>
            </View>
            {/* Arrivée */}
            <View style={styles.leg}>
              <ThemedText style={styles.time}>
                {trip.arrivalTime ?? ''}
                {trip.arrivalTime != null && trip.nextDay === true && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {' '}
                    +1
                  </ThemedText>
                )}
              </ThemedText>
              <View style={styles.glyph}>
                <View style={[styles.ring, { borderColor: theme.text }]} />
              </View>
              <View style={styles.cityBlock}>
                <ThemedText style={styles.city}>{trip.toCity}</ThemedText>
                {toCountry && (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {toCountry}
                  </ThemedText>
                )}
              </View>
            </View>
          </View>

          {/* Le prix, en évidence à droite (réf.) : exact pour le moteur au
              kilo (avec le restant dessous), « À partir de » pour le legacy. */}
          <View style={styles.priceBlock}>
            {perKgPrice !== null ? (
              <>
                <ThemedText style={styles.price}>
                  {t('card.perKg', { price: perKgPrice, currency })}
                </ThemedText>
                {trip.remainingKg != null && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('card.remainingKg', { kg: trip.remainingKg })}
                  </ThemedText>
                )}
              </>
            ) : (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('card.fromLabel')}
                </ThemedText>
                <ThemedText style={styles.price}>
                  {t('card.price', { price: trip.minPrice, currency })}
                </ThemedText>
              </>
            )}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

        <View style={styles.footer}>
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={1}
            style={styles.footerContext}>
            {t(`card.mode.${trip.transportMode}`)} · {trip.travelDate}
          </ThemedText>
          {trip.travelerFirstName && (
            <View style={styles.traveler}>
              {trip.travelerAvatarUrl && (
                <Image source={{ uri: trip.travelerAvatarUrl }} style={styles.avatar} />
              )}
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {trip.travelerFirstName}
                {trip.rating != null &&
                  ` · ${t('card.rating', { rating: trip.rating, count: trip.reviewCount ?? 0 })}`}
              </ThemedText>
            </View>
          )}
        </View>
      </ThemedView>
    </Pressable>
  );
}

// Largeur commune de la colonne horaires : départ, durée et arrivée ALIGNÉS
// (chiffres tabulaires — sans eux, « 07:27 » et « 10:04 » ne tombent pas
// l'un sous l'autre).
const TIME_COL = 56;

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  body: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  journey: {
    flex: 1,
    gap: 2,
  },
  leg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  legMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 16,
  },
  time: {
    width: TIME_COL,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: 600,
    fontVariant: ['tabular-nums'],
  },
  timeCol: {
    width: TIME_COL,
  },
  glyph: {
    width: 12,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  dotsColumn: {
    height: 16,
    gap: 3,
  },
  dot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
  },
  cityBlock: {
    flex: 1,
  },
  city: {
    fontSize: 15,
    lineHeight: 20,
  },
  priceBlock: {
    alignItems: 'flex-end',
    gap: 1,
  },
  price: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: 700,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.two,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  footerContext: {
    flexShrink: 1,
  },
  traveler: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  pressed: {
    opacity: 0.7,
  },
});

/**
 * trip-result-card.tsx — une carte de résultat de recherche (lot recherche).
 * ==========================================================================
 * Que du VRAI : villes, date localisée par le serveur, horaires, prix (€/kg
 * pour le moteur PER_KG avec les kilos restants, « dès X € » pour le legacy —
 * les mots de la carte web), Voyageur et sa note quand elle existe. Depuis le
 * lot page trajet, la carte OUVRE la fiche (`/trip/[id]`) — la vue y est
 * comptée par le serveur, comme sur le web.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { TripSearchResult } from '@/lib/api/search.api';

export function TripResultCard({ trip }: { trip: TripSearchResult }) {
  const t = useTranslations('search');
  const currency = trip.currency ?? '€';
  // La constante intermédiaire porte le narrowing : `perKg && trip.pricePerKg`
  // ne suffit pas à TS dans l'appel de traduction.
  const perKgPrice = trip.pricePerKg != null && trip.pricePerKg > 0 ? trip.pricePerKg : null;
  const perKg = perKgPrice !== null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
      <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.route} numberOfLines={1}>
          {trip.fromCity} → {trip.toCity}
        </ThemedText>
        <ThemedText type="smallBold">
          {perKgPrice !== null
            ? t('card.perKg', { price: perKgPrice, currency })
            : t('card.fromPrice', { price: trip.minPrice, currency })}
        </ThemedText>
      </View>

      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.route} numberOfLines={1}>
          {trip.travelDate} · {trip.departureTime}
          {trip.arrivalTime ? ` – ${trip.arrivalTime}${trip.nextDay ? ' (+1)' : ''}` : ''}
        </ThemedText>
        {perKg && trip.remainingKg != null && (
          <ThemedText type="small" themeColor="textSecondary">
            {t('card.remainingKg', { kg: trip.remainingKg })}
          </ThemedText>
        )}
      </View>

      {trip.travelerFirstName && (
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {trip.travelerFirstName}
          {trip.rating != null &&
            ` · ${t('card.rating', { rating: trip.rating, count: trip.reviewCount ?? 0 })}`}
        </ThemedText>
      )}
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  route: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});

/**
 * booking/confirmation.tsx — LA DEMANDE EST PARTIE (fin de l'étape ⑦, A218).
 * ===========================================================================
 * Le site, lui, redirige vers le suivi du deal (`/bookings/:id`). Ce suivi
 * EXISTE maintenant en natif (`shipment/[id]`) : le geste principal l'ouvre.
 * L'écran garde pourtant tout ce qu'il disait — ce qui a été autorisé, jusqu'à
 * quand, et ce qui arrive ensuite — parce qu'il reste le seul endroit où ces
 * trois faits sont lisibles à la seconde où l'on a payé, sans un aller-retour
 * réseau. Il INVITE au suivi, il ne s'y substitue plus.
 *
 * Il n'appartient plus au tunnel : pas de barre de prix, pas de jauge, pas de
 * retour en arrière. L'écran de paiement l'ouvre après avoir dépilé le
 * parcours (`dismissAll` + `replace`) : revenir en arrière depuis ici sort de
 * la réservation, il ne ramène jamais sur une carte déjà autorisée.
 *
 * Tout vient des PARAMÈTRES d'URL, pas d'un rechargement : la réponse de
 * `POST /deals` est la seule source qui fasse foi à cet instant, et le
 * brouillon vient d'être effacé.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLocalTime, formatLongDate, formatPrice } from '@/lib/trip-format';

const NEXT_KEYS = ['step1', 'step2', 'step3'] as const;

export default function BookingConfirmationScreen() {
  const { bookingId, expiresAt, totalCents, currencyCode, carrier } = useLocalSearchParams<{
    bookingId?: string;
    expiresAt?: string;
    totalCents?: string;
    currencyCode?: string;
    carrier?: string;
  }>();
  const t = useTranslations('booking');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();

  const amount = totalCents ? formatPrice(Number(totalCents), currencyCode ?? 'EUR', locale) : null;
  const day = formatLongDate(expiresAt ?? null, locale);
  const time = formatLocalTime(expiresAt ?? null, null);
  const deadline = day ? [day, time].filter(Boolean).join(' · ') : null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.badge, { backgroundColor: `${Brand.teal}1A` }]}>
            <Ionicons name="checkmark" size={30} color={Brand.teal} />
          </View>

          <ThemedText type="title" style={styles.centeredText}>
            {t('confirmation.title')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
            {t('confirmation.subtitle', { name: carrier ?? '' })}
          </ThemedText>

          <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
            {amount ? (
              <View style={styles.line}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {t('confirmation.amount')}
                </ThemedText>
                <ThemedText type="smallBold">{amount}</ThemedText>
              </View>
            ) : null}
            {deadline ? (
              <View style={styles.line}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {t('confirmation.deadline')}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.alignEnd}>
                  {deadline}
                </ThemedText>
              </View>
            ) : null}
            {bookingId ? (
              <View style={styles.line}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {t('confirmation.reference')}
                </ThemedText>
                {/* Les 6 derniers caractères suffisent à se repérer et à citer
                    la demande au support : l'identifiant entier ne se lit pas. */}
                <ThemedText type="smallBold">{bookingId.slice(-6).toUpperCase()}</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{t('confirmation.nextTitle')}</ThemedText>
            {NEXT_KEYS.map((key, index) => (
              <View key={key} style={styles.bullet}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {index + 1}.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                  {t(`confirmation.next.${key}`)}
                </ThemedText>
              </View>
            ))}
          </View>

          {/* Ce que personne ne pense à demander mais que tout le monde se
              demande : « et s'il dit non ? » */}
          <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t('confirmation.refused')}
            </ThemedText>
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            // La fiche en REMPLACEMENT : revenir en arrière depuis le suivi
            // ne doit jamais ramener sur cet écran-ci, encore moins sur une
            // carte déjà autorisée. Sans identifiant (cas qui ne devrait pas
            // arriver), on rend l'activité plutôt qu'une route creuse.
            onPress={() =>
              bookingId
                ? router.replace({ pathname: '/shipment/[id]', params: { id: bookingId } })
                : router.replace('/(tabs)/activity')
            }
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={styles.ctaLabel}>
              {t('confirmation.cta')}
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/(tabs)')}
            style={styles.secondary}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('confirmation.secondary')}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  content: { padding: Spacing.five, gap: Spacing.four, alignItems: 'stretch' },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  centeredText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  alignEnd: { textAlign: 'right' },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  bullet: { flexDirection: 'row', gap: Spacing.two },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, borderRadius: 12, padding: Spacing.three },
  actions: { paddingHorizontal: Spacing.five, paddingBottom: Spacing.three, gap: Spacing.two },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  ctaLabel: { color: '#FFFFFF' },
  secondary: { alignItems: 'center', paddingVertical: Spacing.two },
});

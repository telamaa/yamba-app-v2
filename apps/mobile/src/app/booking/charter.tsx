/**
 * booking/charter.tsx — TON ENGAGEMENT (étape ⑥, A217).
 * ======================================================
 * Le dernier écran avant l'argent. Trois blocs, dans cet ordre :
 *   1. ce qui se passera À LA REMISE — pas une politesse : c'est ce qui évite
 *      le refus du Voyageur, donc un trajet perdu ;
 *   2. la CHARTE EXPÉDITEUR, ce que l'Expéditeur déclare sur l'honneur ;
 *   3. l'acceptation, en UNE case dont le libellé NOMME les trois documents.
 *
 * Pourquoi « À la remise » n'est PAS replié ici, alors que les autres blocs
 * informatifs du tunnel le sont : il ne décrit pas une mécanique, il annonce un
 * RISQUE (le Voyageur peut refuser, le trajet est perdu). Replier un
 * avertissement revient à ne pas avertir.
 *
 * Une seule case pour trois documents est une pratique valide DÈS LORS que son
 * libellé les nomme — c'est le cas ici. Ce qui l'est moins, c'est que le
 * brouillon porte DEUX booléens (`charterAccepted`, `termsAccepted`) remplis par
 * le même geste : la donnée affirme deux consentements là où il n'y en a eu
 * qu'un. Signalé au registre, pas corrigé ici (le snapshot serveur en dépend).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BookingStepFrame } from '@/components/booking/booking-step-frame';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentPricingParams, loadPricingParams } from '@/lib/api/pricing.api';
import { getPublicTrip, type PublicTrip } from '@/lib/api/trip.api';
import { setBookingDraft, useBookingDraft } from '@/lib/booking-draft';
import { quoteDraft } from '@/lib/booking-rules';
import { formatPrice } from '@/lib/trip-format';

const HANDOVER_KEYS = ['visualInspection', 'refusalPossible', 'crossPhotos'] as const;
const DECLARATION_KEYS = ['noIllicit', 'matchDeclared', 'customsCompliant'] as const;

export default function BookingCharterScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const t = useTranslations('booking');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const draft = useBookingDraft();

  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [failed, setFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [params, setParams] = useState(currentPricingParams);

  useEffect(() => {
    let alive = true;
    if (!tripId) {
      setFailed(true);
      return;
    }
    void getPublicTrip(tripId)
      .then((loaded) => {
        if (alive) setTrip(loaded);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    void loadPricingParams().then((p) => {
      if (alive) setParams(() => p);
    });
    return () => {
      alive = false;
    };
  }, [tripId]);

  const accepted = draft.charterAccepted && draft.termsAccepted;

  const onContinue = useCallback(() => {
    if (!accepted) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    router.push({ pathname: '/booking/payment', params: { tripId: tripId ?? '' } });
  }, [accepted, tripId]);

  if (failed) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{t('unavailable.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
          {t('unavailable.body')}
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={() => router.back()}>
          <ThemedText type="smallBold">{t('unavailable.cta')}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  if (!trip) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator color={Brand.mango} />
      </ThemedView>
    );
  }

  const quote = quoteDraft(draft, trip, params);

  return (
    <BookingStepFrame
      title={t('charter.title')}
      subtitle={t('charter.subtitle')}
      step={6}
      priceLabel={
        quote.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null
      }
      priceHint={quote.ok === true ? t('bar.allIn') : t('bar.quoteError.GENERIC')}
      ctaLabel={t('charter.cta')}
      onContinueAction={onContinue}>
      {/* 1. CE QUI SE PASSERA À LA REMISE — un avertissement, donc jamais replié. */}
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <View style={styles.cardHeader}>
          <Ionicons name="eye-outline" size={16} color={Brand.teal} />
          <ThemedText type="smallBold" style={styles.flex}>
            {t('charter.handover.title')}
          </ThemedText>
        </View>
        {HANDOVER_KEYS.map((key) => (
          <View key={key} style={styles.bullet}>
            <ThemedText type="small" themeColor="textSecondary">
              •
            </ThemedText>
            <View style={styles.flex}>
              <ThemedText type="smallBold">{t(`charter.handover.${key}Lead`)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(`charter.handover.${key}`)}
              </ThemedText>
            </View>
          </View>
        ))}
      </View>

      {/* 2. LA CHARTE — ce qu'on déclare sur l'honneur. Teintée mangue : c'est
          le seul bloc du tunnel qui engage juridiquement. */}
      <View style={[styles.card, styles.charterCard]}>
        <View style={styles.cardHeader}>
          <Ionicons name="shield-checkmark-outline" size={16} color={Brand.mangoDark} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{t('charter.pledge.title')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('charter.pledge.subtitle')}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small">{t('charter.pledge.intro')}</ThemedText>
        {DECLARATION_KEYS.map((key) => (
          <View key={key} style={styles.bullet}>
            <ThemedText type="small">•</ThemedText>
            <ThemedText type="small" style={styles.flex}>
              {t(`charter.pledge.${key}`)}
            </ThemedText>
          </View>
        ))}
        <ThemedText type="small" themeColor="textSecondary">
          {t('charter.pledge.disclaimer')}
        </ThemedText>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(t('charter.pledge.fullUrl'))}
          style={styles.link}>
          <ThemedText type="small" style={{ color: Brand.mangoDark }}>
            {t('charter.pledge.fullLink')}
          </ThemedText>
          <Ionicons name="arrow-forward" size={14} color={Brand.mangoDark} />
        </Pressable>
      </View>

      {/* 3. L'ACCEPTATION — une case dont le libellé NOMME les trois documents. */}
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={() => setBookingDraft({ charterAccepted: !accepted, termsAccepted: !accepted })}
        style={[styles.card, styles.acceptRow, { borderColor: accepted ? Brand.mango : theme.backgroundElement }]}>
        <View
          style={[
            styles.checkbox,
            {
              borderColor: accepted ? Brand.mango : theme.textSecondary,
              backgroundColor: accepted ? Brand.mango : 'transparent',
            },
          ]}>
          {accepted ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </View>
        <ThemedText type="small" style={styles.flex}>
          {t('charter.accept.label')}
        </ThemedText>
      </Pressable>

      {showErrors && !accepted ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
          <ThemedText type="small" style={{ color: Brand.mango }}>
            {t('charter.accept.error')}
          </ThemedText>
        </View>
      ) : null}
    </BookingStepFrame>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  charterCard: { borderColor: `${Brand.mango}55`, backgroundColor: `${Brand.mango}0D` },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  bullet: { flexDirection: 'row', gap: Spacing.two },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  acceptRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});

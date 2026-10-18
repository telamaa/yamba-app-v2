/**
 * booking/protection.tsx — LA VALEUR ET LA PROTECTION (étape ②, A217).
 * =====================================================================
 * L'ordre de cet écran EST la décision d'A217 : la valeur d'abord, la
 * protection ensuite. La valeur déclarée fixe le plafond d'indemnisation que
 * la garantie utilise — poser le choix à +6 € avant le montant qu'il couvre,
 * c'est le faire prendre à l'aveugle.
 *
 * GAR-04 — la prime et la commission ne se mélangent JAMAIS : la ligne de
 * garantie vit à part dans le total, et rien ici ne parle de « frais ».
 * GAR-05 — les exclusions sont PRÉSENTÉES avant le choix : choisir la Garantie
 * les ouvre d'office. Un lien à cliquer ne présente rien.
 * ANO-WEB-33 — le mot « assurance » ne s'affiche nulle part : c'est une garantie.
 *
 * Le plafond et la prime viennent du MOTEUR (paramètres D62), jamais des
 * traductions : un administrateur qui change un curseur faisait mentir la page.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BookingStepFrame } from '@/components/booking/booking-step-frame';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentPricingParams, loadPricingParams } from '@/lib/api/pricing.api';
import { getPublicTrip, type PublicTrip } from '@/lib/api/trip.api';
import { setBookingDraft, useBookingDraft, type ProtectionTier } from '@/lib/booking-draft';
import { quoteDraft, validateValueStep } from '@/lib/booking-rules';
import { formatPrice } from '@/lib/trip-format';

export default function BookingProtectionScreen() {
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

  const errors = useMemo(() => validateValueStep(draft), [draft]);

  const onContinue = useCallback(() => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    router.push({ pathname: '/booking/content', params: { tripId: trip?.id ?? '' } });
  }, [errors, trip?.id]);

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
  const cap = formatPrice(params.protectionExtendedCapCents, trip.currencyCode, locale);
  const premium = formatPrice(params.protectionExtendedPremiumCents, trip.currencyCode, locale);
  const extendedChosen = draft.protection === 'EXTENDED_500';

  return (
    <BookingStepFrame
      title={t('protection.title')}
      subtitle={t('protection.subtitle')}
      step={2}
      priceLabel={
        quote.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null
      }
      priceHint={quote.ok === true ? t('bar.allIn') : t('bar.quoteError.GENERIC')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      {/* LA VALEUR — d'abord, parce qu'elle fixe le plafond ci-dessous. */}
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <View style={styles.rowTexts}>
            <ThemedText type="smallBold">{t('protection.valueLabel')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('protection.valueHint')}
            </ThemedText>
          </View>
          <View style={styles.amount}>
            <TextInput
              value={draft.declaredValueEur}
              onChangeText={(declaredValueEur) => setBookingDraft({ declaredValueEur })}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={6}
              placeholder="150"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t('protection.valueLabel')}
              style={[styles.amountInput, { color: theme.text }]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              €
            </ThemedText>
          </View>
        </View>
      </View>
      {showErrors && errors.declaredValueEur ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
          <ThemedText type="small" style={{ color: Brand.mango }}>
            {t(`protection.errors.${errors.declaredValueEur}`)}
          </ThemedText>
        </View>
      ) : null}

      {/* LA PROTECTION — deux lignes, la pastille à droite, le prix au bout. */}
      <ThemedText type="subtitle">{t('protection.cardTitle')}</ThemedText>
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <TierRow
          tier="BASIC"
          title={t('protection.basic.title')}
          description={t('protection.basic.description')}
          price={t('protection.basic.price')}
        />
        <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
        <TierRow
          tier="EXTENDED_500"
          title={t('protection.extended.title', { cap })}
          description={t('protection.extended.description', { cap })}
          price={t('protection.extended.price', { amount: premium })}
        />
        {/* GAR-05 — choisir la Garantie OUVRE les exclusions. Un lien à cliquer
            ne « présente » rien : ce qui n'est pas couvert doit se lire AVANT
            que le choix soit acquis. */}
        {extendedChosen ? (
          <>
            <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
            <View style={styles.exclusions}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {t('protection.extended.exclusionsTitle')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('protection.extended.exclusionsText')}
              </ThemedText>
            </View>
          </>
        ) : null}
      </View>
    </BookingStepFrame>
  );

  function TierRow({
    tier,
    title,
    description,
    price,
  }: {
    tier: ProtectionTier;
    title: string;
    description: string;
    price: string;
  }) {
    const active = draft.protection === tier;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        accessibilityLabel={[title, description, price].join(' ')}
        onPress={() => setBookingDraft({ protection: tier })}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={styles.rowTexts}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {price}
        </ThemedText>
        <View style={[styles.radio, { borderColor: active ? Brand.mango : theme.textSecondary }]}>
          {active ? <View style={[styles.radioDot, { backgroundColor: Brand.mango }]} /> : null}
        </View>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  rowTexts: { flex: 1, minWidth: 0, gap: 2 },
  hairline: { height: StyleSheet.hairlineWidth },
  amount: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  amountInput: { minWidth: 56, fontSize: 17, fontWeight: '700', textAlign: 'right', paddingVertical: 0 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  exclusions: { paddingVertical: Spacing.four, gap: Spacing.one },
});

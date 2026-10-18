/**
 * booking/recipient.tsx — LE DESTINATAIRE (étape ⑤ du tunnel, A216).
 * ===================================================================
 * Transposition native de la carte « Le destinataire » du site, validée sur
 * captures le 18/10 (`1-web/back-2`). Quatre informations, une carte :
 * téléphone, prénom, nom, email facultatif.
 *
 * Le TÉLÉPHONE d'abord, et ce n'est pas un hasard de mise en page : c'est par
 * lui que transite le code de livraison (D43). Les trois autres champs servent
 * à reconnaître la personne au rendez-vous ; celui-là conditionne la livraison.
 *
 * On garde la grammaire du CONTENEUR (carte bordée, filets) sans imposer la
 * disposition « libellé à gauche, champ à droite » : elle convient à une valeur,
 * pas à du texte libre. Un email dans une boîte étroite est pénible à saisir et
 * à relire — même arbitrage que sur le web.
 *
 * L'indicatif passe par une FEUILLE (motif de `report-sheet`) plutôt qu'un
 * sélecteur déroulant : il n'existe pas de `<select>` natif, et vingt-et-une
 * entrées se parcourent mieux en pleine hauteur qu'en roulette.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { quoteDraft, validateRecipientStep, type RecipientErrors } from '@/lib/booking-rules';
import { PHONE_PREFIXES } from '@/lib/phone-prefixes';
import { formatPrice } from '@/lib/trip-format';

const DELIVERY_FLOW_KEYS = ['codeGiven', 'shareIt', 'handToTraveler'] as const;

export default function BookingRecipientScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const t = useTranslations('booking');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const draft = useBookingDraft();

  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [failed, setFailed] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [nextStepSoon, setNextStepSoon] = useState(false);
  const [prefixOpen, setPrefixOpen] = useState(false);
  const [flowOpen, setFlowOpen] = useState(false);
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

  const errors: RecipientErrors = useMemo(() => validateRecipientStep(draft), [draft]);

  const setRecipient = useCallback(
    (patch: Partial<typeof draft.recipient>) =>
      setBookingDraft({ recipient: { ...draft.recipient, ...patch } }),
    [draft.recipient]
  );

  const onContinue = useCallback(() => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setNextStepSoon(false);
      return;
    }
    setShowErrors(false);
    setNextStepSoon(true);
  }, [errors]);

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
  const prefixLabel =
    PHONE_PREFIXES.find((p) => p.prefix === draft.recipient.phonePrefix) ?? PHONE_PREFIXES[0];

  return (
    <BookingStepFrame
      title={t('recipient.title')}
      subtitle={t('recipient.subtitle')}
      step={5}
      priceLabel={
        quote.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null
      }
      priceHint={quote.ok === true ? t('bar.allIn') : t('bar.quoteError.GENERIC')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        {/* LE TÉLÉPHONE — le canal du code de livraison (D43). */}
        <View style={styles.field}>
          <ThemedText type="smallBold">{t('recipient.phone')}</ThemedText>
          <View style={styles.phoneRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recipient.phonePrefix')}
              onPress={() => setPrefixOpen(true)}
              style={[styles.prefixButton, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">{prefixLabel.prefix}</ThemedText>
              <Ionicons name="chevron-down" size={14} color={theme.textSecondary} />
            </Pressable>
            <TextInput
              value={draft.recipient.phoneNational}
              onChangeText={(phoneNational) => setRecipient({ phoneNational })}
              keyboardType="phone-pad"
              inputMode="tel"
              autoComplete="tel"
              placeholder="6 42 18 81 12"
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={t('recipient.phone')}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {t('recipient.phoneHint')}
          </ThemedText>
          {showErrors && errors.phone ? <FieldError code={errors.phone} /> : null}
        </View>

        <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />

        <View style={styles.field}>
          <ThemedText type="smallBold">{t('recipient.firstName')}</ThemedText>
          <TextInput
            value={draft.recipient.firstName}
            onChangeText={(firstName) => setRecipient({ firstName })}
            autoComplete="name-given"
            placeholder="Marie"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('recipient.firstName')}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {showErrors && errors.firstName ? <FieldError code={errors.firstName} /> : null}
        </View>

        <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />

        <View style={styles.field}>
          <ThemedText type="smallBold">{t('recipient.lastName')}</ThemedText>
          <TextInput
            value={draft.recipient.lastName}
            onChangeText={(lastName) => setRecipient({ lastName })}
            autoComplete="name-family"
            placeholder="Mboungou"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('recipient.lastName')}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {showErrors && errors.lastName ? <FieldError code={errors.lastName} /> : null}
        </View>

        <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />

        <View style={styles.field}>
          <ThemedText type="smallBold">{t('recipient.email')}</ThemedText>
          <TextInput
            value={draft.recipient.email}
            onChangeText={(email) => setRecipient({ email })}
            keyboardType="email-address"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="marie.mboungou@gmail.com"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel={t('recipient.email')}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('recipient.emailHint')}
          </ThemedText>
          {showErrors && errors.email ? <FieldError code={errors.email} /> : null}
        </View>
      </View>

      {/* Le code de livraison, APRÈS le numéro et REPLIÉ — même arbitrage que sur
          le web : purement informatif, il ne doit pas peser autant que les
          champs, et il n'est concret qu'une fois le numéro saisi. */}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: flowOpen }}
        onPress={() => setFlowOpen((v) => !v)}
        style={styles.flowToggle}>
        <Ionicons name="bulb-outline" size={16} color={Brand.teal} />
        <ThemedText type="small" style={styles.flowTitle}>
          {t('recipient.deliveryFlow.title')}
        </ThemedText>
        <Ionicons
          name={flowOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={theme.textSecondary}
        />
      </Pressable>
      {flowOpen ? (
        <View style={styles.flowList}>
          {DELIVERY_FLOW_KEYS.map((key) => (
            <View key={key} style={styles.flowItem}>
              <ThemedText type="small" themeColor="textSecondary">
                •
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flowText}>
                {t(`recipient.deliveryFlow.${key}`)}
              </ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {nextStepSoon ? (
        <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="arrow-forward-circle-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flowText}>
            {t('recipient.nextStepSoon')}
          </ThemedText>
        </View>
      ) : null}

      {/* La feuille des indicatifs : pas de `<select>` en natif, et vingt-et-une
          entrées se parcourent mieux en pleine hauteur qu'en roulette. */}
      <Modal
        visible={prefixOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPrefixOpen(false)}>
        <ThemedView style={styles.sheet}>
          <SafeAreaView edges={['top']}>
            <View style={styles.sheetHeader}>
              <ThemedText type="subtitle">{t('recipient.phonePrefix')}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('recipient.close')}
                onPress={() => setPrefixOpen(false)}
                hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
          </SafeAreaView>
          <ScrollView contentContainerStyle={styles.sheetList}>
            {PHONE_PREFIXES.map((p) => {
              const active = p.prefix === draft.recipient.phonePrefix;
              return (
                <Pressable
                  key={p.code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    setRecipient({ phonePrefix: p.prefix });
                    setPrefixOpen(false);
                  }}
                  style={styles.sheetRow}>
                  <ThemedText type="small" style={styles.sheetPrefix}>
                    {p.prefix}
                  </ThemedText>
                  <ThemedText type="small" style={styles.flowText}>
                    {locale === 'fr' ? p.labelFr : p.labelEn}
                  </ThemedText>
                  {active ? <Ionicons name="checkmark" size={18} color={Brand.mango} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </ThemedView>
      </Modal>
    </BookingStepFrame>
  );

  function FieldError({ code }: { code: string }) {
    return (
      <View style={styles.errorRow}>
        <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
        <ThemedText type="small" style={{ color: Brand.mango }}>
          {t(`recipient.errors.${code}`)}
        </ThemedText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: Spacing.four },
  field: { paddingVertical: Spacing.four, gap: Spacing.two },
  hairline: { height: StyleSheet.hairlineWidth },
  phoneRow: { flexDirection: 'row', gap: Spacing.two },
  prefixButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  input: { flex: 1, borderRadius: 12, paddingHorizontal: Spacing.three, height: 46, fontSize: 15 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  flowToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  flowTitle: { flex: 1 },
  flowList: { gap: Spacing.one, paddingLeft: Spacing.five },
  flowItem: { flexDirection: 'row', gap: Spacing.two },
  flowText: { flex: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, padding: Spacing.three },
  sheet: { flex: 1 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  sheetList: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.three },
  sheetPrefix: { minWidth: 52 },
});

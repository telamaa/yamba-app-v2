/**
 * booking/places.tsx — LES LIEUX DE RENDEZ-VOUS (étape ④ du tunnel, A216).
 * =========================================================================
 * Transposition native de l'étape 2 du site, validée sur captures le 18/10
 * (`context/captures/mobile/booking/1-web/back-2`). Deux questions, deux
 * cartes : où TU remets le colis, où le DESTINATAIRE le récupère.
 *
 * La grammaire est celle de « Ton colis » (A216 / révision du 21/10) : une
 * carte bordée par groupe, une ligne pleine largeur par lieu, un filet entre
 * elles, la pastille de choix à DROITE, et toute la ligne cliquable — viser
 * une pastille de 22 px au pouce est une épreuve.
 *
 * Trois états par groupe, et aucun n'est un écran vide :
 *   • plusieurs lieux  → on choisit ;
 *   • un seul lieu     → la MÊME carte, sans pastille (il n'y a rien à choisir) ;
 *   • aucun lieu       → on le DIT. Un trajet publié sans lieu de remise existe
 *     (le lieu n'est pas exigé à la publication) et faisait planter le web avant
 *     qu'on le traite ; ici il n'empêche pas de continuer, il se négocie au chat.
 *
 * Le brouillon stocke des INDEX et non des identifiants : le DTO public n'en
 * porte pas. C'est aussi pourquoi le brouillon est lié à un `tripId` (A214) —
 * un rang n'a de sens que dans SA liste.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BookingStepFrame } from '@/components/booking/booking-step-frame';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { currentPricingParams, loadPricingParams } from '@/lib/api/pricing.api';
import { getPublicTrip, type PublicTrip, type TripLocationPoint } from '@/lib/api/trip.api';
import { setBookingDraft, useBookingDraft } from '@/lib/booking-draft';
import { quoteDraft } from '@/lib/booking-rules';
import { DEFAULT_LOCATION_ICON, LOCATION_ICONS, flexibilityLabelKey } from '@/lib/location-format';
import { formatPrice } from '@/lib/trip-format';

export default function BookingPlacesScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const t = useTranslations('booking');
  const tTrip = useTranslations('tripDetail');
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

  const onContinue = useCallback(() => {
    // Un lieu manquant n'est une erreur QUE s'il y avait un choix à faire.
    const pickupMissing = (trip?.pickupLocations.length ?? 0) > 1 && draft.pickupIndex === null;
    const deliveryMissing = (trip?.deliveryLocations.length ?? 0) > 1 && draft.deliveryIndex === null;
    if (pickupMissing || deliveryMissing) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    router.push({ pathname: '/booking/recipient', params: { tripId: trip?.id ?? '' } });
  }, [trip, draft.pickupIndex, draft.deliveryIndex]);

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
  const priceLabel =
    quote.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null;

  return (
    <BookingStepFrame
      title={t('places.title')}
      subtitle={t('places.subtitle', { name: trip.tripper.firstName })}
      step={4}
      priceLabel={priceLabel}
      priceHint={quote.ok === true ? t('bar.allIn') : t('bar.quoteError.GENERIC')}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      <PlaceGroup
        title={t('places.pickupTitle', { name: trip.tripper.firstName })}
        points={trip.pickupLocations}
        selectedIndex={draft.pickupIndex}
        showError={showErrors && trip.pickupLocations.length > 1 && draft.pickupIndex === null}
        errorMessage={t('places.errorPickup')}
        emptyMessage={t('places.emptyPickup', { name: trip.tripper.firstName })}
        onSelectAction={(index) => setBookingDraft({ pickupIndex: index })}
      />

      <PlaceGroup
        title={t('places.deliveryTitle')}
        points={trip.deliveryLocations}
        selectedIndex={draft.deliveryIndex}
        showError={showErrors && trip.deliveryLocations.length > 1 && draft.deliveryIndex === null}
        errorMessage={t('places.errorDelivery')}
        emptyMessage={t('places.emptyDelivery')}
        onSelectAction={(index) => setBookingDraft({ deliveryIndex: index })}
      />

    </BookingStepFrame>
  );

  // ── Pièces d'écran ───────────────────────────────────────────────────────

  function PlaceGroup({
    title,
    points,
    selectedIndex,
    showError,
    errorMessage,
    emptyMessage,
    onSelectAction,
  }: {
    title: string;
    points: TripLocationPoint[];
    selectedIndex: number | null;
    showError: boolean;
    errorMessage: string;
    emptyMessage: string;
    onSelectAction: (index: number) => void;
  }) {
    const choosable = points.length > 1;
    return (
      <View style={styles.group}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {title}
        </ThemedText>

        {points.length === 0 ? (
          <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
            <View style={styles.row}>
              <Ionicons name="help-circle-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.rowTexts}>
                {emptyMessage}
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
            {points.map((point, index) => (
              <View key={`${point.kind}-${index}`}>
                {index > 0 ? (
                  <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
                ) : null}
                <PlaceRow
                  point={point}
                  choosable={choosable}
                  selected={selectedIndex === index}
                  onPressAction={() => onSelectAction(index)}
                />
              </View>
            ))}
          </View>
        )}

        {showError ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
            <ThemedText type="small" style={{ color: Brand.mango }}>
              {errorMessage}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }

  function PlaceRow({
    point,
    choosable,
    selected,
    onPressAction,
  }: {
    point: TripLocationPoint;
    /** Un seul lieu : on l'affiche, on ne le fait pas « choisir ». */
    choosable: boolean;
    selected: boolean;
    onPressAction: () => void;
  }) {
    const flex = flexibilityLabelKey(point.flexibility, point.radiusKm);
    const flexLabel = flex ? tTrip(flex.key, flex.values) : null;
    const kindLabel = tTrip(`locations.kind.${point.kind}`);

    const body = (
      <>
        <Ionicons
          name={LOCATION_ICONS[point.kind] ?? DEFAULT_LOCATION_ICON}
          size={18}
          color={selected && choosable ? Brand.mango : theme.textSecondary}
        />
        <View style={styles.rowTexts}>
          <ThemedText type="smallBold">{kindLabel}</ThemedText>
          {point.details ? (
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {point.details}
            </ThemedText>
          ) : null}
        </View>
        {flexLabel ? (
          <ThemedText type="small" themeColor="textSecondary">
            {flexLabel}
          </ThemedText>
        ) : null}
        {choosable ? (
          <View
            style={[styles.radio, { borderColor: selected ? Brand.mango : theme.textSecondary }]}>
            {selected ? <View style={[styles.radioDot, { backgroundColor: Brand.mango }]} /> : null}
          </View>
        ) : null}
      </>
    );

    if (!choosable) return <View style={styles.row}>{body}</View>;

    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={[kindLabel, point.details, flexLabel].filter(Boolean).join(' ')}
        onPress={onPressAction}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        {body}
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.five },
  centeredText: { textAlign: 'center' },
  group: { gap: Spacing.two },
  card: { borderRadius: 16, borderWidth: 1, paddingHorizontal: Spacing.four },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.four },
  rowTexts: { flex: 1, minWidth: 0, gap: 2 },
  hairline: { height: StyleSheet.hairlineWidth },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});

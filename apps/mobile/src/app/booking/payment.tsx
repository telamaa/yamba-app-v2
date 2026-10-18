/**
 * booking/payment.tsx — LE PAIEMENT (étape ⑦, A218).
 * ====================================================
 * Le dernier écran du tunnel, et le seul qui touche à l'argent. Il montre
 * trois choses, dans cet ordre : ce qui est payé, avec quoi on paie, et ce
 * qui se passera ensuite.
 *
 * CE QUE L'ÉCRAN AFFICHE N'EST PAS LE CALCUL LOCAL. Le détail vient du devis
 * rendu par le SERVEUR avec l'autorisation (`quote`) : c'est lui qui sera figé
 * dans le Booking (D17), et c'est donc lui qu'il faut lire. Le calcul local
 * (`@packages/pricing`) garde un seul rôle — alimenter la barre du bas depuis
 * l'étape ① et permettre au serveur de REFUSER une divergence : un montant
 * jamais montré n'est jamais débité.
 *
 * L'ORDRE DES GESTES est imposé par A45 et par D31 :
 *   1. les photos déclarées montent chez ImageKit — un échec s'arrête ici,
 *      pendant qu'aucune empreinte bancaire n'existe (A34) ;
 *   2. la carte AUTORISE (feuille native Stripe, ou rien chez le fournisseur
 *      FAKE du poste de développement) ;
 *   3. `POST /deals` crée la demande PENDING dans une transaction.
 * Les URLs déjà téléversées sont mémorisées : réessayer après un refus ne
 * renvoie pas les mêmes photos une deuxième fois.
 *
 * POURQUOI LE PAIEMENT PAR CARTE PEUT ÊTRE ABSENT. La feuille Stripe est un
 * module NATIF, absent d'Expo Go (voir `lib/stripe-sheet.ts`). L'écran le dit
 * au lieu de faire semblant — et il reste entièrement utilisable avec le
 * fournisseur FAKE, qui est celui du poste de développement. C'est l'arbitrage
 * du 18/10 : le parcours complet est testable sur un téléphone AUJOURD'HUI,
 * la vraie carte attend le build de développement.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import { BookingStepFrame } from '@/components/booking/booking-step-frame';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import {
  createBooking,
  createPaymentIntent,
  QuoteUnavailableError,
  type PaymentIntentInfo,
} from '@/lib/api/booking.api';
import { ApiError } from '@/lib/api/client';
import { currentPricingParams, loadPricingParams } from '@/lib/api/pricing.api';
import { getPublicTrip, type PublicTrip } from '@/lib/api/trip.api';
import { PHOTO_MAX_MB, uploadDeclaredPhoto } from '@/lib/api/upload.api';
import { clearBookingDraft, getBookingDraft, useBookingDraft } from '@/lib/booking-draft';
import { quoteDraft } from '@/lib/booking-rules';
import { confirmWithPaymentSheet, isPaymentSheetAvailable } from '@/lib/stripe-sheet';
import { formatPrice } from '@/lib/trip-format';

const AFTER_KEYS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

/** Les refus métier que l'écran SAIT nommer (contrat deal-service). */
const KNOWN_CODES = new Set([
  'QUOTE_DIVERGENCE',
  'QUOTE_UNAVAILABLE',
  'CAPACITY_EXCEEDED',
  'FAMILY_REFUSED',
  'TRIP_NOT_BOOKABLE',
  'OWN_TRIP',
  'NEW_ACCOUNT_CAP',
  'PAYMENT_NOT_AUTHORIZED',
  'PAYMENT_MISMATCH',
  'PAYMENT_ALREADY_USED',
  'ACCOUNT_DELETED',
  'UNAUTHENTICATED',
]);

/** Après ces deux-là, l'autorisation ne vaut plus : on en refait une. */
const REFRESHES_INTENT = new Set(['QUOTE_DIVERGENCE', 'PAYMENT_MISMATCH']);

export default function BookingPaymentScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const t = useTranslations('booking');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const scheme = useColorScheme();
  const draft = useBookingDraft();

  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useState(currentPricingParams);

  const [intent, setIntent] = useState<PaymentIntentInfo | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [cardAuthorized, setCardAuthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** URL ImageKit par photo déjà montée : un réessai ne re-téléverse pas. */
  const uploaded = useRef<Map<string, string>>(new Map());

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

  /** Le code d'un refus, ramené à une clé que l'écran sait traduire. */
  const codeOf = useCallback((e: unknown): string => {
    if (e instanceof QuoteUnavailableError) return 'QUOTE_UNAVAILABLE';
    if (e instanceof ApiError) {
      if (e.code && KNOWN_CODES.has(e.code)) return e.code;
      if (e.status === 401) return 'UNAUTHENTICATED';
    }
    return 'GENERIC';
  }, []);

  const requestIntent = useCallback(
    async (current: PublicTrip) => {
      setIntentLoading(true);
      setIntentError(null);
      // Une nouvelle autorisation annule la précédente : la carte devra la
      // reconfirmer, sinon on enverrait une demande sur une empreinte morte.
      setCardAuthorized(false);
      try {
        const created = await createPaymentIntent(getBookingDraft(), current, params);
        setIntent(created);
      } catch (e) {
        const code = codeOf(e);
        setIntent(null);
        setIntentError(t(`payment.errors.${code}`));
        // Le serveur ne calcule PAS le même total : nos entrées sont périmées
        // (prix du trajet modifié, paramètre de plateforme changé). Relire le
        // trajet et les paramètres réaligne le devis local — sans cela,
        // « Réessayer » rejouerait exactement le même calcul faux.
        if (code === 'QUOTE_DIVERGENCE') {
          void getPublicTrip(current.id).then(setTrip).catch(() => undefined);
          void loadPricingParams().then((p) => setParams(() => p));
        }
      } finally {
        setIntentLoading(false);
      }
    },
    [params, t, codeOf]
  );

  // L'autorisation est demandée DÈS l'arrivée sur l'écran : le plafond du
  // compte (CNF-06) et la capacité du trajet tombent avant que l'Expéditeur
  // ne sorte sa carte, pas après.
  useEffect(() => {
    if (!trip || intent || intentLoading || intentError) return;
    void requestIntent(trip);
  }, [trip, intent, intentLoading, intentError, requestIntent]);

  /** Les photos déclarées, montées une fois pour toutes. */
  const uploadPhotos = useCallback(async (): Promise<string[] | { failure: string }> => {
    const urls: string[] = [];
    for (const photo of draft.photos) {
      const already = uploaded.current.get(photo.id);
      if (already) {
        urls.push(already);
        continue;
      }
      const result = await uploadDeclaredPhoto(photo);
      if (!result.ok) return { failure: `UPLOAD_${result.code}` };
      uploaded.current.set(photo.id, result.url);
      urls.push(result.url);
    }
    return urls;
  }, [draft.photos]);

  const onPay = useCallback(async () => {
    if (submitting || !trip) return;
    if (!intent) {
      setError(t('payment.notReady'));
      if (!intentLoading) void requestIntent(trip);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1. Les photos AVANT l'argent (A45).
      const photos = await uploadPhotos();
      if ('failure' in photos) {
        setError(t(`payment.errors.${photos.failure}`, { maxMb: PHOTO_MAX_MB }));
        return;
      }

      // 2. L'autorisation. Chez FAKE il n'y a rien à ouvrir : le serveur a
      //    déjà posé une empreinte simulée en créant l'intention.
      if (intent.provider === 'STRIPE' && !cardAuthorized) {
        if (!intent.clientSecret) {
          setError(t('payment.errors.PAYMENT_NOT_AUTHORIZED'));
          return;
        }
        const outcome = await confirmWithPaymentSheet({
          clientSecret: intent.clientSecret,
          merchantName: 'Yamba',
          dark: scheme === 'dark',
        });
        if (!outcome.ok) {
          setError(
            outcome.reason === 'CANCELED'
              ? t('payment.errors.CANCELED')
              : outcome.reason === 'UNAVAILABLE'
                ? t('payment.unavailableBody')
                : t('payment.errors.SHEET_FAILED')
          );
          return;
        }
        setCardAuthorized(true);
      }

      // 3. La demande elle-même.
      const booking = await createBooking(draft, trip, intent.paymentIntentId, photos, params);
      clearBookingDraft();
      // On DÉPILE le tunnel avant d'afficher la confirmation : `replace` seul
      // laisserait les six écrans précédents dessous, et le retour ramènerait
      // sur « Ton engagement » avec un brouillon vide. Une demande envoyée ne
      // se re-paie pas — le parcours doit disparaître derrière elle.
      if (router.canDismiss()) router.dismissAll();
      router.replace({
        pathname: '/booking/confirmation',
        params: {
          bookingId: booking.bookingId,
          expiresAt: booking.expiresAt,
          totalCents: String(booking.totalShipperCents),
          currencyCode: booking.currencyCode,
          carrier: trip.tripper.firstName,
        },
      });
    } catch (e) {
      const code = codeOf(e);
      setError(t(`payment.errors.${code}`));
      if (REFRESHES_INTENT.has(code)) {
        setIntent(null);
        void requestIntent(trip);
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    trip,
    intent,
    intentLoading,
    cardAuthorized,
    draft,
    params,
    scheme,
    t,
    codeOf,
    requestIntent,
    uploadPhotos,
  ]);

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

  const localQuote = quoteDraft(draft, trip, params);
  // La barre du bas suit le devis du serveur dès qu'il est là ; avant, le
  // calcul local — le même moteur, les mêmes paramètres.
  const totalCents =
    intent?.quote.totalShipperCents ??
    (localQuote.ok === true ? localQuote.quote.totalShipperCents : null);
  const amountLabel = totalCents === null ? null : formatPrice(totalCents, trip.currencyCode, locale);
  const sheetAvailable = isPaymentSheetAvailable();

  return (
    <BookingStepFrame
      title={t('payment.title')}
      subtitle={t('payment.subtitle')}
      step={7}
      priceLabel={amountLabel}
      priceHint={t('bar.allIn')}
      ctaLabel={
        submitting
          ? t('payment.ctaBusy')
          : amountLabel
            ? t('payment.cta', { amount: amountLabel })
            : // Tant que le total n'est pas connu, « Payer » sans montant serait
              // un bouton qui ment sur ce qu'il engage.
              t('bar.continue')
      }
      onContinueAction={() => void onPay()}>
      {/* 1. CE QUE TU PAIES — le devis du SERVEUR, ligne à ligne. */}
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">{t('payment.summaryTitle')}</ThemedText>
        {intent ? (
          <>
            <View style={styles.line}>
              <View style={styles.flex}>
                <ThemedText type="small">{t('payment.transport')}</ThemedText>
                {intent.quote.billableWeightKg ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('payment.transportDetail', { kg: intent.quote.billableWeightKg })}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText type="small">
                {formatPrice(intent.quote.transportCents, intent.quote.currencyCode, locale)}
              </ThemedText>
            </View>
            {/* GAR-04 : la commission et la prime ne se mélangent JAMAIS sur
                une même ligne — deux protections facturées à la lecture. */}
            <View style={styles.line}>
              <ThemedText type="small" style={styles.flex}>
                {t('payment.service')}
              </ThemedText>
              <ThemedText type="small">
                {formatPrice(intent.quote.commissionCents, intent.quote.currencyCode, locale)}
              </ThemedText>
            </View>
            {intent.quote.premiumCents > 0 ? (
              <View style={styles.line}>
                <ThemedText type="small" style={styles.flex}>
                  {t('payment.protection')}
                </ThemedText>
                <ThemedText type="small">
                  {formatPrice(intent.quote.premiumCents, intent.quote.currencyCode, locale)}
                </ThemedText>
              </View>
            ) : null}
            <View style={[styles.line, styles.totalLine, { borderTopColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold" style={styles.flex}>
                {t('payment.total')}
              </ThemedText>
              <ThemedText type="subtitle">
                {formatPrice(intent.quote.totalShipperCents, intent.quote.currencyCode, locale)}
              </ThemedText>
            </View>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t('payment.preparing')}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {t('payment.hold')}
        </ThemedText>
      </View>

      {/* 2. AVEC QUOI ON PAIE. */}
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">{t('payment.methodTitle')}</ThemedText>
        {intentError ? (
          <View style={styles.gap}>
            <ThemedText type="small">{intentError}</ThemedText>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setIntentError(null);
                void requestIntent(trip);
              }}
              style={[styles.retry, { borderColor: theme.backgroundElement }]}>
              <Ionicons name="refresh" size={15} color={theme.text} />
              <ThemedText type="smallBold">{t('payment.retry')}</ThemedText>
            </Pressable>
          </View>
        ) : intentLoading || !intent ? (
          <View style={styles.row}>
            <ActivityIndicator color={Brand.mango} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('payment.preparing')}
            </ThemedText>
          </View>
        ) : intent.provider === 'FAKE' ? (
          <View style={styles.row}>
            <Ionicons name="flask-outline" size={18} color={Brand.teal} />
            <ThemedText type="small" style={styles.flex}>
              {t('payment.testMode', { amount: amountLabel ?? '' })}
            </ThemedText>
          </View>
        ) : sheetAvailable ? (
          <View style={styles.row}>
            <Ionicons
              name={cardAuthorized ? 'checkmark-circle' : 'card-outline'}
              size={18}
              color={cardAuthorized ? Brand.teal : theme.textSecondary}
            />
            <View style={styles.flex}>
              <ThemedText type="small">{t('payment.card')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {cardAuthorized ? t('payment.cardAuthorized') : t('payment.cardPending')}
              </ThemedText>
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <Ionicons name="alert-circle-outline" size={18} color={Brand.mango} />
            <View style={styles.flex}>
              <ThemedText type="small">{t('payment.unavailableTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('payment.unavailableBody')}
              </ThemedText>
            </View>
          </View>
        )}
      </View>

      {/* 3. CE QUI SE PASSERA ENSUITE — numéroté : c'est une chronologie. */}
      <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <Ionicons name="git-branch-outline" size={16} color={Brand.teal} />
          <ThemedText type="smallBold" style={styles.flex}>
            {t('payment.afterTitle')}
          </ThemedText>
        </View>
        {AFTER_KEYS.map((key, index) => (
          <View key={key} style={styles.bullet}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {index + 1}.
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {t(`payment.after.${key}`)}
            </ThemedText>
          </View>
        ))}
      </View>

      {intent?.provider === 'STRIPE' ? (
        <View style={styles.row}>
          <Ionicons name="lock-closed-outline" size={14} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {t('payment.trust')}
          </ThemedText>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
          <ThemedText type="small" style={[styles.flex, { color: Brand.mango }]}>
            {error}
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
  gap: { gap: Spacing.three },
  card: { borderRadius: 16, borderWidth: 1, padding: Spacing.four, gap: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  totalLine: { borderTopWidth: 1, paddingTop: Spacing.three, alignItems: 'center' },
  bullet: { flexDirection: 'row', gap: Spacing.two },
  retry: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1, borderRadius: 12, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, alignSelf: 'flex-start' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});

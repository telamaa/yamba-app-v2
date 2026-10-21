/**
 * shipment/[id].tsx — « Mon envoi » : le suivi d'une demande, côté Expéditeur.
 * =============================================================================
 * L'écran que la fin du tunnel promettait sans pouvoir l'ouvrir : jusqu'ici,
 * l'app disait « ta demande est partie » et s'arrêtait là. Un envoi vit
 * ensuite pendant des jours — on attend une réponse, on prépare un colis, on
 * transmet un code, on suit un vol, on vérifie une livraison. Tout cela se
 * passe ICI, en natif, parce que l'app ne renvoie jamais au site (A210 b).
 *
 * Le jumeau web est `apps/user-ui/src/components/booking/booking-tracker/`
 * (quarante composants, deux arbres desktop/mobile). Il n'est pas transposé
 * composant par composant — ce serait empiler quinze boîtes grises sur un
 * téléphone. La grammaire est celle de la fiche trajet, revue le 13/10 :
 * une page À PLAT, des sections séparées par un filet, et UNE SEULE carte.
 * Ici, cette carte unique est le CODE DE LIVRAISON : c'est la seule chose
 * qu'on sort du téléphone pour la montrer à quelqu'un.
 *
 * Le serveur décide de tout (RG-MOB-1) :
 *   • l'état, les jalons et les échéances viennent de `GET /deals/:id` ;
 *   • les GESTES viennent de `allowedActions` — l'écran reflète cette liste
 *     et ne la recalcule jamais. Un bouton que le serveur n'autorise pas
 *     n'est pas désactivé : il n'existe pas (A209) ;
 *   • après chaque geste, on RELIT. Jamais de vérité locale sur de l'argent :
 *     le montant rendu est celui que le serveur a décidé à l'instant T, pas
 *     celui que la préviz annonçait avant le clic.
 *
 * Ce que cette fiche ne fait PAS encore, et qui ne se devine donc nulle part
 * à l'écran : signaler un problème et noter le Voyageur. Ce sont deux
 * formulaires — deux écrans à part, comme sur le site (`/report`, `/rate`) —
 * et promettre ici un écran absent serait le défaut A203. Le lot suivant les
 * ouvre ; aucun texte de cet écran ne renvoie au site en attendant.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocale, useTranslations } from 'use-intl';

import type { SupportedLocale } from '@packages/api-contracts/locale';

import {
  Action,
  ConfirmSheet,
  Notice,
  Overline,
  Row,
  Section,
  ShipmentTopBar,
  Steps,
} from '@/components/shipment/shipment-kit';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  cancelShipment,
  confirmDelivery,
  getShipment,
  regenerateDeliveryCode,
  WrongViewerRoleError,
  type ShipperShipmentDto,
} from '@/lib/api/shipment.api';
import { DEFAULT_LOCATION_ICON, LOCATION_ICONS } from '@/lib/location-format';
import {
  closureDate,
  closureKey,
  formatZonedTime,
  groupDeliveryCode,
  moneyState,
  remainingUntil,
  shipmentPhase,
  shipmentReference,
  timeline,
  type ShipmentPhase,
} from '@/lib/shipment-view';
import { formatLongDate, formatPrice, getInitials } from '@/lib/trip-format';

/** Le pictogramme et la teinte de chaque phase. Le teal dit « tenu », la
 *  mangue « on t'attend », le gris « clos », le rouge « examen en cours ». */
const PHASE_LOOK: Record<
  ShipmentPhase,
  { icon: keyof typeof Ionicons.glyphMap; tone: 'wait' | 'good' | 'done' | 'alert' }
> = {
  AWAITING_CARRIER: { icon: 'hourglass-outline', tone: 'wait' },
  ACCEPTED: { icon: 'checkmark-circle-outline', tone: 'good' },
  PICKED_UP: { icon: 'keypad-outline', tone: 'wait' },
  IN_TRANSIT: { icon: 'airplane-outline', tone: 'good' },
  DELIVERED: { icon: 'cube-outline', tone: 'wait' },
  COMPLETED: { icon: 'checkmark-done-circle-outline', tone: 'good' },
  DISPUTED: { icon: 'shield-half-outline', tone: 'alert' },
  DECLINED: { icon: 'close-circle-outline', tone: 'done' },
  EXPIRED: { icon: 'time-outline', tone: 'done' },
  CANCELLED: { icon: 'close-circle-outline', tone: 'done' },
};

/** La clé de texte d'état, par phase — « clos par la médiation » et « colis
 *  refusé » ne sont PAS des phases mais des nuances de `CANCELLED` : c'est
 *  `closureKey` qui tranche, parce que le texte en dépend (ANO-WEB-73). */
const STATUS_KEY: Record<ShipmentPhase, string> = {
  AWAITING_CARRIER: 'awaiting',
  ACCEPTED: 'accepted',
  PICKED_UP: 'pickedUp',
  IN_TRANSIT: 'inTransit',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  DECLINED: 'declined',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

/** Les phases qui ont une liste « ce qui arrive ensuite » à montrer. */
const NEXT_KEY: Partial<Record<ShipmentPhase, string>> = {
  AWAITING_CARRIER: 'awaiting',
  ACCEPTED: 'accepted',
  PICKED_UP: 'pickedUp',
  IN_TRANSIT: 'inTransit',
  DELIVERED: 'delivered',
  DISPUTED: 'disputed',
};

/** La fonction de traduction, telle que les aides de ce fichier l'utilisent.
 *  Les messages du mobile ne sont pas typés par un `IntlMessages` global :
 *  une clé est une chaîne, et les clés dynamiques (un statut, une famille)
 *  sont la règle ici. */
type T = (key: string, values?: Record<string, string | number>) => string;

type LoadState =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'wrongRole' }
  | { kind: 'error'; correlationId: string | null }
  | { kind: 'loaded'; shipment: ShipperShipmentDto };

/** Les trois gestes qui passent par une feuille de confirmation. */
type Geste = 'cancel' | 'regenerate' | 'confirm';

export default function ShipmentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTranslations('shipment');
  const locale = useLocale() as SupportedLocale;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [sheet, setSheet] = useState<Geste | null>(null);
  const [pending, setPending] = useState<Geste | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);
  /** Le dernier geste réussi, dit en clair — un geste qui ne dit rien laisse
   *  croire qu'il n'a rien fait. Effacé à la relecture suivante. */
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const shipment = await getShipment(String(id));
      setState({ kind: 'loaded', shipment });
    } catch (err) {
      if (err instanceof WrongViewerRoleError) {
        setState({ kind: 'wrongRole' });
        return;
      }
      // 404 = inexistant OU pas à toi : indiscernables à dessein (403 vs 404).
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        setState({ kind: 'notFound' });
        return;
      }
      setState({
        kind: 'error',
        correlationId: err instanceof ApiError ? err.correlationId : null,
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    setFlash(null);
    void load();
  }, [load]);

  /** Le refus du serveur, traduit par son `details.code` — jamais réécrit.
   *  Un deal qui a changé entre la lecture et le clic n'est pas une erreur :
   *  on le dit, et on relit. */
  const runGeste = useCallback(
    async (geste: Geste, run: () => Promise<string | null>) => {
      setPending(geste);
      setSheetError(null);
      try {
        const message = await run();
        setSheet(null);
        setFlash(message);
        await load();
      } catch (err) {
        const code = err instanceof ApiError ? err.code : null;
        if (code === 'TRANSITION_NOT_ALLOWED') {
          setSheet(null);
          setFlash(t('actions.errors.TRANSITION_NOT_ALLOWED'));
          await load();
        } else if (code === 'CODE_REGENERATION_LIMIT') {
          setSheetError(t('actions.errors.CODE_REGENERATION_LIMIT'));
        } else {
          setSheetError(t('actions.errors.generic'));
        }
      } finally {
        setPending(null);
      }
    },
    [load, t]
  );

  if (state.kind === 'loading') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ShipmentTopBar />
          <View style={styles.stateBlock}>
            <ActivityIndicator color={Brand.mango} />
            <ThemedText type="small" themeColor="textSecondary">
              {t('loading')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (state.kind !== 'loaded') {
    const key = state.kind === 'wrongRole' ? 'wrongRole' : state.kind === 'notFound' ? 'notFound' : 'error';
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ShipmentTopBar />
          <View style={styles.stateBlock}>
            <ThemedText type="smallBold" style={styles.centered}>
              {t(`${key}.title`)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {t(`${key}.body`)}
            </ThemedText>
            {state.kind === 'error' ? (
              <>
                <Action label={t('error.retry')} tone="primary" onPressAction={refresh} />
                {state.correlationId ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                    {t('error.reference', { id: state.correlationId })}
                  </ThemedText>
                ) : null}
              </>
            ) : null}
          </View>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const shipment = state.shipment;
  const phase = shipmentPhase(shipment);
  const carrierFirstName = shipment.carrier.firstName?.trim() || t('carrier.title');
  const recipientFirstName = shipment.recipient.firstName;
  const look = PHASE_LOOK[phase];
  const closure = closureKey(shipment, phase);
  // Deux fins de `CANCELLED` qui ne se racontent pas comme une annulation.
  const statusKey =
    closure === 'cancelledByMediation' || closure === 'pickupRefused' ? closure : STATUS_KEY[phase];
  const money = moneyState(shipment);
  const steps = timeline(phase);
  const code = shipment.deliveryCode;
  const preview = shipment.cancellationPreview;

  const canCancel = shipment.allowedActions.includes('cancel');
  const canConfirm = shipment.allowedActions.includes('confirmEarly');
  // La régénération n'est PAS une transition de la machine : son garde est
  // le plafond serveur et le colis en transit. On ne propose donc le geste
  // que là où il a un sens, et le serveur reste seul juge.
  const canRegenerate =
    code !== null && (phase === 'PICKED_UP' || phase === 'IN_TRANSIT') && shipment.codeRegenerationsLeft > 0;

  const shareCode = async () => {
    if (!code) return;
    await Share.share({
      message: t('actions.shareCode.message', {
        recipientFirstName,
        carrierFirstName,
        route: t('route', {
          origin: shipment.trip.originCity,
          destination: shipment.trip.destinationCity,
        }),
        code: groupDeliveryCode(code),
      }),
    });
  };

  const sheetProps = buildSheet(sheet);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.five }]}
          showsVerticalScrollIndicator={false}>
          <ShipmentTopBar onRefreshAction={refresh} />

          {/* ── L'état, en grand : la première chose qu'on vient chercher ── */}
          <View style={styles.hero}>
            <View style={[styles.badge, { backgroundColor: toneBackground(look.tone) }]}>
              <Ionicons name={look.icon} size={26} color={toneColor(look.tone)} />
            </View>
            <ThemedText type="title" style={styles.heroTitle}>
              {t(`status.${statusKey}.title`, { carrierFirstName, recipientFirstName })}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t(`status.${statusKey}.body`, { carrierFirstName, recipientFirstName })}
            </ThemedText>
            <View style={styles.metaRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('route', {
                  origin: shipment.trip.originCity,
                  destination: shipment.trip.destinationCity,
                })}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                ·
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('reference', { ref: shipmentReference(shipment.id) })}
              </ThemedText>
            </View>
            {closureLine(shipment, phase, closure, locale, t) ? (
              <ThemedText type="small" themeColor="textSecondary">
                {closureLine(shipment, phase, closure, locale, t)}
              </ThemedText>
            ) : null}
            {shipment.pickupRefusalReason ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('refusalReason', { reason: shipment.pickupRefusalReason })}
              </ThemedText>
            ) : null}
            {shipment.declineReason ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('refusalReason', { reason: shipment.declineReason })}
              </ThemedText>
            ) : null}
          </View>

          {flash ? <Notice icon="checkmark-circle-outline">{flash}</Notice> : null}

          {/* ── L'échéance qui court, s'il y en a une ───────────────────── */}
          <Deadline shipment={shipment} phase={phase} carrierFirstName={carrierFirstName} />

          {/* ── La frise : où en est le colis ───────────────────────────── */}
          {steps.length > 0 ? (
            <Section title={t('timeline.title')}>
              <View style={styles.friseRow}>
                {steps.map((step) => (
                  <View key={step.key} style={styles.friseItem}>
                    <View
                      style={[
                        styles.friseDot,
                        {
                          backgroundColor: step.done
                            ? Brand.teal
                            : step.current
                              ? Brand.mango
                              : theme.backgroundSelected,
                        },
                      ]}>
                      {step.done ? <Ionicons name="checkmark" size={11} color="#FFFFFF" /> : null}
                    </View>
                    <ThemedText
                      type="small"
                      themeColor={step.done || step.current ? 'text' : 'textSecondary'}
                      style={styles.friseLabel}>
                      {t(`timeline.steps.${step.key}`)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {/* ── LA carte de l'écran : le code de livraison ──────────────── */}
          <CodeCard
            shipment={shipment}
            phase={phase}
            carrierFirstName={carrierFirstName}
            recipientFirstName={recipientFirstName}
            onShareAction={shareCode}
            onRegenerateAction={canRegenerate ? () => setSheet('regenerate') : undefined}
          />

          {/* ── Le voyage, dès que le colis est parti ───────────────────── */}
          {shipment.pickedUpAt ? (
            <Journey shipment={shipment} carrierFirstName={carrierFirstName} recipientFirstName={recipientFirstName} locale={locale} />
          ) : null}

          {/* ── Les preuves : prise en charge, puis remise ──────────────── */}
          {shipment.pickup ? (
            <Section title={t('pickupProof.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('pickupProof.confirmedAt', {
                  date: formatLongDate(shipment.pickup.confirmedAt, locale),
                  time: formatZonedTime(
                    shipment.pickup.confirmedAt,
                    shipment.trip.originTimezone,
                    locale
                  ),
                })}
              </ThemedText>
              {shipment.pickup.notes ? (
                <Row label={t('pickupProof.notes')} value={shipment.pickup.notes} />
              ) : null}
              {shipment.pickup.checklist && shipment.pickup.checklist.length > 0 ? (
                <Row
                  label={t('pickupProof.checklist')}
                  value={String(shipment.pickup.checklist.length)}
                />
              ) : null}
              <Photos urls={shipment.pickup.photoUrls} label={t('pickupProof.photos', { carrierFirstName })} />
            </Section>
          ) : null}

          {shipment.deliveredAt ? (
            <Section title={t('deliveryProof.title')}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('deliveryProof.confirmedAt', {
                  date: formatLongDate(shipment.deliveredAt, locale),
                  time: formatZonedTime(
                    shipment.deliveredAt,
                    shipment.trip.destinationTimezone,
                    locale
                  ),
                })}
              </ThemedText>
              <Photos
                urls={shipment.deliveryPhotoUrls ?? []}
                label={t('deliveryProof.photos')}
              />
            </Section>
          ) : null}

          {/* ── Ce qui a été réservé : le colis, les lieux, les gens ────── */}
          <Section title={t('parcel.title')}>
            <ThemedText type="smallBold">
              {t('parcel.summary', {
                family: familyLabel(shipment, t),
                weight: formatKg(shipment.pricing.weightKg, locale),
              })}
            </ThemedText>
            {shipment.pricing.billableWeightKg &&
            shipment.pricing.billableWeightKg !== shipment.pricing.weightKg ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('parcel.billedWeight', {
                  weight: formatKg(shipment.pricing.billableWeightKg, locale),
                })}
              </ThemedText>
            ) : null}
            <Row
              label={t('parcel.declaredValue')}
              value={formatPrice(
                shipment.parcel.declaredValueCents,
                shipment.pricing.currencyCode,
                locale
              )}
            />
            {shipment.parcel.description ? (
              <>
                <Overline>{t('parcel.description')}</Overline>
                <ThemedText type="small" themeColor="textSecondary">
                  {shipment.parcel.description}
                </ThemedText>
              </>
            ) : null}
            <Photos urls={shipment.parcel.photoUrls} label={t('parcel.photos')} />
          </Section>

          <Section title={t('places.title')}>
            <PlaceLine
              label={t('places.pickup')}
              place={shipment.pickupPlace}
              city={shipment.trip.originCity}
              fallback={t('places.agreed', { carrierFirstName })}
              t={t}
            />
            <PlaceLine
              label={t('places.delivery')}
              place={shipment.deliveryPlace}
              city={shipment.trip.destinationCity}
              fallback={t('places.agreed', { carrierFirstName })}
              t={t}
            />
          </Section>

          <Section title={t('recipient.title')}>
            <Row
              label={`${shipment.recipient.firstName} ${shipment.recipient.lastName}`.trim()}
              value={t('recipient.inCity', { city: shipment.trip.destinationCity })}
            />
            {shipment.recipient.phoneE164 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {shipment.recipient.phoneE164}
              </ThemedText>
            ) : null}
          </Section>

          <Section title={t('carrier.title')}>
            <View style={styles.carrierRow}>
              {shipment.carrier.avatarUrl ? (
                <Image
                  source={{ uri: shipment.carrier.avatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">
                    {getInitials(shipment.carrier.firstName ?? '', shipment.carrier.lastInitial)}
                  </ThemedText>
                </View>
              )}
              <View style={styles.flex}>
                <ThemedText type="smallBold">
                  {`${shipment.carrier.firstName ?? ''} ${shipment.carrier.lastInitial}`.trim()}
                </ThemedText>
                {carrierLine(phase, t) ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {carrierLine(phase, t)}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          </Section>

          {/* ── L'argent : ce qui est autorisé, débité, gelé, rendu ─────── */}
          <Section title={t('payment.title')}>
            <Row
              label={t('payment.total')}
              value={formatPrice(
                shipment.pricing.totalShipperCents,
                shipment.pricing.currencyCode,
                locale
              )}
            />
            <Row
              label={t('payment.transport')}
              value={formatPrice(
                shipment.pricing.transportCents,
                shipment.pricing.currencyCode,
                locale
              )}
            />
            <Row
              label={t('payment.service')}
              value={formatPrice(
                shipment.pricing.commissionCents,
                shipment.pricing.currencyCode,
                locale
              )}
            />
            {shipment.pricing.premiumCents > 0 ? (
              <Row
                label={t('payment.protection')}
                value={formatPrice(
                  shipment.pricing.premiumCents,
                  shipment.pricing.currencyCode,
                  locale
                )}
              />
            ) : null}
            {shipment.pricing.protectionTier ? (
              <Row
                label={t('payment.protection')}
                value={protectionLabel(shipment.pricing.protectionTier, t)}
              />
            ) : null}
            <ThemedText type="small" themeColor="textSecondary">
              {money.authorizedOnly
                ? t('payment.authorized')
                : t('payment.capturedOn', { date: formatLongDate(money.capturedAt, locale) })}
            </ThemedText>
            {money.frozen ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('payment.frozen')}
              </ThemedText>
            ) : null}
            {money.refundedCents !== null && money.refundedCents > 0 ? (
              <Row
                label={t('payment.refunded')}
                value={formatPrice(money.refundedCents, shipment.pricing.currencyCode, locale)}
              />
            ) : null}
            {money.retainedCents !== null && money.retainedCents > 0 ? (
              <Row
                label={t('payment.retained')}
                value={formatPrice(money.retainedCents, shipment.pricing.currencyCode, locale)}
              />
            ) : null}
            <Notice icon="lock-closed-outline">{paymentNote(shipment, phase, money.authorizedOnly, carrierFirstName, t)}</Notice>
          </Section>

          {/* ── La décision de médiation, quand il y en a une ───────────── */}
          {shipment.dispute?.resolution || shipment.retentionDecision ? (
            <Section title={t('mediation.title')}>
              {shipment.dispute?.ticketNumber ? (
                <Overline>{t('mediation.ticket', { ticket: shipment.dispute.ticketNumber })}</Overline>
              ) : null}
              {shipment.dispute?.resolution ? (
                <>
                  <ThemedText type="smallBold">
                    {t(`mediation.outcomes.${shipment.dispute.resolution.outcome}`)}
                  </ThemedText>
                  {shipment.dispute.resolution.refundCents > 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('mediation.refund', {
                        amount: formatPrice(
                          shipment.dispute.resolution.refundCents,
                          shipment.pricing.currencyCode,
                          locale
                        ),
                      })}
                    </ThemedText>
                  ) : null}
                  <Overline>{t('mediation.reason')}</Overline>
                  <ThemedText type="small" themeColor="textSecondary">
                    {shipment.dispute.resolution.reason}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('mediation.decidedOn', {
                      date: formatLongDate(shipment.dispute.resolution.resolvedAt, locale),
                    })}
                  </ThemedText>
                </>
              ) : null}
              {shipment.retentionDecision ? (
                <>
                  <ThemedText type="smallBold">
                    {t(`mediation.outcomes.${shipment.retentionDecision.outcome}`)}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {shipment.retentionDecision.reason}
                  </ThemedText>
                </>
              ) : null}
            </Section>
          ) : null}

          {/* ── Le dossier déposé, en lecture ───────────────────────────── */}
          {shipment.dispute ? (
            <Section title={t('dispute.title')}>
              <Row label={t('dispute.ticket')} value={shipment.dispute.ticketNumber} />
              <Row
                label={t('dispute.category')}
                value={disputeCategoryLabel(shipment.dispute.category, t)}
              />
              <Overline>{t('dispute.description')}</Overline>
              <ThemedText type="small" themeColor="textSecondary">
                {shipment.dispute.description}
              </ThemedText>
              {shipment.dispute.desiredOutcome ? (
                <Row
                  label={t('dispute.outcome')}
                  value={disputeOutcomeLabel(shipment.dispute.desiredOutcome, t)}
                />
              ) : null}
              <Photos urls={shipment.dispute.photoUrls} label={t('dispute.photos')} />
              <ThemedText type="small" themeColor="textSecondary">
                {t('dispute.openedOn', {
                  date: formatLongDate(shipment.dispute.createdAt, locale),
                })}
              </ThemedText>
              {phase === 'DISPUTED' ? (
                <Notice>
                  {shipment.dispute.carrierRespondedAt
                    ? t('dispute.carrierResponded', { carrierFirstName })
                    : t('dispute.carrierPending', { carrierFirstName })}
                </Notice>
              ) : null}
              <ThemedText type="small" themeColor="textSecondary">
                {t('dispute.support')}
              </ThemedText>
            </Section>
          ) : null}

          {/* ── Ce qui arrive ensuite ───────────────────────────────────── */}
          {NEXT_KEY[phase] ? (
            <Section title={t('next.title')}>
              <Steps
                items={['one', 'two', 'three'].map((n) =>
                  t(`next.${NEXT_KEY[phase]}.${n}`, { carrierFirstName, recipientFirstName })
                )}
              />
            </Section>
          ) : null}

          {/* ── Le repli : annuler. Jamais un bouton plein ──────────────── */}
          {canCancel ? (
            <Section>
              <Action
                label={t('actions.cancel.label')}
                tone="quiet"
                onPressAction={() => {
                  setSheetError(null);
                  setSheet('cancel');
                }}
              />
            </Section>
          ) : null}
        </ScrollView>

        {/* ── La barre du bas : l'action ATTENDUE, et elle seule ───────── */}
        {canConfirm || (code && (phase === 'PICKED_UP' || phase === 'IN_TRANSIT')) ? (
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: theme.backgroundElement, paddingBottom: insets.bottom + Spacing.two },
            ]}>
            {canConfirm ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('actions.confirmDelivery.hint', { carrierFirstName })}
                </ThemedText>
                <Action
                  label={t('actions.confirmDelivery.label')}
                  tone="primary"
                  icon="checkmark-circle-outline"
                  onPressAction={() => {
                    setSheetError(null);
                    setSheet('confirm');
                  }}
                />
              </>
            ) : (
              <Action
                label={t('actions.shareCode.label', { recipientFirstName })}
                tone="primary"
                icon="share-outline"
                onPressAction={() => void shareCode()}
              />
            )}
          </View>
        ) : null}
      </SafeAreaView>

      {sheetProps ? (
        <ConfirmSheet
          visible
          title={sheetProps.title}
          lines={sheetProps.lines}
          confirmLabel={sheetProps.confirmLabel}
          keepLabel={sheetProps.keepLabel}
          pendingLabel={sheetProps.pendingLabel}
          pending={pending === sheet}
          error={sheetError}
          destructive={sheetProps.destructive}
          onConfirmAction={sheetProps.onConfirm}
          onCancelAction={() => {
            if (pending) return;
            setSheet(null);
            setSheetError(null);
          }}
        />
      ) : null}
    </ThemedView>
  );

  /** Les trois feuilles, construites au même endroit : chacune dit ce que le
   *  geste fait, avec les MONTANTS servis par le serveur quand il y en a. */
  function buildSheet(which: Geste | null) {
    if (which === null) return null;

    if (which === 'cancel') {
      const lines: string[] = [];
      if (preview) {
        const full = preview.retentionCents === 0;
        lines.push(
          full
            ? t('actions.cancel.fullRefund', {
                amount: formatPrice(preview.refundCents, preview.currencyCode, locale),
              })
            : t('actions.cancel.partialRefund', {
                refund: formatPrice(preview.refundCents, preview.currencyCode, locale),
                retention: formatPrice(preview.retentionCents, preview.currencyCode, locale),
                pct: String(preview.retentionPct),
                carrierFirstName,
              })
        );
        if (full) {
          lines.push(
            t('actions.cancel.deadline', {
              date: formatLongDate(preview.fullRefundUntil, locale),
            })
          );
        }
      }
      lines.push(t('actions.cancel.recomputed'));

      return {
        title: t('actions.cancel.confirmTitle'),
        lines,
        confirmLabel: t('actions.cancel.confirm'),
        keepLabel: t('actions.cancel.keep'),
        pendingLabel: t('actions.cancel.pending'),
        destructive: true,
        onConfirm: () =>
          void runGeste('cancel', async () => {
            const result = await cancelShipment(shipment.id);
            return result.refundAmountCents && result.refundAmountCents > 0
              ? t('actions.cancel.doneFull', {
                  amount: formatPrice(result.refundAmountCents, result.currencyCode, locale),
                })
              : t('actions.cancel.doneNone');
          }),
      };
    }

    if (which === 'regenerate') {
      return {
        title: t('actions.regenerate.confirmTitle'),
        lines: [
          t('actions.regenerate.confirmBody', { recipientFirstName }),
          t('code.regenerationsLeft', { count: shipment.codeRegenerationsLeft }),
        ],
        confirmLabel: t('actions.regenerate.confirm'),
        keepLabel: t('actions.regenerate.keep'),
        pendingLabel: t('actions.regenerate.pending'),
        destructive: true,
        onConfirm: () =>
          void runGeste('regenerate', async () => {
            // Le nouveau code est servi par la réponse, mais on ne l'affiche
            // pas d'ici : la relecture de `GET /deals/:id` reste la seule
            // source du code à l'écran (A43).
            await regenerateDeliveryCode(shipment.id);
            return t('actions.regenerate.done', { recipientFirstName });
          }),
      };
    }

    return {
      title: t('actions.confirmDelivery.confirmTitle'),
      lines: [
        t('actions.confirmDelivery.confirmBody', { carrierFirstName }),
        t('actions.confirmDelivery.tip', { recipientFirstName }),
      ],
      confirmLabel: t('actions.confirmDelivery.confirm'),
      keepLabel: t('actions.confirmDelivery.keep'),
      pendingLabel: t('actions.confirmDelivery.pending'),
      destructive: true,
      onConfirm: () =>
        void runGeste('confirm', async () => {
          // `payoutStatus` revient dans la réponse : il n'est JAMAIS montré à
          // l'Expéditeur (2A) — un versement en échec est une affaire entre
          // Yamba et le Voyageur, et le colis est livré dans les deux cas.
          await confirmDelivery(shipment.id);
          return t('actions.confirmDelivery.done', { carrierFirstName });
        }),
    };
  }
}

/* ══ Blocs ═══════════════════════════════════════════════════════════════ */

/**
 * L'échéance qui court : la fenêtre d'acceptation (24 h) ou le versement
 * automatique (J+4). Les deux dates sont SERVIES ; on ne fait que décompter.
 * Échéance passée = pas de décompte à zéro : le serveur n'a simplement pas
 * encore basculé l'état, et on le dit.
 */
function Deadline({
  shipment,
  phase,
  carrierFirstName,
}: {
  shipment: ShipperShipmentDto;
  phase: ShipmentPhase;
  carrierFirstName: string;
}) {
  const t = useTranslations('shipment');
  const target =
    phase === 'AWAITING_CARRIER'
      ? shipment.expiresAt
      : phase === 'DELIVERED'
        ? shipment.payoutDueAt
        : null;
  if (!target) return null;

  // Recalculé à chaque rendu, pas à chaque seconde : un décompte en jours et
  // en heures n'a pas besoin d'une horloge, et une horloge réveille l'écran
  // soixante fois par minute pour rien.
  const left = remainingUntil(target, Date.now());
  const value = left
    ? left.days > 0
      ? t('countdown.remainingDays', { days: left.days, hours: left.hours })
      : left.hours > 0
        ? t('countdown.remainingHours', { hours: left.hours, minutes: left.minutes })
        : t('countdown.remainingMinutes', { minutes: left.minutes })
    : t('countdown.elapsed');

  const isAcceptance = phase === 'AWAITING_CARRIER';

  return (
    <Section title={t(isAcceptance ? 'countdown.acceptanceTitle' : 'countdown.payoutTitle')}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t(isAcceptance ? 'countdown.acceptanceBody' : 'countdown.payoutBody', { carrierFirstName })}
      </ThemedText>
    </Section>
  );
}

/**
 * La carte UNIQUE de l'écran. Trois états, jamais inventés :
 *   • avant la prise en charge, le code n'existe pas encore côté serveur —
 *     on dit quand il arrivera, on ne montre pas une case vide ;
 *   • en transit, il est là : en grand, groupé par trois, partageable ;
 *   • après la remise, il a servi — on le barre d'un mot plutôt que de le
 *     faire disparaître, parce que l'Expéditeur se souvient l'avoir vu.
 */
function CodeCard({
  shipment,
  phase,
  carrierFirstName,
  recipientFirstName,
  onShareAction,
  onRegenerateAction,
}: {
  shipment: ShipperShipmentDto;
  phase: ShipmentPhase;
  carrierFirstName: string;
  recipientFirstName: string;
  onShareAction: () => Promise<void>;
  onRegenerateAction?: () => void;
}) {
  const t = useTranslations('shipment');
  const theme = useTheme();

  // Clos sans livraison : le code n'a plus de sens, la carte n'a plus lieu.
  if (phase === 'DECLINED' || phase === 'EXPIRED' || phase === 'CANCELLED') return null;

  const code = shipment.deliveryCode;
  const validated = Boolean(shipment.deliveredAt);

  return (
    <View style={[styles.card, { borderColor: theme.backgroundElement }]}>
      <View style={styles.cardHead}>
        <ThemedText type="smallBold" style={styles.flex}>
          {t('code.title')}
        </ThemedText>
        {!code && !validated ? (
          <View style={[styles.pill, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('code.waitingBadge')}
            </ThemedText>
          </View>
        ) : null}
        {validated ? (
          <View style={[styles.pill, { backgroundColor: `${Brand.teal}1A` }]}>
            <ThemedText type="small" style={{ color: Brand.teal }}>
              {t('code.validatedBadge')}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {code && !validated ? (
        <>
          <Overline>{t('code.label', { recipientFirstName })}</Overline>
          <ThemedText style={styles.code}>{groupDeliveryCode(code)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('code.hint')}
          </ThemedText>
          <View style={styles.cardActions}>
            <Action
              label={t('actions.shareCode.label', { recipientFirstName })}
              icon="share-outline"
              onPressAction={() => void onShareAction()}
            />
            {onRegenerateAction ? (
              <>
                <Action
                  label={t('actions.regenerate.label')}
                  tone="quiet"
                  onPressAction={onRegenerateAction}
                />
                <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                  {t('code.regenerationsLeft', { count: shipment.codeRegenerationsLeft })}
                </ThemedText>
              </>
            ) : null}
          </View>
        </>
      ) : validated ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('code.validatedBody', { carrierFirstName })}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {t('code.waitingBody', { carrierFirstName })}
        </ThemedText>
      )}

      {/* Un colis en transit SANS code servi : un enregistrement d'avant la
          révélation du code (B3). On le dit, on n'invente rien. */}
      {!code && !validated && (phase === 'PICKED_UP' || phase === 'IN_TRANSIT') ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('code.unavailable')}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Les étapes du voyage : le MIROIR des confirmations du Voyageur, jamais une
 * prédiction. Une étape non confirmée se dit « en attente » — Yamba ne suit
 * pas les vols, elle suit ce qu'une personne a confirmé (philosophie A+B).
 */
function Journey({
  shipment,
  carrierFirstName,
  recipientFirstName,
  locale,
}: {
  shipment: ShipperShipmentDto;
  carrierFirstName: string;
  recipientFirstName: string;
  locale: SupportedLocale;
}) {
  const t = useTranslations('shipment');
  const theme = useTheme();

  const confirmed = new Map(shipment.trackingEvents.map((e) => [e.step, e.confirmedAt]));
  const rows: { key: string; label: string; at: string | null; zone: string | null | undefined }[] = [
    {
      key: 'pickedUp',
      label: t('journey.pickedUp'),
      at: shipment.pickedUpAt ?? null,
      zone: shipment.trip.originTimezone,
    },
    {
      key: 'AT_AIRPORT',
      label: t('journey.AT_AIRPORT'),
      at: confirmed.get('AT_AIRPORT') ?? null,
      zone: shipment.trip.originTimezone,
    },
    {
      key: 'FLIGHT_DEPARTED',
      label: t('journey.FLIGHT_DEPARTED', { destination: shipment.trip.destinationCity }),
      at: confirmed.get('FLIGHT_DEPARTED') ?? null,
      zone: shipment.trip.originTimezone,
    },
    {
      key: 'FLIGHT_ARRIVED',
      label: t('journey.FLIGHT_ARRIVED', { destination: shipment.trip.destinationCity }),
      at: confirmed.get('FLIGHT_ARRIVED') ?? null,
      zone: shipment.trip.destinationTimezone,
    },
    {
      key: 'delivery',
      label: t('journey.delivery', { recipientFirstName }),
      at: shipment.deliveredAt ?? null,
      zone: shipment.trip.destinationTimezone,
    },
  ];

  return (
    <Section title={t('journey.title')}>
      {rows.map((row) => (
        <View key={row.key} style={styles.journeyRow}>
          <View
            style={[
              styles.journeyDot,
              { backgroundColor: row.at ? Brand.teal : theme.backgroundSelected },
            ]}
          />
          <View style={styles.flex}>
            <ThemedText type="small" themeColor={row.at ? 'text' : 'textSecondary'}>
              {row.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {row.at
                ? `${formatLongDate(row.at, locale)} · ${formatZonedTime(row.at, row.zone, locale)}`
                : row.key === 'delivery'
                  ? t('journey.deliveryPending', { carrierFirstName })
                  : t('journey.pending')}
            </ThemedText>
          </View>
        </View>
      ))}
    </Section>
  );
}

/** Une bande de vignettes. Aucune n'est cliquable : il n'y a pas d'écran de
 *  visionneuse, et un toucher sans effet se remarque plus qu'une image fixe. */
function Photos({ urls, label }: { urls: string[]; label: string }) {
  const t = useTranslations('shipment');
  if (urls.length === 0) return null;

  return (
    <View style={styles.photos}>
      <Overline>{`${label} · ${t('parcel.photosCount', { count: urls.length })}`}</Overline>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
        {urls.map((url) => (
          <Image key={url} source={{ uri: url }} style={styles.photo} contentFit="cover" />
        ))}
      </ScrollView>
    </View>
  );
}

/** Un lieu de rendez-vous : son genre (aéroport, gare, ville) et sa précision
 *  telle que l'Expéditeur l'a choisie — gelée dans la réservation. */
function PlaceLine({
  label,
  place,
  city,
  fallback,
  t,
}: {
  label: string;
  place: { kind: string; details?: string | null } | null | undefined;
  city: string;
  fallback: string;
  t: T;
}) {
  const theme = useTheme();
  const icon =
    (place ? LOCATION_ICONS[place.kind as keyof typeof LOCATION_ICONS] : null) ??
    DEFAULT_LOCATION_ICON;

  return (
    <View style={styles.placeRow}>
      <Ionicons name={icon} size={18} color={theme.textSecondary} />
      <View style={styles.flex}>
        <ThemedText type="small" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="smallBold">
          {place
            ? [t(`places.kinds.${place.kind}`), place.details || city].filter(Boolean).join(' · ')
            : fallback}
        </ThemedText>
      </View>
    </View>
  );
}

/* ══ Petites mises en forme ══════════════════════════════════════════════ */

function toneBackground(tone: 'wait' | 'good' | 'done' | 'alert'): string {
  if (tone === 'good') return `${Brand.teal}1A`;
  if (tone === 'wait') return 'rgba(255,153,0,0.16)';
  if (tone === 'alert') return 'rgba(220,38,38,0.14)';
  return 'rgba(128,128,128,0.16)';
}

function toneColor(tone: 'wait' | 'good' | 'done' | 'alert'): string {
  if (tone === 'good') return Brand.teal;
  if (tone === 'wait') return Brand.mangoDark;
  if (tone === 'alert') return '#DC2626';
  return '#808080';
}

/** « 2,3 kg » et pas « 2.3 kg » : c'est le format du nombre qui porte la
 *  langue, jamais une concaténation (le défaut corrigé le 18/10 sur le web). */
function formatKg(value: number, locale: SupportedLocale): string {
  try {
    return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return String(value);
  }
}

/** Les huit familles D14 — la liste FERMÉE du contrat. Une famille hors
 *  liste (il n'en existe pas, mais le DTO est une chaîne) s'affiche telle
 *  quelle : visible, jamais traduite de travers. */
const FAMILIES = [
  'DOCUMENTS_PAPERS',
  'CLOTHES_TEXTILE',
  'FOOD_DRY_SEALED',
  'ELECTRONICS_DEVICES',
  'COSMETICS_CARE',
  'PARTS_TOOLS',
  'TOYS_CHILDCARE',
  'MISC_ACCESSORIES',
] as const;

/** La famille D14 si elle est là (« Vêtements & textile »), sinon la catégorie
 *  legacy telle quelle — jamais une étiquette inventée pour une clé absente.
 *  Les libellés vivent dans le dictionnaire, comme tout le reste : pas de
 *  `fr ? … : …` ni de table de chaînes françaises dans un composant. */
function familyLabel(shipment: ShipperShipmentDto, t: T): string {
  const family = shipment.parcel.categoryFamily;
  if (!family) return shipment.parcel.category;
  return (FAMILIES as readonly string[]).includes(family) ? t(`families.${family}`) : family;
}

function protectionLabel(tier: string, t: ReturnType<typeof useTranslations<'shipment'>>): string {
  return tier === 'EXTENDED_500' ? t('protectionTiers.EXTENDED_500') : t('protectionTiers.BASIC');
}

function disputeCategoryLabel(
  category: string,
  t: T
): string {
  const known = ['NOT_DELIVERED', 'CONTENT_MISSING', 'DAMAGED', 'SIGNIFICANT_DELAY', 'RECIPIENT_ISSUE', 'OTHER'];
  return known.includes(category) ? t(`dispute.categories.${category}`) : category;
}

function disputeOutcomeLabel(
  outcome: string,
  t: T
): string {
  const known = ['FULL_REFUND', 'PARTIAL_REFUND', 'CONTACT_CARRIER', 'YAMBA_DECIDES'];
  return known.includes(outcome) ? t(`dispute.outcomes.${outcome}`) : outcome;
}

function carrierLine(
  phase: ShipmentPhase,
  t: T
): string | null {
  if (phase === 'AWAITING_CARRIER') return t('carrier.awaiting');
  if (phase === 'ACCEPTED') return t('carrier.accepted');
  if (phase === 'PICKED_UP' || phase === 'IN_TRANSIT') return t('carrier.transit');
  return null;
}

/** La ligne de date sous l'état : clôture, fin ou ouverture de signalement. */
function closureLine(
  shipment: ShipperShipmentDto,
  phase: ShipmentPhase,
  closure: ReturnType<typeof closureKey>,
  locale: SupportedLocale,
  t: T
): string | null {
  const iso = closureDate(shipment, phase);
  if (!iso) return null;
  const date = formatLongDate(iso, locale);
  if (!date) return null;
  if (phase === 'AWAITING_CARRIER') return null; // le décompte le dit mieux
  if (closure === 'completed') return t('completedOn', { date });
  if (closure === 'disputed') return t('openedOn', { date });
  return t('closedOn', { date });
}

/** La note d'argent : ce qui est vrai MAINTENANT, pas une généralité. */
function paymentNote(
  shipment: ShipperShipmentDto,
  phase: ShipmentPhase,
  authorizedOnly: boolean,
  carrierFirstName: string,
  t: T
): string {
  if (phase === 'DISPUTED') return t('payment.noteFrozen');
  if (authorizedOnly) return t('payment.noteAuthorized', { carrierFirstName });
  if (phase === 'COMPLETED') return t('payment.noteReleased', { carrierFirstName });
  return t('payment.noteHeld', { carrierFirstName });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
  },
  scroll: { paddingTop: Spacing.two },
  stateBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centered: { textAlign: 'center' },
  flex: { flex: 1, minWidth: 0 },

  hero: { gap: Spacing.two, paddingBottom: Spacing.three },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 24, lineHeight: 32 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.one },

  friseRow: { flexDirection: 'row', gap: Spacing.one },
  friseItem: { flex: 1, alignItems: 'center', gap: Spacing.one },
  friseDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friseLabel: { fontSize: 11, lineHeight: 14, textAlign: 'center' },

  /* LA carte de l'écran */
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  pill: { borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  code: { fontSize: 38, lineHeight: 46, fontWeight: 800, letterSpacing: 4 },
  cardActions: { gap: Spacing.two, paddingTop: Spacing.one },

  journeyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  journeyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },

  placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },

  carrierRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  photos: { gap: Spacing.two, paddingTop: Spacing.one },
  photoRow: { gap: Spacing.two },
  photo: { width: 84, height: 84, borderRadius: 12 },

  bottomBar: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

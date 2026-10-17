/**
 * booking/parcel.tsx — ÉTAPE 1 sur 7 : le colis.
 * ===============================================
 * La première décision du parcours de réservation : **ce qu'on envoie**.
 * Quatre choix, dans l'ordre où on se les pose — le produit (un colis au kilo
 * ou un bagage entier au forfait), le contenu (les 8 familles D14), la taille
 * (PRC-03) et le poids — et un prix qui bouge à chaque geste.
 *
 * Pourquoi ces quatre-là et rien d'autre : sur le site, l'étape 1 porte HUIT
 * sections (lieux, règles d'or, catégorie, poids, valeur, description, photos,
 * garantie). Transposée telle quelle, elle ferait sur un téléphone le
 * formulaire à rallonge que la fiche trajet a dû désempiler (A213). Ici, une
 * décision par page : la valeur, les photos et la description sont l'étape 2,
 * les lieux l'étape 3, la garantie l'étape 4.
 *
 * Ce que l'écran NE fait pas :
 *   • il ne calcule aucune formule — le devis vient de `@packages/pricing`,
 *     LE moteur, celui du snapshot serveur (D34) ; il PROJETTE, le serveur
 *     tranche et fige (D17) ;
 *   • il n'invente aucune limite — les familles refusées, les forfaits non
 *     proposés et les kilos restants viennent du trajet, et tout est revérifié
 *     par le serveur à la création de la réservation (RG-MOB-1).
 *
 * Un visiteur anonyme peut composer son colis : rien ici n'est personnel. La
 * porte d'identité tombera à l'étape du destinataire, pas avant — on ne
 * demande pas de compte pour regarder un prix.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
import {
  setBookingDraft,
  startBookingDraft,
  useBookingDraft,
  type ParcelFamily,
  type ParcelProduct,
  type SizeClass,
} from '@/lib/booking-draft';
import {
  MAX_PARCEL_KG,
  PARCEL_FAMILIES,
  SIZE_CLASSES,
  familyStance,
  offeredProducts,
  parseWeight,
  quoteDraft,
  validateParcelStep,
  type ParcelErrors,
} from '@/lib/booking-rules';
import { formatPrice } from '@/lib/trip-format';

/** Les raccourcis de poids : les colis réels, pas une règle graduée. */
const WEIGHT_SHORTCUTS = [1, 2, 5, 10] as const;

type SizeIcon = 'purse-outline' | 'bag-personal-outline' | 'bag-suitcase-outline';

const SIZE_ICONS: Record<SizeClass, SizeIcon> = {
  S: 'purse-outline',
  M: 'bag-personal-outline',
  L: 'bag-suitcase-outline',
};

export default function BookingParcelScreen() {
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const t = useTranslations('booking');
  const theme = useTheme();
  const locale = useLocale() as SupportedLocale;

  const [trip, setTrip] = useState<PublicTrip | null>(null);
  const [failed, setFailed] = useState(false);
  const [params, setParams] = useState(currentPricingParams);
  const [showErrors, setShowErrors] = useState(false);
  const [nextStepSoon, setNextStepSoon] = useState(false);
  const draft = useBookingDraft();

  useEffect(() => {
    let alive = true;
    if (!tripId) {
      setFailed(true);
      return;
    }
    void getPublicTrip(tripId)
      .then((loaded) => {
        if (!alive) return;
        startBookingDraft(loaded);
        setTrip(loaded);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [tripId]);

  // Les paramètres de la plateforme (D62) : tant qu'ils ne sont pas là, le
  // devis se calcule avec les défauts du moteur — jamais une attente visible.
  useEffect(() => {
    void loadPricingParams().then(setParams);
  }, []);

  const errors: ParcelErrors = useMemo(
    () => (trip ? validateParcelStep(draft, trip) : {}),
    [draft, trip]
  );

  const quote = useMemo(
    () => (trip ? quoteDraft(draft, trip, params) : null),
    [draft, trip, params]
  );

  const onContinue = useCallback(() => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setNextStepSoon(false);
      return;
    }
    // L'étape 2 (valeur, photos, description) est le lot suivant : on le DIT,
    // on ne pousse pas vers une page qui n'existe pas.
    setShowErrors(false);
    setNextStepSoon(true);
  }, [errors]);

  if (failed) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{t('unavailable.title')}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {t('unavailable.body')}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: theme.backgroundElement }]}>
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

  const products = offeredProducts(trip);
  const remainingKg = typeof trip.remainingKg === 'number' ? trip.remainingKg : null;
  const priceLabel =
    quote?.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null;
  const priceHint =
    quote?.ok === true
      ? t('bar.allIn')
      : t(`bar.quoteError.${quote?.code === 'MISSING_WEIGHT' ? 'MISSING_WEIGHT' : 'GENERIC'}`);

  return (
    <BookingStepFrame
      title={t('parcel.title')}
      step={1}
      priceLabel={priceLabel}
      priceHint={priceHint}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      {/* Ce qu'on réserve, en une ligne : on ne laisse jamais oublier le trajet. */}
      <ThemedText type="small" themeColor="textSecondary">
        {[trip.origin.city, trip.destination.city].filter(Boolean).join(' → ')}
      </ThemedText>

      {/* 1. Le produit — masqué quand le trajet ne propose QUE le colis :
          un choix à une seule option n'est pas un choix. */}
      {products.length > 1 ? (
        <Section title={t('parcel.productTitle')}>
          <View style={styles.cards}>
            {products.map((product) => (
              <ProductCard
                key={product}
                active={draft.product === product}
                title={t(`parcel.products.${product}`)}
                hint={t(`parcel.productHints.${product}`)}
                price={productPrice(trip, product, locale)}
                onPressAction={() => setBookingDraft({ product })}
              />
            ))}
          </View>
          {showErrors && errors.product ? <ErrorLine message={t(`parcel.errors.${errors.product}`, { kg: remainingKg ?? 0 })} /> : null}
        </Section>
      ) : null}

      {draft.product === 'PARCEL' ? (
        <>
          {/* 2. Le contenu — les 8 familles D14. Les refusées RESTENT visibles,
              barrées : une porte fermée qu'on ne montre pas devient une
              question (« pourquoi ma famille n'est pas là ? »). */}
          <Section title={t('parcel.familyTitle')} hint={t('parcel.familyHint')}>
            <View style={styles.chips}>
              {PARCEL_FAMILIES.map((family) => (
                <FamilyChip
                  key={family}
                  family={family}
                  label={t(`parcel.families.${family}`)}
                  trip={trip}
                  active={draft.family === family}
                  surchargeLabel={(pct) => t('parcel.surcharge', { pct })}
                  onPressAction={() => setBookingDraft({ family })}
                />
              ))}
            </View>
            {showErrors && errors.family ? <ErrorLine message={t(`parcel.errors.${errors.family}`)} /> : null}
          </Section>

          {/* 3. La taille (PRC-03) — le coefficient est DIT : un supplément
              silencieux dans un total est un supplément qu'on subit. */}
          <Section title={t('parcel.sizeTitle')}>
            <View style={styles.cards}>
              {SIZE_CLASSES.map((size) => (
                <SizeCard
                  key={size}
                  active={draft.sizeClass === size}
                  icon={SIZE_ICONS[size]}
                  label={t(`parcel.sizes.${size}`)}
                  example={t(`parcel.sizeExamples.${size}`)}
                  coef={params.sizeCoef[size]}
                  coefLabel={t('parcel.sizeCoef', { coef: formatCoef(params.sizeCoef[size], locale) })}
                  onPressAction={() => setBookingDraft({ sizeClass: size })}
                />
              ))}
            </View>
          </Section>

          {/* 4. Le poids — saisie libre ET raccourcis : on tape rarement
              « 2 », on le choisit. */}
          <Section title={t('parcel.weightTitle')} hint={t('parcel.weightHint')}>
            <View style={[styles.weightRow, { borderColor: theme.backgroundElement }]}>
              <TextInput
                value={draft.weightKg}
                onChangeText={(weightKg) => setBookingDraft({ weightKg })}
                keyboardType="decimal-pad"
                inputMode="decimal"
                maxLength={5}
                selectTextOnFocus
                accessibilityLabel={t('parcel.weightTitle')}
                style={[styles.weightInput, { color: theme.text }]}
              />
              <ThemedText type="subtitle" themeColor="textSecondary">
                {t('parcel.weightUnit')}
              </ThemedText>
            </View>
            <View style={styles.chips}>
              {WEIGHT_SHORTCUTS.filter((kg) => remainingKg === null || kg <= remainingKg).map((kg) => {
                const active = parseWeight(draft.weightKg) === kg;
                return (
                  <Pressable
                    key={kg}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setBookingDraft({ weightKg: String(kg) })}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? `${Brand.mango}22` : theme.backgroundElement,
                        borderColor: active ? Brand.mango : 'transparent',
                      },
                    ]}>
                    <ThemedText type="small">{t('parcel.weightShortcut', { kg })}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
            {remainingKg !== null ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('parcel.remaining', { kg: remainingKg })}
              </ThemedText>
            ) : null}
            {showErrors && errors.weightKg ? (
              <ErrorLine
                message={t(`parcel.errors.${errors.weightKg}`, { kg: remainingKg ?? 0, max: MAX_PARCEL_KG })}
              />
            ) : null}
          </Section>
        </>
      ) : null}

      {nextStepSoon ? (
        <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="arrow-forward-circle-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
            {t('parcel.nextStepSoon')}
          </ThemedText>
        </View>
      ) : null}
    </BookingStepFrame>
  );
}

// ============================================================
// Pièces d'écran
// ============================================================

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      {children}
    </View>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <View style={styles.errorRow}>
      <Ionicons name="alert-circle" size={16} color="#DC2626" />
      <ThemedText type="small" style={styles.errorText}>
        {message}
      </ThemedText>
    </View>
  );
}

function ProductCard({
  active,
  title,
  hint,
  price,
  onPressAction,
}: {
  active: boolean;
  title: string;
  hint: string;
  price: string | null;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPressAction}
      style={[
        styles.card,
        {
          backgroundColor: active ? `${Brand.mango}14` : theme.backgroundElement,
          borderColor: active ? Brand.mango : 'transparent',
        },
      ]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {hint}
      </ThemedText>
      {price ? <ThemedText type="small">{price}</ThemedText> : null}
    </Pressable>
  );
}

function SizeCard({
  active,
  icon,
  label,
  example,
  coef,
  coefLabel,
  onPressAction,
}: {
  active: boolean;
  icon: SizeIcon;
  label: string;
  example: string;
  coef: number;
  coefLabel: string;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={onPressAction}
      style={[
        styles.card,
        {
          backgroundColor: active ? `${Brand.mango}14` : theme.backgroundElement,
          borderColor: active ? Brand.mango : 'transparent',
        },
      ]}>
      <MaterialCommunityIcons name={icon} size={22} color={active ? Brand.mango : theme.text} />
      <ThemedText type="smallBold">{label}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {example}
      </ThemedText>
      {coef > 1 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {coefLabel}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function FamilyChip({
  family,
  label,
  trip,
  active,
  surchargeLabel,
  onPressAction,
}: {
  family: ParcelFamily;
  label: string;
  trip: PublicTrip;
  active: boolean;
  surchargeLabel: (pct: number) => string;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  const stance = familyStance(trip, family);
  const refused = stance.mode === 'REFUSE';

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active, disabled: refused }}
      disabled={refused}
      onPress={onPressAction}
      style={[
        styles.chip,
        {
          backgroundColor: active ? `${Brand.mango}22` : theme.backgroundElement,
          borderColor: active ? Brand.mango : 'transparent',
          opacity: refused ? 0.45 : 1,
        },
      ]}>
      <ThemedText type="small" style={refused ? styles.refused : undefined}>
        {label}
      </ThemedText>
      {stance.mode === 'SURCHARGE' && stance.surchargePct > 0 ? (
        <ThemedText type="small" style={styles.surcharge}>
          {surchargeLabel(stance.surchargePct)}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

// ============================================================
// Mise en forme
// ============================================================

function productPrice(
  trip: PublicTrip,
  product: ParcelProduct,
  locale: SupportedLocale
): string | null {
  if (product === 'CHECKED_BAG_23KG' && trip.checkedBag23PriceCents) {
    return formatPrice(trip.checkedBag23PriceCents, trip.currencyCode, locale);
  }
  if (product === 'CABIN_BAG_12KG' && trip.cabinBag12PriceCents) {
    return formatPrice(trip.cabinBag12PriceCents, trip.currencyCode, locale);
  }
  if (product === 'PARCEL' && trip.pricePerKgCents) {
    return `${formatPrice(trip.pricePerKgCents, trip.currencyCode, locale)}/kg`;
  }
  return null;
}

/** « 1,1 » en français, « 1.1 » en anglais — sans passer par `Intl` (Hermes). */
function formatCoef(coef: number, locale: SupportedLocale): string {
  const text = String(coef);
  return locale === 'fr' ? text.replace('.', ',') : text;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  backButton: {
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    letterSpacing: 0.6,
  },
  cards: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  card: {
    flex: 1,
    gap: Spacing.one,
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 40,
  },
  refused: {
    textDecorationLine: 'line-through',
  },
  surcharge: {
    color: Brand.mango,
    fontWeight: '700',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  weightInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    paddingVertical: Spacing.two,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  errorText: {
    color: '#DC2626',
    flex: 1,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: 12,
    padding: Spacing.three,
  },
  noticeText: {
    flex: 1,
  },
});

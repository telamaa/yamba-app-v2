/**
 * booking/parcel.tsx — ÉTAPE 1 sur 7 : le colis.
 * ===============================================
 * La première décision du parcours de réservation : **ce qu'on envoie**.
 * Quatre choix, dans l'ordre où on se les pose — le produit (un colis au kilo
 * ou un bagage entier au forfait), le contenu (les 8 familles D14), le poids,
 * puis la taille (PRC-03) — et un prix qui bouge à chaque geste.
 *
 * Le poids vient AVANT la taille pour une raison de vérité : sans poids, aucun
 * écart de prix n'est calculable, et la taille devrait se vendre avec un
 * coefficient (« ×1,1 ») — de la mécanique interne. Le poids posé, chaque
 * taille annonce ce qu'elle COÛTE en euros (revue UX 17/10, comme la carte de
 * résultat le 16/10).
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
import { countryFlag } from '@/lib/country-name';
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

/** Le plus petit colis qu'on accepte de peser — en dessous, c'est une erreur de saisie. */
const MIN_PARCEL_KG = 0.1;

/**
 * Le PAS du sélecteur de poids. Fin là où vivent les colis réels (sous 5 kg,
 * un demi-kilo change le prix), plus large au-dessus où la précision n'apporte
 * rien et où il faudrait vingt appuis.
 */
function weightStep(kg: number): number {
  return kg < 5 ? 0.5 : 1;
}



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
  const [showRefused, setShowRefused] = useState(false);
  /** Le clavier ne monte QUE si on le demande, en touchant la valeur. */
  const [editingWeight, setEditingWeight] = useState(false);
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
        // Un trajet qui ne propose RIEN (ni prix au kilo, ni forfait bagage)
        // n'est pas réservable : mieux vaut le dire que d'ouvrir un formulaire
        // dont aucun devis ne sortira.
        const offered = offeredProducts(loaded);
        if (offered.length === 0) {
          setFailed(true);
          return;
        }
        startBookingDraft(loaded, offered[0]);
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

  // PRC-03 — ce que chaque taille COÛTE, en euros, par le même moteur que le
  // total. `null` tant que le poids manque : on n'affiche pas un écart inventé.
  const sizeDeltaCents = useMemo((): Record<SizeClass, number> | null => {
    if (!trip || draft.product !== 'PARCEL' || !parseWeight(draft.weightKg)) return null;
    const totals: number[] = [];
    for (const size of SIZE_CLASSES) {
      const result = quoteDraft({ ...draft, sizeClass: size }, trip, params);
      if (!result.ok) return null;
      totals.push(result.quote.totalShipperCents);
    }
    const cheapest = Math.min(...totals);
    return { S: totals[0] - cheapest, M: totals[1] - cheapest, L: totals[2] - cheapest };
  }, [draft, trip, params]);

  // D14 — ce que le Voyageur accepte d'abord, ses refus comptés et repliés.
  const acceptedFamilies = useMemo(
    () => (trip ? PARCEL_FAMILIES.filter((f) => familyStance(trip, f).mode !== 'REFUSE') : []),
    [trip]
  );
  const refusedFamilies = useMemo(
    () => (trip ? PARCEL_FAMILIES.filter((f) => familyStance(trip, f).mode === 'REFUSE') : []),
    [trip]
  );

  // D81 — à ce poids, la taille ne change RIEN : le colis pèse déjà plus que
  // TOUS les minimums de taille (le plus haut est celui de L). On le dit, au
  // lieu de laisser croire que la question est décorative.
  const sizeIsFlat =
    sizeDeltaCents !== null &&
    sizeDeltaCents.S === 0 &&
    sizeDeltaCents.M === 0 &&
    sizeDeltaCents.L === 0;

  const weightValue = parseWeight(draft.weightKg);

  /**
   * Le pas, borné par la capacité du trajet et le maximum par colis. On arrondit
   * au dixième : `0.1 + 0.2` ne vaut pas `0.3` en virgule flottante, et un poids
   * affiché « 2.9000000000000004 » ruine une interface.
   */
  const adjustWeight = useCallback(
    (direction: 1 | -1) => {
      const current = parseWeight(draft.weightKg) ?? 0;
      const next = Math.round((current + direction * weightStep(current)) * 10) / 10;
      const ceiling = Math.min(MAX_PARCEL_KG, trip?.remainingKg ?? MAX_PARCEL_KG);
      setBookingDraft({ weightKg: String(Math.min(ceiling, Math.max(MIN_PARCEL_KG, next))) });
    },
    [draft.weightKg, trip?.remainingKg]
  );

  /**
   * La jauge se remplit du poids FACTURÉ, pas du poids déclaré (D81, CAP-01) :
   * c'est la place réellement réservée au Voyageur. Un colis L d'1 kg en prend
   * six, et la barre doit le montrer.
   */
  const capacityUsedKg = quote?.ok === true ? quote.quote.capacityKgConsumed : (weightValue ?? 0);
  const capacityTight =
    typeof trip?.remainingKg === 'number' && capacityUsedKg > trip.remainingKg * 0.8;

  /**
   * Pourquoi le poids facturé diffère du poids saisi. `billableReason` vivait
   * dans le devis depuis D81 sans jamais être affiché : l'Expéditeur voyait le
   * prix ne pas suivre son poids, sans explication.
   */
  const billedNote = useMemo(() => {
    if (quote?.ok !== true || !trip) return null;
    const { billableReason, billableWeightKg, sizeClass } = quote.quote;
    if (!billableReason || billableReason === 'ACTUAL' || billableWeightKg === null) return null;
    if (billableReason === 'SIZE_MIN') {
      return t('parcel.billed.SIZE_MIN', { kg: billableWeightKg, size: sizeClass ?? '' });
    }
    return t('parcel.billed.FLOOR', { kg: billableWeightKg });
  }, [quote, trip, t]);

  const onContinue = useCallback(() => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setNextStepSoon(false);
      return;
    }
    // L'étape ② est désormais LA GARANTIE (remontée du ④ au ②, 17/10 : c'est
    // elle qui rend les photos obligatoires, le web l'a placée juste après la
    // taille). Elle est le lot suivant : on le DIT, on ne pousse pas vers une
    // page qui n'existe pas.
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

  const routeLabel = [
    [countryFlag(trip.origin.countryCode), trip.origin.city].filter(Boolean).join(' '),
    [countryFlag(trip.destination.countryCode), trip.destination.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' → ');
  const products = offeredProducts(trip);
  const remainingKg = typeof trip.remainingKg === 'number' ? trip.remainingKg : null;
  const priceLabel =
    quote?.ok === true ? formatPrice(quote.quote.totalShipperCents, trip.currencyCode, locale) : null;
  // Les causes qu'on sait NOMMER. La liste est explicite et non dérivée du code
  // d'erreur : une clé construite à la volée qui n'existe pas fait planter le
  // rendu next-intl au lieu d'afficher un message approximatif.
  const QUOTE_ERROR_KEYS = ['MISSING_WEIGHT', 'MISSING_PRICE_PER_KG', 'BAG_NOT_OFFERED'] as const;
  const quoteErrorKey =
    quote?.ok === false && (QUOTE_ERROR_KEYS as readonly string[]).includes(quote.code)
      ? quote.code
      : 'GENERIC';
  const priceHint = quote?.ok === true ? t('bar.allIn') : t(`bar.quoteError.${quoteErrorKey}`);

  return (
    <BookingStepFrame
      title={t('parcel.title')}
      subtitle={t('parcel.subtitle')}
      step={1}
      priceLabel={priceLabel}
      priceHint={priceHint}
      ctaLabel={t('bar.continue')}
      onContinueAction={onContinue}>
      {/* Ce qu'on réserve, en une ligne : on ne laisse jamais oublier le trajet.
          Les drapeaux sont systématiques, trajet intérieur compris (A215) — ils
          disent le pays sans consommer de ligne. */}
      <ThemedText type="small" themeColor="textSecondary" accessibilityLabel={routeLabel}>
        {routeLabel}
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
          {/* 2. Le contenu — les 8 familles D14, mais ce que le Voyageur ACCEPTE
              d'abord. Les refusées restent atteignables derrière une ligne qui
              les COMPTE : la porte fermée est dite (« pourquoi ma famille n'est
              pas là ? » garde sa réponse) sans que six « non » barrés ouvrent
              la page (revue UX 17/10). */}
          <Section title={t('parcel.familyTitle')} hint={t('parcel.familyHint')}>
            <View style={styles.chips}>
              {acceptedFamilies.map((family) => (
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
            {refusedFamilies.length > 0 ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showRefused }}
                  onPress={() => setShowRefused((v) => !v)}
                  style={styles.refusedToggle}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('parcel.familyRefusedToggle', {
                      count: refusedFamilies.length,
                      name: trip.tripper.firstName,
                    })}
                  </ThemedText>
                  <Ionicons
                    name={showRefused ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={theme.textSecondary}
                  />
                </Pressable>
                {showRefused ? (
                  <View style={styles.chips}>
                    {refusedFamilies.map((family) => (
                      <FamilyChip
                        key={family}
                        family={family}
                        label={t(`parcel.families.${family}`)}
                        trip={trip}
                        active={false}
                        surchargeLabel={(pct) => t('parcel.surcharge', { pct })}
                        onPressAction={() => undefined}
                      />
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            {showErrors && errors.family ? <ErrorLine message={t(`parcel.errors.${errors.family}`)} /> : null}
          </Section>

          {/* 3 + 4. LE COLIS — un titre, puis UNE carte à filets fins où chaque
              ligne est « libellé gras · ligne grise · contrôle à droite ». La
              grammaire vient des références de recette (21/10) : des lignes
              pleine largeur plutôt que des colonnes serrées, du blanc plutôt que
              des cadres imbriqués. Poids et taille partagent la carte parce
              qu'ils partagent le calcul (D81), et l'ordre suit A214. */}
          <View style={styles.parcelSection}>
            <ThemedText type="subtitle">{t('parcel.cardTitle')}</ThemedText>

            <View style={[styles.optionCard, { borderColor: theme.backgroundElement }]}>
              {/* LE POIDS — modèle « Modifiez le nombre de voyageurs » : le
                  libellé et sa contrainte à gauche, le pas à droite. La
                  contrainte se dit en MOTS, pas en jauge : une phrase survit à
                  n'importe quel écran, et elle passe en mangue avant la limite. */}
              <View style={styles.optionRow}>
                <View style={styles.optionText}>
                  <ThemedText type="smallBold">{t('parcel.weightLabel')}</ThemedText>
                  <ThemedText
                    type="small"
                    themeColor={capacityTight ? undefined : 'textSecondary'}
                    style={capacityTight ? { color: Brand.mango } : undefined}>
                    {remainingKg === null
                      ? t('parcel.weightFree')
                      : t('parcel.capacityLeft', {
                          kg: Math.max(0, Math.round((remainingKg - capacityUsedKg) * 10) / 10),
                        })}
                  </ThemedText>
                </View>
                <View style={styles.stepper}>
                  <StepperButton
                    icon="remove"
                    accessibilityLabel={t('parcel.weightDecrease')}
                    disabled={weightValue !== null && weightValue <= MIN_PARCEL_KG}
                    onPressAction={() => adjustWeight(-1)}
                  />
                  {editingWeight ? (
                    <TextInput
                      value={draft.weightKg}
                      onChangeText={(weightKg) => setBookingDraft({ weightKg })}
                      onBlur={() => setEditingWeight(false)}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      maxLength={5}
                      autoFocus
                      selectTextOnFocus
                      accessibilityLabel={t('parcel.weightEdit')}
                      style={[styles.stepperInput, { color: theme.text }]}
                    />
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('parcel.weightEdit')}
                      onPress={() => setEditingWeight(true)}
                      style={styles.stepperValue}>
                      <ThemedText type="default">{draft.weightKg || '—'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('parcel.weightUnit')}
                      </ThemedText>
                    </Pressable>
                  )}
                  <StepperButton
                    icon="add"
                    accessibilityLabel={t('parcel.weightIncrease')}
                    disabled={remainingKg !== null && weightValue !== null && weightValue >= remainingKg}
                    onPressAction={() => adjustWeight(1)}
                  />
                </View>
              </View>

              {/* LES TAILLES — modèle « Choisissez quand vous souhaitez payer » :
                  des lignes pleine largeur, le choix par une pastille à DROITE,
                  et la conséquence en ligne grise. Les trois colonnes serrées
                  rognaient les libellés et n'offraient aucune cible confortable. */}
              {SIZE_CLASSES.map((size) => (
                <View key={size}>
                  <View style={[styles.hairline, { backgroundColor: theme.backgroundElement }]} />
                  <SizeRow
                    active={draft.sizeClass === size}
                    code={t(`parcel.sizes.${size}`)}
                    example={t(`parcel.sizeExamples.${size}`)}
                    detail={
                      sizeDeltaCents === null
                        ? null
                        : sizeDeltaCents[size] === 0
                          ? t('parcel.sizeIncluded')
                          : t('parcel.sizeExtra', {
                              amount: formatPrice(sizeDeltaCents[size], trip.currencyCode, locale),
                            })
                    }
                    onPressAction={() => setBookingDraft({ sizeClass: size })}
                  />
                </View>
              ))}
            </View>

            {showErrors && errors.weightKg ? (
              <ErrorLine
                message={t(`parcel.errors.${errors.weightKg}`, { kg: remainingKg ?? 0, max: MAX_PARCEL_KG })}
              />
            ) : null}

            {/* D81 expliqué sous la carte, comme « Annulation gratuite » sous le
                récapitulatif de la référence : la conséquence, en gris, au
                contact de la décision. */}
            <ThemedText type="small" themeColor="textSecondary">
              {/* Sans écart calculable, on distingue DEUX cas : le poids manque
                  (on le demande), ou le devis a échoué pour une autre raison —
                  et dans ce cas réclamer un poids déjà saisi est un mensonge. */}
              {billedNote ??
                (sizeDeltaCents !== null
                  ? sizeIsFlat
                    ? t('parcel.sizeHintFlat')
                    : t('parcel.sizeHint')
                  : weightValue === null
                    ? t('parcel.sizeHintPending')
                    : t('parcel.sizeHintNoPrice'))}
            </ThemedText>
          </View>
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

/**
 * Un bouton de pas. Cible de 44 px (le minimum tactile recommandé), et
 * `disabled` plutôt que caché : un bouton qui disparaît déplace l'autre sous le
 * doigt entre deux appuis.
 */
function StepperButton({
  icon,
  accessibilityLabel,
  disabled,
  onPressAction,
}: {
  icon: 'add' | 'remove';
  accessibilityLabel: string;
  disabled: boolean;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPressAction}
      style={({ pressed }) => [
        styles.stepperButton,
        {
          backgroundColor: theme.backgroundElement,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}>
      <Ionicons name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

/**
 * Une ligne de taille — grammaire « Choisissez quand vous souhaitez payer » :
 * le libellé gras, la conséquence en gris dessous, le choix par une pastille à
 * DROITE. Toute la ligne est la cible : sur un téléphone, viser une pastille de
 * 22 px est une épreuve.
 *
 * AUCUNE illustration (révision du 21/10). Les silhouettes à l'échelle avaient
 * un sens en COLONNES, où trois rectangles adjacents se comparent d'un regard.
 * Empilées en lignes, elles sont séparées par soixante pixels de texte : l'œil
 * ne compare plus rien, et la gouttière ne fait que pousser le libellé. Or
 * « une boîte à chaussures » dit déjà tout — ordonné et concret.
 */
function SizeRow({
  active,
  code,
  example,
  detail,
  onPressAction,
}: {
  active: boolean;
  code: string;
  example: string;
  /** Ce que cette taille change au prix — `null` tant que le poids manque. */
  detail: string | null;
  onPressAction: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={[code, example, detail].filter(Boolean).join(' ')}
      onPress={onPressAction}
      style={({ pressed }) => [styles.optionRow, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.optionText}>
        <ThemedText type="smallBold">
          {code} · {example}
        </ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: active ? Brand.mango : theme.textSecondary },
        ]}>
        {active ? <View style={[styles.radioDot, { backgroundColor: Brand.mango }]} /> : null}
      </View>
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
  refusedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  refused: {
    textDecorationLine: 'line-through',
  },
  surcharge: {
    color: Brand.mango,
    fontWeight: '700',
  },
  // LA CARTE DU COLIS — un titre, puis des lignes pleine largeur séparées par
  // un filet. Pas de cadre dans un cadre : le blanc fait la structure.
  parcelSection: {
    gap: Spacing.three,
  },
  optionCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  // Le filet n'atteint pas les bords de la carte : il sépare les lignes, il ne
  // la découpe pas en tranches.
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    minWidth: 52,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
  },
  stepperInput: {
    minWidth: 52,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
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

/**
 * booking-step-frame.tsx — le cadre commun des SEPT étapes de la réservation.
 * ===========================================================================
 * Le parcours est une pile de pages poussées, une décision par page. Toutes
 * partagent la même armature, et c'est elle qui tient la promesse faite sur la
 * fiche trajet (A213) : **la barre du bas ne bouge pas** — le prix à gauche,
 * le geste à droite, de la première étape au paiement.
 *
 * Trois partis pris :
 *   • le parcours compte SEPT écrans mais n'en annonce JAMAIS le nombre
 *     (arbitrage du 17/10). Il annonce les QUATRE phases du web — Colis,
 *     Livraison, Engagement, Paiement — et la jauge avance à chaque écran.
 *     Ce n'est pas le nombre d'écrans qui fait abandonner, c'est le nombre
 *     ANNONCÉ : « Étape 1 sur 7 » lu avant d'avoir rien saisi est un départ.
 *     Les écrans restent courts (règle « one thing per page ») — sur un
 *     téléphone, un formulaire long cache son CTA et ses erreurs ;
 *   • le TITRE de l'étape vit dans le contenu, pas dans l'en-tête — comme sur
 *     le web, où « Décris ton colis » est dans la carte et non dans la barre ;
 *   • le PRIX est permanent : chaque choix se paie, et on le voit se payer.
 *     Sur un téléphone, un total qu'il faut aller chercher est un total qu'on
 *     découvre trop tard (la leçon du 16/10 sur la liste de résultats) ;
 *   • le CTA reste ACTIF même quand l'étape est incomplète (doctrine A209) :
 *     il NOMME ce qui manque au tap, il ne se tait pas en gris.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Le nombre d'écrans du parcours. La jauge s'en sert, l'Expéditeur ne le lit jamais. */
export const BOOKING_STEPS = 7;

/**
 * Les QUATRE phases annoncées — les mêmes mots, dans le même ordre, que le
 * stepper du site. Les sept écrans s'y logent : « Colis » en couvre trois
 * (le colis, la garantie, le contenu), « Livraison » deux (les lieux, le
 * destinataire). La garantie est en ② et non en ④ : c'est elle qui rend les
 * photos obligatoires, le web l'a remontée juste après la taille (A214) — un
 * ordre natif qui la laisserait après les lieux casserait le regroupement.
 */
export const BOOKING_PHASES = [
  { key: 'parcel', lastStep: 3 },
  { key: 'delivery', lastStep: 5 },
  { key: 'commitment', lastStep: 6 },
  { key: 'payment', lastStep: 7 },
] as const;

/** La phase qui porte cet écran (1-indexé), et son rang parmi les quatre. */
export function phaseOfStep(step: number): { key: string; index: number } {
  const index = BOOKING_PHASES.findIndex((phase) => step <= phase.lastStep);
  const safe = index === -1 ? BOOKING_PHASES.length - 1 : index;
  return { key: BOOKING_PHASES[safe].key, index: safe };
}

type Props = {
  /** Le titre de l'étape — rendu EN TÊTE DU CONTENU, pas dans la barre. */
  title: string;
  /** La phrase sous le titre (facultative), comme sur le web. */
  subtitle?: string;
  /** 1 pour la première étape. */
  step: number;
  /** Le total, déjà mis en forme — ou `null` quand il n'est pas calculable. */
  priceLabel: string | null;
  /** La ligne sous le prix (« tout compris », ou la raison de son absence). */
  priceHint: string;
  ctaLabel: string;
  onContinueAction: () => void;
  children: ReactNode;
};

export function BookingStepFrame({
  title,
  subtitle,
  step,
  priceLabel,
  priceHint,
  ctaLabel,
  onContinueAction,
  children,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations('booking');
  const phase = phaseOfStep(step);
  const phaseLabel = t(`phases.${phase.key}`);
  // Le lecteur d'écran, lui, a droit au chiffre : « Colis, phase 1 sur 4 ».
  // Quatre, jamais sept — c'est la même promesse que ce qui est à l'écran.
  const progressLabel = t('phaseProgress', {
    phase: phaseLabel,
    current: phase.index + 1,
    total: BOOKING_PHASES.length,
  });

  return (
    <ThemedView style={styles.container}>
      <View style={styles.column}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('back')}
              onPress={() => router.back()}
              hitSlop={10}
              style={[styles.iconButton, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </Pressable>
            {/* Les quatre phases, d'un coup d'œil. `adjustsFontSizeToFit` plutôt
                qu'une troncature : sur un petit écran les quatre mots rétrécissent,
                ils ne disparaissent pas — une phase cachée est une phase qui
                n'existe pas pour celui qui la lit. */}
            <ThemedText
              type="small"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={styles.phases}
              accessibilityLabel={progressLabel}>
              {BOOKING_PHASES.map((item, index) => {
                const current = index === phase.index;
                return (
                  <ThemedText
                    key={item.key}
                    type={current ? 'smallBold' : 'small'}
                    themeColor={current ? undefined : 'textSecondary'}
                    style={current ? { color: Brand.mango } : undefined}>
                    {index > 0 ? '  ·  ' : ''}
                    {t(`phases.${item.key}`)}
                  </ThemedText>
                );
              })}
            </ThemedText>
          </View>
          {/* La jauge avance à CHAQUE écran (septièmes), alors que l'en-tête
              n'annonce que quatre phases : on sent qu'on progresse sans jamais
              compter jusqu'à sept. */}
          <View
            style={[styles.gaugeTrack, { backgroundColor: theme.backgroundElement }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={progressLabel}>
            <View
              style={[
                styles.gaugeFill,
                { width: `${(Math.min(step, BOOKING_STEPS) / BOOKING_STEPS) * 100}%` },
              ]}
            />
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
          <ThemedText type="title" style={styles.stepTitle}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.stepSubtitle}>
              {subtitle}
            </ThemedText>
          ) : null}
          {children}
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundElement,
              paddingBottom: Math.max(insets.bottom, Spacing.three),
            },
          ]}>
          <View style={styles.price}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {priceLabel ?? '—'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {priceHint}
            </ThemedText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onContinueAction}
            style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
            <ThemedText type="smallBold" style={styles.ctaLabel}>
              {ctaLabel}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  column: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phases: {
    flex: 1,
    textAlign: 'right',
  },
  gaugeTrack: {
    height: 3,
    borderRadius: 2,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: Brand.mango,
  },
  // Le titre de l'étape ouvre le contenu — `gap` du conteneur l'espace déjà,
  // le sous-titre se recolle dessous par une marge négative.
  stepTitle: {
    marginBottom: 0,
  },
  stepSubtitle: {
    marginTop: -Spacing.four,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.five,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  price: {
    flex: 1,
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: 48,
    justifyContent: 'center',
  },
  ctaLabel: {
    color: '#1A1A1A',
    fontSize: 15,
  },
});

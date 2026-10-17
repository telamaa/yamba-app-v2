/**
 * booking-step-frame.tsx — le cadre commun des SEPT étapes de la réservation.
 * ===========================================================================
 * Le parcours est une pile de pages poussées, une décision par page. Toutes
 * partagent la même armature, et c'est elle qui tient la promesse faite sur la
 * fiche trajet (A213) : **la barre du bas ne bouge pas** — le prix à gauche,
 * le geste à droite, de la première étape au paiement.
 *
 * Trois partis pris :
 *   • un en-tête aligné à GAUCHE (le titre d'une étape, pas d'une modale) et
 *     une jauge de progression en segments — on sait où on en est et combien
 *     il reste, sans compter des points ;
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

/** Le nombre d'étapes du parcours — la jauge le dit, elle ne le devine pas. */
export const BOOKING_STEPS = 7;

type Props = {
  title: string;
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
            <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
              {title}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('progress', { current: step, total: BOOKING_STEPS })}
            </ThemedText>
          </View>
          {/* La jauge : des segments, pas une barre continue — on compte les
              étapes qui restent du regard. */}
          <View
            style={styles.gauge}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('progress', { current: step, total: BOOKING_STEPS })}>
            {Array.from({ length: BOOKING_STEPS }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.gaugeSegment,
                  {
                    backgroundColor: index < step ? Brand.mango : theme.backgroundElement,
                  },
                ]}
              />
            ))}
          </View>
        </SafeAreaView>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag">
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
  title: {
    flex: 1,
  },
  gauge: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  gaugeSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
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

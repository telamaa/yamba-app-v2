/**
 * publish-step-frame.tsx — le cadre commun des SEPT écrans de publication.
 * =========================================================================
 * Le jumeau du cadre de réservation (`booking/booking-step-frame.tsx`), et
 * c'est délibéré : les deux parcours du produit se tiennent de la même façon,
 * parce que c'est souvent LA MÊME PERSONNE qui envoie un colis un jour et
 * transporte le suivant (A210). Mêmes gestes, mêmes repères, deux rôles.
 *
 * Ce qui change, et qui n'est pas un détail : **la barre du bas ne montre pas
 * un prix, elle montre un GAIN**. Dans la réservation, chaque choix se paie et
 * on le voit se payer ; dans la publication, chaque choix RAPPORTE et on le
 * voit rapporter (D16 : le prix du Voyageur EST son net). Tant qu'il n'y a
 * rien à chiffrer, la barre dit où en est le trajet plutôt que d'afficher un
 * « 0 € » qui ne veut rien dire.
 *
 * Trois partis pris repris tels quels du parcours de réservation :
 *   • le nombre d'écrans n'est JAMAIS annoncé — trois PHASES le sont
 *     (« Trajet · Conditions · Vérification », les mots du site), la jauge
 *     avance à chaque écran ;
 *   • le titre de l'étape vit dans le contenu, pas dans l'en-tête ;
 *   • le bouton reste ACTIF quand l'étape est incomplète (doctrine A209) : il
 *     NOMME ce qui manque, il ne se tait pas en gris.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ECRANS_PUBLICATION, PHASES_PUBLICATION, phaseDeLEcran } from '@/lib/publish-trip';

type Props = {
  /** Le titre de l'étape — rendu EN TÊTE DU CONTENU, pas dans la barre. */
  title: string;
  subtitle?: string;
  /** 1 pour le premier écran du tunnel. */
  step: number;
  /** Le gain déjà mis en forme, ou l'état du trajet — jamais un zéro muet. */
  valueLabel: string;
  /** La ligne sous la valeur : ce qu'elle veut dire. */
  valueHint: string;
  ctaLabel: string;
  onContinueAction: () => void;
  children: ReactNode;
};

export function PublishStepFrame({
  title,
  subtitle,
  step,
  valueLabel,
  valueHint,
  ctaLabel,
  onContinueAction,
  children,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations('publish');
  const phase = phaseDeLEcran(step);
  // Le lecteur d'écran a droit au chiffre — TROIS, le nombre annoncé, jamais
  // sept : c'est la même promesse que ce qui est à l'écran.
  const progression = t('phaseProgress', {
    phase: t(`phases.${phase.cle}`),
    current: phase.rang + 1,
    total: PHASES_PUBLICATION.length,
  });

  return (
    <ThemedView style={styles.container}>
      <View style={styles.column}>
        <SafeAreaView edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <BackButton variant="boxed" label={t('back')} onPress={() => router.back()} />
            <ThemedText
              type="small"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={styles.phases}
              accessibilityLabel={progression}>
              {PHASES_PUBLICATION.map((item, index) => {
                const courante = index === phase.rang;
                return (
                  <ThemedText
                    key={item.cle}
                    type={courante ? 'smallBold' : 'small'}
                    themeColor={courante ? undefined : 'textSecondary'}
                    style={courante ? { color: Brand.mango } : undefined}>
                    {index > 0 ? '  ·  ' : ''}
                    {t(`phases.${item.cle}`)}
                  </ThemedText>
                );
              })}
            </ThemedText>
          </View>
          <View
            style={[styles.gaugeTrack, { backgroundColor: theme.backgroundElement }]}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={progression}>
            <View
              style={[
                styles.gaugeFill,
                { width: `${(Math.min(step, ECRANS_PUBLICATION) / ECRANS_PUBLICATION) * 100}%` },
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
          <View style={styles.value}>
            <ThemedText type="subtitle" numberOfLines={1}>
              {valueLabel}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
              {valueHint}
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
  value: {
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

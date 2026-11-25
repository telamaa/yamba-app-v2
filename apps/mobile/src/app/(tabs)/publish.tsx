/**
 * publish.tsx — l'écran « Publier », le « + » central de la barre (A210).
 * =======================================================================
 * Il est le cinquième élément de la barre, au MILIEU, et le seul qui ne soit
 * pas une destination mais une ACTION — le motif de Vinted, Leboncoin,
 * Instagram (le pourquoi est dans `(tabs)/_layout.tsx`). Sa seconde porte
 * est la carte CTA en tête d'Activité.
 *
 * CE N'EST PLUS UNE COQUILLE (A203) : le tunnel natif de publication existe,
 * et cet écran en est le SEUIL. Pourquoi un seuil plutôt que la première
 * question posée tout de suite :
 *   • le tunnel a une barre d'action permanente en bas (gain à gauche, geste
 *     à droite). Dans un onglet, elle se superposerait à la barre flottante —
 *     deux barres empilées, dont une qui ne concerne pas l'étape ;
 *   • publier, ce n'est pas naviguer : on le COMMENCE et on le termine. Les
 *     sept écrans se poussent donc par-dessus les onglets, comme les sept
 *     étapes de la réservation ;
 *   • et un trajet commencé doit pouvoir se REPRENDRE. C'est ici qu'on le
 *     propose, explicitement — jamais par une reprise automatique : un écran
 *     qui repart tout seul là où on l'avait laissé est un écran qu'on ne peut
 *     plus quitter (le défaut d'un seul coup de D106, pris par l'autre bout).
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { mesBrouillons, supprimerLeBrouillon, type TrajetServeur } from '@/lib/api/publish.api';
import {
  brouillonCommence,
  clearPublishDraft,
  remplacerLeBrouillon,
  usePublishDraft,
} from '@/lib/publish-draft';
import { brouillonDepuisLeTrajet, resumeDuBrouillon } from '@/lib/publish-reverse';

function PublishContent() {
  const t = useTranslations('publish');
  const theme = useTheme();
  const draft = usePublishDraft();
  const enCours = brouillonCommence(draft);

  /**
   * D111 quater — LE BROUILLON SERVEUR.
   *
   * Le brouillon local meurt avec l'app ; celui-ci survit à tout, y compris
   * à un changement de téléphone. On le relit À CHAQUE RETOUR sur l'écran
   * (et non une seule fois au montage) : il a pu être publié, repris ou
   * supprimé entre deux visites.
   *
   * Ordre de priorité quand les deux existent : le LOCAL d'abord — c'est le
   * plus frais, et c'est lui que le Voyageur vient de quitter.
   */
  const [brouillonServeur, setBrouillonServeur] = useState<TrajetServeur | null>(null);

  useFocusEffect(
    useCallback(() => {
      let vivant = true;
      void mesBrouillons().then((trajets) => {
        if (vivant) setBrouillonServeur(trajets[0] ?? null);
      });
      return () => {
        vivant = false;
      };
    }, [])
  );

  const resumeServeur = brouillonServeur === null ? null : resumeDuBrouillon(brouillonServeur);
  const reprendreLeServeur = useCallback(() => {
    if (brouillonServeur === null) return;
    remplacerLeBrouillon(brouillonDepuisLeTrajet(brouillonServeur));
    router.push('/publish-trip');
  }, [brouillonServeur]);

  const jeterLeServeur = useCallback(() => {
    if (brouillonServeur === null) return;
    void supprimerLeBrouillon(String(brouillonServeur.id));
    setBrouillonServeur(null);
    clearPublishDraft();
  }, [brouillonServeur]);

  const route =
    draft.depart !== null && draft.arrivee !== null
      ? t('bar.route', { from: draft.depart.ville, to: draft.arrivee.ville })
      : (draft.depart?.ville ?? draft.arrivee?.ville ?? t('launch.newTrip'));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.column} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title">{t('launch.title')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
            {t('launch.body')}
          </ThemedText>

          <View style={styles.points}>
            <Point icon="pricetag-outline" text={t('launch.point1')} />
            <Point icon="shield-checkmark-outline" text={t('launch.point2')} />
            <Point icon="wallet-outline" text={t('launch.point3')} />
          </View>

          {enCours ? (
            <View style={[styles.resume, { borderColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{t('launch.resumeTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('launch.resumeBody', { route })}
              </ThemedText>
              <View style={styles.resumeActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/publish-trip')}
                  style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
                  <ThemedText type="smallBold" style={styles.ctaLabel}>
                    {t('launch.resumeCta')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    // « Recommencer » jette AUSSI la copie serveur quand elle
                    // existe : la laisser ferait reproposer, au prochain
                    // lancement, le trajet qu'on vient d'abandonner.
                    if (draft.tripId !== null) void supprimerLeBrouillon(draft.tripId);
                    setBrouillonServeur(null);
                    clearPublishDraft();
                    router.push('/publish-trip');
                  }}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('launch.freshCta')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : resumeServeur !== null ? (
            <View style={[styles.resume, { borderColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{t('launch.savedTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('launch.savedBody', {
                  route: t('bar.route', { from: resumeServeur.depart, to: resumeServeur.arrivee }),
                })}
              </ThemedText>
              <View style={styles.resumeActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={reprendreLeServeur}
                  style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
                  <ThemedText type="smallBold" style={styles.ctaLabel}>
                    {t('launch.resumeCta')}
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={jeterLeServeur}
                  style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {t('launch.deleteCta')}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/publish-trip')}
              style={({ pressed }) => [styles.cta, styles.ctaAlone, { opacity: pressed ? 0.85 : 1 }]}>
              <ThemedText type="smallBold" style={styles.ctaLabel}>
                {t('launch.cta')}
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );

  function Point({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
    return (
      <View style={styles.point}>
        <View style={[styles.pointIcon, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name={icon} size={18} color={theme.text} />
        </View>
        <ThemedText type="small" style={styles.pointText}>
          {text}
        </ThemedText>
      </View>
    );
  }
}

export default function PublishScreen() {
  return (
    <IdentityGate destination="publish">
      <PublishContent />
    </IdentityGate>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.four,
  },
  body: {
    marginTop: -Spacing.two,
  },
  points: {
    gap: Spacing.three,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pointIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: {
    flex: 1,
    minWidth: 0,
  },
  resume: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  resumeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaAlone: {
    marginTop: Spacing.two,
  },
  ctaLabel: {
    color: '#1A1A1A',
    fontSize: 15,
  },
  secondary: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});

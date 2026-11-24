/**
 * publish-trip/done.tsx — LA FIN DU TUNNEL, ET LE RETOUR EN UN GESTE.
 * =====================================================================
 * Le premier jet renvoyait directement sur la fiche publique du trajet. Ce
 * n'était pas faux — on veut voir ce qu'on vient de publier — mais ça
 * laissait passer le seul moment où le Voyageur est à la fois convaincu et
 * disponible : **il vient de publier, et il rentre.**
 *
 * D'où cet écran, et son geste principal : « Publier le retour ». Les deux
 * villes sont inversées, les lieux d'échange avec elles (un lieu de remise à
 * Paris devient un lieu de livraison à Paris — même terminal, autre sens),
 * le prix, la capacité, les familles et les options sont gardés. Il ne reste
 * que les dates : le tunnel rouvre directement à l'écran ②.
 *
 * C'est ce qui remplace l'« Aller-retour » du site, qui promettait un retour
 * et n'en créait jamais (D100 : un contrôle qui affirme ce que le produit ne
 * fait pas). Ici le retour est un VRAI second trajet, que les Expéditeurs
 * trouveront.
 *
 * L'écran n'a pas de retour arrière : le tunnel est terminé, et il a été
 * REMPLACÉ dans la pile (`router.replace`). Ses trois sorties sont devant.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { oublierLeRetour, reprendreLeRetour, retourEnAttente } from '@/lib/publish-draft';

export default function PublishDoneScreen() {
  const { id, billet } = useLocalSearchParams<{ id?: string; billet?: string }>();
  const t = useTranslations('publish');
  const theme = useTheme();

  // Lu une fois, à l'affichage : c'est un instantané, pas un état qui vit.
  const retour = retourEnAttente();

  const publierLeRetour = useCallback(() => {
    if (!reprendreLeRetour()) return;
    // On repart à l'écran des DATES : tout le reste est déjà posé.
    router.replace('/publish-trip/when');
  }, []);

  const terminer = useCallback(() => {
    oublierLeRetour();
    router.dismissAll();
  }, []);

  const voirLeTrajet = useCallback(() => {
    oublierLeRetour();
    if (id) router.replace({ pathname: '/trip/[id]', params: { id } });
    else router.dismissAll();
  }, [id]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.column} edges={['top', 'left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.pastille, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="checkmark" size={28} color={Brand.teal} />
          </View>

          <ThemedText type="title">{t('done.title')}</ThemedText>
          {retour !== null && retour.arrivee !== null && retour.depart !== null ? (
            <ThemedText type="small" themeColor="textSecondary">
              {/* Le retour porte les villes DÉJÀ inversées : on les remet dans
                  le sens de l'aller pour dire ce qui vient d'être publié. */}
              {t('done.route', { from: retour.arrivee.ville, to: retour.depart.ville })}
            </ThemedText>
          ) : null}

          {/* Le trajet est publié, mais son billet n'est pas passé : on le DIT.
              Taire un échec que l'on connaît fait croire à un badge qui ne
              viendra pas. */}
          {billet === 'ko' ? (
            <View style={styles.avertissement}>
              <Ionicons name="alert-circle-outline" size={15} color={Brand.mango} />
              <ThemedText type="small" style={{ color: Brand.mango }}>
                {t('ticket.notAttached')}
              </ThemedText>
            </View>
          ) : null}

          {retour !== null ? (
            <View style={[styles.carte, { borderColor: theme.backgroundElement }]}>
              <ThemedText type="smallBold">{t('done.returnTitle')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('done.returnBody')}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={publierLeRetour}
                style={({ pressed }) => [styles.cta, { opacity: pressed ? 0.85 : 1 }]}>
                <ThemedText type="smallBold" style={styles.ctaLabel}>
                  {t('done.returnCta')}
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={voirLeTrajet}
            style={({ pressed }) => [
              styles.secondaire,
              { borderColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <ThemedText type="smallBold">{t('done.viewCta')}</ThemedText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={terminer}
            style={({ pressed }) => [styles.tertiaire, pressed && styles.pressed]}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('done.doneCta')}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  pastille: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avertissement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  carte: {
    borderWidth: 1,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  ctaLabel: {
    color: '#1A1A1A',
    fontSize: 15,
  },
  // Un texte centré au milieu du vide se lit comme une phrase, pas comme un
  // bouton — et c'est l'action principale quand il n'y a pas de retour à
  // proposer. Elle prend donc un contour.
  secondaire: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
  },
  tertiaire: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});

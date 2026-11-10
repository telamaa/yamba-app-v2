/**
 * auth-screen.tsx — le gabarit des écrans d'auth (refonte sur captures, A208).
 * ============================================================================
 * La composition des pages auth du SITE, en feuille : fond slate, badge
 * pilule teal « … sécurisée » avec bouclier, GROS titre navy, sous-titre
 * gris — puis le formulaire de l'écran. La feuille garde un geste de
 * fermeture discret en haut (chevron/croix), les retours d'étape sont des
 * LIENS dans le contenu (« ← Retour à la connexion »), comme sur le site.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Ionicons } from '@expo/vector-icons';
import { useTranslations } from 'use-intl';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';

type Props = {
  /**
   * Libellé du badge pilule (« Connexion sécurisée »…).
   *
   * OPTIONNEL depuis D91 : l'inscription n'en porte plus. Une affirmation de
   * sécurité que l'on se décerne à soi-même ne rassure pas — elle installe la
   * question que personne ne se posait, et elle occupe la première ligne de
   * l'écran pour ne rien dire de vérifiable. Les écrans qui en gardent un le
   * passent encore ; sans lui, la rangée du haut ne porte que la fermeture.
   */
  badge?: string;
  title: string;
  subtitle?: string;
  /** Croix (premier écran de la feuille) ou chevron (étape poussée). */
  dismissGlyph?: 'close' | 'back';
  children: ReactNode;
};

export function AuthScreen({ badge, title, subtitle, dismissGlyph = 'back', children }: Props) {
  const t = useTranslations('auth');
  const palette = useAuthPalette();

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={[styles.topRow, badge === undefined && styles.topRowBare]}>
              {badge !== undefined && (
                <View style={[styles.badge, { borderColor: palette.teal }]}>
                  <Ionicons name="shield-checkmark" size={14} color={palette.teal} />
                  <Text style={[styles.badgeLabel, { color: palette.teal }]}>{badge}</Text>
                </View>
              )}
              <Pressable
                onPress={() => router.back()}
                hitSlop={Spacing.two}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
                <Ionicons
                  name={dismissGlyph === 'close' ? 'close' : 'chevron-back'}
                  size={17}
                  color={palette.muted}
                />
              </Pressable>
            </View>

            <Text style={[styles.title, { color: palette.title }]}>{title}</Text>
            {subtitle !== undefined && (
              <Text style={[styles.subtitle, { color: palette.muted }]}>{subtitle}</Text>
            )}

            <View style={styles.content}>{children}</View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  body: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  /** Sans badge, la fermeture reste à droite — `space-between` la collerait à gauche. */
  topRowBare: {
    justifyContent: 'flex-end',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
  },
  badgeLabel: {
    fontSize: 13,
    fontFamily: Font.semibold,
  },
  dismiss: {
    paddingHorizontal: Spacing.two,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    // D91 5A, appliquée ici par la revue du 10/11 : le titre RECULE à 600.
    // À 800 il ne laissait rien derrière lui — quand tout crie, rien ne porte.
    // Le seul 700 de l'écran est le bouton, et c'est ce qui le fait avancer.
    fontFamily: Font.semibold,
    marginBottom: Spacing.two,
  },
  subtitle: {
    // 15 px (revue du 10/11) : le sous-titre ACCOMPAGNE le titre, il ne le
    // double pas. À 16 il faisait un second titre juste sous le premier.
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Font.regular,
  },
  content: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});

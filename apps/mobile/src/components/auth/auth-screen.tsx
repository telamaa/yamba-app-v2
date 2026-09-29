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

import { SymbolView } from 'expo-symbols';
import { useTranslations } from 'use-intl';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';

type Props = {
  /** Libellé du badge pilule (« Connexion sécurisée »…). */
  badge: string;
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
            <View style={styles.topRow}>
              <View style={[styles.badge, { borderColor: palette.teal }]}>
                <SymbolView
                  name="checkmark.shield"
                  size={14}
                  tintColor={palette.teal}
                  fallback={<Text style={[styles.badgeGlyph, { color: palette.teal }]}>✓</Text>}
                />
                <Text style={[styles.badgeLabel, { color: palette.teal }]}>{badge}</Text>
              </View>
              <Pressable
                onPress={() => router.back()}
                hitSlop={Spacing.two}
                accessibilityRole="button"
                accessibilityLabel={t('common.back')}
                style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
                <SymbolView
                  name={dismissGlyph === 'close' ? 'xmark' : 'chevron.left'}
                  size={17}
                  tintColor={palette.muted}
                  fallback={
                    <Text style={[styles.dismissFallback, { color: palette.muted }]}>
                      {dismissGlyph === 'close' ? '✕' : '‹'}
                    </Text>
                  }
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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
  },
  badgeGlyph: {
    fontSize: 12,
    fontWeight: 700,
  },
  badgeLabel: {
    fontSize: 13,
    fontWeight: 600,
  },
  dismiss: {
    paddingHorizontal: Spacing.two,
  },
  dismissFallback: {
    fontSize: 22,
    fontWeight: 500,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 800,
    marginBottom: Spacing.two,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: 500,
  },
  content: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
});

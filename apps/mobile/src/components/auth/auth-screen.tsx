/**
 * auth-screen.tsx — le gabarit des écrans d'auth (lot auth mobile).
 * =================================================================
 * Tous les écrans du groupe `(auth)` partagent la même coquille : feuille
 * modale (déclarée au layout racine), en-tête maison — retour à gauche,
 * titre centré, équilibre à droite (le motif du `city-picker`) —, contenu
 * défilable qui laisse la place au clavier. Le retour est `router.back()` :
 * dans la pile interne du groupe, il revient à l'étape précédente ; sur la
 * première, il referme la feuille.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type Props = {
  title: string;
  /** Libellé du geste de gauche — défaut : « Retour ». */
  backLabel?: string;
  onBackAction?: () => void;
  children: ReactNode;
};

export function AuthScreen({ title, backLabel, onBackAction, children }: Props) {
  const t = useTranslations('auth');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={onBackAction ?? (() => router.back())}
            hitSlop={Spacing.two}
            style={styles.headerSide}>
            <ThemedText type="linkPrimary">{backLabel ?? t('common.back')}</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.headerTitle}>
            {title}
          </ThemedText>
          <View style={styles.headerSide} />
        </View>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
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
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  headerSide: {
    width: 72,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  scroll: {
    gap: Spacing.three,
    paddingBottom: Spacing.five,
  },
});

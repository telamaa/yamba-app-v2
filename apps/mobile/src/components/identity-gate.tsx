/**
 * identity-gate.tsx — la porte d'identité des onglets (motif A58/A63 du web).
 * ===========================================================================
 * Un onglet réservé aux membres montre la PORTE, jamais un écran vide : titre,
 * explication, « Se connecter ». Le contenu n'apparaît qu'avec une session ;
 * pendant l'amorçage, un sablier — pas un flash de porte pour un membre déjà
 * connecté.
 */
import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';

export function IdentityGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const t = useTranslations('tabs');

  if (status === 'authenticated') return <>{children}</>;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {status === 'loading' ? (
          <ActivityIndicator color={Brand.mango} />
        ) : (
          <ThemedView style={styles.gate}>
            <ThemedText type="subtitle" style={styles.centered}>
              {t('gate.title')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {t('gate.body')}
            </ThemedText>
            <Link href="/login" asChild>
              <Pressable style={styles.cta}>
                <ThemedText style={styles.ctaLabel}>{t('gate.cta')}</ThemedText>
              </Pressable>
            </Link>
          </ThemedView>
        )}
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  gate: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  ctaLabel: {
    color: '#ffffff',
    fontWeight: 700,
  },
});

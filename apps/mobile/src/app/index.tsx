import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreferredLocaleSetter } from '@/i18n/provider';
import { bootstrapSession, logout, me, type SessionUser } from '@/lib/api/auth.api';

// Écran d'attente du socle : il ne promet rien qui n'existe pas.
// L'accroche est celle de l'accueil web (#357).
export default function HomeScreen() {
  const t = useTranslations('home');
  const setPreferredLocale = usePreferredLocaleSetter();
  // null = amorçage en cours (refresh en réserve ?), ensuite user ou absent.
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasSession = await bootstrapSession();
      const sessionUser = hasSession ? await me().catch(() => null) : null;
      if (!cancelled) {
        setUser(sessionUser);
        setPreferredLocale(sessionUser?.preferredLocale ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setPreferredLocale]);

  const onLogout = useCallback(async () => {
    await logout();
    setUser(null);
    setPreferredLocale(null);
  }, [setPreferredLocale]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.brand}>
            Yamba
          </ThemedText>
          <ThemedText type="subtitle" style={styles.tagline}>
            {t('tagline')}
          </ThemedText>

          {loading ? (
            <ActivityIndicator color={Brand.mango} />
          ) : user !== null ? (
            <ThemedView style={styles.sessionBlock}>
              <ThemedText style={styles.tagline}>
                {t('connectedAs', { firstName: user.firstName, lastName: user.lastName })}
              </ThemedText>
              <Pressable onPress={onLogout}>
                <ThemedText type="linkPrimary">{t('logout')}</ThemedText>
              </Pressable>
            </ThemedView>
          ) : (
            <Link href="/login" asChild>
              <Pressable style={styles.cta}>
                <ThemedText style={styles.ctaLabel}>{t('login')}</ThemedText>
              </Pressable>
            </Link>
          )}

          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            {t('socleNote')}
          </ThemedText>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: Spacing.four,
  },
  brand: {
    color: Brand.mango,
  },
  tagline: {
    textAlign: 'center',
  },
  sessionBlock: {
    alignItems: 'center',
    gap: Spacing.two,
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

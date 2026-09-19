import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';

// Accueil : public, il ne promet rien qui n'existe pas. L'accroche est celle
// de l'accueil web (#357). La session vient du contexte partagé (lot tabs) ;
// la déconnexion vit désormais dans l'onglet Profil.
export default function HomeScreen() {
  const t = useTranslations('home');
  const { status, user } = useSession();

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

          {status === 'loading' ? (
            <ActivityIndicator color={Brand.mango} />
          ) : user !== null ? (
            <ThemedText style={styles.tagline}>
              {t('connectedAs', { firstName: user.firstName, lastName: user.lastName })}
            </ThemedText>
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

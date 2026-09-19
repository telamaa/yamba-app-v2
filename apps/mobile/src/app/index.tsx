import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';

// Écran d'attente du socle : il ne promet rien qui n'existe pas.
// L'accroche est celle de l'accueil web (#357).
export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <ThemedText type="title" style={styles.brand}>
            Yamba
          </ThemedText>
          <ThemedText type="subtitle" style={styles.tagline}>
            Il y a toujours quelqu&apos;un qui part vers ta destination.
            Confie-lui ton colis.
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.tagline}>
            Socle mobile — les parcours arrivent écran par écran.
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
});

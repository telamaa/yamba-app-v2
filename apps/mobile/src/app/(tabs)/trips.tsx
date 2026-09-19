import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabBadges } from '@/hooks/use-tab-badges';
import { useSession } from '@/lib/session-context';

// Trajets : derrière la porte d'identité. La coquille montre des chiffres
// VRAIS (les mêmes que le badge — demandes en attente, trajets à finaliser,
// pour un Voyageur) ; le détail des trajets est un lot à part.
function TripsContent() {
  const t = useTranslations('tabs');
  const { user } = useSession();
  const badges = useTabBadges();
  const isCarrier = user?.roles.includes('CARRIER') ?? false;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.centered}>
          {t('trips.title')}
        </ThemedText>
        {isCarrier && (
          <ThemedView style={styles.counters}>
            <ThemedText style={styles.centered}>
              {t('trips.pendingDeals', { count: badges.pendingDeals })}
            </ThemedText>
            <ThemedText style={styles.centered}>
              {t('trips.draftTrips', { count: badges.draftTrips })}
            </ThemedText>
          </ThemedView>
        )}
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          {t('trips.note')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function TripsScreen() {
  return (
    <IdentityGate>
      <TripsContent />
    </IdentityGate>
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
    gap: Spacing.three,
  },
  counters: {
    gap: Spacing.one,
  },
  centered: {
    textAlign: 'center',
  },
});

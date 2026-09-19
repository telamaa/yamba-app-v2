import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabBadges } from '@/hooks/use-tab-badges';

// Messages : derrière la porte d'identité. Le compteur est celui du serveur
// (`totalUnread`) — le même que le badge ; les conversations sont un lot à part.
function MessagesContent() {
  const t = useTranslations('tabs');
  const badges = useTabBadges();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.centered}>
          {t('messages.title')}
        </ThemedText>
        <ThemedText style={styles.centered}>
          {t('messages.unread', { count: badges.unreadMessages })}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          {t('messages.note')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function MessagesScreen() {
  return (
    <IdentityGate>
      <MessagesContent />
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
  centered: {
    textAlign: 'center',
  },
});

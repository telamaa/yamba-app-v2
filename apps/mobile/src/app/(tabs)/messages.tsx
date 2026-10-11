import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { ProfileAvatarButton } from '@/components/profile-avatar-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabBadges } from '@/hooks/use-tab-badges';

// Messages : derrière la porte d'identité. Le compteur est celui du serveur
// (`totalUnread`) — le même que le badge ; les conversations sont un lot à part.
//
// La pastille Profil est présente ICI AUSSI : depuis A210 elle est le SEUL
// accès au compte, elle doit donc exister sur les QUATRE destinations — sans
// quoi, depuis Messages, atteindre son profil demanderait de changer d'onglet.
function MessagesContent() {
  const t = useTranslations('tabs');
  const badges = useTabBadges();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.titleRow}>
          <ThemedText type="subtitle" style={styles.title}>
            {t('messages.title')}
          </ThemedText>
          <ProfileAvatarButton />
        </View>
        <View style={styles.body}>
          <ThemedText style={styles.centered}>
            {t('messages.unread', { count: badges.unreadMessages })}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {t('messages.note')}
          </ThemedText>
        </View>
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
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  title: {
    flexShrink: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
});

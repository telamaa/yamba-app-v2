import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';

// Profil : derrière la porte d'identité. Identité du compte + déconnexion
// (déplacée ici depuis l'accueil — sa place idiomatique). Après la
// déconnexion, l'écran reste ouvert : la porte réapparaît, pas un écran vide.
//
// A210 — Profil n'est PLUS un onglet : il se POUSSE au-dessus des onglets
// depuis la pastille d'angle (`ProfileAvatarButton`), ce qui libère la
// cinquième place de la barre pour le « + » de publication. D'où le retour
// explicite ci-dessous : un écran poussé se referme.
function ProfileContent() {
  const t = useTranslations('tabs');
  const { user, signOut } = useSession();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <ThemedText type="linkPrimary">‹ {t('profile.back')}</ThemedText>
          </Pressable>
        </View>
        <ThemedText type="subtitle" style={styles.centered}>
          {user !== null ? `${user.firstName} ${user.lastName}` : t('profile.title')}
        </ThemedText>
        {user !== null && (
          <ThemedText themeColor="textSecondary" style={styles.centered}>
            {user.email}
          </ThemedText>
        )}
        <Pressable onPress={() => void signOut()}>
          <ThemedText type="linkPrimary">{t('profile.logout')}</ThemedText>
        </Pressable>
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          {t('profile.note')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function ProfileScreen() {
  return (
    <IdentityGate>
      <ProfileContent />
    </IdentityGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  backRow: {
    paddingTop: Spacing.two,
    alignSelf: 'flex-start',
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

/**
 * profile-avatar-button.tsx — l'accès au Profil, depuis l'en-tête (A210).
 * =======================================================================
 * Profil a quitté la barre d'onglets pour libérer sa place au « + » de
 * publication. Son accès devient une PASTILLE d'angle — le motif de Gmail,
 * Spotify, Google Maps et Revolut (la référence du lot auth, A209) : un
 * compte est une destination qu'on visite délibérément, pas une entre
 * lesquelles on navigue.
 *
 * Elle vit dans une rangée QUI EXISTE DÉJÀ sur chaque écran (la barre récap
 * d'Explorer, le titre de Favoris et d'Activité) : zéro hauteur ajoutée.
 *
 * `SessionUser` ne porte pas d'avatar : on affiche les INITIALES, comme le
 * repli des cartes de résultat. Un visiteur anonyme voit une silhouette et
 * atterrit sur la porte d'identité — on montre la porte, jamais rien.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session-context';
import { getInitials } from '@/lib/trip-format';

export function ProfileAvatarButton() {
  const t = useTranslations('tabs');
  const theme = useTheme();
  const { user } = useSession();

  return (
    <Pressable
      onPress={() => router.push('/profile')}
      accessibilityRole="button"
      accessibilityLabel={t('profile.title')}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      {user !== null ? (
        <ThemedText type="smallBold" style={styles.initials}>
          {getInitials(user.firstName, user.lastName)}
        </ThemedText>
      ) : (
        <Ionicons name="person-outline" size={18} color={theme.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 13,
    lineHeight: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});

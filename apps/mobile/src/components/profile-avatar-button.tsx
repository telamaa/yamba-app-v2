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
 * d'Accueil, le titre de Favoris et d'Activité) : zéro hauteur ajoutée.
 *
 * TROIS ÉTATS, dans cet ordre (D88 5A) : la PHOTO quand le compte en a une,
 * les INITIALES sinon (le même repli que les cartes de résultat), la
 * SILHOUETTE pour un visiteur anonyme — qui atterrit sur la porte d'identité :
 * on montre la porte, jamais rien.
 *
 * La photo vient de `/auth/me`, qui la projette déjà (`avatar: { url }`) :
 * rien à ouvrir côté serveur. Elle n'arrive donc qu'avec la session complète
 * — la réponse de `/auth/login` ne la porte pas, et c'est `SessionProvider`
 * qui complète par `/auth/me` juste après la connexion.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
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
  const photo = user?.avatar?.url ?? null;

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
      {photo !== null ? (
        <Image
          source={{ uri: photo }}
          style={styles.photo}
          contentFit="cover"
          // Un visage qui apparaît d'un coup sur une pastille ronde « saute ».
          transition={120}
          // La pastille est montée sur un FOND (`backgroundElement`) : si
          // l'URL tombe, on voit ce fond, jamais un trou. `recyclingKey`
          // empêche la photo d'un compte précédent de rester affichée après
          // une déconnexion-reconnexion — la vue est recyclée, pas l'image.
          recyclingKey={photo}
        />
      ) : user !== null ? (
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
  photo: {
    // Elle remplit la pastille : même diamètre, même rayon.
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  pressed: {
    opacity: 0.7,
  },
});

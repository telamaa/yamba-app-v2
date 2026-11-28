import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { BackButton } from '@/components/back-button';
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
        {/* D125 1A — LA RANGÉE D'EN-TÊTE EST EN HAUT, ET ELLE EST À PART.
            Le retour de D105 vivait dans le même conteneur que le contenu,
            lequel porte `justifyContent: 'center'` : le chevron se retrouvait
            au MILIEU de l'écran, au-dessus d'un bloc centré, sur une page vide
            aux trois quarts. Le bouton était juste, sa place ne l'était pas —
            troisième défaut de COMPOSITION de la semaine (D104, D124, ici). */}
        <View style={styles.enTete}>
          <BackButton label={t('profile.back')} onPress={() => router.back()} />
        </View>

        {/* D125 1B — la phrase « la gestion du profil arrive dans un prochain
            lot » est partie. Un écran qui annonce un lot à venir est une
            promesse, pas une fonction : il occupe la place, ne répond à rien,
            et date l'application. Ce qui reste est peu, mais vrai. */}
        <View style={styles.contenu}>
          <ThemedText type="subtitle" style={styles.centered}>
            {user !== null ? `${user.firstName} ${user.lastName}` : t('profile.title')}
          </ThemedText>
          {user !== null && (
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {user.email}
            </ThemedText>
          )}
          <Pressable
            onPress={() => void signOut()}
            accessibilityRole="button"
            style={styles.deconnexion}>
            <ThemedText type="linkPrimary">{t('profile.logout')}</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function ProfileScreen() {
  // D104 1A — la sortie se passe à la PORTE, pas seulement au contenu.
  // Le retour de `ProfileContent` ci-dessus est juste, et il était placé du
  // mauvais côté de la condition : un visiteur non connecté voit la porte,
  // jamais le contenu — donc jamais le bouton. Profil est le seul des cinq
  // écrans gardés à être POUSSÉ au-dessus des onglets (A210) : les quatre
  // autres gardent la barre, qui leur sert de sortie. Lui n'avait plus rien.
  return (
    <IdentityGate destination="profile" onDismiss={() => router.back()}>
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
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
  },
  /** En haut, à gauche, comme sur les huit autres écrans poussés. */
  enTete: {
    paddingTop: Spacing.two,
    alignSelf: 'flex-start',
  },
  /** Le contenu, lui, se centre dans ce qui reste. */
  contenu: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  deconnexion: {
    minHeight: 44,
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});

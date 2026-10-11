/**
 * publish.tsx — l'écran « Publier », HORS de la barre d'onglets (A210).
 * =====================================================================
 * Il n'est plus un onglet : un onglet permanent pour un écran qui ne fait
 * rien ne se justifiait pas. La route VIT toujours et reste atteignable par
 * `router.push('/publish')` (doc Expo v57 : une route sans Trigger quitte la
 * barre sans cesser d'être navigable) ; sa porte est la carte CTA en tête
 * d'Activité. Il reviendra en « + » central avec le lot de publication
 * NATIVE.
 *
 * Coquille HONNÊTE (A203) : elle dit que le parcours arrive, et ne renvoie
 * NULLE PART — l'app est full mobile et native (A210 b). L'ancienne ligne
 * « publie ton trajet depuis le site » a été supprimée, comme le commentaire
 * qui prétendait ici que l'écran « renvoyait vers le site » alors qu'il n'a
 * jamais porté ni lien ni WebView.
 */
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { IdentityGate } from '@/components/identity-gate';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

function PublishContent() {
  const t = useTranslations('tabs');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle" style={styles.centered}>
          {t('publish.title')}
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centered}>
          {t('publish.body')}
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

export default function PublishScreen() {
  return (
    <IdentityGate>
      <PublishContent />
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

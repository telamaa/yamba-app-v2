/**
 * publish.tsx — l'onglet Publier (lot recherche-first).
 * =====================================================
 * L'offre a sa place dans la barre (le « + » de la référence) : un Voyageur
 * doit voir dès l'arrivée qu'ici, on publie aussi. Derrière la porte
 * d'identité (A58/A63) — et une COQUILLE HONNÊTE (leçon A203) : le parcours
 * de publication n'existe pas encore dans l'app, l'écran le dit et renvoie
 * vers le site ; aucun formulaire fantôme.
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
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {t('publish.note')}
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

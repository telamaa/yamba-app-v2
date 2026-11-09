/**
 * publish.tsx — l'écran « Publier », le « + » central de la barre (A210).
 * =======================================================================
 * Il est le cinquième élément de la barre, au MILIEU, et le seul qui ne soit
 * pas une destination mais une ACTION — le motif de Vinted, Leboncoin,
 * Instagram (le pourquoi est dans `(tabs)/_layout.tsx`). Sa seconde porte
 * est la carte CTA en tête d'Activité.
 *
 * L'en-tête de ce fichier a dit un temps « HORS de la barre d'onglets » :
 * c'était vrai d'une passe intermédiaire d'A210, plus du code — le « + » est
 * revenu au centre. Corrigé ici le 08/11/2026.
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
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

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
    <IdentityGate destination="publish">
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
    // La barre d'onglets FLOTTE au-dessus du contenu (D88) : cet écran ne
    // défile pas, c'est donc ici qu'il lui réserve sa place — sans quoi son
    // bas se centrerait SOUS la pilule.
    paddingBottom: BottomTabInset,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
});

/**
 * etat-vide.tsx — le gabarit d'un écran qui n'a rien à montrer (D125 3A).
 * =======================================================================
 * Une icône, un titre, une phrase, et — quand il y a quelque chose à faire —
 * une action. Rien d'autre : un état vide est le moment où l'on a le MOINS
 * de choses à dire, pas le plus.
 *
 * Il existait déjà, et c'est tout le sujet : `EmptyBlock` vivait DANS
 * `favorites.tsx`, donc personne ne pouvait l'importer. Trois autres écrans
 * (messages, notifications, le fil) en ont chacun recomposé un à la main, avec
 * les mêmes styles recopiés à l'identique. C'est la leçon de D110 appliquée à
 * un composant plutôt qu'à une classe CSS : **une source de vérité que l'on
 * n'importe pas est un commentaire.**
 *
 * L'action est FACULTATIVE et c'est une décision : un état vide subi (« aucun
 * message ») n'a pas de bouton — en proposer un invente un geste. Un état vide
 * qu'on peut quitter (« aucun envoi » → chercher un trajet) en a un.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  titre: string;
  corps: string;
  /** Le seul geste qui vaille depuis cet écran, ou rien. */
  action?: { libelle: string; onPress: () => void };
};

export function EtatVide({ icon, titre, corps, action }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.bloc}>
      <View style={[styles.icone, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name={icon} size={26} color={theme.textSecondary} />
      </View>
      <ThemedText type="smallBold" style={styles.centre}>
        {titre}
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.centre}>
        {corps}
      </ThemedText>
      {action !== undefined && (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={[styles.action, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold">{action.libelle}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  icone: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    textAlign: 'center',
  },
  action: {
    // 44 pt : la cible tactile minimale, comme partout dans l'application.
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: 12,
    borderWidth: 1,
  },
});

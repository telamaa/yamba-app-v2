/**
 * back-button.tsx — le retour, en un seul exemplaire (D105).
 * ===========================================================
 * Avant ce fichier, le même geste portait QUATRE costumes : un chevron de
 * 20 px sur les écrans de paiement, de 22 px dans le cadre d'étape, de 26 px
 * sur ville et date, et un lien texte « ‹ Retour » sur le profil. Quatre
 * tailles, trois zones tactiles (`hitSlop` 8, 10, 12), et deux écrans sans
 * aucun nom accessible — un lecteur d'écran y annonçait « bouton », sans plus.
 *
 * Rien de tout cela n'avait été décidé : chaque écran avait recopié son
 * voisin le plus proche. C'est une incohérence qu'on ne voit pas en LISANT le
 * code, seulement en le COMPTANT.
 *
 * Deux variantes survivent, parce qu'elles ont une raison :
 *   • `bare`  — le chevron nu, dans une rangée d'en-tête : il n'a rien à
 *               surmonter, un fond l'alourdirait ;
 *   • `boxed` — le chevron dans un disque, quand il FLOTTE sur du contenu
 *               (cadre d'étape, kit d'envoi) et a besoin d'un fond pour
 *               rester lisible.
 *
 * Ce qui ne varie plus : la taille, la zone tactile, et le NOM — requis par
 * la signature, donc réclamé par TypeScript. D98 2A avait payé cette leçon
 * sur les boutons d'attente ; elle n'avait pas traversé jusqu'aux en-têtes.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { BACK_BOX_SIZE, BACK_HIT_SLOP, BACK_ICON_SIZE } from '@/lib/back-affordance';
import { useTheme } from '@/hooks/use-theme';

export function BackButton({
  onPress,
  label,
  variant = 'bare',
}: {
  onPress: () => void;
  /** Le nom annoncé par un lecteur d'écran. REQUIS : un chevron nu n'a pas
   *  de texte visible, donc pas de nom implicite. */
  label: string;
  variant?: 'bare' | 'boxed';
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      hitSlop={BACK_HIT_SLOP}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {variant === 'boxed' ? (
        <View style={[styles.box, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={theme.text} />
        </View>
      ) : (
        <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={theme.text} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    width: BACK_BOX_SIZE,
    height: BACK_BOX_SIZE,
    borderRadius: BACK_BOX_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});

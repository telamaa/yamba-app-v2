/**
 * app-splash.tsx — le splash JS (lot bienvenue).
 * ===============================================
 * Prolonge le splash NATIF (app.json : fond mangue + icône) pendant
 * l'amorçage réel de la session — il couvre un vrai temps de chargement,
 * jamais un délai artificiel. Fond mangue plein, wordmark blanc, et en bas
 * un motif d'arcs discret (le réseau des corridors) dessiné en pures Views :
 * zéro asset, zéro dépendance.
 */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';

const ARC = 'rgba(255, 255, 255, 0.18)';

export function AppSplash() {
  return (
    <View style={styles.container} pointerEvents="auto">
      <ThemedText style={styles.wordmark}>Yamba</ThemedText>
      {/* Le « globe » : deux cercles immenses qui débordent du bas d'écran. */}
      <View style={[styles.arc, styles.arcOuter]} />
      <View style={[styles.arc, styles.arcInner]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Brand.mango,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 10,
  },
  wordmark: {
    color: '#ffffff',
    fontSize: 44,
    lineHeight: 52,
    fontWeight: 800,
    letterSpacing: 0.5,
  },
  arc: {
    position: 'absolute',
    borderColor: ARC,
    borderWidth: 1.5,
    borderRadius: 9999,
  },
  arcOuter: {
    width: 700,
    height: 700,
    bottom: -430,
    alignSelf: 'center',
  },
  arcInner: {
    width: 700,
    height: 700,
    bottom: -510,
    alignSelf: 'center',
  },
});

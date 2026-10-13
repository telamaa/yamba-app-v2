/**
 * search/_layout.tsx — la pile de l'ÉDITEUR de recherche.
 * ========================================================
 * Même motif que le groupe `(auth)` (A208) : tout le parcours « modifier ma
 * recherche » vit dans UNE pile présentée au-dessus de l'app, et les étapes
 * se poussent DEDANS. Le layout racine la présente en `transparentModal` :
 * c'est ce qui permet à la première étape (`edit`) d'être une FEUILLE qui
 * laisse voir les résultats dessous, puis aux étapes suivantes (`city`,
 * `date`) d'être de VRAIES pages pleines qui glissent depuis la droite.
 *
 * Deux présentations dans une pile, donc deux fonds : la feuille peint son
 * propre voile, les pages poussées sont opaques (`contentStyle` ci-dessous).
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function SearchEditorLayout() {
  const theme = useTheme();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* La feuille : pas d'animation native, elle anime elle-même sa montée
          et son voile (le natif ferait glisser un écran PLEIN et opaque). */}
      <Stack.Screen
        name="edit"
        options={{ animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
      />
      <Stack.Screen
        name="city"
        options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
      />
      <Stack.Screen
        name="date"
        options={{ animation: 'slide_from_right', contentStyle: { backgroundColor: theme.background } }}
      />
    </Stack>
  );
}

/**
 * conversation/_layout.tsx — la pile d'UN fil (D117).
 * =====================================================
 * Même parti pris que `deal/` et `shipment/` : aucun en-tête natif. L'écran
 * porte son propre bandeau, parce que le nom de l'interlocuteur et le
 * corridor se lisent ensemble — un en-tête système les aurait séparés, et
 * répété le premier en petit.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function ConversationLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: theme.background },
      }}
    />
  );
}

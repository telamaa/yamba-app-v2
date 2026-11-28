/**
 * deal/_layout.tsx — la pile d'UNE demande, côté Voyageur (D115).
 * =================================================================
 * `deal/[id]` était un écran seul jusqu'ici. La prise en charge en fait une
 * PILE : on ouvre la demande, puis on pousse l'inspection par-dessus, et le
 * retour depuis l'inspection retombe sur la demande — pas sur la liste.
 *
 * Même parti pris que `shipment/` : aucun en-tête natif. Chaque écran porte
 * son bandeau, parce que le titre se lit en grand DANS la page et qu'un
 * en-tête système l'aurait répété en petit.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function DealLayout() {
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

/**
 * shipment/_layout.tsx — la pile du SUIVI d'un envoi.
 * ====================================================
 * Séparée de `booking/` à dessein : `booking/` est un TUNNEL (sept étapes
 * qu'on termine ou qu'on quitte), `shipment/` est une DESTINATION (on y
 * revient autant de fois qu'on veut, pendant des jours). Les mélanger aurait
 * fait cohabiter une jauge de progression et une fiche de suivi dans la même
 * pile, et le retour depuis la fiche serait retombé sur une étape de paiement.
 *
 * Pas d'en-tête natif : la fiche porte son propre bandeau, parce que le titre
 * se lit en grand DANS la page (« Mon envoi », puis l'état) et qu'un en-tête
 * système l'aurait répété en petit.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function ShipmentLayout() {
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

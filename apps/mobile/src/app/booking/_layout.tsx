/**
 * booking/_layout.tsx — la pile du parcours de RÉSERVATION.
 * ==========================================================
 * Sept écrans, sept pages poussées — dans l'ordre d'A217 : ① le colis (famille,
 * poids, taille), ② la valeur du contenu puis la protection, ③ la description
 * courte et les photos, ④ les lieux de rendez-vous, ⑤ le destinataire,
 * ⑥ l'engagement, ⑦ le paiement.
 *
 * Pourquoi la VALEUR avant la PROTECTION : elle fixe le plafond
 * d'indemnisation que la garantie utilise. Une décision à +6 € posée avant le
 * montant qu'elle couvre se prend à l'aveugle. Et la protection reste avant les
 * photos, parce que c'est elle qui les rend obligatoires (A214). C'est
 * exactement l'ordre de l'étape 1 du site : le natif ne le contredit plus. Chacune glisse depuis la droite et se dépile au retour — le motif
 * natif des deux OS, celui du parcours de recherche (`search/`).
 *
 * La pile vit au niveau RACINE (déclarée dans `app/_layout.tsx`), par-dessus
 * les onglets : une réservation est un parcours qu'on termine ou qu'on quitte,
 * pas une destination où l'on navigue.
 *
 * Pas d'en-tête natif : chaque étape porte le sien (`BookingStepFrame`), parce
 * qu'il contient la jauge de progression et que la barre du bas — le prix et
 * le geste — doit rester la même d'une étape à l'autre.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function BookingLayout() {
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

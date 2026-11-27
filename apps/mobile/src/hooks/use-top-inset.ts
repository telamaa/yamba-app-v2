/**
 * use-top-inset.ts — la marge haute, branchée sur l'appareil (D107).
 * ===================================================================
 * Le hook ne décide de rien : il va chercher les deux sources et laisse
 * `plancherHaut` (pur, dans `lib/`, donc sous le harnais) trancher.
 *
 * `Constants.statusBarHeight` est fourni par l'appareil et ne dépend d'aucun
 * arbre de contexte React — c'est ce qui en fait le filet de sécurité de
 * l'inset mesuré, qui lui en dépend.
 */
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { plancherHaut } from '@/lib/top-inset';

export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return plancherHaut(insets.top, Constants.statusBarHeight);
}

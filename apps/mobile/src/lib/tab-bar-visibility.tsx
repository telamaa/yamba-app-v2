/**
 * tab-bar-visibility.tsx — l'escamotage de la barre d'onglets (D88 3A).
 * =====================================================================
 * UNE valeur partagée Reanimated — `hidden` : 0 = barre posée, 1 = barre
 * sortie par le bas — vivante au niveau du groupe d'onglets, écrite par les
 * écrans qui défilent et lue par la barre dessinée (`components/tab-bar`).
 *
 * Les écrans ne la touchent JAMAIS à la main : ils branchent
 * `useTabBarHideOnScroll()` sur leur conteneur défilant, et c'est le geste
 * qui décide. Pas de minuteur, pas de « masquer au bout de 3 s » : une barre
 * qui disparaît sans qu'on ait rien fait est une barre qu'on croit cassée.
 *
 * POURQUOI UNE VALEUR PARTAGÉE ET NON UN `useState`. Un défilement émet des
 * dizaines d'événements par seconde. Passés par un état React, ce sont autant
 * de rendus de toute la barre, et l'animation vit sur le pont JS — elle saute
 * dès que le fil JS travaille (une page de résultats qui arrive, par exemple).
 * Une valeur partagée est écrite et lue sur le fil d'INTERFACE : le geste et
 * l'animation ne traversent jamais le pont, et la barre ne se rend pas une
 * seule fois pendant tout le défilement.
 *
 * LE SEUIL, et pourquoi il est CUMULÉ. Un doigt posé sur une liste produit
 * des micro-mouvements de un ou deux points dans les deux sens : un seuil
 * appliqué à chaque événement laisserait la barre papilloter. On additionne
 * donc le déplacement tant qu'il va dans le MÊME sens (un changement de sens
 * remet le compteur à zéro), et on ne bascule qu'au-delà de SEUIL points.
 * Le haut de liste reforce toujours la barre visible : là, elle ne masque
 * rien, et c'est l'état dans lequel on doit retrouver l'écran.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** Déplacement cumulé, en points, avant de basculer. Mesuré à l'écran : en
 *  dessous de ~10 pt la barre réagit au tremblement du doigt. */
const SEUIL = 12;
/** Partir est plus rapide que revenir : on dégage vite pour rendre la place,
 *  on remonte posément pour ne pas surprendre le pouce qui vise une carte. */
const SORTIE_MS = 180;
const RETOUR_MS = 240;

type TabBarVisibility = {
  /** 0 = posée, 1 = entièrement sortie par le bas. Les valeurs entre les deux
   *  sont les images de l'animation. */
  hidden: SharedValue<number>;
};

const TabBarVisibilityContext = createContext<TabBarVisibility | null>(null);

/** À poser AUTOUR du navigateur d'onglets : la barre et les écrans doivent
 *  lire la même valeur. */
export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const value = useMemo(() => ({ hidden }), [hidden]);

  return (
    <TabBarVisibilityContext.Provider value={value}>{children}</TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility(): TabBarVisibility {
  const value = useContext(TabBarVisibilityContext);
  if (value === null) {
    throw new Error('useTabBarVisibility() appelé hors de <TabBarVisibilityProvider>');
  }
  return value;
}

/**
 * Le gestionnaire à brancher sur `onScroll` d'un conteneur défilant
 * **Reanimated** (`Animated.FlatList`, `Animated.ScrollView`) — un conteneur
 * ordinaire ne sait pas appeler un worklet.
 *
 * Un écran SANS conteneur défilant n'appelle rien : la barre y reste posée,
 * ce qui est la seule chose juste (il n'y a rien à dégager).
 */
export function useTabBarHideOnScroll() {
  const { hidden } = useTabBarVisibility();
  const dernierY = useSharedValue(0);
  const cumul = useSharedValue(0);

  return useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const delta = y - dernierY.value;
      dernierY.value = y;

      // Haut de liste (et rebond négatif de l'élastique iOS) : la barre ne
      // masque rien, elle est toujours posée.
      if (y <= 0) {
        cumul.value = 0;
        hidden.value = withTiming(0, { duration: RETOUR_MS });
        return;
      }

      cumul.value = cumul.value > 0 === delta > 0 ? cumul.value + delta : delta;

      if (cumul.value > SEUIL) {
        hidden.value = withTiming(1, { duration: SORTIE_MS });
      } else if (cumul.value < -SEUIL) {
        hidden.value = withTiming(0, { duration: RETOUR_MS });
      }
    },
  });
}

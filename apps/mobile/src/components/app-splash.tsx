/**
 * app-splash.tsx — le splash JS (lot bienvenue, revu D90).
 * =========================================================
 * Prolonge le splash NATIF (`app.json`) pendant l'amorçage réel de la
 * session — il couvre un vrai temps de chargement, jamais un délai
 * artificiel. Il doit donc en être la COPIE EXACTE : au passage de l'un à
 * l'autre, rien ne doit bouger à l'écran.
 *
 * D90 — CE QUI A CHANGÉ, ET POURQUOI. L'écran portait une pastille mango
 * pleine, le symbole en BLANC dessus, le mot « Yamba » en 44 pt et deux arcs
 * décoratifs. Trois raisons de tout retirer sauf le symbole :
 *
 *   ① **le fond de marque n'est pas le fond de l'app.** Ouvrir sur un aplat
 *      mango pour atterrir sur une page blanche est la rupture exacte que
 *      D88 6A avait supprimée de l'écran de bienvenue ; la garder ici la
 *      réintroduisait deux secondes plus tôt ;
 *   ② **le mot est déjà dans le symbole, et ailleurs.** Le nom de
 *      l'application est écrit par le SYSTÈME sous l'icône, au lancement
 *      comme dans le tiroir d'applications. Le répéter en 44 pt sur l'écran
 *      de démarrage ne dit rien de neuf ;
 *   ③ **le splash natif ne sait pas dessiner d'arcs.** Les deux cercles ne
 *      pouvaient exister QUE du côté JS : ils apparaissaient donc au moment
 *      de la bascule. Un détail qui ne tient pas sur les deux moitiés d'un
 *      même écran n'est pas un détail, c'est un saut.
 *
 * Le symbole suit le thème (`light` / `dark`) : seul le COLIS change, le Y
 * reste mango sur les deux fonds. Même règle, mêmes fichiers que partout
 * ailleurs dans l'app — voir `yamba-symbol.tsx`.
 *
 * LA TAILLE EST ACCORDÉE AU NATIF, et ce n'est pas un réglage libre :
 * `app.json` affiche `splash-icon.png` à 76 px de large, mais ce PNG est
 * dessiné dans un carré de 240 dont le Y n'occupe que ~142 — soit ~45 px de
 * glyphe visible. `yamba-symbol.svg` est cadré SERRÉ (le Y remplit 96 % de
 * sa largeur), donc 47 px ici rendent le même dessin à la même taille.
 * Changer l'un sans l'autre fait sauter le logo à la bascule.
 */
import { StyleSheet, View, useColorScheme } from 'react-native';

import YambaSymbol from '@/components/yamba-symbol';
import { Colors } from '@/constants/theme';

/** Voir l'en-tête : la contrepartie exacte de `imageWidth: 76` d'`app.json`. */
const TAILLE_SYMBOLE = 47;

export function AppSplash() {
  const sombre = useColorScheme() === 'dark';
  const fond = sombre ? Colors.dark.background : Colors.light.background;

  return (
    <View style={[styles.container, { backgroundColor: fond }]} pointerEvents="auto">
      <YambaSymbol size={TAILLE_SYMBOLE} variant={sombre ? 'dark' : 'light'} />
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
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});

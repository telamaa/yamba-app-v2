/**
 * tab-bar.tsx — la barre d'onglets DESSINÉE (D88, révisée par D109).
 * ==================================================================
 * Une pilule flottante qui NOMME ses cinq destinations, avec escamotage au
 * défilement. Référence de composition : la barre flottante de YouTube,
 * revue avec l'utilisateur écran en main ; référence de STRUCTURE depuis
 * D109 : la barre de navigation Material 3, dont l'indicateur de sélection
 * se place derrière l'ICÔNE seule, le libellé vivant dessous et dehors.
 *
 * POURQUOI ELLE N'EST PLUS NATIVE (D88 0A). D36 avait choisi `NativeTabs` —
 * la vraie `UITabBar` d'iOS, la barre Material 3 d'Android — en écartant
 * explicitement « une imitation JS ». La décision est LEVÉE, et le motif est
 * mesuré, pas supposé : l'escamotage au défilement existe (`minimizeBehavior:
 * 'onScrollDown'`) mais seulement à partir d'iOS 26 et sans équivalent
 * Android ; les icônes sans libellé (`labelVisibilityMode`) sont Android
 * SEULEMENT, `UITabBar` affichant toujours le titre ; et une barre système
 * est ancrée au bas de l'écran — elle ne peut pas flotter. Les trois
 * demandes réunies sont hors d'atteinte du natif.
 *
 * CE QUE L'ON PAIE, ET QU'ON RÉÉCRIT ICI À LA MAIN : le flou (natif sur iOS,
 * repli translucide sur Android — voir plus bas), la sémantique d'onglet pour
 * les lecteurs d'écran (`tablist` / `tab` + position annoncée), la borne du
 * Dynamic Type, l'évitement du clavier, les pastilles de badge. Et ce qu'on
 * ne récupère pas : les retours haptiques idiomatiques et les comportements
 * Material 3 d'Android. C'est le prix explicite du contrôle de la forme.
 *
 * LES CINQ LIBELLÉS SONT PERMANENTS (D109 1A, qui REVIENT sur D88 2A).
 * D88 2A ne montrait le mot que sur l'onglet ACTIF, au nom du mode
 * « étiquette sur le sélectionné » de Material 3. Deux choses lui ont
 * échappé. D'abord, ce mode vise des destinations DÉJÀ APPRISES, et M3
 * recommande l'étiquette permanente dès que l'icône est ambiguë — or le
 * raisonnement de D88 2A nommait lui-même deux icônes indevinables sur cinq
 * (le colis = « Activité », le squircle = « Publier »). Ensuite et surtout,
 * le mot était montré là où il ne sert à RIEN : sur l'onglet où l'on se
 * trouve, que l'écran annonce déjà — pendant que les quatre destinations
 * possibles restaient anonymes.
 *
 * Le mot reste SOUS l'icône, et non à côté (revue du 08/11, arbitrage gardé
 * par D109) : à côté, il poussait les quatre autres onglets latéralement à
 * chaque sélection. Il n'y a en revanche plus de fente réservée — il n'y a
 * plus de vide à réserver, puisque les cinq mots sont là en permanence.
 *
 * LA SÉLECTION N'EST PAS MANGUE (revue du 08/11). La pilule active portait
 * d'abord la teinte des pastilles transport — crème `#FFF6E8` sur clair,
 * mangue à 15 % sur sombre — avec le mot en `#CC7A00`. Trois défauts, dont
 * deux mesurables :
 *   ① **l'indicateur ne se voyait pas** : `#FFF6E8` sur une barre à
 *     `rgba(255,255,255,0.94)`, c'est 3 % d'écart de luminance. La teinte
 *     avait été empruntée aux pastilles transport, qui vivent sur le fond
 *     BLANC de la page — un même jeton ne vaut pas sur deux supports ;
 *   ② **le mot ne passait pas l'AA** : `#CC7A00` sur `#FFF6E8` plafonne vers
 *     4,0:1, sous les 4,5:1 qu'exige un texte de 10 px, fût-il gras ;
 *   ③ **deux mangues se disputaient la barre.** Le squircle « Publier » doit
 *     rester LA seule tache chaude et saturée (A210) : c'est à cette
 *     condition que l'œil le lit comme une action et non comme une
 *     destination. Un onglet actif en mangue lui volait ce privilège.
 * La sélection se dit donc en ENCRE, pas en teinte : glyphe plein + encre
 * pleine + le mot, contre contour + gris de second plan. Trois signaux, zéro
 * couleur dépensée. La mangue reste la propriété exclusive de « Publier ».
 * C'est aussi ce que fait la référence citée en revue : chez YouTube, le
 * rouge n'est QUE sur la marque, jamais sur l'onglet actif.
 *
 * LE FLOU. Sur iOS, `BlurView` floute ce qui passe dessous sans rien savoir
 * du contenu. Sur Android, expo-blur a besoin d'une CIBLE (`BlurTargetView`,
 * cf. l'en-tête collant de l'onglet Accueil) : la barre, elle, est au-dessus
 * de n'importe quel écran et ne peut donc pas la désigner. Android reçoit un
 * fond translucide dense — assumé, et c'est la seule option honnête.
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useState, type ComponentProps } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Brand, Colors, MaxContentWidth, Spacing, TabBar } from '@/constants/theme';
import {
  ICON_SIZE,
  INDICATOR_HEIGHT,
  LABEL_LINE_HEIGHT,
  LABEL_SIZE,
  MARK_GLYPH,
  MARK_INK,
  MARK_RADIUS,
  MARK_SIZE,
  STACK_GAP,
  markBackground,
} from '@/lib/tab-bar-geometry';
import { Font } from '@/constants/typography';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBadges } from '@/lib/activite-context';
import { useTabBarVisibility } from '@/lib/tab-bar-visibility';

type IonName = ComponentProps<typeof Ionicons>['name'];
type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * Le jeu d'icônes de l'onglet. Quatre sur cinq sont des Ionicons ; « Accueil »
 * vient de Material Community parce que c'est le seul jeu embarqué qui porte
 * une maison SANS PORTE — la forme de YouTube. La maison d'Ionicons en a une,
 * et à 23 px cette porte est un pâté qui salit le glyphe.
 *
 * Aucune police de plus dans l'app : `@expo/vector-icons` est un baril qui les
 * embarque TOUTES dès le premier import (vérifié dans le bundle — le TTF de
 * Material Community y était déjà quand seul Ionicons était utilisé).
 */
type Onglet =
  | { labelKey: string; set: 'ion'; off: IonName; on: IonName }
  | { labelKey: string; set: 'mci'; off: MciName; on: MciName }
  | { labelKey: string; set: 'mark' };

/**
 * Chaque route du groupe, dans l'ordre de la barre — la clé de dictionnaire
 * et les deux états de l'icône (contour au repos, plein à la sélection, comme
 * les paires SF Symbols de la barre native).
 *
 * `index` porte une MAISON et s'appelle « Accueil » (D88 4A) : l'écran est un
 * flux d'atterrissage localisé (D80) et la recherche vit DANS la page, donc
 * « Explorer » mentait un peu. Et la maison est la seule icône que tout le
 * monde lit sans libellé — ce qui compte double quand quatre onglets sur cinq
 * n'en ont plus.
 */
const ONGLETS: Record<string, Onglet> = {
  index: { labelKey: 'home', set: 'mci', off: 'home-variant-outline', on: 'home-variant' },
  favorites: { labelKey: 'favorites', set: 'ion', off: 'heart-outline', on: 'heart' },
  // `publish` porte une MARQUE et non un pictogramme : le squircle mangue,
  // seule tache chaude et saturée de la barre (A210), DESSINÉE dans le code
  // depuis D109 2A — elle était servie en image matricielle.
  publish: { labelKey: 'publish', set: 'mark' },
  activity: { labelKey: 'activity', set: 'ion', off: 'cube-outline', on: 'cube' },
  messages: { labelKey: 'messages', set: 'ion', off: 'chatbubbles-outline', on: 'chatbubbles' },
};

/**
 * Le rayon de l'indicateur suit la MÊME LOI que la barre qui le contient :
 * hauteur / 2. C'est de la géométrie, pas un goût — payé une fois (revue du
 * 08/11) : aux deux bouts, Accueil et Messages, l'indicateur frôle le bord de
 * la barre, et l'œil compare alors directement deux courbures. Un angle qui
 * ne répond pas à son contenant se voit immédiatement. Les trois onglets du
 * milieu ne touchent aucun bord : le défaut y est invisible, ce qui est
 * précisément pourquoi il se rate.
 */
const INDICATOR_RADIUS = INDICATOR_HEIGHT / 2;

/** La transition de largeur de l'indicateur actif. Reanimated respecte seul
 *  « Réduire les animations » du système (`ReduceMotion.System` par défaut) :
 *  rien à brancher, mais c'est une raison de PASSER par lui. */
const TRANSITION = LinearTransition.duration(220);

function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count);
}

export function YambaTabBar({ state, navigation }: BottomTabBarProps) {
  const t = useTranslations('tabs');
  const dark = useColorScheme() === 'dark';
  const theme = dark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const badges = useTabBadges();
  const { hidden } = useTabBarVisibility();

  /**
   * Clavier ouvert : la barre ne se rend pas du tout.
   *
   * Elle est posée en absolu au bas de l'écran. Sur Android la fenêtre se
   * réduit et la pilule vient s'asseoir SUR le clavier ; sur iOS elle reste
   * dessous, à moitié mangée. Les deux sont faux, et une barre de navigation
   * n'a rien à dire pendant qu'on saisit du texte — le natif la masque aussi.
   */
  const [keyboardUp, setKeyboardUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardUp(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardUp(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /** Changer d'onglet REPOSE la barre : on arrive en haut du nouvel écran,
   *  et on doit y retrouver la barre à sa place. */
  useEffect(() => {
    hidden.value = withTiming(0, { duration: 180 });
  }, [state.index, hidden]);

  // La course d'escamotage : la pilule, son écart, et la zone sûre — de quoi
  // sortir ENTIÈREMENT de l'écran, sinon il reste un liseré qui traîne.
  const course = TabBar.height + TabBar.gap + insets.bottom;
  const barStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.value * course }],
    // Un fondu léger PENDANT la glissade : sans lui, la pilule se lit comme
    // une brique qui tombe.
    opacity: 1 - hidden.value * 0.5,
  }));

  if (keyboardUp) return null;

  const pilule = dark ? 'rgba(28, 28, 30, 0.92)' : 'rgba(255, 255, 255, 0.94)';
  const contour = dark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
  // L'onglet actif est de l'ENCRE PLEINE, l'inactif du gris de second plan.
  // Pas de mangue : voir « LA SÉLECTION N'EST PAS MANGUE » en tête de fichier.
  const actif = dark ? '#FFFFFF' : '#111827';
  /**
   * L'indicateur de sélection : un LAVIS de la même encre que la surface,
   * jamais une pastille opaque.
   *
   * La barre est translucide (flou iOS, fond à 92–94 % ailleurs) : un aplat
   * opaque posé dessus se lit comme une vignette COLLÉE dès que du contenu
   * passe derrière, parce qu'il ne reçoit pas la translucidité du support.
   * Un lavis, lui, se compose avec ce qu'il y a dessous et reste solidaire
   * de la barre quoi qu'il arrive.
   *
   * 8 % sur clair, 14 % sur sombre — l'œil perd plus vite un éclaircissement
   * sur fond sombre qu'un assombrissement sur fond clair, les deux valeurs
   * ne sont donc PAS symétriques.
   */
  const indicateur = dark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(17, 24, 39, 0.08)';

  return (
    <View style={[styles.anchor, { paddingBottom: insets.bottom + TabBar.gap }]} pointerEvents="box-none">
      <Animated.View
        style={[styles.bar, { backgroundColor: pilule, borderColor: contour }, barStyle]}
        accessibilityRole="tablist">
        {Platform.OS === 'ios' && (
          <BlurView
            style={StyleSheet.absoluteFill}
            tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
            intensity={60}
          />
        )}

        {state.routes.map((route, i) => {
          const onglet = ONGLETS[route.name];
          if (onglet === undefined) return null;

          const focused = state.index === i;
          const label = t(`bar.${onglet.labelKey}`);
          const badge =
            route.name === 'activity'
              ? badges.pendingDeals + badges.draftTrips
              : route.name === 'messages'
                ? badges.unreadMessages
                : 0;

          // Un seul indicateur pour les cinq : « Publier » n'est plus un cas
          // particulier depuis que la sélection a cessé d'être mangue — le
          // squircle ne risque plus de se poser sur sa propre couleur.
          const fond = focused ? indicateur : 'transparent';

          return (
            <View key={route.key} style={styles.cell}>
              <Pressable
                onPress={() => {
                  // `tabPress` d'abord : c'est l'événement qu'écoutent les
                  // écrans (remontée en haut de liste) et qui peut être annulé.
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
                onLongPress={() => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                // Le libellé est TOUJOURS annoncé, même quand il n'est pas
                // dessiné : une icône nue ne dit rien à VoiceOver.
                accessibilityLabel={label}
                // Ce que la barre native donnait gratuitement (« onglet 2 sur
                // 5 ») : rendu à la main, parce qu'une barre d'onglets sans
                // position annoncée est une liste de boutons anonymes.
                accessibilityValue={{ text: `${i + 1} / ${state.routes.length}` }}
                style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
                <View style={styles.stack}>
                  <Animated.View
                    layout={TRANSITION}
                    style={[styles.indicator, { backgroundColor: fond }]}>
                  <View style={styles.iconBox}>
                  {onglet.set === 'mark' ? (
                    <View
                      style={[
                        styles.mark,
                        // Troisième signal d'état pour le SEUL onglet dont le
                        // glyphe ne peut pas passer du contour au plein. Le
                        // code disait « la même image qu'on y soit ou non » —
                        // mais `publish` EST un onglet, il se sélectionne, et
                        // il lui manquait justement le signal le plus fort
                        // (D109 2B). La teinte dépend du THÈME : assombrir
                        // sur une barre sombre rendrait la marque moins
                        // visible au moment où elle doit l'être le plus.
                        { backgroundColor: markBackground(dark, focused) },
                      ]}>
                      <Ionicons name="add" size={MARK_GLYPH} color={MARK_INK} />
                    </View>
                  ) : onglet.set === 'mci' ? (
                    <MaterialCommunityIcons
                      name={focused ? onglet.on : onglet.off}
                      size={ICON_SIZE}
                      color={focused ? actif : theme.textSecondary}
                    />
                  ) : (
                    <Ionicons
                      name={focused ? onglet.on : onglet.off}
                      size={ICON_SIZE}
                      color={focused ? actif : theme.textSecondary}
                    />
                  )}

                  {badge > 0 && (
                    <View style={[styles.badge, { borderColor: pilule }]}>
                      <Text style={styles.badgeLabel} maxFontSizeMultiplier={1.1}>
                        {badgeLabel(badge)}
                      </Text>
                    </View>
                  )}
                  </View>

                  </Animated.View>

                  {/* D109 1A — LES CINQ onglets portent leur mot, toujours.
                    D88 2A ne le montrait que sur l'onglet ACTIF : c'est-à-dire
                    là où il ne sert à rien, puisque l'écran dit déjà où l'on
                    est, pendant que les quatre destinations possibles
                    restaient anonymes — dont deux que le fichier lui-même
                    reconnaissait indevinables (le cube, le squircle).
                    Il n'y a donc plus de fente réservée : il n'y a plus de
                    vide à réserver. */}
                  <Text
                    numberOfLines={1}
                    // Le Dynamic Type reste BORNÉ : au-delà, les mots
                    // pousseraient les icônes hors de l'écran. Une barre de
                    // navigation n'est pas du contenu à lire.
                    maxFontSizeMultiplier={1.3}
                    style={[
                      styles.label,
                      focused ? styles.labelFocused : null,
                      { color: focused ? actif : theme.textSecondary },
                    ]}>
                    {label}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // La MÊME laisse que la rangée du haut (`stickyContent` de l'onglet
    // Accueil, `Spacing.four`) : la barre commence où commence la pilule de
    // recherche et finit où finit la pastille d'identité. Deux blocs
    // flottants sur un même écran qui ne partagent pas leur marge, l'œil le
    // voit immédiatement.
    paddingHorizontal: Spacing.four,
    alignItems: 'stretch',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TabBar.height,
    // Le même plafond que les écrans (`MaxContentWidth`) : sur une tablette,
    // une barre de 1024 pt de large aurait cinq icônes perdues au milieu de
    // rien. Au-delà du plafond elle se centre, comme le contenu.
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
    borderRadius: TabBar.height / 2,
    borderWidth: StyleSheet.hairlineWidth,
    // 2 et non 4 : c'est la SEULE marge qui sépare encore l'indicateur du
    // bord de la barre (quand le premier ou le dernier onglet est actif), et
    // chaque point rendu ici élargit les cinq cellules.
    paddingHorizontal: 2,
    // `hidden` fait sortir la pilule du bas : sans ce découpage, le flou et
    // le fond dépasseraient du rayon.
    overflow: 'hidden',
    // L'ombre porte le « flottant ». iOS la dessine, Android passe par
    // l'élévation — les deux sont nécessaires, aucune ne suffit.
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  cell: {
    // Cinq parts ÉGALES de la largeur. C'est ce qui fige la rangée : la
    // pilule active grandit pour prendre son mot, mais DANS sa cellule — les
    // quatre autres icônes ne bougent pas d'un point.
    flex: 1,
  },
  hit: {
    // La cible tactile, c'est toute la cellule, pas la pilule dessinée : une
    // barre pleine largeur offre ~64 pt par onglet, ce serait du gâchis de
    // n'en rendre que 48 tapables.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // AUCUN rembourrage : l'indicateur prend la cellule ENTIÈRE. Les 2 pt
    // qu'on gardait pour qu'il ne touche pas sa voisine ne servaient à rien —
    // il n'y a jamais qu'UN onglet actif, donc jamais deux indicateurs
    // côte à côte. Seul le bord de la barre devait être protégé, et c'est le
    // rembourrage de la barre elle-même qui s'en charge.
  },
  stack: {
    // L'EMPILEMENT de la cellule : l'indicateur (qui tient l'icône) puis le
    // mot, dessous et DEHORS. Le mot est sous l'icône et non à côté — à côté,
    // il pousserait les quatre autres onglets à chaque sélection (revue du
    // 08/11, arbitrage conservé par D109).
    flexDirection: 'column',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: STACK_GAP,
  },
  indicator: {
    /**
     * D109 1C — CET INDICATEUR EST DÉCORATIF, ET C'EST ÉCRIT.
     *
     * Mesuré sur capture : `#E8E8E9` sur une barre à `#FAFAFB`, soit
     * **1,17:1**, là où WCAG 1.4.11 demande 3:1 pour un élément d'interface
     * non textuel. On ne le force PAS à 3:1 : il faudrait un gris sombre qui
     * pèserait plus que la mangue et volerait à « Publier » la seule tache
     * chaude de la barre (A210).
     *
     * L'état se dit donc en TROIS signaux non colorés — glyphe plein contre
     * contour (une FORME, donc conforme à WCAG 1.4.1), encre pleine contre
     * gris de second plan, et graisse du mot. L'indicateur ne fait que les
     * renforcer.
     *
     * Ce qui change vraiment : il ne DICTE plus la géométrie du texte. Il
     * occupait 42 des 52 pt de la barre pour un signal que personne ne voit.
     */
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_RADIUS,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    // Le squircle déborde la boîte des glyphes : voulu, il doit peser plus
    // lourd que les quatre contours.
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    /**
     * 10 pt, et plus 9 (D109 1D).
     *
     * 9 était sous le minimum des DEUX plateformes — 10 pt pour un onglet
     * iOS, 11 sp en Material 3 — et son interligne de 11 donnait un ratio de
     * 1,22, sous le plancher maison de 1,35. Le fichier était pour cela
     * exempté NOMMÉMENT de `typography.spec.ts`, avec une raison qui n'était
     * pas une propriété du texte mais un coût : « toucher à la fente rouvre
     * D88 ». L'exception est SUPPRIMÉE par ce lot — c'est sa mesure.
     *
     * La descente 13 → 10 → 9 avait été forcée par le mot le plus long,
     * « Messages ». Or le plancher de 1,35 existe justement parce que Plus
     * Jakarta Sans rogne les jambages : le `g` de « Messages » était le
     * premier concerné.
     *
     * 14 d'interligne pour 10 de corps = 1,40.
     */
    fontSize: LABEL_SIZE,
    lineHeight: LABEL_LINE_HEIGHT,
    fontFamily: Font.medium,
    letterSpacing: -0.1,
  },
  labelFocused: {
    // Troisième signal d'état, et le seul qui ne coûte ni couleur ni place :
    // la graisse. Medium au repos, bold à la sélection.
    fontFamily: Font.bold,
  },
  badge: {
    position: 'absolute',
    top: -5,
    left: 12,
    minWidth: 17,
    height: 17,
    borderRadius: 8.5,
    // Le liseré est de la couleur de la PILULE, pas du fond de l'écran : la
    // pastille est posée sur la barre, et c'est d'elle qu'elle se détache.
    borderWidth: 1.5,
    backgroundColor: Brand.mango,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeLabel: {
    color: '#0B1120',
    fontSize: 10,
    fontFamily: Font.extrabold,
    lineHeight: 12,
  },
  pressed: {
    opacity: 0.6,
  },
});

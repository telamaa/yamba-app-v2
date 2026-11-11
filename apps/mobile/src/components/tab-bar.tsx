/**
 * tab-bar.tsx — la barre d'onglets DESSINÉE (D88).
 * ================================================
 * Une pilule flottante : icônes seules, le mot sur le SEUL onglet actif,
 * escamotage au défilement. Référence de composition : la barre flottante de
 * YouTube, revue avec l'utilisateur écran en main.
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
 * LES LIBELLÉS NE DISPARAISSENT PAS TOUS (D88 2A). YouTube peut montrer
 * quatre icônes nues parce que ses destinations sont apprises depuis dix
 * ans ; Yamba en a cinq, dont deux indevinables (le colis = « Activité », le
 * squircle mango = « Publier »). Le compromis retenu est l'état de l'art
 * Material 3 : l'onglet ACTIF porte son mot, les quatre autres sont des
 * icônes seules. On garde le rendu net ET la compréhension là où elle compte
 * — sur la destination où l'on se trouve.
 *
 * Le mot est SOUS l'icône, et non à côté (revue du 08/11). À côté, il poussait
 * les quatre autres onglets latéralement à chaque sélection : toute la barre
 * se réorganisait pour un mot. Empilé, il ne coûte que de la hauteur — et
 * cette hauteur est réservée en permanence (`labelSlot`), de sorte que les
 * cinq icônes restent sur UNE seule ligne quel que soit l'onglet actif.
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
import { Image } from 'expo-image';
import { useEffect, useState, type ComponentProps } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Brand, Colors, MaxContentWidth, Spacing, TabBar } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTabBadges } from '@/hooks/use-tab-badges';
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
  | { labelKey: string; set: 'image' };

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
  // `publish` n'a pas de glyphe : c'est une MARQUE (le squircle mango), servie
  // en image, et la même qu'on y soit ou non — une action ne change pas de
  // dessin selon l'écran où l'on se trouve.
  publish: { labelKey: 'publish', set: 'image' },
  activity: { labelKey: 'activity', set: 'ion', off: 'cube-outline', on: 'cube' },
  messages: { labelKey: 'messages', set: 'ion', off: 'chatbubbles-outline', on: 'chatbubbles' },
};

const PUBLISH_SOURCE = require('../../assets/images/tab-publish.png');

/**
 * La taille des glyphes. 22 et non 24 : le mot passe DESSOUS depuis la revue
 * du 08/11, et les deux doivent tenir dans la hauteur de la pilule — 22 de
 * glyphe + 2 d'écart + 12 de ligne = 36, dans une cible de 46.
 */
const ICON_SIZE = 22;

/**
 * La hauteur de l'indicateur de sélection.
 *
 * 42 : le contenu empilé pèse 35 (22 d'icône + 2 d'écart + 11 de ligne de
 * mot), il reste 3,5 de respiration de chaque côté. En dessous, le mot
 * touche le bord.
 */
const PILL_HEIGHT = 42;

/**
 * Son rayon : la MOITIÉ de sa hauteur — un stade, et il n'y a pas le choix.
 *
 * Essayé à 16 à la revue, pour « baisser l'arrondi ». Le défaut ne s'est vu
 * qu'aux DEUX BOUTS — Accueil et Messages — et c'est de la géométrie pure :
 * la barre qui le contient est elle-même un stade (son rayon vaut la moitié
 * de ses 52, soit 26). Aux extrémités, l'indicateur n'a plus que 2 pt de
 * marge, et l'œil compare alors directement deux courbures qui ne se
 * répondent pas — un angle de 16 logé dans un arrondi de 26. Les trois
 * onglets du milieu, eux, ne touchent aucun bord : le défaut y est invisible.
 *
 * Deux sorties possibles : raccourcir l'indicateur pour l'éloigner des
 * bords (il perdrait la largeur qu'on vient de lui donner), ou lui donner la
 * courbure de son contenant. C'est la seconde — et comme la hauteur de
 * l'indicateur n'est pas celle de la barre, « même courbure » veut dire
 * « même LOI » : rayon = hauteur / 2, aux deux niveaux.
 */
const PILL_RADIUS = PILL_HEIGHT / 2;

/** La transition de largeur de la pilule active. Reanimated respecte seul
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
                <Animated.View
                  layout={TRANSITION}
                  style={[
                    styles.pill,
                    focused && styles.pillFocused,
                    { backgroundColor: fond },
                  ]}>
                  <View style={styles.iconBox}>
                  {onglet.set === 'image' ? (
                    <Image
                      source={PUBLISH_SOURCE}
                      style={styles.publishIcon}
                      contentFit="contain"
                      transition={0}
                    />
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

                  {/* L'emplacement du mot est TOUJOURS là, même vide. Sans lui,
                    l'onglet actif serait le seul à empiler deux choses et son
                    icône monterait de six points au-dessus des quatre autres :
                    la rangée d'icônes se tordrait à chaque changement
                    d'onglet. Réservé, il ne se passe rien — seul le mot
                    apparaît. */}
                  <View style={styles.labelSlot}>
                  {focused && (
                    <Animated.Text
                      entering={FadeIn.duration(160)}
                      exiting={FadeOut.duration(100)}
                      numberOfLines={1}
                      // Le Dynamic Type est BORNÉ : au-delà, le mot de
                      // l'onglet actif pousse les quatre icônes hors de
                      // l'écran. Une barre de navigation n'est pas du contenu
                      // à lire.
                      maxFontSizeMultiplier={1.3}
                      style={[styles.label, { color: actif }]}>
                      {label}
                    </Animated.Text>
                  )}
                  </View>
                </Animated.View>
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
  pill: {
    // COLONNE : le mot passe sous l'icône (revue du 08/11). En rangée, le
    // libellé poussait les quatre autres onglets de côté à chaque sélection ;
    // empilé, il ne coûte que de la hauteur, et la hauteur est réservée une
    // fois pour toutes.
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: PILL_HEIGHT,
    minWidth: 48,
    borderRadius: PILL_RADIUS,
    paddingHorizontal: Spacing.two,
  },
  pillFocused: {
    /**
     * La pilule active prend TOUTE sa cellule (revue du 08/11 : « largeur
     * trop courte, élargis encore pour que ça respire »).
     *
     * Elle épousait son contenu : ~52 pt dans une cellule de 64, soit un
     * bloc de couleur qui flottait au milieu d'un vide qu'il ne remplissait
     * pas. Étirée, elle vaut la cellule moins les 2 pt de `hit` de chaque
     * côté — ~60 pt. C'est le maximum disponible sans toucher la voisine.
     *
     * Rien ne bouge pour autant : les cellules restant égales, c'est
     * l'intérieur d'une cellule qui se remplit, pas la rangée qui se
     * réorganise. Et les quatre pilules inactives sont transparentes — leur
     * largeur n'a aucune conséquence visible.
     */
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.one,
  },
  iconBox: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishIcon: {
    // Le squircle déborde un peu de la boîte des glyphes : c'est voulu, il
    // doit peser plus lourd que les quatre contours.
    width: 27,
    height: 27,
  },
  labelSlot: {
    height: 11,
    justifyContent: 'center',
  },
  label: {
    // 9 — descendu de 13 (à côté de l'icône) puis de 10 (sous l'icône).
    // Le rembourrage ramené à 6 suffisait presque à faire tenir « Messages »
    // (52 pt disponibles pour 44 demandés), mais 8 pt de marge ne tiennent
    // pas une traduction : l'espagnol arrive (critère de fin du chantier
    // i18n) et « Mensajes » est plus long. À 9, le mot pèse ~40 pt dans 52 —
    // la marge absorbe une langue de plus sans retoucher la géométrie.
    // `letterSpacing` négatif resserre encore de ~1 pt sur huit caractères,
    // gratuitement.
    fontSize: 9,
    lineHeight: 11,
    fontFamily: Font.bold,
    letterSpacing: -0.1,
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

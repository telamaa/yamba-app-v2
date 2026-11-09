/**
 * identity-gate.tsx — la porte d'identité (motif A58/A63 du web).
 * ================================================================
 * Un espace réservé aux membres montre la PORTE, jamais un écran vide. Le
 * contenu n'apparaît qu'avec une session ; pendant l'amorçage, un sablier —
 * pas un flash de porte pour un membre déjà connecté.
 *
 * ELLE PARLE DE LA DESTINATION, PAS DE L'ADHÉSION (revue du 08/11).
 * Elle servait le MÊME mur aux cinq endroits : « Connecte-toi pour
 * continuer » + « tes trajets, tes messages et ton profil t'attendent ».
 * Trois défauts :
 *   ① **la motivation se perdait** — ce qui donne envie de se connecter,
 *     c'est la chose PRÉCISE qu'on vient de réclamer, pas un statut
 *     d'adhésion. « Tes favoris t'attendent » convertit, « Connecte-toi pour
 *     continuer » fait barrage ;
 *   ② **le texte était faux quatre fois sur cinq** : il énumérait trois
 *     destinations, et on en touchait une quatrième ;
 *   ③ **le titre donnait un ORDRE au lieu de porter un argument**, et il
 *     répétait le bouton posé trois lignes plus bas.
 * Chaque appelant déclare donc sa `destination` — un mot — et la porte va
 * chercher son titre et son corps.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * LA COMPOSITION EST CELLE D'AIRBNB, PAS CELLE DE LA BIENVENUE
 * (revue du 08/11, 23h, capture à l'appui — « pas épurée »).
 *
 * La porte avait d'abord repris le modèle de l'écran de bienvenue : ancré en
 * bas, grand titre, deux boutons pleine largeur. Posé sur un onglet, il ne
 * tenait pas. Mesuré sur la capture de référence, trois inversions :
 *
 *   ① **LE CONTENU EST EN HAUT, le vide en bas.** On lisait à 55 % de la
 *      hauteur, sous un vide que rien ne justifiait. La bienvenue, elle, n'a
 *      pas de barre d'onglets et assume l'ancrage bas comme page de garde ;
 *      ici l'écran a un titre de page, et un titre de page est en haut.
 *   ② **LA HIÉRARCHIE ÉTAIT À L'ENVERS.** Le titre de page faisait 20 pt et
 *      l'accroche 34 : le nom de la destination, qui dit OÙ L'ON EST, pesait
 *      trois fois moins que l'argument. La référence fait l'inverse — ~33 pt
 *      pour le titre de page, ~23 pour l'accroche. On passe donc à 30 / 20 /
 *      16, l'échelle maison, de la plus grosse à la plus petite dans
 *      l'ordre de lecture.
 *   ③ **UN SEUL BOUTON, ET IL ÉPOUSE SON TEXTE.** Deux blocs pleine largeur
 *      empilés font un mur en bas d'écran et donnent le même poids à deux
 *      gestes qui n'en ont pas. La référence n'a qu'un bouton compact.
 *      « Créer un compte » redevient ce qu'il était : un lien.
 *
 * Et le RYTHME fait le reste : un grand écart entre le titre de page et
 * l'accroche, un autre entre le corps et le bouton. L'épure n'est pas
 * l'absence d'éléments, c'est l'espace entre eux.
 *
 * Le verrou de marque reste HORS de l'app : « Yamba » sous le symbole est la
 * porte d'entrée (l'écran de bienvenue), pas un rappel à servir cinq fois.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POURQUOI LES CTA NE SONT PAS DESSINÉS COMME CEUX DE LA BIENVENUE, et
 * pourquoi ce n'est PAS une incohérence (question posée en revue le 08/11).
 *
 * Bienvenue : trois gestes EMPILÉS, PLEINE LARGEUR. Porte : deux gestes
 * CÔTE À CÔTE, qui épousent leur texte. La règle qui rend les deux
 * cohérents tient en une phrase :
 *
 *     LE POIDS DU BOUTON ÉPOUSE LE POIDS DU MOMENT.
 *
 * La bienvenue est un écran de DÉCISION : il n'existe que pour ça, les
 * gestes SONT le contenu, et pleine largeur est l'affordance maximale. La
 * porte est une INTERRUPTION : l'utilisateur voulait ses favoris et trouve
 * un mur ; les gestes y sont un remède, pas le propos. Des boutons compacts
 * gardent l'interruption légère et laissent l'écran ressembler à sa page.
 *
 * Deux contraintes le confirment, et elles sont matérielles : la bienvenue
 * a TROIS actions — trois sur une rangée est impossible — et son bloc est
 * ancré en bas, où une pile pleine largeur est la forme naturelle. La porte
 * en a deux, ancrées en haut, dans une colonne de lecture.
 *
 * La référence fait exactement cela : pleine largeur sur son écran de
 * connexion, un bouton compact sur sa porte. Harmoniser les deux formes
 * reviendrait à dire que tous les moments se valent.
 */
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { InviteBody, InviteGutter, useInviteColors } from '@/components/invite-kit';
import { ThemedText } from '@/components/themed-text';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/session-context';

/**
 * Les destinations qui ont leur propre discours. Une union fermée : le
 * dictionnaire et ce type se lisent ensemble, et un onglet ajouté sans sa
 * paire de clés se voit à la compilation.
 */
export type GateDestination = 'favorites' | 'activity' | 'messages' | 'publish' | 'profile';

export function IdentityGate({
  children,
  destination,
}: {
  children: ReactNode;
  destination?: GateDestination;
}) {
  const { status } = useSession();
  const t = useTranslations('tabs');
  const c = useInviteColors();

  if (status === 'authenticated') return <>{children}</>;

  const titre = destination === undefined ? t('gate.title') : t(`gate.${destination}.title`);
  const corps = destination === undefined ? t('gate.body') : t(`gate.${destination}.body`);

  // Le nom de la destination : celui de la BARRE pour les quatre onglets (le
  // même mot que celui qu'on vient de toucher), celui de l'écran pour Profil,
  // qui n'est pas un onglet. Un appelant sans destination n'en a pas.
  const nom =
    destination === undefined
      ? null
      : destination === 'profile'
        ? t('profile.title')
        : t(`bar.${destination}`);

  // L'amorçage reste CENTRÉ : un sablier calé en haut se lirait comme un
  // élément d'interface et non comme une attente.
  if (status === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <SafeAreaView style={styles.loading}>
          <ActivityIndicator color={Brand.mango} />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.block}>
          {/* ① Le titre de page : le plus gros caractère de l'écran. Même
              gabarit que la rangée de titre des écrans CONNECTÉS — il ne doit
              pas bouger d'un point quand la session s'ouvre. */}
          {nom !== null && <ThemedText type="title">{nom}</ThemedText>}

          {/* ② L'accroche, un cran en dessous : elle argumente, elle ne
              nomme pas. */}
          <ThemedText type="subtitle" style={styles.heading}>
            {titre}
          </ThemedText>
          <InviteBody>{corps}</InviteBody>

          {/* ③ LES DEUX gestes, côte à côte, et chacun épouse son texte. */}
          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push('/login')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, styles.ctaPrimary, pressed && styles.pressed]}>
              <ThemedText numberOfLines={1} style={[styles.ctaLabel, { color: c.onMango }]}>
                {t('gate.cta')}
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => router.push('/register')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.cta,
                { borderWidth: 1, borderColor: c.hairline },
                pressed && styles.pressed,
              ]}>
              <ThemedText numberOfLines={1} style={[styles.ctaLabel, { color: c.headline }]}>
                {t('gate.registerLink')}
              </ThemedText>
            </Pressable>
          </View>
        </View>

        {/* TOUT le vide est ici, SOUS le contenu : la barre d'onglets y
            flotte sans rien masquer, et rien n'a donc à lui réserver de la
            place. */}
        <View style={styles.spacer} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  block: {
    paddingHorizontal: InviteGutter,
    paddingTop: Spacing.four,
  },
  // Le grand écart qui FAIT l'épure : le titre de page vit seul, l'accroche
  // ouvre un second bloc. Mesuré à ~57 pt sur la référence.
  heading: {
    marginTop: Spacing.five + Spacing.four,
  },
  /**
   * LES DEUX CTA SUR UNE SEULE RANGÉE.
   *
   * Empilés pleine largeur, ils faisaient le mur qu'on vient de retirer ;
   * empilés en épousant leur texte, ils donnaient deux pilules de largeurs
   * différentes l'une sous l'autre — un bord gauche propre et un bord droit
   * en escalier. Côte à côte, ils tiennent sur une ligne (mesuré : ~271 pt
   * de boutons pour 327 pt disponibles sur un iPhone SE, le plus étroit du
   * parc) et la hiérarchie se lit à l'aplat, pas à la taille : mangue plein
   * pour l'un, contour pour l'autre.
   *
   * `flexWrap` est le filet : une traduction plus longue que prévu fait
   * passer le second bouton à la ligne au lieu de déborder.
   */
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.five + Spacing.two,
  },
  cta: {
    // Chaque bouton épouse son texte au lieu de barrer l'écran.
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: {
    backgroundColor: Brand.mango,
  },
  ctaLabel: {
    fontSize: 16,
    fontWeight: 700,
  },
  pressed: {
    opacity: 0.75,
  },
  spacer: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

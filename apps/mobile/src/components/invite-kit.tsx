/**
 * invite-kit.tsx — le modèle des écrans qui INVITENT (D88, revue du 08/11).
 * ==========================================================================
 * CE QUE CE FICHIER EST, APRÈS LA REVUE DU 08/11 (23h). Il a d'abord porté
 * « le modèle servi partout » : la porte d'identité devait reprendre telle
 * quelle la composition de la bienvenue. À l'écran, posée sur un onglet,
 * elle ne tenait pas — la porte a sa propre composition désormais (voir
 * `identity-gate.tsx`, qui dit pourquoi). Ce qu'ils partagent encore est ici,
 * et c'est l'essentiel : les TEINTES (une seule encre pour toute l'app) et
 * la typographie du CORPS. Le reste — verrou de marque, grand titre, pile de
 * gestes pleine largeur — reste la grammaire de la BIENVENUE, et d'elle
 * seule : un écran sans barre d'onglets, qui assume d'être une page de garde.
 *
 * Deux écrans, deux compositions, une seule encre : c'est plus honnête qu'un
 * modèle unique qu'il faudrait trahir au premier cas particulier.
 *
 * LE MODÈLE, dans l'ordre de lecture :
 *   ① tout le VIDE en haut (un unique espaceur `flex: 1`) — le bloc est
 *     ancré EN BAS et aligné à GAUCHE, à la manière des onboardings
 *     d'application. Centré, il se lisait comme une page de garde ;
 *   ② le verrou de marque : le symbole + le mot « Yamba » en TEXTE ;
 *   ③ un grand titre (34 px, 800, interlettrage serré) dont les coupures
 *     sont ÉCRITES dans le dictionnaire (`\n`), jamais subies — à 34 px une
 *     ligne porte ~24 caractères sur un iPhone 15 et ~23 sur un SE, et
 *     laisser le moteur couper produit des mots orphelins ;
 *   ④ un corps gris, 16 px, borné à 330 px de large ;
 *   ⑤ les gestes empilés PLEINE LARGEUR : mangue plein, puis contour, puis
 *     un lien centré discret. Rayon 12 — celui des écrans d'auth (l'identité
 *     du web) ; les pilules 999 juraient avec le reste du parcours.
 *
 * POURQUOI PAS `auth-kit`. Celui-là sert les écrans de FORMULAIRE et porte
 * l'ambiance « slate » du site (fond #F8FAFC, cartes bordées). Ici on est sur
 * le thème générique de l'app, et il n'y a pas un champ à remplir : deux
 * familles d'écrans, deux jeux de briques. Seul le CTA se ressemble, et il
 * ne justifie pas de marier deux ambiances.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import YambaSymbol from '@/components/yamba-symbol';
import { Spacing } from '@/constants/theme';
import { Brand } from '@/constants/theme';
import { FooterLine, Font } from '@/constants/typography';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

/** La gouttière du modèle. Elle n'est jamais posée sur le conteneur plein
 *  écran mais sur CHAQUE bloc : l'écran de bienvenue y fait défiler un
 *  carrousel pleine largeur, et une gouttière globale couperait sa
 *  pagination. */
export const InviteGutter = Spacing.four;

export type InviteColors = {
  background: string;
  /** Le noir ou le blanc PLEIN : titres, wordmark, libellé du bouton bordé. */
  headline: string;
  /** Le corps de texte. */
  body: string;
  /** Les liens discrets. */
  muted: string;
  /** Les contours. */
  hairline: string;
  /** Les points inactifs du carrousel. */
  dotIdle: string;
  /** Le libellé posé SUR le mangue. */
  onMango: string;
};

/**
 * Les teintes du modèle, dérivées du thème.
 *
 * Pourquoi pas `theme.text` partout : un écran d'invitation n'est pas une
 * page de contenu. Le wordmark doit être le noir ou le blanc PLEIN, le corps
 * et les liens sont des gris calculés par OPACITÉ sur le fond — ce que
 * `Colors` n'expose pas, et qui n'a pas sa place dans le thème global.
 */
export function useInviteColors(): InviteColors {
  const theme = useTheme();
  const dark = useColorScheme() === 'dark';
  const ink = dark ? '255, 255, 255' : '17, 24, 39';

  return {
    background: theme.background,
    headline: dark ? '#ffffff' : '#111827',
    body: `rgba(${ink}, ${dark ? 0.58 : 0.62})`,
    muted: `rgba(${ink}, ${dark ? 0.64 : 0.66})`,
    hairline: `rgba(${ink}, ${dark ? 0.32 : 0.22})`,
    dotIdle: `rgba(${ink}, ${dark ? 0.24 : 0.18})`,
    // Le libellé du bouton mangue reste MARINE dans les deux thèmes : du
    // blanc sur du mangue tombe sous 3:1, et c'est vrai de jour comme de nuit.
    onMango: '#0B1120',
  };
}

/* ── ② Le verrou de marque ───────────────────────────────────────────────── */

/**
 * Le symbole ne se suffit pas à lui-même pour qui découvre Yamba : le mot
 * reste à côté, et en TEXTE (D85 2A) — net à toute taille, lu par VoiceOver,
 * traduisible. Le symbole est décoratif, le texte dit déjà « Yamba ».
 */
export function InviteLockup() {
  const dark = useColorScheme() === 'dark';
  const c = useInviteColors();

  return (
    <View style={styles.lockup}>
      {/* `dark` désigne la variante POUR FOND SOMBRE : c'est l'inverse du nom
          du thème, d'où la bascule explicite. */}
      <YambaSymbol size={34} variant={dark ? 'dark' : 'light'} />
      <Text style={[styles.wordmark, { color: c.headline }]}>Yamba</Text>
    </View>
  );
}

/* ── ③④ Le discours ──────────────────────────────────────────────────────── */

export function InviteHeadline({ children }: { children: ReactNode }) {
  const c = useInviteColors();
  return <Text style={[styles.headline, { color: c.headline }]}>{children}</Text>;
}

export function InviteBody({ children }: { children: ReactNode }) {
  const c = useInviteColors();
  return <Text style={[styles.body, { color: c.body }]}>{children}</Text>;
}

/* ── ⑤ Les gestes ────────────────────────────────────────────────────────── */

/** La pile de gestes, collée au bas du bloc. */
export function InviteActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function InvitePrimary({
  label,
  onPressAction,
}: {
  label: string;
  onPressAction: () => void;
}) {
  const c = useInviteColors();
  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
      <Text style={[styles.primaryLabel, { color: c.onMango }]}>{label}</Text>
    </Pressable>
  );
}

/** Contour plutôt qu'aplat : deux blocs pleins l'un sur l'autre se disputent
 *  l'attention, et le second geste n'est pas celui qu'on pousse. */
export function InviteSecondary({
  label,
  onPressAction,
}: {
  label: string;
  onPressAction: () => void;
}) {
  const c = useInviteColors();
  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.secondary,
        { borderColor: c.hairline },
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.secondaryLabel, { color: c.headline }]}>{label}</Text>
    </Pressable>
  );
}

/** Le troisième geste : un lien centré, sans cadre — il existe, il ne pèse pas. */
export function InviteTertiary({
  label,
  onPressAction,
}: {
  label: string;
  onPressAction: () => void;
}) {
  const c = useInviteColors();
  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      hitSlop={Spacing.two}
      style={({ pressed }) => [styles.tertiary, pressed && styles.pressed]}>
      <Text style={[styles.tertiaryLabel, { color: c.muted }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  lockup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: InviteGutter,
    marginBottom: Spacing.four,
  },
  wordmark: {
    fontSize: 24,
    fontFamily: Font.extrabold,
    letterSpacing: -0.5,
  },
  // NI l'un NI l'autre ne portent la gouttière : la typographie n'est pas une
  // mise en page. Chaque écran pose la sienne — volets de carrousel pour la
  // bienvenue, bloc de contenu pour la porte d'identité.
  headline: {
    fontSize: 34,
    lineHeight: 46,
    fontFamily: Font.extrabold,
    letterSpacing: -0.8,
  },
  body: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: Font.medium,
    marginTop: Spacing.three,
    /**
     * AUCUN plafond de mesure, et c'est un retrait (revue du 08/11, 23h12).
     *
     * Il y avait `maxWidth: 330`, réglé pour le carrousel de la bienvenue.
     * Posé dans la porte d'identité, il rendait la mise en page DÉPENDANTE
     * DE L'APPAREIL : sur un iPhone 15 il reste 345 pt entre les gouttières,
     * le corps revenait donc à la ligne 15 pt avant le titre et le bloc de
     * texte n'avait plus de bord droit commun ; sur un SE (327 pt) le
     * plafond ne mordait pas du tout et le défaut disparaissait.
     *
     * Sans lui, la mesure vaut la laisse de l'écran : ~42 caractères à
     * 16 pt, au cœur de la fourchette lisible (45–75 avec les espaces).
     * Vérifié sur les six volets de la bienvenue : aucun ne change de
     * nombre de lignes, et le volet « modèle » en français en perd même une.
     */
  },
  actions: {
    gap: Spacing.two,
    paddingHorizontal: InviteGutter,
    paddingBottom: Spacing.three,
  },
  // Rayon 12, comme les boutons des écrans auth (l'identité web).
  primary: {
    backgroundColor: Brand.mango,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontFamily: Font.bold,
  },
  secondary: {
    borderRadius: 12,
    minHeight: 52,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 16,
    fontFamily: Font.semibold,
  },
  tertiary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  // « Plus tard » est un pied d'écran comme les deux autres (revue du 10/11)
  // — même gabarit, et l'encre GRISE posée par l'appelant : les deux autres
  // mènent à l'écran jumeau (connexion ↔ inscription), celui-ci DÉCLINE la
  // proposition. Même gabarit, autre intention.
  tertiaryLabel: {
    ...FooterLine,
  },
  pressed: {
    opacity: 0.75,
  },
});

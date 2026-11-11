/**
 * auth-kit.tsx — les briques des écrans d'auth (refonte sur captures, A208).
 * ==========================================================================
 * Les éléments récurrents des pages auth du site, en natif : label en gras
 * au-dessus du champ (avec action à droite optionnelle — « Oublié ? »),
 * champ bordé arrondi 12 (la ref passe en PROP — React 19 — pour le
 * chaînage clavier `returnKeyType="next"`), CTA mangue à texte sombre,
 * séparateur, boutons de méthode (« Continuer avec … »), case à cocher
 * carrée avec aide, lien teal souligné. Palette : `auth-theme.ts`.
 *
 * D91 — la rangée sociale en LOGOS SEULS a été retirée : une pastille ronde
 * ne dit ni le verbe ni ce qui va se passer. Les fournisseurs passent par
 * `MethodButton`, qui porte leur nom ; quand la place manque (rangée à deux
 * colonnes de l'inscription), le libellé visible se raccourcit et le verbe
 * reste dans `accessibilityLabel`.
 */
import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Image } from 'expo-image';
import { useTranslations } from 'use-intl';

import { Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import {
  AuthBrand,
  AuthFieldHeight,
  AuthRadius,
  useAuthPalette,
} from '@/components/auth/auth-theme';

/* ── Label de champ ──────────────────────────────────────────────────────── */

/**
 * Le libellé d'un champ GUIDE, il n'annonce pas (alignement du 10/11 sur le
 * formulaire web). Il était en 700, à l'encre du titre : sur un écran qui en
 * aligne quatre, la page n'avait plus de niveau de lecture — tout pesait le
 * même poids que le titre, donc rien ne reculait.
 *
 * CORRIGÉ le 10/11 — il était passé à `muted`, qui est AUSSI la couleur de
 * l'exemple dans le champ (`placeholderTextColor`) : « First name » et
 * « Marie » se retrouvaient à la même encre, à la même graisse, à quatre
 * points de taille près. Le libellé se lisait comme une deuxième valeur.
 *
 * Il prend donc `text`, l'encre INTERMÉDIAIRE : plus clair que le titre, plus
 * franc que l'exemple. Trois niveaux au lieu de deux.
 *
 * On n'a PAS copié le web ici, et c'est délibéré. Le web sépare les deux en
 * ÉCLAIRCISSANT son exemple (slate-400 sur blanc), ce qui le fait tomber à
 * 2,56:1 — sous le seuil AA. Un exemple de format se lit, surtout dehors sur
 * un téléphone. On sépare donc par le HAUT. Mesuré :
 *
 *     libellé   9,90:1 (clair)   12,68:1 (sombre)
 *     exemple   4,76:1 (clair)    6,96:1 (sombre)   ← au-dessus de 4,5:1
 *
 * Ce qui reste aligné avec le web est ce qui comptait : la GRAISSE (500, plus
 * aucun gras) et la hiérarchie libellé > exemple.
 */
export function FieldLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const palette = useAuthPalette();
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: palette.text }]}>{children}</Text>
      {right}
    </View>
  );
}

/* ── Champ texte ─────────────────────────────────────────────────────────── */

export function AuthTextField(props: TextInputProps & { ref?: Ref<TextInput> }) {
  const palette = useAuthPalette();
  const { style, ...rest } = props;
  return (
    <TextInput
      style={[
        styles.input,
        {
          color: palette.title,
          backgroundColor: palette.card,
          borderColor: palette.border,
        },
        style,
      ]}
      placeholderTextColor={palette.muted}
      {...rest}
    />
  );
}

/* ── CTA mangue ──────────────────────────────────────────────────────────── */



/**
 * Doctrine du désactivé (passes UX des 28/09) : `disabled` n'est permis que
 * quand UN SEUL champ visible l'explique (validation live — le bouton
 * s'allume sous les yeux) ; les formulaires multi-champs restent toujours
 * actifs et NOMMENT le manquement au tap. L'état désactivé est un GRIS
 * NEUTRE franc (le motif Revolut) — jamais de la mangue délavée.
 */
export function AuthCta({
  label,
  onPressAction,
  disabled = false,
  pending = false,
}: {
  label: string;
  onPressAction: () => void;
  disabled?: boolean;
  pending?: boolean;
}) {
  const palette = useAuthPalette();
  return (
    <Pressable
      onPress={onPressAction}
      disabled={disabled || pending}
      style={({ pressed }) => [
        styles.cta,
        disabled && !pending && { backgroundColor: palette.border },
        pressed && styles.dimmed,
      ]}>
      {/* D95 — le chargement moderne : le libellé ne DISPARAÎT pas, il
          s'efface. Rendu à l'opacité 0, il continue d'occuper sa place, donc
          la largeur du bouton ne bouge pas d'un pixel ; le disque se
          superpose, centré. Trois choses qu'on évite ainsi, et qui se voient
          toutes à l'œil nu :
            • le SAUT de largeur quand « Créer mon compte » devient « … » ;
            • le changement de LIBELLÉ (« Création… »), un mot de plus à lire
              pour n'apprendre que ce que le disque dit déjà ;
            • le bouton qui se vide, puis se remplit — deux animations là où
              une seule suffit.
          Au succès on NAVIGUE : le disque ne s'arrête jamais, il part avec
          l'écran. C'est voulu — un bouton qui redevient cliquable une
          fraction de seconde avant la navigation invite au double envoi. */}
      {pending && (
        <ActivityIndicator
          size="small"
          color={palette.ctaLabel}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text
        style={[
          styles.ctaLabel,
          { color: disabled ? palette.muted : palette.ctaLabel },
          pending && styles.labelFaded,
        ]}>
          {label}
      </Text>
    </Pressable>
  );
}

/* ── Bouton de méthode (« Continuer avec … », écran identifier-first) ────── */

export function MethodButton({
  icon,
  label,
  onPressAction,
  accessibilityLabel,
}: {
  icon: ReactNode;
  label: string;
  onPressAction?: () => void;
  /**
   * Ce que LIT un lecteur d'écran, quand le libellé visible a dû être
   * raccourci (rangée à deux colonnes). Sans lui, VoiceOver annonce
   * « Google », qui ne dit pas ce que fait le bouton.
   */
  accessibilityLabel?: string;
}) {
  const palette = useAuthPalette();
  return (
    <Pressable
      onPress={onPressAction}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.methodButton,
        { backgroundColor: palette.card, borderColor: palette.border },
        pressed && styles.dimmed,
      ]}>
      <View style={styles.methodIcon}>{icon}</View>
      <Text style={[styles.methodLabel, { color: palette.title }]}>{label}</Text>
    </Pressable>
  );
}

/* ── Échec plein écran (X, titre, sous-titre, CTA bas — réf. captures/3) ── */

export function AuthFailureView({
  title,
  body,
  ctaLabel,
  onRetryAction,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onRetryAction: () => void;
}) {
  const palette = useAuthPalette();
  return (
    <View style={styles.failure}>
      <View style={[styles.failureBadge, { backgroundColor: palette.card }]}>
        <Text style={[styles.failureGlyph, { color: palette.title }]}>✕</Text>
      </View>
      <View style={styles.failureTexts}>
        <Text style={[styles.failureTitle, { color: palette.title }]}>{title}</Text>
        <Text style={[styles.failureBody, { color: palette.muted }]}>{body}</Text>
      </View>
      <AuthCta label={ctaLabel} onPressAction={onRetryAction} />
    </View>
  );
}

/* ── Séparateur « OU PAR E-MAIL » ────────────────────────────────────────── */

export function AuthDivider({ label }: { label: string }) {
  const palette = useAuthPalette();
  return (
    <View style={styles.divider}>
      <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
      <Text style={[styles.dividerLabel, { color: palette.muted }]}>{label.toUpperCase()}</Text>
      <View style={[styles.dividerLine, { backgroundColor: palette.border }]} />
    </View>
  );
}


/* ── Case à cocher ───────────────────────────────────────────────────────── */

export function AuthCheckbox({
  checked,
  onToggleAction,
  label,
  helper,
}: {
  checked: boolean;
  onToggleAction: () => void;
  label: ReactNode;
  helper?: string;
}) {
  const palette = useAuthPalette();
  return (
    <Pressable onPress={onToggleAction} accessibilityRole="checkbox" style={styles.checkboxRow}>
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? AuthBrand.mango : palette.muted },
          checked && { backgroundColor: AuthBrand.mango },
        ]}>
        {checked && <Text style={styles.checkboxMark}>✓</Text>}
      </View>
      <View style={styles.checkboxTexts}>
        <Text style={[styles.checkboxLabel, { color: palette.text }]}>{label}</Text>
        {helper !== undefined && (
          <Text style={[styles.checkboxHelper, { color: palette.muted }]}>{helper}</Text>
        )}
      </View>
    </Pressable>
  );
}

/* ── Lien teal souligné (« ← Retour à la connexion ») ────────────────────── */

export function TealLink({
  label,
  onPressAction,
  arrow = false,
  center = false,
}: {
  label: string;
  onPressAction: () => void;
  arrow?: boolean;
  center?: boolean;
}) {
  const palette = useAuthPalette();
  return (
    <Pressable
      onPress={onPressAction}
      hitSlop={Spacing.one}
      style={({ pressed }) => [center && styles.centerSelf, pressed && styles.dimmed]}>
      <Text style={[styles.tealLink, { color: palette.teal }]}>
        {arrow ? '←  ' : ''}
        <Text style={styles.underline}>{label}</Text>
      </Text>
    </Pressable>
  );
}

/* ── Message d'erreur ────────────────────────────────────────────────────── */

export function AuthError({ message }: { message: string }) {
  return <Text style={styles.error}>{message}</Text>;
}

/**
 * Les graisses de cette trousse suivent D91 5A (revue du 10/11, page 2) :
 * titre 600, libellés 500, corps 400 — et UN SEUL élément en 700, le bouton.
 * `ctaLabel` est donc le seul TEXTE en 700, et doit le rester : c'est ce qui
 * le fait avancer pendant que le reste tient sa place. Restent lourds
 * `failureGlyph` et `checkboxMark` — ce ne sont pas des textes mais des
 * GLYPHES dessinés (une croix de 36 px, une coche de case), dont la graisse
 * est un trait de dessin et non un niveau de lecture.
 */
const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -Spacing.one,
  },
  label: {
    // 15 et non 13 comme le web : même rôle, autre distance de lecture — un
    // libellé de formulaire sur un téléphone se lit à bout de bras. Ce qui
    // s'aligne est la GRAISSE et l'encre, c'est-à-dire ce qui fait reculer.
    fontSize: 15,
    fontFamily: Font.medium,
  },
  input: {
    height: AuthFieldHeight,
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  /** Le libellé effacé GARDE sa place : c'est ce qui fige la largeur. */
  labelFaded: {
    opacity: 0,
  },
  cta: {
    backgroundColor: AuthBrand.mango,
    borderRadius: AuthRadius,
    height: AuthFieldHeight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  ctaLabel: {
    // 15 et non 17 (revue du 10/11). Ce qui fait avancer ce bouton n'est pas
    // la TAILLE de son texte : c'est l'aplat mangue, sa pleine largeur, ses
    // 52 pt de haut et le fait d'être le SEUL élément en gras de l'écran
    // (D91 5A). Le libellé n'a donc pas à crier par-dessus — et un bouton
    // dont le texte dépasse ses voisins d'un tiers a l'air d'un bouton de
    // système d'exploitation, pas d'un produit. La zone tactile ne change
    // pas d'un pixel : elle tient à la hauteur du bouton, pas à son texte.
    //
    // Reste un cran AU-DESSUS du site (14 px) : même rôle, autre distance de
    // lecture — un téléphone se lit à bout de bras (D91 5A).
    fontSize: 15,
    lineHeight: 21,
    fontFamily: Font.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginVertical: Spacing.one,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerLabel: {
    // « OU CONTINUER AVEC » n'est pas une information : c'est une CHARNIÈRE
    // entre deux façons de s'inscrire. Il doit se lire une fois et disparaître
    // — 11 px, gris, et 400 : l'interlettrage et les deux filets font seuls le
    // travail de séparation, la graisse n'y ajoutait qu'un bruit.
    fontSize: 11,
    fontFamily: Font.regular,
    letterSpacing: 1.5,
  },
  methodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: AuthFieldHeight,
    borderWidth: 1,
    borderRadius: AuthRadius,
  },
  methodIcon: {
    width: 24,
    alignItems: 'center',
  },
  methodLabel: {
    // 14 et non 16 (revue du 10/11) : sur l'inscription ces boutons vont par
    // DEUX, côte à côte (D91 7A), et chacun n'a donc que la moitié de la
    // colonne. « Facebook » y tenait de justesse — il suffisait d'une langue
    // plus longue, ou d'une taille de texte système augmentée, pour que le
    // mot se coupe. 14 rend la marge que la disposition à deux colonnes avait
    // prise, et le logo porte l'identification de toute façon.
    fontSize: 14,
    lineHeight: 19,
    fontFamily: Font.medium,
  },
  failure: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.five,
    paddingVertical: Spacing.six,
  },
  failureBadge: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failureGlyph: {
    fontSize: 36,
    fontFamily: Font.bold,
  },
  failureTexts: {
    gap: Spacing.two,
  },
  failureTitle: {
    fontSize: 26,
    lineHeight: 36,
    fontFamily: Font.semibold,
    textAlign: 'center',
  },
  failureBody: {
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
  },
  checkboxRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxMark: {
    color: '#0F172A',
    fontSize: 13,
    fontFamily: Font.extrabold,
  },
  checkboxTexts: {
    flex: 1,
    gap: 2,
  },
  checkboxLabel: {
    // 13 px (revue du 10/11) : la mention légale est la plus longue ligne de
    // l'écran et la moins décisive. À 15 px elle pesait autant que les champs
    // qu'il faut remplir ; à 13 elle reste parfaitement lisible et rend sa
    // place à ce qui demande un geste. Les deux liens gardent leur encre.
    fontSize: 13,
    lineHeight: 19,
    // 400 et non 500 (revue du 10/11) : un libellé de case à cocher est du
    // texte courant, pas un titre. Il est long, il se lit, il ne s'annonce pas.
    fontFamily: Font.regular,
  },
  checkboxHelper: {
    fontSize: 13,
    lineHeight: 18,
  },
  tealLink: {
    fontSize: 15,
    fontFamily: Font.medium,
  },
  underline: {
    textDecorationLine: 'underline',
  },
  centerSelf: {
    alignSelf: 'center',
  },
  error: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 19,
  },
  dimmed: {
    opacity: 0.6,
  },
});

/**
 * auth-kit.tsx — les briques des écrans d'auth (refonte sur captures, A208).
 * ==========================================================================
 * Les éléments récurrents des pages auth du site, en natif : label en gras
 * au-dessus du champ (avec action à droite optionnelle — « Oublié ? »),
 * champ bordé arrondi 12 (la ref passe en PROP — React 19 — pour le
 * chaînage clavier `returnKeyType="next"`), CTA mangue à texte sombre,
 * séparateur, rangée sociale en LOGOS SEULS sous le CTA (itération UX du
 * 28/09 : le mobile a moins de place que le web — les boutons pleine
 * largeur du site deviennent deux pastilles ; inertes tant que les flux
 * n'existent pas, dessinées fonctionnelles), case à cocher carrée avec
 * aide, lien teal souligné. Palette : `auth-theme.ts`.
 */
import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import {
  Animated,
  Easing,
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
import {
  AuthBrand,
  AuthFieldHeight,
  AuthRadius,
  useAuthPalette,
} from '@/components/auth/auth-theme';

/* ── Label de champ ──────────────────────────────────────────────────────── */

export function FieldLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  const palette = useAuthPalette();
  return (
    <View style={styles.labelRow}>
      <Text style={[styles.label, { color: palette.title }]}>{children}</Text>
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

const DOT_COUNT = 3;
const DOT_CYCLE_MS = 900;
const DOT_STAGGER_MS = 150;

/**
 * L'attente des CTA : trois points qui respirent en VAGUE (le motif du
 * « typing indicator ») à la place du spinner système — `Animated` natif
 * (`useNativeDriver`), zéro dépendance. Chaque point monte, gonfle et
 * s'éclaire avec un décalage d'un tiers de cycle.
 */
function LoadingDots({ color }: { color: string }) {
  const values = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const loops = values.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * DOT_STAGGER_MS),
          Animated.timing(value, {
            toValue: 1,
            duration: DOT_CYCLE_MS / 3,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: DOT_CYCLE_MS / 3,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((DOT_COUNT - 1 - i) * DOT_STAGGER_MS),
        ])
      )
    );
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);

  return (
    <View style={styles.dotsRow} accessibilityRole="progressbar">
      {values.map((value, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
                { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

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
      style={({ pressed }) => [styles.cta, (disabled || pressed) && styles.dimmed]}>
      {pending ? (
        <LoadingDots color={palette.ctaLabel} />
      ) : (
        <Text style={[styles.ctaLabel, { color: palette.ctaLabel }]}>{label}</Text>
      )}
    </Pressable>
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

/* ── Rangée sociale en logos seuls (sous le CTA — itération UX du 28/09) ── */

export function SocialLogosRow() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  return (
    <View style={styles.socialRow}>
      {/* Les VRAIS logos (SVG officiels, rendus par expo-image — le canal de
          l'illustration de bienvenue) : le G quadricolore est obligatoire
          dans la charte Google. Inertes tant que les flux natifs n'existent
          pas (Google : lot A201) — le câblage viendra sans changer l'écran. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('social.google')}
        style={({ pressed }) => [
          styles.socialDot,
          { backgroundColor: palette.card, borderColor: palette.border },
          pressed && styles.dimmed,
        ]}>
        <Image source={require('@/assets/images/google-g.svg')} style={styles.socialLogo} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('social.facebook')}
        style={({ pressed }) => [
          styles.socialDot,
          { backgroundColor: palette.card, borderColor: palette.border },
          pressed && styles.dimmed,
        ]}>
        <Image source={require('@/assets/images/facebook-f.svg')} style={styles.socialLogo} />
      </Pressable>
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

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: -Spacing.one,
  },
  label: {
    fontSize: 15,
    fontWeight: 700,
  },
  input: {
    height: AuthFieldHeight,
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
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
    fontSize: 17,
    fontWeight: 700,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    // La hauteur de la ligne du libellé : le bouton ne bouge pas d'un pixel
    // quand le texte cède la place aux points.
    height: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 1.5,
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  socialDot: {
    width: AuthFieldHeight,
    height: AuthFieldHeight,
    borderRadius: AuthFieldHeight / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLogo: {
    width: 24,
    height: 24,
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
    fontWeight: 800,
  },
  checkboxTexts: {
    flex: 1,
    gap: 2,
  },
  checkboxLabel: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: 500,
  },
  checkboxHelper: {
    fontSize: 13,
    lineHeight: 18,
  },
  tealLink: {
    fontSize: 15,
    fontWeight: 600,
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

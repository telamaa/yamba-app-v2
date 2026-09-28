/**
 * auth-kit.tsx — les briques des écrans d'auth (refonte sur captures, A208).
 * ==========================================================================
 * Les éléments récurrents des pages auth du site, en natif : label en gras
 * au-dessus du champ (avec action à droite optionnelle — « Oublié ? »),
 * champ bordé arrondi 12, CTA mangue à texte sombre, séparateur
 * « OU PAR E-MAIL », bloc social (Google « bientôt disponible » grisé —
 * le natif est son propre lot A201 — et Facebook INERTE, conservé comme
 * sur le site, décision du 03/09), case à cocher carrée avec aide, lien
 * teal souligné avec flèche optionnelle. Palette : `auth-theme.ts`.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

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

export function AuthTextField(props: TextInputProps) {
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
        (disabled || pending || pressed) && styles.dimmed,
      ]}>
      {pending ? (
        <ActivityIndicator color={palette.ctaLabel} />
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

/* ── Bloc social (Google à venir, Facebook inerte — comme le site) ───────── */

export function SocialSignInBlock() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  return (
    <View style={styles.social}>
      <View
        style={[
          styles.socialButton,
          styles.dimmedSocial,
          { backgroundColor: palette.card, borderColor: palette.border },
        ]}>
        <Text style={styles.googleG}>G</Text>
        <Text style={[styles.socialLabel, { color: palette.muted }]}>
          {t('social.googleSoon')}
        </Text>
      </View>
      {/* Inerte à dessein : identique au site (décision du 03/09). */}
      <Pressable
        style={({ pressed }) => [
          styles.socialButton,
          { backgroundColor: palette.card, borderColor: palette.border },
          pressed && styles.dimmed,
        ]}>
        <View style={styles.facebookDot}>
          <Text style={styles.facebookF}>f</Text>
        </View>
        <Text style={[styles.socialLabel, { color: palette.title }]}>
          {t('social.facebook')}
        </Text>
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
  social: {
    gap: Spacing.two,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: AuthFieldHeight,
    borderWidth: 1,
    borderRadius: AuthRadius,
  },
  dimmedSocial: {
    opacity: 0.75,
  },
  googleG: {
    fontSize: 18,
    fontWeight: 700,
    color: '#4285F4',
  },
  facebookDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  facebookF: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 800,
  },
  socialLabel: {
    fontSize: 16,
    fontWeight: 600,
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

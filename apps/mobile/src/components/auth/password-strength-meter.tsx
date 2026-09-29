/**
 * password-strength-meter.tsx — la jauge des 8 critères (lot auth mobile).
 * ========================================================================
 * Version compacte du `PasswordStrengthIndicator` du web, pensée pour un
 * écran de téléphone : une jauge de niveau + la liste des critères ENCORE
 * MANQUANTS seulement (la liste rétrécit à mesure que la saisie progresse,
 * huit lignes cochées n'apprennent rien). Mêmes 8 critères, même barème de
 * niveau que le web et le serveur (`@/lib/password-rules`).
 */
import { StyleSheet, Text, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { useAuthPalette } from '@/components/auth/auth-theme';
import { Brand, Spacing } from '@/constants/theme';
import {
  getPasswordChecks,
  getPasswordLevel,
  getPasswordScore,
  type PasswordChecks,
  type PasswordContext,
} from '@/lib/password-rules';

const LEVEL_COLOR = {
  empty: null,
  weak: '#DC2626',
  medium: Brand.mango,
  strong: '#16A34A',
  excellent: '#16A34A',
} as const;

const CHECK_ORDER: (keyof PasswordChecks)[] = [
  'minLength',
  'lowercase',
  'uppercase',
  'number',
  'special',
  'simpleDate',
  'predictable',
  'personalInfo',
];

type Props = {
  password: string;
  context?: PasswordContext;
};

export function PasswordStrengthMeter({ password, context }: Props) {
  const t = useTranslations('auth');
  const palette = useAuthPalette();

  if (password.length === 0) return null;

  const checks = getPasswordChecks(password, context);
  const score = getPasswordScore(checks);
  const level = getPasswordLevel(password, score);
  const color = LEVEL_COLOR[level] ?? palette.muted;
  const missing = CHECK_ORDER.filter((key) => !checks[key]);

  return (
    // Hauteur RÉSERVÉE (jauge + deux lignes) : la liste qui rétrécit à
    // chaque frappe ne fait plus danser le CTA sous le pouce.
    <View style={styles.container}>
      <View style={styles.gaugeRow}>
        <View style={[styles.gauge, { backgroundColor: palette.border }]}>
          <View
            style={[styles.gaugeFill, { width: `${(score / 8) * 100}%`, backgroundColor: color }]}
          />
        </View>
        <Text style={[styles.levelLabel, { color }]}>{t(`password.level.${level}`)}</Text>
      </View>
      {missing.length > 0 ? (
        <Text style={[styles.missing, { color: palette.muted }]} numberOfLines={2}>
          {missing.map((key) => t(`password.checks.${key}`)).join(' · ')}
        </Text>
      ) : (
        <Text style={[styles.missing, { color: '#16A34A' }]}>{t('password.allGood')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
    minHeight: 50,
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  gauge: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 3,
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: 600,
  },
  missing: {
    fontSize: 13,
    lineHeight: 18,
  },
});

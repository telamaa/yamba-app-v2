/**
 * (auth)/password-reset.tsx — le nouveau mot de passe (lot auth mobile).
 * ======================================================================
 * La dernière étape du parcours oublié (ResetPasswordForm du web) : UN champ
 * avec œil et jauge (mêmes 8 critères que partout), le jeton d'étape venu du
 * store. Jeton absent ou expiré côté serveur (`RESET_SESSION_EXPIRED`, 15
 * min, consommé au premier essai transformé) : un état dédié propose de
 * recommencer. Succès → la connexion, préremplie, bandeau « mot de passe
 * changé » — le serveur n'ouvre pas de session sur un reset.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTranslations } from 'use-intl';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { resetPassword } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/client';
import { getPendingReset, setLoginPrefill, setPendingReset } from '@/lib/auth-flow-state';
import { getPasswordChecks, isPasswordValid } from '@/lib/password-rules';

export default function PasswordResetScreen() {
  const t = useTranslations('auth');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const pendingReset = getPendingReset();

  const restart = () => {
    setPendingReset(null);
    router.navigate('/password-forgot');
  };

  if (pendingReset === null || pendingReset.passwordResetToken === null || sessionExpired) {
    return (
      <AuthScreen title={t('reset.title')}>
        <ThemedText themeColor="textSecondary">{t('reset.sessionExpired')}</ThemedText>
        <Pressable onPress={restart} style={styles.cta}>
          <ThemedText style={styles.ctaLabel}>{t('otp.restartForgot')}</ThemedText>
        </Pressable>
      </AuthScreen>
    );
  }

  const context = { email: pendingReset.email };
  const canSubmit = password.length > 0 && !pending;

  const messageOf = (err: unknown): string => {
    if (!(err instanceof ApiError)) return t('common.errors.network');
    switch (err.code) {
      case 'PASSWORD_UNCHANGED':
        return t('reset.errors.PASSWORD_UNCHANGED');
      case 'PASSWORD_STATE_CHANGED':
        return t('reset.errors.PASSWORD_STATE_CHANGED');
      default:
        return err.message;
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    if (!isPasswordValid(getPasswordChecks(password, context))) {
      setError(t('register.errors.PASSWORD_INVALID'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await resetPassword(pendingReset.passwordResetToken as string, password);
      const email = pendingReset.email;
      setPendingReset(null);
      setLoginPrefill({ email, notice: 'passwordChanged' });
      router.navigate('/login');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESET_SESSION_EXPIRED') {
        setSessionExpired(true);
        return;
      }
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen title={t('reset.title')}>
      <ThemedText themeColor="textSecondary">{t('reset.subtitle')}</ThemedText>

      <PasswordInput
        placeholder={t('reset.passwordPlaceholder')}
        autoComplete="new-password"
        autoFocus
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={onSubmit}
      />
      <PasswordStrengthMeter password={password} context={context} />

      {error !== null && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={onSubmit}
        disabled={!canSubmit}
        style={({ pressed }) => [styles.submit, (!canSubmit || pressed) && styles.submitDimmed]}>
        {pending ? (
          <ActivityIndicator color="#151718" />
        ) : (
          <ThemedText style={styles.submitLabel}>{t('reset.submit')}</ThemedText>
        )}
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  error: {
    color: '#DC2626',
  },
  submit: {
    backgroundColor: Brand.mango,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitDimmed: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#151718',
    fontSize: 15,
    fontWeight: 600,
  },
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  ctaLabel: {
    color: '#151718',
    fontSize: 15,
    fontWeight: 600,
  },
});

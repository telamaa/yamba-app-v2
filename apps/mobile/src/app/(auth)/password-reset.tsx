/**
 * (auth)/password-reset.tsx — le nouveau mot de passe (A208, refonte sur
 * captures).
 * ======================================================================
 * La dernière étape du parcours oublié, dans la composition du site :
 * badge « Récupération sécurisée », UN champ avec œil et jauge des 8
 * critères (pas de confirmation — même divergence mobile assumée que
 * l'inscription : l'œil + l'autofill la rendent inutile), CTA mangue.
 * Jeton absent ou expiré
 * (`RESET_SESSION_EXPIRED`, 15 min, consommé au premier essai transformé) :
 * un état dédié propose de recommencer. Succès → la connexion, préremplie,
 * bandeau « mot de passe changé » — un reset n'ouvre pas de session.
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { useTranslations } from 'use-intl';

import { AuthCta, AuthError, AuthFailureView, FieldLabel } from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
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

  if (pendingReset === null || pendingReset.passwordResetToken === null || sessionExpired) {
    return (
      <AuthScreen badge={t('forgot.badge')} title="">
        <AuthFailureView
          title={t('failure.title')}
          body={t('reset.sessionExpired')}
          ctaLabel={t('otp.restartForgot')}
          onRetryAction={() => {
            setPendingReset(null);
            router.navigate('/password-forgot');
          }}
        />
      </AuthScreen>
    );
  }

  const context = { email: pendingReset.email };

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

  // CTA toujours actif (passe UX) : au tap, le manquement est nommé.
  const onSubmit = async () => {
    if (pending) return;
    if (password.length === 0) {
      setError(t('common.errors.MISSING_PASSWORD'));
      return;
    }
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
    <AuthScreen badge={t('forgot.badge')} title={t('reset.title')} subtitle={t('reset.subtitle')}>
      <FieldLabel>{t('reset.passwordLabel')}</FieldLabel>
      <PasswordInput
        autoComplete="new-password"
        autoFocus
        returnKeyType="done"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={onSubmit}
      />
      <PasswordStrengthMeter password={password} context={context} />

      {error !== null && <AuthError message={error} />}

      <AuthCta label={t('reset.submit')} onPressAction={onSubmit} pending={pending} />
    </AuthScreen>
  );
}

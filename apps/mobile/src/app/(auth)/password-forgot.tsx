/**
 * (auth)/password-forgot.tsx — mot de passe oublié (A208, refonte sur
 * captures).
 * ===================================================================
 * La page « Mot de passe oublié ? » du site : badge « Récupération
 * sécurisée », une adresse, la note de sécurité (« le message est
 * identique même si le compte n'existe pas » — anti-énumération
 * ANO-API-08, le serveur répond TOUJOURS oui), CTA « Envoyer le code »,
 * lien « ← Retour à la connexion ». L'e-mail du parcours part dans
 * `auth-flow-state`, jamais en paramètre de route.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { useTranslations } from 'use-intl';

import {
  AuthCta,
  AuthError,
  AuthTextField,
  FieldLabel,
  TealLink,
} from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useAuthPalette } from '@/components/auth/auth-theme';
import { forgotPassword } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/client';
import { setPendingReset } from '@/lib/auth-flow-state';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordForgotScreen() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();
  const canSubmit = normalized.length > 0 && !pending;

  const onSubmit = async () => {
    if (!canSubmit) return;
    if (!EMAIL_REGEX.test(normalized)) {
      setError(t('register.errors.INVALID_EMAIL'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await forgotPassword(normalized);
      setPendingReset({ email: normalized, passwordResetToken: null });
      router.push('/password-verify');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.errors.network'));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen
      badge={t('forgot.badge')}
      title={t('forgot.title')}
      subtitle={t('forgot.subtitle')}>
      <FieldLabel>{t('forgot.emailLabel')}</FieldLabel>
      <AuthTextField
        placeholder={t('login.emailPlaceholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoFocus
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={onSubmit}
      />

      <Text style={[styles.securityNote, { color: palette.muted }]}>
        {t('forgot.securityNote')}
      </Text>

      {error !== null && <AuthError message={error} />}

      <AuthCta
        label={t('forgot.submit')}
        onPressAction={onSubmit}
        disabled={!canSubmit}
        pending={pending}
      />

      <TealLink label={t('forgot.backToLogin')} onPressAction={() => router.back()} arrow center />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  securityNote: {
    fontSize: 14,
    lineHeight: 20,
  },
});

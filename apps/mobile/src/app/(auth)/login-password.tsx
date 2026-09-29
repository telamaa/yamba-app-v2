/**
 * (auth)/login-password.tsx — l'étape mot de passe (identifier-first, A208).
 * ==========================================================================
 * La deuxième marche du parcours Revolut : l'adresse vient de l'étape
 * identifier (`auth-flow-state`), affichée en chip avec « Modifier » ; si
 * l'on est arrivé par la méthode « e-mail et mot de passe » sans adresse
 * valide, le champ e-mail s'affiche ici. « Rester connecté » = le VRAI
 * `rememberMe` serveur (7 j / 60 min, décoché par défaut — A62). Les refus
 * parlent par `details.code` (RG-MOB-1). Succès → la feuille se referme.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslations } from 'use-intl';

import {
  AuthCheckbox,
  AuthError,
  AuthTextField,
  AuthCta,
  FieldLabel,
} from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';
import { PasswordInput } from '@/components/auth/password-input';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { getLoginEmail, setLoginEmail } from '@/lib/auth-flow-state';
import { isValidEmail } from '@/lib/email';
import { useSession } from '@/lib/session-context';

const TRANSLATED_ERROR_CODES = new Set([
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'ACCOUNT_SUSPENDED',
]);

function closeAuthSheet() {
  if (router.canDismiss()) router.dismiss();
  else router.replace('/');
}

export default function LoginPasswordScreen() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const { signIn } = useSession();
  const lockedEmail = getLoginEmail();
  const [email, setEmail] = useState(lockedEmail ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalized = email.trim().toLowerCase();

  const messageOf = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.code !== null && TRANSLATED_ERROR_CODES.has(err.code)) {
        return t(`login.errors.${err.code}`);
      }
      return err.message;
    }
    return t('login.errors.network');
  };

  const onSubmit = async () => {
    if (pending) return;
    if (!isValidEmail(normalized)) {
      setError(t('register.errors.INVALID_EMAIL'));
      return;
    }
    if (password.length === 0) {
      setError(t('common.errors.MISSING_PASSWORD'));
      return;
    }
    setPending(true);
    setError(null);
    try {
      await signIn(normalized, password, remember);
      setLoginEmail(null);
      closeAuthSheet();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen
      badge={t('login.badge')}
      title={t('login.passwordTitle')}
      subtitle={lockedEmail === null ? t('login.subtitle') : undefined}>
      {lockedEmail !== null ? (
        <View
          style={[styles.emailChip, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.emailChipText, { color: palette.title }]} numberOfLines={1}>
            {lockedEmail}
          </Text>
          <Pressable onPress={() => router.back()} hitSlop={Spacing.one}>
            <Text style={[styles.changeEmail, { color: palette.teal }]}>
              {t('login.changeEmail')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FieldLabel>{t('login.emailLabel')}</FieldLabel>
          <AuthTextField
            placeholder={t('login.emailPlaceholder')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </>
      )}

      <FieldLabel
        right={
          <Pressable onPress={() => router.push('/password-forgot')} hitSlop={Spacing.one}>
            <Text style={[styles.forgotLink, { color: palette.teal }]}>{t('login.forgot')}</Text>
          </Pressable>
        }>
        {t('login.passwordLabel')}
      </FieldLabel>
      <PasswordInput
        placeholder={t('login.passwordPlaceholder')}
        autoComplete="password"
        autoFocus={lockedEmail !== null}
        returnKeyType="done"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={onSubmit}
      />

      <AuthCheckbox
        checked={remember}
        onToggleAction={() => setRemember((v) => !v)}
        label={t('login.rememberLabel')}
        helper={t('login.rememberHelper')}
      />

      {error !== null && <AuthError message={error} />}

      <AuthCta label={t('login.submit')} onPressAction={onSubmit} pending={pending} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  emailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  emailChipText: {
    flex: 1,
    fontSize: 16,
    fontWeight: 600,
  },
  changeEmail: {
    fontSize: 14,
    fontWeight: 700,
  },
  forgotLink: {
    fontSize: 15,
    fontWeight: 700,
  },
});

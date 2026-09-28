/**
 * (auth)/password-forgot.tsx — mot de passe oublié (lot auth mobile).
 * ===================================================================
 * Le formulaire du web (ForgotPasswordForm) : une adresse, et le serveur
 * répond TOUJOURS oui (anti-énumération ANO-API-08) — l'écran annonce
 * « si un compte existe » et passe à l'étape code sans jamais savoir si
 * l'adresse est connue. L'e-mail du parcours part dans `auth-flow-state`,
 * jamais en paramètre de route.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';

import { useTranslations } from 'use-intl';

import { AuthScreen } from '@/components/auth/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { forgotPassword } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/client';
import { setPendingReset } from '@/lib/auth-flow-state';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PasswordForgotScreen() {
  const t = useTranslations('auth');
  const theme = useTheme();
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
    <AuthScreen title={t('forgot.title')}>
      <ThemedText themeColor="textSecondary">{t('forgot.subtitle')}</ThemedText>

      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholder={t('login.emailPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoFocus
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={onSubmit}
      />

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
          <ThemedText style={styles.submitLabel}>{t('forgot.submit')}</ThemedText>
        )}
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
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
});

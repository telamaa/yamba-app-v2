import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTranslations } from 'use-intl';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { usePreferredLocaleSetter } from '@/i18n/provider';
import { ApiError } from '@/lib/api/client';
import { login } from '@/lib/api/auth.api';
import { useTheme } from '@/hooks/use-theme';

// Les refus dont l'écran porte un texte à lui ; tout autre `details.code`
// affiche le message du serveur (RG-MOB-1 : le serveur décide).
const TRANSLATED_ERROR_CODES = new Set([
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'ACCOUNT_SUSPENDED',
]);

export default function LoginScreen() {
  const theme = useTheme();
  const t = useTranslations('auth');
  const setPreferredLocale = usePreferredLocaleSetter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending;

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
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      setPreferredLocale(user.preferredLocale ?? null);
      router.replace('/');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  };

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.form}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ThemedText type="subtitle">{t('login.title')}</ThemedText>

          <TextInput
            style={inputStyle}
            placeholder={t('login.emailPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder={t('login.passwordPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
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
            style={({ pressed }) => [
              styles.submit,
              (!canSubmit || pressed) && styles.submitDimmed,
            ]}>
            {pending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <ThemedText style={styles.submitLabel}>{t('login.submit')}</ThemedText>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
  },
  form: {
    gap: Spacing.three,
  },
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
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitDimmed: {
    opacity: 0.6,
  },
  submitLabel: {
    color: '#ffffff',
    fontWeight: 700,
  },
});

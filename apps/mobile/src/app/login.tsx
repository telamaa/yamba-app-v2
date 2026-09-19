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

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, MaxContentWidth, Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { login } from '@/lib/api/auth.api';
import { useTheme } from '@/hooks/use-theme';

// TODO (lot i18n D36) : dictionnaires partagés — textes FR en dur d'ici là.
function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'Email ou mot de passe incorrect.';
    if (error.code === 'TOO_MANY_ATTEMPTS') return 'Trop de tentatives. Réessaie dans quelques minutes.';
    if (error.code === 'ACCOUNT_SUSPENDED') return 'Ce compte est suspendu.';
    return error.message;
  }
  return 'Connexion impossible. Vérifie le réseau et réessaie.';
}

export default function LoginScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !pending;

  const onSubmit = async () => {
    if (!canSubmit) return;
    setPending(true);
    setError(null);
    try {
      await login(email.trim(), password);
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
          <ThemedText type="subtitle">Connexion</ThemedText>

          <TextInput
            style={inputStyle}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={inputStyle}
            placeholder="Mot de passe"
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
              <ThemedText style={styles.submitLabel}>Se connecter</ThemedText>
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

/**
 * (auth)/login.tsx — la connexion (porte d'identité A58/A63, lot auth mobile).
 * ============================================================================
 * Premier écran de la feuille d'auth. Les refus parlent par `details.code`
 * (RG-MOB-1) ; « mot de passe oublié » et « créer un compte » poussent leurs
 * étapes DANS la feuille. Un bandeau de succès accueille les retours des
 * autres parcours (compte activé, mot de passe changé) via le préremplissage
 * consommé au focus — la transposition du `/login?verified=1` du web, sans
 * rien mettre dans une URL.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { useTranslations } from 'use-intl';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { consumeLoginPrefill, type LoginNotice } from '@/lib/auth-flow-state';
import { useSession } from '@/lib/session-context';
import { useTheme } from '@/hooks/use-theme';

// Les refus dont l'écran porte un texte à lui ; tout autre `details.code`
// affiche le message du serveur (RG-MOB-1 : le serveur décide).
const TRANSLATED_ERROR_CODES = new Set([
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'ACCOUNT_SUSPENDED',
]);

function closeAuthSheet() {
  // Ouvert depuis une porte d'identité : la porte est devenue le contenu.
  if (router.canDismiss()) router.dismiss();
  else router.replace('/');
}

export default function LoginScreen() {
  const theme = useTheme();
  const t = useTranslations('auth');
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<LoginNotice | null>(null);

  // Un parcours voisin (OTP vérifié, mot de passe changé) ramène ici avec
  // l'e-mail et son bandeau — consommés une seule fois.
  useFocusEffect(
    useCallback(() => {
      const prefill = consumeLoginPrefill();
      if (prefill !== null) {
        setEmail(prefill.email);
        setNotice(prefill.notice);
        setPassword('');
        setError(null);
      }
    }, [])
  );

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
      await signIn(email.trim(), password);
      closeAuthSheet();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen title={t('login.title')} backLabel={t('common.close')}>
      {notice !== null && (
        <ThemedView type="backgroundElement" style={styles.notice}>
          <ThemedText type="small" style={styles.noticeText}>
            {t(`login.notices.${notice}`)}
          </ThemedText>
        </ThemedView>
      )}

      <TextInput
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
        placeholder={t('login.emailPlaceholder')}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <PasswordInput
        placeholder={t('login.passwordPlaceholder')}
        autoComplete="password"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={onSubmit}
      />

      <Pressable
        onPress={() => router.push('/password-forgot')}
        hitSlop={Spacing.one}
        style={styles.forgot}>
        <ThemedText type="linkPrimary">{t('login.forgot')}</ThemedText>
      </Pressable>

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
          <ThemedText style={styles.submitLabel}>{t('login.submit')}</ThemedText>
        )}
      </Pressable>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('login.noAccount')}
        </ThemedText>
        <Pressable onPress={() => router.push('/register')} hitSlop={Spacing.one}>
          <ThemedText type="linkPrimary">{t('login.registerLink')}</ThemedText>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noticeText: {
    color: '#16A34A',
  },
  input: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  forgot: {
    alignSelf: 'flex-end',
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
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
});

/**
 * (auth)/register.tsx — l'inscription (lot auth mobile).
 * ======================================================
 * Le formulaire du web (RegisterForm) en natif : prénom, nom, e-mail, UN
 * champ mot de passe avec œil et jauge des 8 critères (pas de champ de
 * confirmation : l'œil rend la double saisie redondante sur téléphone),
 * CGU par interrupteur. Le serveur reste seul juge (RG-MOB-1) — la
 * pré-validation locale (miroir `password-rules`) évite l'aller-retour,
 * elle ne décide rien. Succès → l'étape code (`/register-verify`), l'état
 * du parcours dans `auth-flow-state` (jamais en URL ni en SecureStore).
 * Versions légales : la source partagée `@packages/legal/versions`.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { useTranslations } from 'use-intl';

import { LEGAL_VERSIONS } from '@packages/legal/versions';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { register } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/client';
import { setPendingRegistration } from '@/lib/auth-flow-state';
import { getPasswordChecks, isPasswordValid } from '@/lib/password-rules';

// Le miroir de la regex serveur (auth.controller) et du web.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const t = useTranslations('auth');
  const theme = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];
  const normalizedEmail = email.trim().toLowerCase();
  const context = { firstName, lastName, email: normalizedEmail };

  const filled =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    normalizedEmail.length > 0 &&
    password.length > 0 &&
    terms;

  const localError = (): string | null => {
    if (!EMAIL_REGEX.test(normalizedEmail)) return t('register.errors.INVALID_EMAIL');
    if (!isPasswordValid(getPasswordChecks(password, context))) {
      return t('register.errors.PASSWORD_INVALID');
    }
    return null;
  };

  const messageOf = (err: unknown): string => {
    if (!(err instanceof ApiError)) return t('common.errors.network');
    switch (err.code) {
      case 'EMAIL_ALREADY_USED':
        return t('register.errors.EMAIL_ALREADY_USED');
      case 'OTP_COOLDOWN':
        return t('otp.errors.OTP_COOLDOWN');
      case 'OTP_TOO_MANY':
        return t('otp.errors.OTP_TOO_MANY');
      case 'OTP_LOCKED':
        return t('otp.errors.OTP_LOCKED');
      default:
        return err.message;
    }
  };

  const onSubmit = async () => {
    if (!filled || pending) return;
    const invalid = localError();
    if (invalid !== null) {
      setError(invalid);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const { verificationToken } = await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        password,
        termsAccepted: true,
        termsVersion: LEGAL_VERSIONS.terms,
        privacyVersion: LEGAL_VERSIONS.privacy,
      });
      setPendingRegistration({ email: normalizedEmail, password, verificationToken });
      router.push('/register-verify');
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthScreen title={t('register.title')}>
      <ThemedText themeColor="textSecondary">{t('register.subtitle')}</ThemedText>

      <View style={styles.nameRow}>
        <TextInput
          style={[...inputStyle, styles.nameField]}
          placeholder={t('register.firstNamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoComplete="given-name"
          autoCapitalize="words"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={[...inputStyle, styles.nameField]}
          placeholder={t('register.lastNamePlaceholder')}
          placeholderTextColor={theme.textSecondary}
          autoComplete="family-name"
          autoCapitalize="words"
          value={lastName}
          onChangeText={setLastName}
        />
      </View>
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
      <PasswordInput
        placeholder={t('register.passwordPlaceholder')}
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
      />
      <PasswordStrengthMeter password={password} context={context} />

      <View style={styles.termsRow}>
        <Switch
          value={terms}
          onValueChange={setTerms}
          trackColor={{ true: Brand.mango }}
          accessibilityLabel={t('register.termsLabel')}
        />
        <ThemedText type="small" themeColor="textSecondary" style={styles.termsText}>
          {t('register.termsLabel')}
        </ThemedText>
      </View>

      {error !== null && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={onSubmit}
        disabled={!filled || pending}
        style={({ pressed }) => [
          styles.submit,
          (!filled || pending || pressed) && styles.submitDimmed,
        ]}>
        {pending ? (
          <ActivityIndicator color="#151718" />
        ) : (
          <ThemedText style={styles.submitLabel}>{t('register.submit')}</ThemedText>
        )}
      </Pressable>

      <View style={styles.footer}>
        <ThemedText type="small" themeColor="textSecondary">
          {t('register.hasAccount')}
        </ThemedText>
        <Pressable onPress={() => router.navigate('/login')} hitSlop={Spacing.one}>
          <ThemedText type="linkPrimary">{t('register.loginLink')}</ThemedText>
        </Pressable>
      </View>
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
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  nameField: {
    flex: 1,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  termsText: {
    flex: 1,
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

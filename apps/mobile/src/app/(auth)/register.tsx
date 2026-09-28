/**
 * (auth)/register.tsx — l'inscription (A208, refonte sur captures).
 * =================================================================
 * La page « Deviens Voyageur » du site, en feuille : badge « Inscription
 * sécurisée », social (mêmes états que le site), « OU PAR E-MAIL »,
 * Prénom/Nom sur une rangée, e-mail, mot de passe AVEC confirmation (le
 * miroir du formulaire web) et jauge des 8 critères, CGU cochées (les
 * intitulés des documents soulignés comme sur le site — le lien viendra
 * avec une URL publique). Le serveur reste seul juge (RG-MOB-1) ; la
 * pré-validation locale évite l'aller-retour. Succès → l'étape code,
 * l'état du parcours dans `auth-flow-state` (jamais en URL).
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { LEGAL_VERSIONS } from '@packages/legal/versions';

import {
  AuthCta,
  AuthCheckbox,
  AuthDivider,
  AuthError,
  AuthTextField,
  FieldLabel,
  SocialSignInBlock,
} from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthBrand, useAuthPalette } from '@/components/auth/auth-theme';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Spacing } from '@/constants/theme';
import { register } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/client';
import { setPendingRegistration } from '@/lib/auth-flow-state';
import { getPasswordChecks, isPasswordValid } from '@/lib/password-rules';

// Le miroir de la regex serveur (auth.controller) et du web.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const context = { firstName, lastName, email: normalizedEmail };

  const filled =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    normalizedEmail.length > 0 &&
    password.length > 0 &&
    confirm.length > 0 &&
    terms;

  const localError = (): string | null => {
    if (!EMAIL_REGEX.test(normalizedEmail)) return t('register.errors.INVALID_EMAIL');
    if (!isPasswordValid(getPasswordChecks(password, context))) {
      return t('register.errors.PASSWORD_INVALID');
    }
    if (confirm !== password) return t('register.errors.PASSWORD_MISMATCH');
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
    <AuthScreen
      badge={t('register.badge')}
      title={t('register.title')}
      subtitle={t('register.subtitle')}>
      <SocialSignInBlock />
      <AuthDivider label={t('common.orByEmail')} />

      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          <FieldLabel>{t('register.firstNameLabel')}</FieldLabel>
          <AuthTextField
            placeholder={t('register.firstNamePlaceholder')}
            autoComplete="given-name"
            autoCapitalize="words"
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View style={styles.nameCol}>
          <FieldLabel>{t('register.lastNameLabel')}</FieldLabel>
          <AuthTextField
            placeholder={t('register.lastNamePlaceholder')}
            autoComplete="family-name"
            autoCapitalize="words"
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
      </View>

      <FieldLabel>{t('login.emailLabel')}</FieldLabel>
      <AuthTextField
        placeholder={t('login.emailPlaceholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <FieldLabel>{t('login.passwordLabel')}</FieldLabel>
      <PasswordInput autoComplete="new-password" value={password} onChangeText={setPassword} />
      <PasswordStrengthMeter password={password} context={context} />

      <FieldLabel>{t('register.confirmLabel')}</FieldLabel>
      <PasswordInput autoComplete="new-password" value={confirm} onChangeText={setConfirm} />

      <AuthCheckbox
        checked={terms}
        onToggleAction={() => setTerms((v) => !v)}
        label={
          <>
            {t('register.termsPrefix')}
            <Text style={[styles.termsDoc, { color: palette.teal }]}>{t('register.termsCgu')}</Text>
            {t('register.termsMiddle')}
            <Text style={[styles.termsDoc, { color: palette.teal }]}>
              {t('register.termsPrivacy')}
            </Text>
            {t('register.termsSuffix')}
          </>
        }
      />

      {error !== null && <AuthError message={error} />}

      <AuthCta
        label={t('register.submit')}
        onPressAction={onSubmit}
        disabled={!filled}
        pending={pending}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.text }]}>{t('register.hasAccount')}</Text>
        <Pressable onPress={() => router.navigate('/login')} hitSlop={Spacing.one}>
          <Text style={styles.footerLink}>{t('register.loginLink')}</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  nameCol: {
    flex: 1,
    gap: Spacing.three,
  },
  termsDoc: {
    fontWeight: 600,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  footerText: {
    fontSize: 15,
    fontWeight: 500,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: 700,
    color: AuthBrand.mango,
  },
});

/**
 * (auth)/register.tsx — l'inscription (A208, refonte sur captures + passe UX).
 * ============================================================================
 * « Deviens Voyageur », réordonné pour le téléphone (passe expert du
 * 28/09) : les champs d'abord, chaînage clavier Prénom → Nom → E-mail →
 * Mot de passe → envoi, le social en logos seuls sous le CTA. PAS de champ
 * « Confirmer le mot de passe » : l'œil + l'autofill (le trousseau remplit
 * les deux champs d'un coup, la confirmation ne confirme rien) le rendent
 * inutile sur mobile — divergence UX ASSUMÉE avec le formulaire web,
 * consignée dans A208. Le serveur reste seul juge (RG-MOB-1). Succès →
 * l'étape code, l'état du parcours dans `auth-flow-state` (jamais en URL).
 */
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { Image } from 'expo-image';
import { useTranslations } from 'use-intl';

import { LEGAL_VERSIONS } from '@packages/legal/versions';

import {
  AuthCta,
  AuthCheckbox,
  AuthDivider,
  AuthError,
  AuthTextField,
  FieldLabel,
  MethodButton,
} from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthBrand, useAuthPalette } from '@/components/auth/auth-theme';
import { PasswordInput } from '@/components/auth/password-input';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';
import { Spacing } from '@/constants/theme';
import { Font } from '@/constants/typography';
import { register } from '@/lib/api/auth.api';
import { ApiError } from '@/lib/api/client';
import { setPendingRegistration } from '@/lib/auth-flow-state';
import { EMAIL_REGEX } from '@/lib/email';
import { getPasswordChecks, isPasswordValid } from '@/lib/password-rules';

export default function RegisterScreen() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const lastNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [terms, setTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedEmail = email.trim().toLowerCase();
  const context = { firstName, lastName, email: normalizedEmail };

  // CTA toujours actif (passe UX) : au tap, le premier manquement est nommé.
  const localError = (): string | null => {
    if (firstName.trim().length === 0 || lastName.trim().length === 0) {
      return t('register.errors.MISSING_NAME');
    }
    if (normalizedEmail.length === 0) return t('common.errors.MISSING_EMAIL');
    if (!EMAIL_REGEX.test(normalizedEmail)) return t('register.errors.INVALID_EMAIL');
    if (password.length === 0) return t('common.errors.MISSING_PASSWORD');
    if (!isPasswordValid(getPasswordChecks(password, context))) {
      return t('register.errors.PASSWORD_INVALID');
    }
    if (!terms) return t('register.errors.TERMS_REQUIRED');
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
    if (pending) return;
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
      title={t('register.title')}
      subtitle={t('register.subtitle')}>
      <View style={styles.nameRow}>
        <View style={styles.nameCol}>
          <FieldLabel>{t('register.firstNameLabel')}</FieldLabel>
          <AuthTextField
            placeholder={t('register.firstNamePlaceholder')}
            autoComplete="given-name"
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => lastNameRef.current?.focus()}
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View style={styles.nameCol}>
          <FieldLabel>{t('register.lastNameLabel')}</FieldLabel>
          <AuthTextField
            ref={lastNameRef}
            placeholder={t('register.lastNamePlaceholder')}
            autoComplete="family-name"
            autoCapitalize="words"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => emailRef.current?.focus()}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
      </View>

      <FieldLabel>{t('login.emailLabel')}</FieldLabel>
      <AuthTextField
        ref={emailRef}
        placeholder={t('register.emailPlaceholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={email}
        onChangeText={setEmail}
      />

      <FieldLabel>{t('login.passwordLabel')}</FieldLabel>
      <PasswordInput
        ref={passwordRef}
        autoComplete="new-password"
        returnKeyType="done"
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={onSubmit}
      />
      <PasswordStrengthMeter password={password} context={context} />

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

      <AuthCta label={t('register.submit')} onPressAction={onSubmit} pending={pending} />

      <AuthDivider label={t('common.orContinueWith')} />
      {/*
        Les deux fournisseurs CÔTE À CÔTE, et non empilés (revue du 10/11).
        Empilés, ils ajoutaient 60 pt et l'écran cessait de tenir sur un
        iPhone : le second bouton et le lien « Déjà membre ? » passaient sous
        la ligne de flottaison. Un écran d'inscription qui demande de faire
        défiler pour voir ses propres options perd des inscriptions.

        Ils restent des BOUTONS, pas des pastilles rondes (D91) : le nom du
        fournisseur est écrit. Le verbe, lui, passe dans le libellé
        ACCESSIBLE — « Continuer avec Google » reste ce que lisent VoiceOver
        et TalkBack, et le séparateur juste au-dessus le dit à l'œil.

        Divergence ASSUMÉE avec le site, qui les garde empilés : sa colonne a
        la place, et le bouton officiel de Google veut sa largeur.
      */}
      <View style={styles.socialRow}>
        <View style={styles.socialCol}>
          <MethodButton
            icon={<Image source={require('@/assets/images/google-g.svg')} style={styles.logo} />}
            label={t('social.googleShort')}
            accessibilityLabel={t('social.google')}
          />
        </View>
        <View style={styles.socialCol}>
          <MethodButton
            icon={<Image source={require('@/assets/images/facebook-f.svg')} style={styles.logo} />}
            label={t('social.facebookShort')}
            accessibilityLabel={t('social.facebook')}
          />
        </View>
      </View>

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
  logo: {
    width: 20,
    height: 20,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  socialCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  nameCol: {
    flex: 1,
    gap: Spacing.three,
  },
  /**
   * Les textes de BAS NIVEAU — les conditions, le renvoi vers la connexion —
   * s'allègent (revue du 10/11). Ils accompagnent, ils ne hèlent pas : un
   * paragraphe de conditions en demi-gras pèse autant que le libellé d'un
   * champ, et l'œil n'a plus de raison de descendre vers le bouton.
   *
   * Ce qui porte l'affordance des liens n'est PAS la graisse : c'est le
   * soulignement ici, et la mangue sur le renvoi. On peut donc alléger sans
   * rien perdre de ce qui se clique.
   */
  termsDoc: {
    fontFamily: Font.medium,
    textDecorationLine: 'underline',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.two,
  },
  // « Déjà un compte ? » est une SORTIE, pas une proposition : qui a déjà un
  // compte la cherche et la trouve, les autres n'ont pas à la lire. 13 px,
  // comme la mention légale — le bas d'écran recule d'un bloc (revue du 10/11).
  footerText: {
    fontSize: 13,
    fontFamily: Font.regular,
  },
  footerLink: {
    fontSize: 13,
    // 400 : la MANGUE suffit à désigner le lien. Lui ajouter de la graisse,
    // c'est le signaler deux fois — et un bas d'écran n'a pas à se signaler.
    fontFamily: Font.regular,
    color: AuthBrand.mango,
  },
});

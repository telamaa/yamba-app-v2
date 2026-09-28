/**
 * (auth)/login.tsx — la connexion (A208, refonte sur captures + passe UX).
 * ========================================================================
 * L'identité de la page « Connecte-toi » du site, RÉORDONNÉE pour le
 * téléphone (passe expert du 28/09) : l'e-mail d'abord — le chemin
 * principal reste au-dessus du pli clavier levé —, le social en LOGOS
 * SEULS sous le CTA (« ou continue avec »), chaînage clavier
 * e-mail → mot de passe → envoi. « Rester connecté » = le VRAI
 * `rememberMe` serveur (7 j / 60 min, décoché par défaut — A62). Les
 * refus parlent par `details.code` (RG-MOB-1) ; le bandeau de succès
 * accueille les retours des autres parcours.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInput } from 'react-native';

import { useTranslations } from 'use-intl';

import {
  AuthCta,
  AuthCheckbox,
  AuthDivider,
  AuthError,
  AuthTextField,
  FieldLabel,
  SocialLogosRow,
} from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthBrand, AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';
import { PasswordInput } from '@/components/auth/password-input';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { consumeLoginPrefill, type LoginNotice } from '@/lib/auth-flow-state';
import { useSession } from '@/lib/session-context';

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
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const { signIn } = useSession();
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
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
      await signIn(email.trim(), password, remember);
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
      title={t('login.title')}
      subtitle={t('login.subtitle')}
      dismissGlyph="close">
      {notice !== null && (
        <View style={[styles.notice, { borderColor: palette.teal }]}>
          <Text style={[styles.noticeText, { color: palette.teal }]}>
            {t(`login.notices.${notice}`)}
          </Text>
        </View>
      )}

      <FieldLabel>{t('login.emailLabel')}</FieldLabel>
      <AuthTextField
        placeholder={t('login.emailPlaceholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={email}
        onChangeText={setEmail}
      />

      <FieldLabel
        right={
          <Pressable onPress={() => router.push('/password-forgot')} hitSlop={Spacing.one}>
            <Text style={[styles.forgotLink, { color: palette.teal }]}>{t('login.forgot')}</Text>
          </Pressable>
        }>
        {t('login.passwordLabel')}
      </FieldLabel>
      <PasswordInput
        ref={passwordRef}
        placeholder={t('login.passwordPlaceholder')}
        autoComplete="password"
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

      <AuthCta
        label={t('login.submit')}
        onPressAction={onSubmit}
        disabled={!canSubmit}
        pending={pending}
      />

      <AuthDivider label={t('common.orContinueWith')} />
      <SocialLogosRow />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.text }]}>{t('login.noAccount')}</Text>
        <Pressable onPress={() => router.push('/register')} hitSlop={Spacing.one}>
          <Text style={styles.footerLink}>{t('login.registerLink')}</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  noticeText: {
    fontSize: 14,
    fontWeight: 600,
  },
  forgotLink: {
    fontSize: 15,
    fontWeight: 700,
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

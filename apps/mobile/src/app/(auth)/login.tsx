/**
 * (auth)/login.tsx — la connexion, IDENTIFIER-FIRST (itération Revolut, A208).
 * ============================================================================
 * L'adresse d'abord, la méthode ensuite (réf. captures/auth/3) : UN champ
 * e-mail, « Continuer » grisé tant que l'adresse n'est pas valide (doctrine :
 * le désactivé n'est permis que quand UN SEUL champ visible l'explique —
 * validation live), puis une CONFIRMATION de l'adresse (avec l'anti-
 * énumération, une faute de frappe = un code qui ne viendrait jamais, en
 * silence) — et « ou » : e-mail + mot de passe, Google, Facebook.
 *
 * TANT QUE le lot serveur « code par e-mail » n'existe pas (décision du
 * 28/09 : UI d'abord, serveur ensuite), « Continuer » confirmé mène à
 * l'étape MOT DE PASSE, adresse verrouillée — zéro écran fantôme (A203) ;
 * le jour du lot, cette navigation bascule vers le parcours code.
 */
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useTranslations } from 'use-intl';

import {
  AuthCta,
  AuthDivider,
  AuthTextField,
  MethodButton,
} from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { AuthBrand, AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';
import { Spacing } from '@/constants/theme';
import {
  consumeLoginPrefill,
  setLoginEmail,
  type LoginNotice,
} from '@/lib/auth-flow-state';
import { isValidEmail } from '@/lib/email';

export default function LoginScreen() {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const [email, setEmail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<LoginNotice | null>(null);

  // Un parcours voisin (OTP vérifié, mot de passe changé) ramène ici avec
  // l'e-mail et son bandeau — consommés une seule fois.
  useFocusEffect(
    useCallback(() => {
      const prefill = consumeLoginPrefill();
      if (prefill !== null) {
        setEmail(prefill.email);
        setNotice(prefill.notice);
      }
    }, [])
  );

  const normalized = email.trim().toLowerCase();
  const emailValid = isValidEmail(normalized);

  const proceedWithEmail = () => {
    setConfirming(false);
    setLoginEmail(normalized);
    // Étape MOT DE PASSE tant que le parcours « code par e-mail » n'a pas
    // son serveur — le point de bascule du futur lot est ICI.
    router.push('/login-password');
  };

  const openPasswordMethod = () => {
    setLoginEmail(emailValid ? normalized : null);
    router.push('/login-password');
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

      <AuthTextField
        placeholder={t('login.emailPlaceholder')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        autoFocus
        returnKeyType="done"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={() => emailValid && setConfirming(true)}
      />

      <AuthCta
        label={t('login.continue')}
        onPressAction={() => setConfirming(true)}
        disabled={!emailValid}
      />

      <AuthDivider label={t('common.or')} />

      <MethodButton
        icon={
          <SymbolView
            name="key.fill"
            size={18}
            tintColor={palette.title}
            fallback={<Text style={{ fontSize: 15 }}>🔑</Text>}
          />
        }
        label={t('login.methodPassword')}
        onPressAction={openPasswordMethod}
      />
      {/* Inertes tant que les flux natifs n'existent pas (Google : lot A201). */}
      <MethodButton
        icon={<Image source={require('@/assets/images/google-g.svg')} style={styles.logo} />}
        label={t('social.google')}
      />
      <MethodButton
        icon={<Image source={require('@/assets/images/facebook-f.svg')} style={styles.logo} />}
        label={t('social.facebook')}
      />

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: palette.text }]}>{t('login.noAccount')}</Text>
        <Pressable onPress={() => router.push('/register')} hitSlop={Spacing.one}>
          <Text style={styles.footerLink}>{t('login.registerLink')}</Text>
        </Pressable>
      </View>

      {/* La confirmation d'adresse (réf. capture 16.16.43) : une carte au
          centre, l'adresse en gras, Confirmer / Retour. */}
      <Modal
        visible={confirming}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirming(false)}>
        <Pressable style={styles.backdrop} onPress={() => setConfirming(false)}>
          <Pressable style={[styles.confirmCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.confirmEmail, { color: palette.title }]}>{normalized}</Text>
            <Text style={[styles.confirmBody, { color: palette.muted }]}>
              {t('login.confirmBody')}
            </Text>
            <AuthCta label={t('login.confirmYes')} onPressAction={proceedWithEmail} />
            <Pressable
              onPress={() => setConfirming(false)}
              hitSlop={Spacing.one}
              style={styles.confirmBack}>
              <Text style={[styles.confirmBackLabel, { color: palette.text }]}>
                {t('login.confirmBack')}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  logo: {
    width: 20,
    height: 20,
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
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  confirmCard: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  confirmEmail: {
    fontSize: 18,
    fontWeight: 700,
    textAlign: 'center',
  },
  confirmBody: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
  },
  confirmBack: {
    alignSelf: 'center',
    paddingVertical: Spacing.one,
  },
  confirmBackLabel: {
    fontSize: 15,
    fontWeight: 600,
  },
});

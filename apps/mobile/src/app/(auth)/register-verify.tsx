/**
 * (auth)/register-verify.tsx — le code d'inscription (lot auth mobile).
 * =====================================================================
 * L'étape OTP du parcours d'inscription (RegisterVerifyForm du web). Le
 * serveur n'ouvre PAS de session à la vérification : le web renvoyait vers
 * `/login?verified=1` — ici, le mot de passe encore en mémoire du parcours
 * permet de CHAÎNER la connexion (un compte activé est un membre connecté,
 * le détour n'apprend rien) ; si le processus a redémarré entre-temps, on
 * retombe sur la connexion préremplie avec son bandeau « compte activé ».
 * Étape morte côté serveur (pending 30 min / jeton 15 min expirés) : un
 * état dédié propose de recommencer — jamais un code d'erreur brut.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTranslations } from 'use-intl';

import { AuthScreen } from '@/components/auth/auth-screen';
import { OtpVerifyView } from '@/components/auth/otp-verify-view';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import {
  cancelRegistration,
  resendRegistrationOtp,
  verifyRegistrationOtp,
} from '@/lib/api/auth.api';
import {
  getPendingRegistration,
  setLoginPrefill,
  setPendingRegistration,
} from '@/lib/auth-flow-state';
import { useSession } from '@/lib/session-context';

const FATAL_CODES = new Set(['REGISTRATION_EXPIRED', 'VERIFICATION_EXPIRED']);

function closeAuthSheet() {
  if (router.canDismiss()) router.dismiss();
  else router.replace('/');
}

export default function RegisterVerifyScreen() {
  const t = useTranslations('auth');
  const { signIn } = useSession();
  const [expired, setExpired] = useState(false);
  const pendingRegistration = getPendingRegistration();

  // Arrivée sans parcours en cours (processus relancé) : retour au départ.
  if (pendingRegistration === null) {
    return (
      <AuthScreen title={t('otp.registerTitle')}>
        <ThemedText themeColor="textSecondary">{t('otp.flowLost')}</ThemedText>
        <Pressable onPress={() => router.navigate('/register')} style={styles.cta}>
          <ThemedText style={styles.ctaLabel}>{t('otp.restartRegister')}</ThemedText>
        </Pressable>
      </AuthScreen>
    );
  }

  if (expired) {
    return (
      <AuthScreen title={t('otp.registerTitle')}>
        <ThemedText themeColor="textSecondary">{t('otp.registrationExpired')}</ThemedText>
        <Pressable
          onPress={() => {
            setPendingRegistration(null);
            router.navigate('/register');
          }}
          style={styles.cta}>
          <ThemedText style={styles.ctaLabel}>{t('otp.restartRegister')}</ThemedText>
        </Pressable>
      </AuthScreen>
    );
  }

  const onVerify = async (otp: string) => {
    await verifyRegistrationOtp(pendingRegistration.verificationToken, otp);
    const { email, password } = pendingRegistration;
    setPendingRegistration(null);
    if (password !== null) {
      // Le login chaîné : un échec ici (réseau…) retombe sur l'écran de
      // connexion prérempli — jamais un compte activé bloqué sur un écran.
      try {
        await signIn(email, password);
        closeAuthSheet();
        return;
      } catch {
        // continue vers la connexion préremplie
      }
    }
    setLoginPrefill({ email, notice: 'accountVerified' });
    router.navigate('/login');
  };

  const onResend = async () => {
    const { verificationToken } = await resendRegistrationOtp(
      pendingRegistration.verificationToken
    );
    setPendingRegistration({ ...pendingRegistration, verificationToken });
  };

  const onCancel = () => {
    // Meilleur effort : le pending Redis expirera de lui-même.
    void cancelRegistration(pendingRegistration.verificationToken).catch(() => undefined);
    setPendingRegistration(null);
    router.back();
  };

  return (
    <AuthScreen title={t('otp.registerTitle')}>
      <OtpVerifyView
        subtitle={t('otp.sentTo', { email: pendingRegistration.email })}
        onVerifyAction={onVerify}
        onResendAction={onResend}
        onFatalCodeAction={(code) => {
          if (!FATAL_CODES.has(code)) return false;
          setExpired(true);
          return true;
        }}
        secondaryLabel={t('otp.cancelRegister')}
        onSecondaryAction={onCancel}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  cta: {
    backgroundColor: Brand.mango,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  ctaLabel: {
    color: '#151718',
    fontSize: 15,
    fontWeight: 600,
  },
});

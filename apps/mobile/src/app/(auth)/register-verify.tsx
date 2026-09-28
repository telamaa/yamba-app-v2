/**
 * (auth)/register-verify.tsx — le code d'inscription (A208, refonte sur
 * captures).
 * =====================================================================
 * L'écran « Vérification du code » du site pour le parcours d'inscription.
 * Le serveur n'ouvre PAS de session à la vérification : le mot de passe
 * encore en mémoire du parcours permet de CHAÎNER la connexion ; tout
 * échec du chaînage retombe sur la connexion préremplie « compte activé ».
 * Étape morte côté serveur (pending 30 min / jeton 15 min expirés) : un
 * état dédié propose de recommencer — jamais un code d'erreur brut.
 */
import { router } from 'expo-router';
import { useState } from 'react';

import { useTranslations } from 'use-intl';

import { AuthCta } from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { OtpVerifyView } from '@/components/auth/otp-verify-view';
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

  // Arrivée sans parcours en cours (processus relancé) ou étape expirée :
  // l'écran le dit et propose de reprendre.
  if (pendingRegistration === null || expired) {
    return (
      <AuthScreen
        badge={t('otp.badge')}
        title={t('otp.title')}
        subtitle={expired ? t('otp.registrationExpired') : t('otp.flowLost')}>
        <AuthCta
          label={t('otp.restartRegister')}
          onPressAction={() => {
            setPendingRegistration(null);
            router.navigate('/register');
          }}
        />
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

  const onRestart = () => {
    // Meilleur effort : le pending Redis expirera de lui-même.
    void cancelRegistration(pendingRegistration.verificationToken).catch(() => undefined);
    setPendingRegistration(null);
    router.back();
  };

  return (
    <AuthScreen badge={t('otp.badge')} title={t('otp.title')} subtitle={t('otp.sentTo')}>
      <OtpVerifyView
        email={pendingRegistration.email}
        onVerifyAction={onVerify}
        onResendAction={onResend}
        onFatalCodeAction={(code) => {
          if (!FATAL_CODES.has(code)) return false;
          setExpired(true);
          return true;
        }}
        restartQuestion={t('otp.wrongEmail')}
        restartLabel={t('otp.restart')}
        onRestartAction={onRestart}
      />
    </AuthScreen>
  );
}

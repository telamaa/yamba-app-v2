/**
 * (auth)/password-verify.tsx — le code du reset (A208, refonte sur captures).
 * ===========================================================================
 * Le MÊME écran « Vérification du code » que l'inscription (composant
 * partagé), pour le parcours oublié. Le renvoi passe par
 * `/auth/password/resend` — qui répond TOUJOURS 200 (silence
 * anti-énumération) : le cooldown de 60 s est purement client. Le code
 * vérifié donne un `passwordResetToken` (15 min) qui part dans le store,
 * et l'étape « nouveau mot de passe » s'ouvre.
 */
import { router } from 'expo-router';

import { useTranslations } from 'use-intl';

import { AuthCta } from '@/components/auth/auth-kit';
import { AuthScreen } from '@/components/auth/auth-screen';
import { OtpVerifyView } from '@/components/auth/otp-verify-view';
import { resendPasswordOtp, verifyPasswordOtp } from '@/lib/api/auth.api';
import { getPendingReset, setPendingReset } from '@/lib/auth-flow-state';

export default function PasswordVerifyScreen() {
  const t = useTranslations('auth');
  const pendingReset = getPendingReset();

  if (pendingReset === null) {
    return (
      <AuthScreen badge={t('otp.badge')} title={t('otp.title')} subtitle={t('otp.flowLost')}>
        <AuthCta
          label={t('otp.restartForgot')}
          onPressAction={() => router.navigate('/password-forgot')}
        />
      </AuthScreen>
    );
  }

  const onVerify = async (otp: string) => {
    const { passwordResetToken } = await verifyPasswordOtp(pendingReset.email, otp);
    setPendingReset({ ...pendingReset, passwordResetToken });
    router.push('/password-reset');
  };

  return (
    <AuthScreen badge={t('otp.badge')} title={t('otp.title')} subtitle={t('otp.sentToIfExists')}>
      <OtpVerifyView
        email={pendingReset.email}
        onVerifyAction={onVerify}
        onResendAction={() => resendPasswordOtp(pendingReset.email)}
        restartQuestion={t('otp.wrongEmail')}
        restartLabel={t('otp.restart')}
        onRestartAction={() => {
          setPendingReset(null);
          router.back();
        }}
      />
    </AuthScreen>
  );
}

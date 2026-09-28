/**
 * (auth)/password-verify.tsx — le code du reset (lot auth mobile).
 * ================================================================
 * L'étape OTP du mot de passe oublié (ResetVerifyForm du web). Le renvoi
 * passe par `/auth/password/resend` — qui répond TOUJOURS 200 (le silence
 * anti-énumération) : le cooldown de 60 s est purement client. Le code
 * vérifié donne un `passwordResetToken` (15 min) qui part dans le store du
 * parcours, et l'étape « nouveau mot de passe » s'ouvre.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { useTranslations } from 'use-intl';

import { AuthScreen } from '@/components/auth/auth-screen';
import { OtpVerifyView } from '@/components/auth/otp-verify-view';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { resendPasswordOtp, verifyPasswordOtp } from '@/lib/api/auth.api';
import { getPendingReset, setPendingReset } from '@/lib/auth-flow-state';

export default function PasswordVerifyScreen() {
  const t = useTranslations('auth');
  const pendingReset = getPendingReset();

  if (pendingReset === null) {
    return (
      <AuthScreen title={t('otp.resetTitle')}>
        <ThemedText themeColor="textSecondary">{t('otp.flowLost')}</ThemedText>
        <Pressable onPress={() => router.navigate('/password-forgot')} style={styles.cta}>
          <ThemedText style={styles.ctaLabel}>{t('otp.restartForgot')}</ThemedText>
        </Pressable>
      </AuthScreen>
    );
  }

  const onVerify = async (otp: string) => {
    const { passwordResetToken } = await verifyPasswordOtp(pendingReset.email, otp);
    setPendingReset({ ...pendingReset, passwordResetToken });
    router.push('/password-reset');
  };

  return (
    <AuthScreen title={t('otp.resetTitle')}>
      <OtpVerifyView
        subtitle={t('otp.sentToIfExists', { email: pendingReset.email })}
        onVerifyAction={onVerify}
        onResendAction={() => resendPasswordOtp(pendingReset.email)}
        secondaryLabel={t('otp.changeEmail')}
        onSecondaryAction={() => {
          setPendingReset(null);
          router.back();
        }}
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

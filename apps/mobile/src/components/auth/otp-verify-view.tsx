/**
 * otp-verify-view.tsx — l'étape « saisis ton code » partagée (A208, refonte
 * sur captures).
 * =========================================================================
 * La composition de l'écran « Vérification du code » du site : l'adresse
 * MASQUÉE dans une carte (police mono), la puce « Code valable mm:ss »,
 * les six cases, l'astuce collage, le CTA « Valider mon code », puis le
 * bloc renvoi (« Pas reçu le code ? Vérifie tes spams ou… ») et le lien
 * « Recommencer ». La mécanique est inchangée : TROIS compteurs
 * (expiration 10 min = TTL serveur, renvoi 60 s purement client —
 * anti-énumération —, verrou serveur `details.lockUntilSeconds`),
 * vérification d'office à la sixième frappe, refus par `details.code`
 * (RG-MOB-1), codes fatals remontés à l'écran appelant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { SymbolView } from 'expo-symbols';
import { useTranslations } from 'use-intl';

import { AuthCta, AuthError, TealLink } from '@/components/auth/auth-kit';
import { OtpInput, OTP_LENGTH } from '@/components/auth/otp-input';
import {
  AuthRadius,
  maskEmail,
  useAuthPalette,
} from '@/components/auth/auth-theme';
import { Spacing } from '@/constants/theme';
import { formatMMSS, useCountdown } from '@/hooks/use-countdown';
import { ApiError } from '@/lib/api/client';

/** Les TTL du serveur (otp-policy.ts) — affichés, jamais décidés ici. */
const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  /** L'adresse du parcours — affichée MASQUÉE, comme sur le site. */
  email: string;
  onVerifyAction: (otp: string) => Promise<void>;
  /** Renvoie un code ; l'appelant fait son appel API et jette en cas d'échec. */
  onResendAction: () => Promise<void>;
  /** Un `details.code` que l'appelant prend en charge (étape expirée…) :
   *  retourner true court-circuite l'affichage générique. */
  onFatalCodeAction?: (code: string) => boolean;
  /** « Trompé d'adresse e-mail ? » / « Recommencer » du bas d'écran. */
  restartQuestion: string;
  restartLabel: string;
  onRestartAction: () => void;
};

export function OtpVerifyView({
  email,
  onVerifyAction,
  onResendAction,
  onFatalCodeAction,
  restartQuestion,
  restartLabel,
  onRestartAction,
}: Props) {
  const t = useTranslations('auth');
  const palette = useAuthPalette();
  const [otp, setOtp] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiry, restartExpiry] = useCountdown(OTP_EXPIRY_SECONDS);
  const [resendWait, restartResendWait] = useCountdown(RESEND_COOLDOWN_SECONDS);
  const [lock, restartLock] = useCountdown(0);
  // La vérification ne part qu'UNE fois par saisie complète (l'effet retente
  // sinon à chaque tic des compteurs).
  const verifiedValue = useRef('');

  const expired = expiry <= 0;
  const locked = lock > 0;
  const canVerify = otp.length === OTP_LENGTH && !pending && !locked && !expired;

  const messageOf = useCallback(
    (err: unknown): string => {
      if (!(err instanceof ApiError)) return t('common.errors.network');
      const code = err.code;
      if (code !== null && onFatalCodeAction?.(code)) return '';
      const lockSeconds =
        typeof err.details?.lockUntilSeconds === 'number' ? err.details.lockUntilSeconds : null;
      switch (code) {
        case 'OTP_INCORRECT': {
          const attemptsLeft =
            typeof err.details?.attemptsLeft === 'number' ? err.details.attemptsLeft : null;
          return attemptsLeft !== null && attemptsLeft <= 2
            ? t('otp.errors.incorrectCounted', { attemptsLeft })
            : t('otp.errors.OTP_INCORRECT');
        }
        case 'OTP_INVALIDATED':
        case 'OTP_LOCKED':
          if (lockSeconds !== null) restartLock(lockSeconds);
          if (code === 'OTP_INVALIDATED') setOtp('');
          return t(`otp.errors.${code}`);
        case 'OTP_EXPIRED':
          restartExpiry(0);
          return t('otp.errors.OTP_EXPIRED');
        case 'OTP_COOLDOWN':
          return t('otp.errors.OTP_COOLDOWN');
        case 'OTP_TOO_MANY':
          return t('otp.errors.OTP_TOO_MANY');
        default:
          // Tout autre refus : le message du serveur (RG-MOB-1).
          return err.message;
      }
    },
    [t, onFatalCodeAction, restartLock, restartExpiry]
  );

  const verify = useCallback(
    async (digits: string) => {
      setPending(true);
      setError(null);
      try {
        await onVerifyAction(digits);
      } catch (err) {
        const message = messageOf(err);
        if (message.length > 0) setError(message);
        verifiedValue.current = '';
        setPending(false);
        return;
      }
      // Succès : l'appelant navigue — on reste en `pending` pour figer l'écran.
    },
    [onVerifyAction, messageOf]
  );

  // Sixième chiffre → vérification d'office (le geste attendu sur mobile).
  useEffect(() => {
    if (otp.length === OTP_LENGTH && verifiedValue.current !== otp && canVerify) {
      verifiedValue.current = otp;
      void verify(otp);
    }
  }, [otp, canVerify, verify]);

  const resend = async () => {
    setError(null);
    try {
      await onResendAction();
      setOtp('');
      verifiedValue.current = '';
      restartExpiry(OTP_EXPIRY_SECONDS);
      restartResendWait(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      const message = messageOf(err);
      if (message.length > 0) setError(message);
    }
  };

  const canResend = resendWait <= 0 && !locked && !pending;
  const mono = Platform.select({ ios: 'ui-monospace', default: 'monospace' });

  return (
    <View style={styles.container}>
      <View
        style={[styles.emailCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[styles.emailMasked, { color: palette.title, fontFamily: mono }]}>
          {maskEmail(email)}
        </Text>
      </View>

      <View style={[styles.validityChip, { borderColor: palette.border }]}>
        <SymbolView
          name="clock"
          size={14}
          tintColor={palette.muted}
          fallback={<Text style={{ color: palette.muted, fontSize: 12 }}>◷</Text>}
        />
        <Text style={[styles.validityLabel, { color: palette.text }]}>
          {expired ? (
            t('otp.expired')
          ) : (
            <>
              {t('otp.validFor')}{' '}
              <Text style={[styles.validityTime, { fontFamily: mono }]}>{formatMMSS(expiry)}</Text>
            </>
          )}
        </Text>
      </View>

      <Text style={[styles.enterCode, { color: palette.title }]}>{t('otp.enterCode')}</Text>

      <OtpInput value={otp} onChangeAction={setOtp} disabled={pending || locked} />

      <Text style={[styles.pasteHint, { color: palette.muted }]}>{t('otp.pasteHint')}</Text>

      {locked && <AuthError message={t('otp.lockedFor', { time: formatMMSS(lock) })} />}
      {error !== null && <AuthError message={error} />}

      <AuthCta
        label={t('otp.verify')}
        onPressAction={() => verify(otp)}
        disabled={!canVerify}
        pending={pending}
      />

      <View style={[styles.footerDivider, { backgroundColor: palette.border }]} />

      <View style={styles.resendBlock}>
        <Text style={[styles.resendQuestion, { color: palette.text }]}>
          {t('otp.notReceived')}
        </Text>
        {canResend ? (
          <TealLink label={t('otp.resend')} onPressAction={resend} center />
        ) : (
          <Text style={[styles.resendWait, { color: palette.muted }]}>
            {t('otp.resendIn', { time: formatMMSS(resendWait) })}
          </Text>
        )}
      </View>

      <View style={styles.restartRow}>
        <Text style={[styles.resendQuestion, { color: palette.text }]}>{restartQuestion}</Text>
        <TealLink label={restartLabel} onPressAction={onRestartAction} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  emailCard: {
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  emailMasked: {
    fontSize: 16,
    fontWeight: 600,
  },
  validityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: 7,
  },
  validityLabel: {
    fontSize: 14,
    fontWeight: 500,
  },
  validityTime: {
    fontWeight: 700,
  },
  enterCode: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  pasteHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  footerDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: Spacing.two,
  },
  resendBlock: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  resendQuestion: {
    fontSize: 15,
    textAlign: 'center',
  },
  resendWait: {
    fontSize: 15,
    fontWeight: 600,
  },
  restartRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: Spacing.one,
    flexWrap: 'wrap',
  },
});

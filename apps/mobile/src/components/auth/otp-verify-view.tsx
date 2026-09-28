/**
 * otp-verify-view.tsx — l'étape « saisis ton code » partagée (lot auth mobile).
 * =============================================================================
 * Les deux parcours OTP (inscription, mot de passe oublié) partagent la même
 * mécanique que leurs formulaires web (RegisterVerifyForm / ResetVerifyForm) :
 * TROIS compteurs simultanés — expiration du code (10 min, le TTL serveur),
 * cooldown de renvoi (60 s, purement client : le serveur ne révèle rien),
 * verrou serveur (`details.lockUntilSeconds` sur refus). Le code se vérifie
 * de LUI-MÊME à la sixième frappe (le bouton reste pour recommencer après un
 * refus). Les refus parlent par `details.code` (RG-MOB-1) ; les codes fatals
 * du parcours (session d'étape expirée…) remontent à l'écran appelant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTranslations } from 'use-intl';

import { OtpInput, OTP_LENGTH } from '@/components/auth/otp-input';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { formatMMSS, useCountdown } from '@/hooks/use-countdown';
import { ApiError } from '@/lib/api/client';

/** Les TTL du serveur (otp-policy.ts) — affichés, jamais décidés ici. */
const OTP_EXPIRY_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 60;

type Props = {
  /** « Un code à 6 chiffres a été envoyé à … » — construit par l'appelant. */
  subtitle: string;
  onVerifyAction: (otp: string) => Promise<void>;
  /** Renvoie un code ; l'appelant fait son appel API et jette en cas d'échec. */
  onResendAction: () => Promise<void>;
  /** Un `details.code` que l'appelant prend en charge (étape expirée…) :
   *  retourner true court-circuite l'affichage générique. */
  onFatalCodeAction?: (code: string) => boolean;
  /** Ligne d'action secondaire sous le renvoi (annuler, changer d'adresse). */
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
};

export function OtpVerifyView({
  subtitle,
  onVerifyAction,
  onResendAction,
  onFatalCodeAction,
  secondaryLabel,
  onSecondaryAction,
}: Props) {
  const t = useTranslations('auth');
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

  return (
    <View style={styles.container}>
      <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>

      <OtpInput value={otp} onChangeAction={setOtp} disabled={pending || locked} />

      {locked ? (
        <ThemedText type="small" style={styles.error}>
          {t('otp.lockedFor', { time: formatMMSS(lock) })}
        </ThemedText>
      ) : expired ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {t('otp.expired')}
        </ThemedText>
      ) : (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {t('otp.expiresIn', { time: formatMMSS(expiry) })}
        </ThemedText>
      )}

      {error !== null && (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      )}

      <Pressable
        onPress={() => verify(otp)}
        disabled={!canVerify}
        style={({ pressed }) => [styles.submit, (!canVerify || pressed) && styles.submitDimmed]}>
        {pending ? (
          <ActivityIndicator color="#151718" />
        ) : (
          <ThemedText style={styles.submitLabel}>{t('otp.verify')}</ThemedText>
        )}
      </Pressable>

      <Pressable
        onPress={resend}
        disabled={resendWait > 0 || locked || pending}
        hitSlop={Spacing.one}
        style={styles.inlineAction}>
        <ThemedText
          type="linkPrimary"
          themeColor={resendWait > 0 || locked ? 'textSecondary' : undefined}>
          {resendWait > 0
            ? t('otp.resendIn', { time: formatMMSS(resendWait) })
            : t('otp.resend')}
        </ThemedText>
      </Pressable>

      {secondaryLabel !== undefined && onSecondaryAction !== undefined && (
        <Pressable onPress={onSecondaryAction} hitSlop={Spacing.one} style={styles.inlineAction}>
          <ThemedText type="link" themeColor="textSecondary">
            {secondaryLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  centered: {
    textAlign: 'center',
  },
  error: {
    color: '#DC2626',
    textAlign: 'center',
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
  inlineAction: {
    alignSelf: 'center',
  },
});

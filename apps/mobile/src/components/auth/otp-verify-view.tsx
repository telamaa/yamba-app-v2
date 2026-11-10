/**
 * otp-verify-view.tsx — l'étape « saisis ton code » partagée (A208, refondue
 * par D92).
 * =========================================================================
 * L'écran est une SALLE D'ATTENTE, pas un formulaire : c'est le seul du
 * produit où l'utilisateur sort de l'application pour aller chercher un code
 * dans sa boîte mail, et doit vouloir revenir. Sa composition suit de là.
 *
 *   • L'adresse est EN CLAIR, avec « Modifier » à côté (D92 2A). On masque
 *     une adresse que l'utilisateur n'a pas tapée — défi de connexion,
 *     récupération de compte, où celui qui regarde l'écran n'est peut-être
 *     pas le titulaire. Ici elle a été saisie trente secondes plus tôt sur
 *     le même appareil : le masque ne protège de rien et DÉTRUIT la seule
 *     fonction utile de la ligne, attraper la faute de frappe —
 *     `c*********a@g***.com` rend `gmial.com` et `gmail.com` identiques.
 *   • UN SEUL compte à rebours est visible à la fois (D92 6A, règles pures
 *     dans `lib/otp-display.ts`), et l'aide arrive quand elle sert.
 *   • « Ouvrir ma boîte mail » quand le domaine est connu (`lib/webmail.ts`).
 *
 * La mécanique est inchangée : TROIS compteurs (expiration 10 min = TTL
 * serveur, renvoi 60 s purement client — anti-énumération —, verrou serveur
 * `details.lockUntilSeconds`), vérification d'office à la sixième frappe,
 * refus par `details.code` (RG-MOB-1), codes fatals remontés à l'écran
 * appelant.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useTranslations } from 'use-intl';

import { AuthCta, AuthError, MethodButton, TealLink } from '@/components/auth/auth-kit';
import { OtpInput, OTP_LENGTH } from '@/components/auth/otp-input';
import { AuthRadius, useAuthPalette } from '@/components/auth/auth-theme';
import { Spacing } from '@/constants/theme';
import { formatMMSS, useCountdown } from '@/hooks/use-countdown';
import { ApiError } from '@/lib/api/client';
import {
  OTP_EXPIRY_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  resendPhase,
  showValidity,
} from '@/lib/otp-display';
import { webmailUrl } from '@/lib/webmail';

type Props = {
  /** L'adresse du parcours — affichée EN CLAIR (D92 2A). */
  email: string;
  onVerifyAction: (otp: string) => Promise<void>;
  /** Renvoie un code ; l'appelant fait son appel API et jette en cas d'échec. */
  onResendAction: () => Promise<void>;
  /** Un `details.code` que l'appelant prend en charge (étape expirée…) :
   *  retourner true court-circuite l'affichage générique. */
  onFatalCodeAction?: (code: string) => boolean;
  /**
   * Le geste « Modifier », rendu À CÔTÉ de l'adresse et non en pied d'écran
   * (D92 2A) : la ligne qui porte l'adresse est la seule qui ait à répondre
   * de sa justesse.
   */
  restartLabel: string;
  onRestartAction: () => void;
};

export function OtpVerifyView({
  email,
  onVerifyAction,
  onResendAction,
  onFatalCodeAction,
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

  // CTA toujours actif hors verrou/envoi (passe UX) : au tap, le manquement
  // est nommé — code incomplet ou expiré.
  const onVerifyPressed = () => {
    if (expired) {
      setError(t('otp.errors.OTP_EXPIRED'));
      return;
    }
    if (otp.length < OTP_LENGTH) {
      setError(t('otp.errors.INCOMPLETE'));
      return;
    }
    void verify(otp);
  };

  const canResend = resendWait <= 0 && !locked && !pending;
  const mono = Platform.select({ ios: 'ui-monospace', default: 'monospace' });
  const mailbox = webmailUrl(email);
  // Trois états, jamais deux à la fois (D92 6A) : le verrou et l'envoi en
  // cours comptent comme « pas encore », sans quoi le lien s'offrirait au
  // moment précis où il refuserait de servir.
  const phase = canResend ? 'ready' : resendPhase(resendWait);

  return (
    <View style={styles.container}>
      {/* L'adresse EN CLAIR, et le geste qui répond d'elle (D92 2A).
          `ellipsizeMode="middle"` : si la ligne doit céder, elle cède au
          MILIEU — le début et le domaine sont justement ce que l'on relit
          pour attraper la faute de frappe. */}
      <View
        style={[styles.emailCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text
          style={[styles.emailAddress, { color: palette.title, fontFamily: mono }]}
          numberOfLines={1}
          ellipsizeMode="middle">
          {email}
        </Text>
        <TealLink label={restartLabel} onPressAction={onRestartAction} />
      </View>

      {mailbox !== null && (
        <MethodButton
          icon={<Ionicons name="mail-outline" size={18} color={palette.title} />}
          label={t('otp.openMailbox')}
          onPressAction={() => {
            // Meilleur effort : un navigateur absent ne doit pas faire
            // tomber l'écran qui porte le code.
            void Linking.openURL(mailbox).catch(() => undefined);
          }}
        />
      )}

      {/* La validité ne se montre qu'à sa dernière minute (D92 6A). */}
      {showValidity(expiry) && (
        <View style={[styles.validityChip, { borderColor: palette.border }]}>
          <Ionicons name="time-outline" size={14} color={palette.muted} />
          <Text style={[styles.validityLabel, { color: palette.text }]}>
            {expired ? (
              t('otp.expired')
            ) : (
              <>
                {t('otp.validFor')}{' '}
                <Text style={[styles.validityTime, { fontFamily: mono }]}>
                  {formatMMSS(expiry)}
                </Text>
              </>
            )}
          </Text>
        </View>
      )}

      <Text style={[styles.enterCode, { color: palette.muted }]}>{t('otp.enterCode')}</Text>

      <OtpInput value={otp} onChangeAction={setOtp} disabled={pending || locked} />

      <Text style={[styles.pasteHint, { color: palette.muted }]}>{t('otp.pasteHint')}</Text>

      {locked && <AuthError message={t('otp.lockedFor', { time: formatMMSS(lock) })} />}
      {error !== null && <AuthError message={error} />}

      <AuthCta
        label={t('otp.verify')}
        onPressAction={onVerifyPressed}
        disabled={locked}
        pending={pending}
      />

      <View style={[styles.footerDivider, { backgroundColor: palette.border }]} />

      {/* Le bloc de renvoi, en trois temps (D92 6A) — jamais une phrase
          ouverte sur un non-geste. */}
      <View style={styles.resendBlock}>
        {phase === 'ready' ? (
          <>
            <Text style={[styles.resendQuestion, { color: palette.text }]}>
              {t('otp.notReceived')}
            </Text>
            <TealLink label={t('otp.resend')} onPressAction={resend} center />
          </>
        ) : phase === 'early' ? (
          <Text style={[styles.resendQuestion, { color: palette.muted }]}>
            {t('otp.hintEarly')}
          </Text>
        ) : (
          <>
            <Text style={[styles.resendQuestion, { color: palette.text }]}>
              {t('otp.notReceivedWaiting')}
            </Text>
            {resendWait > 0 && (
              <Text style={[styles.resendWait, { color: palette.muted }]}>
                {t('otp.resendIn', { time: formatMMSS(resendWait) })}
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  emailCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: AuthRadius,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  emailAddress: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: 500,
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
    fontWeight: 400,
  },
  validityTime: {
    // 600 et non 700 : le compte à rebours doit se REPÉRER dans sa phrase,
    // pas peser autant que le bouton.
    fontWeight: 600,
  },
  enterCode: {
    // « Saisis ton code » est un LIBELLÉ de champ, pas un titre : 15 px / 500
    // en gris moyen, comme tous les libellés du mobile (D91 5A — 15 et non 13
    // comme le web : même rôle, autre distance de lecture).
    fontSize: 15,
    fontWeight: 500,
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
    fontWeight: 500,
  },
});

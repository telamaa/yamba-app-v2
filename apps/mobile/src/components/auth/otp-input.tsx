/**
 * otp-input.tsx — la saisie du code à 6 chiffres, côté AUTH.
 * ===========================================================
 * Depuis D116, ce fichier n'est plus que l'HABILLAGE auth de la primitive
 * partagée `components/code-input.tsx` : il lui donne la palette « slate »
 * des écrans d'auth (A208), le nom accessible du dictionnaire `auth`, et
 * dit `autofill: true` — ici le code est REÇU (mail), donc le système a
 * raison de le proposer.
 *
 * La remise d'un colis, elle, dit `autofill: false` : son code est DICTÉ par
 * le destinataire (D43), et proposer un code SMS reçu pour autre chose
 * serait une erreur devant quelqu'un qui attend.
 *
 * Ce qui reste ici : rien de géométrique. Deux jeux de cases à six chiffres
 * dans une même app seraient une incohérence de charte (D105).
 */
import { useTranslations } from 'use-intl';

import { useAuthPalette } from '@/components/auth/auth-theme';
import { CODE_LENGTH, CodeInput } from '@/components/code-input';

/** Conservé : trois écrans d'auth importent cette constante par ce nom. */
export const OTP_LENGTH = CODE_LENGTH;

export function OtpInput({
  value,
  onChangeAction,
  disabled = false,
}: {
  value: string;
  onChangeAction: (digits: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('auth');
  const palette = useAuthPalette();

  return (
    <CodeInput
      value={value}
      onChangeAction={onChangeAction}
      accessibilityLabel={t('otp.enterCode')}
      palette={{ card: palette.card, border: palette.border, digit: palette.title }}
      // Le code d'auth arrive par mail : le remplissage automatique est un
      // geste économisé, pas un piège.
      autofill
      autoFocus
      disabled={disabled}
    />
  );
}

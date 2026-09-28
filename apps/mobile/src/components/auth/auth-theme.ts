/**
 * auth-theme.ts — la palette des écrans d'auth (refonte sur captures, A208).
 * ==========================================================================
 * Les écrans d'auth du SITE ont leur propre ambiance « slate » (fond
 * #F8FAFC clair / #0B1120 sombre, cartes blanches bordées, titres navy,
 * liens teal soulignés, CTA mangue arrondi à texte sombre) — distincte du
 * thème générique de l'app. Les captures de `context/captures/auth/` sont
 * la référence pixel de ce fichier : toute retouche se compare à elles.
 */
import { useColorScheme } from 'react-native';

import { Brand } from '@/constants/theme';

export type AuthPalette = {
  bg: string;
  card: string;
  border: string;
  title: string;
  text: string;
  muted: string;
  teal: string;
  /** Fond du champ mot de passe REMPLI (la teinte lavande des captures). */
  inputFilled: string;
  ctaLabel: string;
};

const LIGHT: AuthPalette = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  title: '#0F172A',
  text: '#334155',
  muted: '#64748B',
  teal: '#0F766E',
  inputFilled: '#EEF2FF',
  ctaLabel: '#0F172A',
};

const DARK: AuthPalette = {
  bg: '#0B1120',
  card: '#0F172A',
  border: '#1E293B',
  title: '#F8FAFC',
  text: '#CBD5E1',
  muted: '#94A3B8',
  teal: '#2DD4BF',
  inputFilled: '#1E293B',
  ctaLabel: '#0F172A',
};

export function useAuthPalette(): AuthPalette {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}

export const AuthBrand = {
  mango: Brand.mango,
} as const;

/** Rayons et hauteurs des captures : cartes et CTA arrondis 12, PAS en pilule. */
export const AuthRadius = 12;
export const AuthFieldHeight = 52;

/**
 * `egoiomab@gmail.com` → `e******b@g***.com` — le masquage de l'écran de
 * vérification du site : premier et dernier caractère du local, première
 * lettre du domaine, le TLD en clair.
 */
export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const domainName = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  const maskedLocal =
    local.length <= 2
      ? `${local[0] ?? ''}*`
      : `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}`;
  const maskedDomain = `${domainName[0] ?? ''}${'*'.repeat(Math.max(1, Math.min(3, domainName.length - 1)))}`;
  return `${maskedLocal}@${maskedDomain}${tld}`;
}

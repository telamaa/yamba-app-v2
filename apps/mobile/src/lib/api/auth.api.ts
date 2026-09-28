/**
 * auth.api.ts — la session du mobile (A201) : login / me / logout / amorçage.
 * Le login demande la livraison des jetons dans le corps (`x-token-delivery:
 * body`, jamais de cookies) ; la déconnexion révoque la session côté serveur
 * par Bearer AVANT de purger le stockage local.
 */
import { apiFetch, refreshSession, storeSessionTokens } from './client';
import { apiBaseUrl } from './base-url';
import { clearTokens, getAccessToken, getRefreshToken } from './token-store';

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  /** Langue du COMPTE (D44) — prime sur celle de l'appareil quand elle existe. */
  preferredLocale?: string | null;
};

type LoginResponse = {
  message: string;
  user: SessionUser;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresInSeconds: number;
  };
};

export async function login(
  email: string,
  password: string,
  rememberMe = false
): Promise<SessionUser> {
  const body = await apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { email, password, rememberMe },
    headers: { 'x-token-delivery': 'body' },
    requireAuth: false,
  });
  if (!body.tokens) {
    // Le serveur a répondu 200 sans jetons : contrat A201 non tenu (gateway
    // qui avale l'en-tête ?) — mieux vaut échouer bruyamment qu'une session fantôme.
    throw new Error('Réponse de connexion sans jetons (x-token-delivery ignoré)');
  }
  await storeSessionTokens(body.tokens);
  return body.user;
}

export async function me(): Promise<SessionUser> {
  const body = await apiFetch<{ user: SessionUser }>('/auth/me');
  return body.user;
}

/** Au démarrage : s'il y a un refresh en réserve, rouvre la session. */
export async function bootstrapSession(): Promise<boolean> {
  if (getAccessToken() !== null) return true;
  if ((await getRefreshToken()) === null) return false;
  return refreshSession();
}

/* ── Inscription (miroir des endpoints du web : pending Redis + OTP 6 chiffres,
      AUCUNE session ouverte à la vérification — le login se chaîne après) ─── */

export type RegisterPayload = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: true;
  termsVersion: string;
  privacyVersion: string;
};

export async function register(payload: RegisterPayload): Promise<{ verificationToken: string }> {
  return apiFetch<{ message: string; verificationToken: string }>('/auth/register', {
    method: 'POST',
    body: payload,
    requireAuth: false,
  });
}

export async function verifyRegistrationOtp(
  verificationToken: string,
  otp: string
): Promise<void> {
  await apiFetch<{ success: boolean }>('/auth/register/verify', {
    method: 'POST',
    body: { verificationToken, otp },
    requireAuth: false,
  });
}

export async function resendRegistrationOtp(
  verificationToken: string
): Promise<{ verificationToken: string }> {
  return apiFetch<{ message: string; verificationToken: string }>('/auth/register/resend', {
    method: 'POST',
    body: { verificationToken },
    requireAuth: false,
  });
}

export async function cancelRegistration(verificationToken: string): Promise<void> {
  await apiFetch<{ success: boolean }>('/auth/register/cancel', {
    method: 'POST',
    body: { verificationToken },
    requireAuth: false,
  });
}

/* ── Mot de passe oublié (anti-énumération ANO-API-08 : forgot et resend
      répondent TOUJOURS 200 — les compteurs d'attente sont purement client) ── */

export async function forgotPassword(email: string): Promise<void> {
  await apiFetch<{ message: string }>('/auth/password/forgot', {
    method: 'POST',
    body: { email },
    requireAuth: false,
  });
}

export async function resendPasswordOtp(email: string): Promise<void> {
  await apiFetch<{ message: string }>('/auth/password/resend', {
    method: 'POST',
    body: { email },
    requireAuth: false,
  });
}

export async function verifyPasswordOtp(
  email: string,
  otp: string
): Promise<{ passwordResetToken: string }> {
  return apiFetch<{ message: string; passwordResetToken: string }>('/auth/password/verify', {
    method: 'POST',
    body: { email, otp },
    requireAuth: false,
  });
}

export async function resetPassword(
  passwordResetToken: string,
  newPassword: string
): Promise<void> {
  await apiFetch<{ message: string }>('/auth/password/reset', {
    method: 'POST',
    body: { passwordResetToken, newPassword },
    requireAuth: false,
  });
}

export async function logout(): Promise<void> {
  const refreshToken = await getRefreshToken();
  if (refreshToken !== null) {
    try {
      await fetch(`${apiBaseUrl()}/auth/logout`, {
        method: 'POST',
        headers: { authorization: `Bearer ${refreshToken}` },
      });
    } catch {
      // Hors ligne : la purge locale suffit, la session Redis expirera.
    }
  }
  await clearTokens();
}

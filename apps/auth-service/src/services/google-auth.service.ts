/**
 * google-auth.service.ts — connexion / inscription par Google (D47)
 * ================================================================
 * Le front obtient un JETON D'IDENTITÉ (OpenID `id_token`) via Google
 * Identity Services et l'envoie à `POST /auth/google`. Ici :
 *  1. vérification cryptographique du jeton (audience = GOOGLE_CLIENT_ID),
 *     email VÉRIFIÉ par Google exigé ;
 *  2. identité connue (provider + sub) → connexion ;
 *  3. sinon, compte existant avec le même email vérifié → rattachement de
 *     l'identité puis connexion (l'email vérifié par Google vaut l'OTP) ;
 *  4. sinon, NOUVEAU compte : le consentement CGU + confidentialité est
 *     OBLIGATOIRE (journal `ConsentLog`, même transaction que le User —
 *     miroir de l'inscription classique) ; sans consentement fourni, on
 *     répond CONSENT_REQUIRED avec le profil pré-rempli, jamais un compte.
 *
 * Logique PURE : le vérificateur de jeton et Prisma sont injectés → testable
 * sans réseau (google-auth.service.spec.ts).
 */
import type { Prisma } from "@prisma/client";
import { AppError, AuthError, ForbiddenError } from "@packages/error-handler";
import { resolveLocale } from "@packages/api-contracts";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
};

export type GoogleTokenVerifier = (idToken: string) => Promise<GoogleProfile | null>;

export type GoogleConsent = { termsVersion: string; privacyVersion: string };

export type GoogleSignInInput = {
  idToken: string;
  consent?: GoogleConsent;
  locale?: string | null;
  ip?: string;
  userAgent?: string;
};

export type GoogleSignInResult =
  | { status: "LOGGED_IN"; user: UserLike; created: boolean; linked: boolean }
  | { status: "CONSENT_REQUIRED"; profile: { email: string; firstName: string; lastName: string; avatarUrl?: string } };

export type UserLike = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  preferredLocale?: string;
};

export type GoogleAuthErrorCode = "GOOGLE_NOT_CONFIGURED" | "GOOGLE_TOKEN_INVALID" | "GOOGLE_EMAIL_UNVERIFIED";

function oauthError(status: 401 | 403 | 503, code: GoogleAuthErrorCode, message: string) {
  const details = { type: "oauth", provider: "GOOGLE", code };
  if (status === 401) return Object.assign(new AuthError(message), { details });
  if (status === 403) return Object.assign(new ForbiddenError(message), { details });
  return new AppError(message, 503, true, details);
}

/** Dépendances injectées (Prisma réel en prod, mock en test). */
export type GoogleAuthDeps = {
  verify: GoogleTokenVerifier | null;
  prisma: {
    authIdentity: {
      findUnique: (args: Prisma.AuthIdentityFindUniqueArgs) => Promise<{ userId: string } | null>;
      update: (args: Prisma.AuthIdentityUpdateArgs) => Promise<unknown>;
      create: (args: Prisma.AuthIdentityCreateArgs) => Promise<unknown>;
    };
    user: {
      findUnique: (args: Prisma.UserFindUniqueArgs) => Promise<UserLike | null>;
    };
    $transaction: <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => Promise<T>;
  };
  generatePublicSlug: (firstName: string, lastName: string) => Promise<string>;
  recordConsents: (
    tx: Prisma.TransactionClient,
    userId: string,
    consents: GoogleConsent & { ipAddress?: string; userAgent?: string; locale?: string }
  ) => Promise<void>;
  normalizeEmail: (email: string) => string;
};

export async function googleSignIn(deps: GoogleAuthDeps, input: GoogleSignInInput): Promise<GoogleSignInResult> {
  if (!deps.verify) {
    throw oauthError(503, "GOOGLE_NOT_CONFIGURED", "Google sign-in is not configured on this server.");
  }
  const profile = await deps.verify(input.idToken);
  if (!profile) throw oauthError(401, "GOOGLE_TOKEN_INVALID", "Invalid Google token.");
  if (!profile.emailVerified) {
    throw oauthError(403, "GOOGLE_EMAIL_UNVERIFIED", "Your Google email address is not verified.");
  }

  const emailKey = deps.normalizeEmail(profile.email);

  // 2. Identité connue → connexion
  const identity = await deps.prisma.authIdentity.findUnique({
    where: { provider_providerSub: { provider: "GOOGLE", providerSub: profile.sub } },
    select: { userId: true },
  });
  if (identity) {
    const user = await deps.prisma.user.findUnique({ where: { id: identity.userId } });
    if (user) {
      await deps.prisma.authIdentity.update({
        where: { provider_providerSub: { provider: "GOOGLE", providerSub: profile.sub } },
        data: { lastUsedAt: new Date(), email: profile.email },
      });
      return { status: "LOGGED_IN", user, created: false, linked: false };
    }
  }

  // 3. Compte existant avec le même email vérifié → rattachement
  const existing = await deps.prisma.user.findUnique({ where: { emailNormalized: emailKey } });
  if (existing) {
    await deps.prisma.authIdentity.create({
      data: { userId: existing.id, provider: "GOOGLE", providerSub: profile.sub, email: profile.email },
    });
    return { status: "LOGGED_IN", user: existing, created: false, linked: true };
  }

  // 4. Nouveau compte : consentement obligatoire
  if (!input.consent?.termsVersion || !input.consent?.privacyVersion) {
    return {
      status: "CONSENT_REQUIRED",
      profile: { email: profile.email, firstName: profile.firstName, lastName: profile.lastName, avatarUrl: profile.avatarUrl },
    };
  }

  const publicSlug = await deps.generatePublicSlug(profile.firstName, profile.lastName);
  const preferredLocale = resolveLocale(input.locale);
  const consent = input.consent;

  const user = await deps.prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        emailNormalized: emailKey,
        passwordHash: null,
        publicSlug,
        preferredLocale,
        identities: {
          create: { provider: "GOOGLE", providerSub: profile.sub, email: profile.email },
        },
      },
    });
    await deps.recordConsents(tx, created.id, {
      termsVersion: consent.termsVersion,
      privacyVersion: consent.privacyVersion,
      ipAddress: input.ip,
      userAgent: input.userAgent,
      locale: preferredLocale,
    });
    return created;
  });

  return { status: "LOGGED_IN", user, created: true, linked: false };
}

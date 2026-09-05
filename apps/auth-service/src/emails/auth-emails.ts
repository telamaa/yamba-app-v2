/**
 * auth-emails.ts — les emails de l'auth-service, en DONNÉES, par langue (D44)
 * ==========================================================================
 * Un dictionnaire par locale supportée ; chaque entrée est une fonction
 * (paramètres → sujet + contenu) rendue par le gabarit partagé de
 * `@packages/email`. Ajouter une langue = ajouter une clé dans AUTH_EMAILS
 * (tsc casse si une entrée manque — `Record<SupportedLocale, …>`).
 *
 * Registre de marque (D45) : tutoiement, prénom réel, aucun emoji dans les
 * sujets. Le mot « Tripper » des emails carrier est conservé tel quel en
 * attendant la décision sur le nom du rôle (D45, ouvert).
 */
import type { EmailContent } from "@packages/email";
import {
  DEFAULT_LOCALE,
  resolveLocale,
  type SupportedLocale,
} from "@packages/api-contracts";

export type AuthEmail = { subject: string; content: EmailContent };

export type OtpEmailParams = { firstName: string; otp: string; expiresInMinutes: number };
export type PasswordChangedParams = {
  firstName?: string;
  changedAt?: string;
  ip?: string;
  userAgent?: string;
  securityUrl?: string;
  supportEmail: string;
};
export type AccountCreatedParams = { firstName?: string; loginUrl?: string; supportEmail: string };
export type SecurityAlertParams = {
  scope: "register" | "forgot" | "sudo"; // sudo : C-PR8b (D63 1A) — même texte « compte » que forgot
  attemptCount: number;
  /** Durée du verrou déclenché, en secondes (barème A50). */
  lockSeconds: number;
  supportEmail: string;
};
export type OnboardingCompleteParams = { name: string; city: string; stripeReady: boolean; appUrl: string };
/** `currentStep` = CarrierPage.onboardingStep (enum Prisma : PROFILE, puis paiement). */
export type OnboardingReminderParams = { name: string; step: 1 | 2 | 3; currentStep: string; appUrl: string };

export type AuthEmailDictionary = {
  verifyEmail(p: OtpEmailParams): AuthEmail;
  resetPassword(p: OtpEmailParams): AuthEmail;
  passwordChanged(p: PasswordChangedParams): AuthEmail;
  accountCreated(p: AccountCreatedParams): AuthEmail;
  securityAlert(p: SecurityAlertParams): AuthEmail;
  carrierOnboardingComplete(p: OnboardingCompleteParams): AuthEmail;
  carrierOnboardingReminder(p: OnboardingReminderParams): AuthEmail;
  /** C-PR8b (D63 1A) — code sudo pour un geste sensible (export, effacement) */
  sudoCode(p: OtpEmailParams): AuthEmail;
  /** C-PR8b (D63 4A) — confirmation envoyée à l'ancienne adresse, sans lien ni code */
  accountErased(p: { firstName: string; supportEmail: string }): AuthEmail;
};

export const AUTH_EMAIL_KEYS = [
  "verifyEmail",
  "resetPassword",
  "passwordChanged",
  "accountCreated",
  "securityAlert",
  "carrierOnboardingComplete",
  "carrierOnboardingReminder",
  "sudoCode",
  "accountErased",
] as const satisfies ReadonlyArray<keyof AuthEmailDictionary>;

function greet(firstName: string | undefined, fr: boolean): string {
  const name = firstName?.trim();
  if (fr) return name ? `Bonjour ${name},` : "Bonjour,";
  return name ? `Hi ${name},` : "Hi,";
}

export function formatLockDurationLocalized(seconds: number, locale: SupportedLocale): string {
  const fr = locale === "fr";
  if (seconds < 3600) {
    const min = Math.max(1, Math.ceil(seconds / 60));
    return fr ? `${min} minute${min > 1 ? "s" : ""}` : `${min} minute${min > 1 ? "s" : ""}`;
  }
  const hours = Math.ceil(seconds / 3600);
  return fr ? `${hours} heure${hours > 1 ? "s" : ""}` : `${hours} hour${hours > 1 ? "s" : ""}`;
}

/* ══ FR ═══════════════════════════════════════════════════════ */

const fr: AuthEmailDictionary = {
  sudoCode: ({ firstName, otp, expiresInMinutes }) => ({
    subject: "Ton code de confirmation Yamba",
    content: {
      preheader: `Ton code de confirmation Yamba : ${otp}`,
      title: "Confirme une action sensible",
      greeting: greet(firstName, true),
      paragraphs: ["Tu as demandé à télécharger tes données ou à supprimer ton compte. Saisis le code ci-dessous pour confirmer :"],
      code: { label: "Code de confirmation", value: otp },
      notice: { tone: "warning", text: `Ce code expire dans ${expiresInMinutes} minutes. Si tu n'es pas à l'origine de cette demande, change ton mot de passe : quelqu'un a accès à ta session.` },
      footnotes: ["Conseil sécurité : ne partage jamais ce code, même avec le support Yamba."],
      reason: "Tu reçois cet email car une action sensible a été demandée depuis ton compte Yamba.",
    },
  }),
  accountErased: ({ firstName, supportEmail }) => ({
    subject: "Ton compte Yamba a été supprimé",
    content: {
      preheader: "Tes données personnelles ont été effacées.",
      title: "Compte supprimé",
      greeting: greet(firstName, true),
      paragraphs: [
        "Ton compte Yamba a été supprimé et tes données personnelles effacées : identité, coordonnées, adresses, alertes, favoris, justificatifs.",
        "Ce qui reste, sans ton nom : l'historique des réservations et des litiges (obligations comptables), les avis et les messages déjà échangés avec d'autres membres.",
        "Ton compte de versement Stripe n'est pas supprimé par Yamba : tu peux le clôturer depuis Stripe.",
      ],
      reason: `Tu reçois cet email parce qu'un compte Yamba lié à cette adresse vient d'être supprimé. Une question ? ${supportEmail}`,
    },
  }),
  verifyEmail: ({ firstName, otp, expiresInMinutes }) => ({
    subject: "Ton code d'activation Yamba",
    content: {
      preheader: `Ton code d'activation Yamba : ${otp}`,
      title: "Active ton compte Yamba",
      greeting: greet(firstName, true),
      paragraphs: ["Merci pour ton inscription. Saisis le code ci-dessous pour activer ton compte :"],
      code: { label: "Code d'activation", value: otp },
      notice: {
        tone: "warning",
        text: `Ce code expire dans ${expiresInMinutes} minutes. Si tu n'as pas créé de compte sur Yamba, ignore cet email.`,
      },
      footnotes: ["Conseil sécurité : ne partage jamais ce code, même avec le support Yamba."],
      reason: "Tu reçois cet email car un compte a été créé sur Yamba avec cette adresse.",
    },
  }),
  resetPassword: ({ firstName, otp, expiresInMinutes }) => ({
    subject: "Ton code de réinitialisation Yamba",
    content: {
      preheader: `Ton code de réinitialisation Yamba : ${otp}`,
      title: "Réinitialise ton mot de passe",
      greeting: greet(firstName, true),
      paragraphs: ["Tu as demandé à réinitialiser ton mot de passe. Saisis le code ci-dessous pour continuer :"],
      code: { label: "Code de réinitialisation", value: otp },
      notice: {
        tone: "warning",
        text: `Ce code expire dans ${expiresInMinutes} minutes. Si tu n'es pas à l'origine de cette demande, ignore cet email : ton compte reste sécurisé.`,
      },
      footnotes: ["Conseil sécurité : ne partage jamais ce code, même avec le support Yamba."],
      reason: "Tu reçois cet email car une réinitialisation de mot de passe a été demandée pour ce compte Yamba.",
    },
  }),
  passwordChanged: ({ firstName, changedAt, ip, userAgent, securityUrl, supportEmail }) => ({
    subject: "Ton mot de passe Yamba a été modifié",
    content: {
      preheader: "Confirmation : ton mot de passe Yamba a été modifié.",
      title: "Mot de passe modifié",
      greeting: greet(firstName, true),
      paragraphs: [
        "Nous te confirmons que le mot de passe de ton compte Yamba a bien été modifié.",
        [changedAt ? `Date : ${changedAt}` : null, ip ? `Adresse IP : ${ip}` : null, userAgent ? `Appareil : ${userAgent}` : null]
          .filter(Boolean)
          .join(" · "),
      ].filter((p) => p.length > 0),
      notice: {
        tone: "warning",
        text: `Ce n'était pas toi ? Contacte immédiatement le support (${supportEmail}) pour sécuriser ton compte.`,
      },
      cta: securityUrl ? { label: "Vérifier la sécurité de mon compte", url: securityUrl } : undefined,
      footnotes: ["Si tu es à l'origine de cette modification, aucune action n'est nécessaire."],
      reason: "Tu reçois cet email car le mot de passe de ton compte Yamba vient d'être changé.",
      help: { label: "Besoin d'aide ?", url: `mailto:${supportEmail}` },
    },
  }),
  accountCreated: ({ firstName, loginUrl, supportEmail }) => ({
    subject: "Bienvenue sur Yamba",
    content: {
      preheader: "Ton compte Yamba est créé. Bienvenue !",
      title: "Bienvenue sur Yamba",
      greeting: greet(firstName, true),
      paragraphs: [
        "Ton compte Yamba a bien été créé. Tu fais maintenant partie d'une communauté qui rend le transport de colis plus simple et plus humain.",
        "Envoyer un colis : trouve un Voyageur sur un trajet qui te convient. Devenir Tripper : publie tes trajets et gagne de l'argent en transportant des colis. Explorer : découvre les trajets disponibles près de chez toi.",
      ],
      notice: {
        tone: "info",
        text: "Astuce : complète ton profil (coordonnées, adresses) pour gagner du temps lors de tes prochaines étapes.",
      },
      cta: loginUrl ? { label: "Me connecter", url: loginUrl } : undefined,
      footnotes: ["Si tu n'es pas à l'origine de cette création de compte, contacte-nous rapidement."],
      reason: "Tu reçois cet email car un compte Yamba vient d'être créé avec cette adresse.",
      help: { label: "Besoin d'aide ?", url: `mailto:${supportEmail}` },
    },
  }),
  securityAlert: ({ scope, attemptCount, lockSeconds, supportEmail }) => {
    const isRegister = scope === "register";
    const lock = formatLockDurationLocalized(lockSeconds, "fr");
    return {
      subject: isRegister
        ? "Activité suspecte sur ton inscription Yamba"
        : "Activité suspecte sur ton compte Yamba",
      content: {
        preheader: "Activité suspecte détectée sur ton compte Yamba.",
        title: "Activité suspecte détectée",
        greeting: "Bonjour,",
        paragraphs: [
          `Nous avons détecté ${attemptCount} saisies incorrectes du code de vérification lors de ${isRegister ? "ton inscription" : "la réinitialisation de ton mot de passe"} sur Yamba.`,
          `Par mesure de sécurité, la saisie est bloquée pendant ${lock}.`,
          "Si ce n'était pas toi : quelqu'un a peut-être tenté d'accéder à ton compte. Vérifie la sécurité de ta boîte e-mail, choisis un mot de passe unique et contacte-nous en cas de doute.",
          "Si c'était bien toi : aucune action n'est requise. Tu pourras demander un nouveau code à la fin du blocage.",
        ],
        reason: "Cet email t'est envoyé automatiquement pour protéger ton compte Yamba.",
        help: { label: `Une question ? ${supportEmail}`, url: `mailto:${supportEmail}` },
      },
    };
  },
  carrierOnboardingComplete: ({ name, city, stripeReady, appUrl }) => ({
    subject: "Ton profil Tripper est actif",
    content: {
      preheader: "Ton profil Tripper est actif : tu peux recevoir des propositions de transport.",
      title: "Bienvenue chez les Trippers",
      greeting: greet(name, true),
      paragraphs: [
        "Ton profil de Tripper est maintenant actif. Tu peux dès à présent recevoir des propositions de transport de colis sur tes trajets.",
        `Adresse principale : ${city}.`,
        "Prochaines étapes : publie ton premier trajet pour que les expéditeurs puissent te trouver, accepte des propositions, et configure Stripe pour recevoir tes paiements.",
      ],
      notice: stripeReady
        ? { tone: "success", text: "Paiements Stripe : connectés." }
        : { tone: "warning", text: "Stripe n'est pas encore configuré : tu pourras le faire plus tard depuis ton espace." },
      cta: { label: "Publier mon premier trajet", url: `${appUrl}/trips/create` },
      reason: "Tu reçois cet email car tu as créé un profil Tripper sur Yamba.",
      help: { label: "Gérer mes notifications", url: `${appUrl}/settings/notifications` },
    },
  }),
  carrierOnboardingReminder: ({ name, step, currentStep, appUrl }) => {
    const titles = {
      1: "Plus qu'une étape pour devenir Tripper",
      2: "Ton profil Tripper t'attend",
      3: "Dernière chance de finaliser ton profil",
    } as const;
    const body = {
      1: [
        "Tu as commencé à créer ton profil Tripper sur Yamba, mais tu n'as pas encore terminé. Ça ne prend que 2 minutes.",
        currentStep === "PROFILE"
          ? "Il te reste à remplir ton profil (bio, adresse, téléphone) pour être visible des expéditeurs."
          : "Ton profil est prêt : il ne reste plus qu'à connecter Stripe pour recevoir tes paiements.",
      ],
      2: [
        "Tu as commencé ton inscription comme Tripper il y a quelques jours. Voici ce que tu rates : de l'argent gagné sur tes trajets quotidiens, un service rendu à ta communauté, un transport plus durable.",
      ],
      3: [
        "C'est notre dernier rappel. Ton profil Tripper est toujours en attente de finalisation.",
        "Si tu changes d'avis, tu pourras toujours reprendre ton inscription depuis ton espace Yamba. On ne t'enverra plus de rappels à ce sujet.",
      ],
    } as const;
    return {
      subject: titles[step],
      content: {
        preheader: titles[step],
        title: titles[step],
        greeting: greet(name, true),
        paragraphs: [...body[step]],
        notice: {
          tone: "info",
          text: currentStep === "PROFILE" ? "Progression : étape 1/2 — Profil" : "Progression : étape 2/2 — Paiement",
        },
        cta: { label: step === 3 ? "Reprendre mon inscription" : "Terminer mon profil", url: `${appUrl}/carrier/onboarding` },
        reason:
          step === 3
            ? "Ceci est notre dernier rappel : tu ne recevras plus d'emails à ce sujet."
            : "Tu reçois cet email car tu as commencé l'inscription Tripper sur Yamba.",
        help: { label: "Se désabonner", url: `${appUrl}/settings/notifications` },
      },
    };
  },
};

/* ══ EN ═══════════════════════════════════════════════════════ */

const en: AuthEmailDictionary = {
  sudoCode: ({ firstName, otp, expiresInMinutes }) => ({
    subject: "Your Yamba confirmation code",
    content: {
      preheader: `Your Yamba confirmation code: ${otp}`,
      title: "Confirm a sensitive action",
      greeting: greet(firstName, false),
      paragraphs: ["You asked to download your data or to delete your account. Enter the code below to confirm:"],
      code: { label: "Confirmation code", value: otp },
      notice: { tone: "warning", text: `This code expires in ${expiresInMinutes} minutes. If you did not request this, change your password: someone has access to your session.` },
      footnotes: ["Security tip: never share this code, not even with Yamba support."],
      reason: "You receive this email because a sensitive action was requested from your Yamba account.",
    },
  }),
  accountErased: ({ firstName, supportEmail }) => ({
    subject: "Your Yamba account has been deleted",
    content: {
      preheader: "Your personal data has been erased.",
      title: "Account deleted",
      greeting: greet(firstName, false),
      paragraphs: [
        "Your Yamba account has been deleted and your personal data erased: identity, contact details, addresses, alerts, favourites, documents.",
        "What remains, without your name: the history of bookings and disputes (accounting obligations), and the reviews and messages already exchanged with other members.",
        "Your Stripe payout account is not deleted by Yamba: you can close it from Stripe.",
      ],
      reason: `You receive this email because a Yamba account linked to this address has just been deleted. Questions? ${supportEmail}`,
    },
  }),
  verifyEmail: ({ firstName, otp, expiresInMinutes }) => ({
    subject: "Your Yamba activation code",
    content: {
      preheader: `Your Yamba activation code: ${otp}`,
      title: "Activate your Yamba account",
      greeting: greet(firstName, false),
      paragraphs: ["Thanks for signing up. Enter the code below to activate your account:"],
      code: { label: "Activation code", value: otp },
      notice: {
        tone: "warning",
        text: `This code expires in ${expiresInMinutes} minutes. If you did not create a Yamba account, ignore this email.`,
      },
      footnotes: ["Security tip: never share this code, not even with Yamba support."],
      reason: "You are receiving this email because a Yamba account was created with this address.",
    },
  }),
  resetPassword: ({ firstName, otp, expiresInMinutes }) => ({
    subject: "Your Yamba password reset code",
    content: {
      preheader: `Your Yamba reset code: ${otp}`,
      title: "Reset your password",
      greeting: greet(firstName, false),
      paragraphs: ["You asked to reset your password. Enter the code below to continue:"],
      code: { label: "Reset code", value: otp },
      notice: {
        tone: "warning",
        text: `This code expires in ${expiresInMinutes} minutes. If you did not request this, ignore this email: your account stays safe.`,
      },
      footnotes: ["Security tip: never share this code, not even with Yamba support."],
      reason: "You are receiving this email because a password reset was requested for this Yamba account.",
    },
  }),
  passwordChanged: ({ firstName, changedAt, ip, userAgent, securityUrl, supportEmail }) => ({
    subject: "Your Yamba password was changed",
    content: {
      preheader: "Confirmation: your Yamba password was changed.",
      title: "Password changed",
      greeting: greet(firstName, false),
      paragraphs: [
        "This confirms that the password of your Yamba account was changed.",
        [changedAt ? `Date: ${changedAt}` : null, ip ? `IP address: ${ip}` : null, userAgent ? `Device: ${userAgent}` : null]
          .filter(Boolean)
          .join(" · "),
      ].filter((p) => p.length > 0),
      notice: {
        tone: "warning",
        text: `Wasn't you? Contact support right away (${supportEmail}) to secure your account.`,
      },
      cta: securityUrl ? { label: "Check my account security", url: securityUrl } : undefined,
      footnotes: ["If you made this change, no action is needed."],
      reason: "You are receiving this email because the password of your Yamba account was just changed.",
      help: { label: "Need help?", url: `mailto:${supportEmail}` },
    },
  }),
  accountCreated: ({ firstName, loginUrl, supportEmail }) => ({
    subject: "Welcome to Yamba",
    content: {
      preheader: "Your Yamba account is ready. Welcome!",
      title: "Welcome to Yamba",
      greeting: greet(firstName, false),
      paragraphs: [
        "Your Yamba account has been created. You are now part of a community that makes parcel delivery simpler and more human.",
        "Send a parcel: find a carrier on a trip that suits you. Become a Tripper: publish your trips and earn money carrying parcels. Explore: discover trips available near you.",
      ],
      notice: {
        tone: "info",
        text: "Tip: complete your profile (contact details, addresses) to save time on your next steps.",
      },
      cta: loginUrl ? { label: "Sign in", url: loginUrl } : undefined,
      footnotes: ["If you did not create this account, contact us quickly."],
      reason: "You are receiving this email because a Yamba account was just created with this address.",
      help: { label: "Need help?", url: `mailto:${supportEmail}` },
    },
  }),
  securityAlert: ({ scope, attemptCount, lockSeconds, supportEmail }) => {
    const isRegister = scope === "register";
    const lock = formatLockDurationLocalized(lockSeconds, "en");
    return {
      subject: isRegister
        ? "Suspicious activity on your Yamba sign-up"
        : "Suspicious activity on your Yamba account",
      content: {
        preheader: "Suspicious activity detected on your Yamba account.",
        title: "Suspicious activity detected",
        greeting: "Hi,",
        paragraphs: [
          `We detected ${attemptCount} incorrect verification code entries during ${isRegister ? "your sign-up" : "your password reset"} on Yamba.`,
          `For your security, code entry is blocked for ${lock}.`,
          "If this wasn't you: someone may have tried to access your account. Check the security of your mailbox, choose a unique password, and contact us if in doubt.",
          "If it was you: no action is needed. You can request a new code once the block ends.",
        ],
        reason: "This email is sent automatically to protect your Yamba account.",
        help: { label: `Questions? ${supportEmail}`, url: `mailto:${supportEmail}` },
      },
    };
  },
  carrierOnboardingComplete: ({ name, city, stripeReady, appUrl }) => ({
    subject: "Your Tripper profile is live",
    content: {
      preheader: "Your Tripper profile is live: you can now receive transport requests.",
      title: "Welcome among the Trippers",
      greeting: greet(name, false),
      paragraphs: [
        "Your Tripper profile is now active. You can start receiving parcel transport requests on your trips.",
        `Primary address: ${city}.`,
        "Next steps: publish your first trip so shippers can find you, accept requests, and set up Stripe to receive your payouts.",
      ],
      notice: stripeReady
        ? { tone: "success", text: "Stripe payouts: connected." }
        : { tone: "warning", text: "Stripe is not set up yet: you can do it later from your dashboard." },
      cta: { label: "Publish my first trip", url: `${appUrl}/trips/create` },
      reason: "You are receiving this email because you created a Tripper profile on Yamba.",
      help: { label: "Manage my notifications", url: `${appUrl}/settings/notifications` },
    },
  }),
  carrierOnboardingReminder: ({ name, step, currentStep, appUrl }) => {
    const titles = {
      1: "One step left to become a Tripper",
      2: "Your Tripper profile is waiting",
      3: "Last chance to complete your profile",
    } as const;
    const body = {
      1: [
        "You started creating your Tripper profile on Yamba but did not finish. It only takes 2 minutes.",
        currentStep === "PROFILE"
          ? "You still need to fill in your profile (bio, address, phone) to be visible to shippers."
          : "Your profile is ready: all that is left is connecting Stripe to receive your payouts.",
      ],
      2: [
        "You started your Tripper sign-up a few days ago. Here is what you are missing: money earned on your everyday trips, a service to your community, more sustainable transport.",
      ],
      3: [
        "This is our last reminder. Your Tripper profile is still waiting to be completed.",
        "If you change your mind, you can always resume your sign-up from your Yamba dashboard. We will not send further reminders about this.",
      ],
    } as const;
    return {
      subject: titles[step],
      content: {
        preheader: titles[step],
        title: titles[step],
        greeting: greet(name, false),
        paragraphs: [...body[step]],
        notice: {
          tone: "info",
          text: currentStep === "PROFILE" ? "Progress: step 1/2 — Profile" : "Progress: step 2/2 — Payouts",
        },
        cta: { label: step === 3 ? "Resume my sign-up" : "Finish my profile", url: `${appUrl}/carrier/onboarding` },
        reason:
          step === 3
            ? "This is our last reminder: you will not receive further emails about this."
            : "You are receiving this email because you started the Tripper sign-up on Yamba.",
        help: { label: "Unsubscribe", url: `${appUrl}/settings/notifications` },
      },
    };
  },
};

export const AUTH_EMAILS: Record<SupportedLocale, AuthEmailDictionary> = { fr, en };

/** Dictionnaire pour une locale (déjà résolue ou brute) — repli DEFAULT_LOCALE. */
export function getAuthEmails(locale: string | null | undefined): AuthEmailDictionary {
  return AUTH_EMAILS[resolveLocale(locale)] ?? AUTH_EMAILS[DEFAULT_LOCALE];
}

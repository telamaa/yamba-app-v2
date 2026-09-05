/**
 * admin-emails.ts — emails du back-office (C-PR3, D56), un dictionnaire par locale (D44)
 * =====================================================================================
 * - adminInvite         : invitation d'un nouvel administrateur (lien 48 h, mot de passe à définir)
 * - adminAccessGranted  : compte existant promu (lien de connexion admin)
 * - adminLoginAlert     : alerte à chaque ouverture de session admin (ip, appareil, date)
 * - accountRestricted / accountSuspended / accountReinstated : au membre, motif GÉNÉRIQUE
 *   (jamais le contenu d'un signalement), recours par email.
 */
import type { EmailContent } from "@packages/email";
import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "@packages/api-contracts";

export type AdminEmail = { subject: string; content: EmailContent };

export type AdminInviteParams = { firstName: string; invitedBy: string; roleLabel: string; acceptUrl: string; expiresInHours: number; supportEmail: string };
export type AdminAccessGrantedParams = { firstName: string; invitedBy: string; roleLabel: string; loginUrl: string; supportEmail: string };
export type AdminLoginAlertParams = { firstName: string; at: string; ip: string; userAgent: string; sessionsUrl: string; supportEmail: string };
export type AccountStatusParams = { firstName: string; reason: string; until: string | null; supportEmail: string };
/** C-PR8a (D62 5A) — chaque modification de paramètre est annoncée à tous les SUPER_ADMIN. */
export type MaintenanceChangedParams = { firstName: string; byName: string; enabled: boolean; scheduledAt: string | null; message: string; reason: string; statusUrl: string };
export type SettingsChangedParams = { firstName: string; byName: string; at: string; reason: string; changes: Array<{ label: string; before: string; after: string }>; settingsUrl: string; reset: boolean };

export type AdminEmailDictionary = {
  adminInvite(p: AdminInviteParams): AdminEmail;
  adminAccessGranted(p: AdminAccessGrantedParams): AdminEmail;
  adminLoginAlert(p: AdminLoginAlertParams): AdminEmail;
  accountRestricted(p: AccountStatusParams): AdminEmail;
  accountSuspended(p: AccountStatusParams): AdminEmail;
  accountReinstated(p: Pick<AccountStatusParams, "firstName" | "supportEmail">): AdminEmail;
  settingsChanged(p: SettingsChangedParams): AdminEmail;
  maintenanceChanged(p: MaintenanceChangedParams): AdminEmail;
};

export const ADMIN_ROLE_LABELS: Record<SupportedLocale, Record<string, string>> = {
  fr: { SUPER_ADMIN: "Super administrateur", MEDIATOR: "Médiateur", SUPPORT: "Support", FINANCE: "Finance", OPS: "Exploitation", PRIVACY: "Données personnelles" },
  en: { SUPER_ADMIN: "Super administrator", MEDIATOR: "Mediator", SUPPORT: "Support", FINANCE: "Finance", OPS: "Operations", PRIVACY: "Privacy" },
};

const fr: AdminEmailDictionary = {
  adminInvite: (p) => ({
    subject: "Ton accès au back-office Yamba",
    content: {
      preheader: `${p.invitedBy} t'ouvre un accès ${p.roleLabel}.`,
      title: "Bienvenue dans le back-office",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [
        `${p.invitedBy} t'a ouvert un accès au back-office Yamba avec le profil « ${p.roleLabel} ».`,
        `Choisis ton mot de passe avec le lien ci-dessous (valable ${p.expiresInHours} h). À ta première connexion, tu activeras la double authentification avec une application d'authentification.`,
      ],
      cta: { label: "Définir mon mot de passe", url: p.acceptUrl },
      notice: { tone: "info", text: "Ce compte n'a aucun rôle client : il ne publie pas de trajet et n'envoie pas de colis." },
      reason: "Tu reçois cet email parce qu'un super administrateur Yamba t'a invité au back-office.",
      footnotes: [`Une question ? ${p.supportEmail}`],
    },
  }),
  adminAccessGranted: (p) => ({
    subject: "Accès au back-office Yamba accordé",
    content: {
      preheader: `Profil ${p.roleLabel} sur ton compte.`,
      title: "Accès au back-office",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`${p.invitedBy} a ouvert le profil « ${p.roleLabel} » sur ton compte Yamba. Connecte-toi avec ton mot de passe habituel ; la double authentification sera demandée.`],
      cta: { label: "Ouvrir le back-office", url: p.loginUrl },
      reason: "Tu reçois cet email parce qu'un super administrateur Yamba a modifié tes accès.",
      footnotes: [`Si ce n'est pas attendu, écris-nous : ${p.supportEmail}`],
    },
  }),
  adminLoginAlert: (p) => ({
    subject: "Nouvelle connexion au back-office Yamba",
    content: {
      preheader: `${p.at} · ${p.ip}`,
      title: "Connexion admin",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`Une session admin vient d'être ouverte sur ton compte le ${p.at}, depuis ${p.ip} (${p.userAgent}).`, "Si ce n'est pas toi, révoque tes sessions et change ton mot de passe tout de suite."],
      cta: { label: "Voir mes sessions", url: p.sessionsUrl },
      reason: "Tu reçois cet email à chaque ouverture de session sur le back-office (sécurité).",
      footnotes: [`Signaler : ${p.supportEmail}`],
    },
  }),
  accountRestricted: (p) => ({
    subject: "Ton compte Yamba est restreint",
    content: {
      preheader: "Tu ne peux plus publier ni réserver pour le moment.",
      title: "Compte restreint",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [
        `Ton compte ne peut plus publier de trajet ni réserver d'envoi${p.until ? ` jusqu'au ${p.until}` : ", jusqu'à nouvel ordre"}. Motif : ${p.reason}`,
        "Tes deals en cours continuent normalement.",
      ],
      notice: { tone: "warning", text: `Pour contester, écris-nous à ${p.supportEmail}.` },
      reason: "Tu reçois cet email parce qu'une décision a été prise sur ton compte Yamba.",
    },
  }),
  accountSuspended: (p) => ({
    subject: "Ton compte Yamba est suspendu",
    content: {
      preheader: "Connexion impossible pendant la suspension.",
      title: "Compte suspendu",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [
        `Ton compte est suspendu${p.until ? ` jusqu'au ${p.until}` : ", jusqu'à nouvel ordre"} : la connexion est refusée et tes trajets ne sont plus visibles. Motif : ${p.reason}`,
        "Tes deals en cours sont pris en charge par notre équipe.",
      ],
      notice: { tone: "warning", text: `Pour contester, écris-nous à ${p.supportEmail}.` },
      reason: "Tu reçois cet email parce qu'une décision a été prise sur ton compte Yamba.",
    },
  }),
  settingsChanged: (p) => ({
    subject: p.reset ? "Paramètres de la plateforme réinitialisés" : "Paramètres de la plateforme modifiés",
    content: {
      preheader: `${p.byName} a ${p.reset ? "réinitialisé" : "modifié"} ${p.changes.length} paramètre(s).`,
      title: p.reset ? "Réinitialisation de paramètres" : "Modification de paramètres",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [
        `${p.byName} a ${p.reset ? "remis par défaut" : "modifié"} ${p.changes.length} paramètre(s) le ${p.at} :`,
        ...p.changes.map((c) => `• ${c.label} : ${c.before} → ${c.after}`),
        `Motif : ${p.reason}`,
        "Les réservations déjà faites ne changent pas. Si tu n'es pas à l'origine de ce changement, vérifie les sessions admin et le journal.",
      ],
      cta: { label: "Voir les paramètres", url: p.settingsUrl },
      reason: "Tu reçois cet email parce que tu es super administrateur Yamba : chaque modification de paramètre est annoncée à tous les super administrateurs (D62).",
    },
  }),
  maintenanceChanged: (p) => ({
    subject: p.enabled ? "Maintenance activée sur Yamba" : p.scheduledAt ? "Maintenance planifiée sur Yamba" : "Maintenance levée sur Yamba",
    content: {
      preheader: `${p.byName} a modifié l'état de maintenance.`,
      title: p.enabled ? "Plateforme en lecture seule" : p.scheduledAt ? "Maintenance annoncée" : "Retour à la normale",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [
        p.enabled ? `${p.byName} a passé la plateforme en lecture seule : les membres lisent, aucune écriture ne passe (sauf connexion et back-office).` : p.scheduledAt ? `${p.byName} a annoncé une maintenance pour le ${new Date(p.scheduledAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} : le bandeau est affiché sur les deux fronts.` : `${p.byName} a levé la maintenance : la plateforme est de nouveau ouverte aux écritures.`,
        p.message ? `Message affiché : « ${p.message} »` : "Aucun message personnalisé.",
        `Motif : ${p.reason}`,
      ],
      cta: { label: "Voir l'état des services", url: p.statusUrl },
      reason: "Tu reçois cet email parce que tu es super administrateur Yamba : chaque changement d'état de maintenance est annoncé à tous les super administrateurs (D64).",
    },
  }),
  accountReinstated: (p) => ({
    subject: "Ton compte Yamba est rétabli",
    content: {
      preheader: "Tout est de nouveau accessible.",
      title: "Compte rétabli",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: ["La restriction sur ton compte est levée : tu peux de nouveau publier, réserver et te connecter normalement."],
      reason: "Tu reçois cet email parce qu'une décision a été prise sur ton compte Yamba.",
      footnotes: [`Une question ? ${p.supportEmail}`],
    },
  }),
};

const en: AdminEmailDictionary = {
  adminInvite: (p) => ({
    subject: "Your access to the Yamba back-office",
    content: {
      preheader: `${p.invitedBy} grants you ${p.roleLabel} access.`,
      title: "Welcome to the back-office",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [
        `${p.invitedBy} opened a Yamba back-office access for you with the "${p.roleLabel}" profile.`,
        `Choose your password with the link below (valid ${p.expiresInHours}h). On first login you will enable two-factor authentication with an authenticator app.`,
      ],
      cta: { label: "Set my password", url: p.acceptUrl },
      notice: { tone: "info", text: "This account has no client role: it does not publish trips nor send parcels." },
      reason: "You receive this email because a Yamba super administrator invited you to the back-office.",
      footnotes: [`Questions? ${p.supportEmail}`],
    },
  }),
  adminAccessGranted: (p) => ({
    subject: "Yamba back-office access granted",
    content: {
      preheader: `${p.roleLabel} profile on your account.`,
      title: "Back-office access",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`${p.invitedBy} opened the "${p.roleLabel}" profile on your Yamba account. Sign in with your usual password; two-factor authentication will be required.`],
      cta: { label: "Open the back-office", url: p.loginUrl },
      reason: "You receive this email because a Yamba super administrator changed your access.",
      footnotes: [`Unexpected? Write to us: ${p.supportEmail}`],
    },
  }),
  adminLoginAlert: (p) => ({
    subject: "New sign-in to the Yamba back-office",
    content: {
      preheader: `${p.at} · ${p.ip}`,
      title: "Admin sign-in",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`An admin session was just opened on your account on ${p.at}, from ${p.ip} (${p.userAgent}).`, "If this is not you, revoke your sessions and change your password right away."],
      cta: { label: "View my sessions", url: p.sessionsUrl },
      reason: "You receive this email at every back-office sign-in (security).",
      footnotes: [`Report: ${p.supportEmail}`],
    },
  }),
  accountRestricted: (p) => ({
    subject: "Your Yamba account is restricted",
    content: {
      preheader: "You can no longer publish or book for now.",
      title: "Account restricted",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`Your account can no longer publish trips or book shipments${p.until ? ` until ${p.until}` : ", until further notice"}. Reason: ${p.reason}`, "Your ongoing deals continue normally."],
      notice: { tone: "warning", text: `To contest, write to ${p.supportEmail}.` },
      reason: "You receive this email because a decision was made on your Yamba account.",
    },
  }),
  accountSuspended: (p) => ({
    subject: "Your Yamba account is suspended",
    content: {
      preheader: "Sign-in is refused during the suspension.",
      title: "Account suspended",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`Your account is suspended${p.until ? ` until ${p.until}` : ", until further notice"}: sign-in is refused and your trips are hidden. Reason: ${p.reason}`, "Your ongoing deals are handled by our team."],
      notice: { tone: "warning", text: `To contest, write to ${p.supportEmail}.` },
      reason: "You receive this email because a decision was made on your Yamba account.",
    },
  }),
  settingsChanged: (p) => ({
    subject: p.reset ? "Platform settings reset" : "Platform settings changed",
    content: {
      preheader: `${p.byName} ${p.reset ? "reset" : "changed"} ${p.changes.length} setting(s).`,
      title: p.reset ? "Settings reset" : "Settings changed",
      greeting: `Hello ${p.firstName},`,
      paragraphs: [
        `${p.byName} ${p.reset ? "reset to default" : "changed"} ${p.changes.length} setting(s) on ${p.at}:`,
        ...p.changes.map((c) => `• ${c.label}: ${c.before} → ${c.after}`),
        `Reason: ${p.reason}`,
        "Existing bookings do not change. If this was not you, check the admin sessions and the audit log.",
      ],
      cta: { label: "Open the settings", url: p.settingsUrl },
      reason: "You receive this email because you are a Yamba super administrator: every settings change is announced to all super administrators (D62).",
    },
  }),
  maintenanceChanged: (p) => ({
    subject: p.enabled ? "Maintenance enabled on Yamba" : p.scheduledAt ? "Maintenance scheduled on Yamba" : "Maintenance lifted on Yamba",
    content: {
      preheader: `${p.byName} changed the maintenance state.`,
      title: p.enabled ? "Platform in read-only mode" : p.scheduledAt ? "Maintenance announced" : "Back to normal",
      greeting: `Hello ${p.firstName},`,
      paragraphs: [
        p.enabled ? `${p.byName} switched the platform to read-only: members can read, no write goes through (except sign-in and the back-office).` : p.scheduledAt ? `${p.byName} announced a maintenance for ${new Date(p.scheduledAt).toLocaleString("en-GB", { timeZone: "Europe/Paris" })}: the banner is shown on both fronts.` : `${p.byName} lifted the maintenance: the platform is open to writes again.`,
        p.message ? `Displayed message: “${p.message}”` : "No custom message.",
        `Reason: ${p.reason}`,
      ],
      cta: { label: "Open the service status", url: p.statusUrl },
      reason: "You receive this email because you are a Yamba super administrator: every maintenance change is announced to all super administrators (D64).",
    },
  }),
  accountReinstated: (p) => ({
    subject: "Your Yamba account is reinstated",
    content: {
      preheader: "Everything is accessible again.",
      title: "Account reinstated",
      greeting: `Hi ${p.firstName},`,
      paragraphs: ["The restriction on your account is lifted: you can publish, book and sign in normally again."],
      reason: "You receive this email because a decision was made on your Yamba account.",
      footnotes: [`Questions? ${p.supportEmail}`],
    },
  }),
};

export const ADMIN_EMAILS: Record<SupportedLocale, AdminEmailDictionary> = { fr, en };
export function getAdminEmails(locale: string | null | undefined): AdminEmailDictionary {
  return ADMIN_EMAILS[resolveLocale(locale)] ?? ADMIN_EMAILS[DEFAULT_LOCALE];
}
export function adminRoleLabel(locale: string | null | undefined, role: string): string {
  return ADMIN_ROLE_LABELS[resolveLocale(locale)]?.[role] ?? role;
}

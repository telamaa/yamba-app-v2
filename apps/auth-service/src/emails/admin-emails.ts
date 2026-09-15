/**
 * admin-emails.ts — emails du back-office (C-PR3, D56), un dictionnaire par locale (D44)
 * =====================================================================================
 * - adminInvite         : invitation d'un nouvel administrateur (lien 48 h, mot de passe à définir)
 * - adminAccessGranted  : compte existant promu (lien de connexion admin)
 * - adminLoginAlert     : alerte à chaque ouverture de session admin (ip, appareil, date)
 * - adminRolesChanged / adminAccessRevoked : A189 c — à l'admin dont les accès changent (sécurité : un compte compromis se
 *   voit ajouter ou retirer des droits). JAMAIS de lien de connexion (on n'offre pas une porte à un compte compromis),
 *   JAMAIS le motif du retrait (texte interne).
 * - accountRestricted / accountSuspended / accountReinstated : au membre, motif GÉNÉRIQUE
 *   (jamais le contenu d'un signalement), recours par email.
 */
import type { EmailContent } from "@packages/email";
import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "@packages/api-contracts";

export type AdminEmail = { subject: string; content: EmailContent };

export type AdminInviteParams = { firstName: string; invitedBy: string; roleLabel: string; acceptUrl: string; expiresInHours: number; supportEmail: string };
export type AdminAccessGrantedParams = { firstName: string; invitedBy: string; roleLabel: string; loginUrl: string; supportEmail: string };
export type AdminLoginAlertParams = { firstName: string; at: string; ip: string; userAgent: string; sessionsUrl: string; supportEmail: string };
export type AdminRolesChangedParams = { firstName: string; changedBy: string; before: string; after: string; supportEmail: string };
export type AdminAccessRevokedParams = { firstName: string; revokedBy: string; supportEmail: string };
export type AccountStatusParams = { firstName: string; reason: string; until: string | null; supportEmail: string };
/** C-PR8a (D62 5A) — chaque modification de paramètre est annoncée à tous les SUPER_ADMIN. */
/** `kind` (A181) : la transition choisit le sujet — lever une maintenance annoncée n'est pas une maintenance planifiée. */
export type MaintenanceChangedParams = { firstName: string; byName: string; kind: "ENABLED" | "LIFTED" | "SCHEDULED" | "UNSCHEDULED" | "UPDATED"; enabled: boolean; scheduledAt: string | null; message: string; reason: string; statusUrl: string };
export type SettingsChangedParams = { firstName: string; byName: string; at: string; reason: string; changes: Array<{ label: string; before: string; after: string }>; settingsUrl: string; reset: boolean };

export type AdminEmailDictionary = {
  adminInvite(p: AdminInviteParams): AdminEmail;
  adminAccessGranted(p: AdminAccessGrantedParams): AdminEmail;
  adminLoginAlert(p: AdminLoginAlertParams): AdminEmail;
  adminRolesChanged(p: AdminRolesChangedParams): AdminEmail;
  adminAccessRevoked(p: AdminAccessRevokedParams): AdminEmail;
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
  adminRolesChanged: (p) => ({
    subject: "Tes profils sur le back-office Yamba ont changé",
    content: {
      preheader: `${p.before} → ${p.after}`,
      title: "Profils modifiés",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`${p.changedBy} a modifié tes profils sur le back-office Yamba : « ${p.before} » devient « ${p.after} ». Tes permissions suivent dès ta prochaine action.`],
      notice: { tone: "warning", text: "Si tu ne t'attendais pas à ce changement, préviens tout de suite le support : quelqu'un a peut-être accès à un compte super administrateur." },
      reason: "Tu reçois cet email à chaque changement de tes accès au back-office (sécurité).",
      footnotes: [`Signaler : ${p.supportEmail}`],
    },
  }),
  adminAccessRevoked: (p) => ({
    subject: "Ton accès au back-office Yamba a été retiré",
    content: {
      preheader: `Accès retiré par ${p.revokedBy}.`,
      title: "Accès retiré",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`${p.revokedBy} a retiré ton accès au back-office Yamba. Tes sessions admin sont fermées et ta double authentification admin est supprimée.`, "Ton compte Yamba, s'il sert aussi à envoyer ou transporter des colis, n'est pas touché."],
      notice: { tone: "info", text: "Si tu ne t'attendais pas à ce retrait, écris au support." },
      reason: "Tu reçois cet email à chaque changement de tes accès au back-office (sécurité).",
      footnotes: [`Une question ? ${p.supportEmail}`],
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
  maintenanceChanged: (p) => {
    const quand = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : null;
    const texte = {
      ENABLED: { subject: "Maintenance activée sur Yamba", title: "Plateforme en lecture seule", body: `${p.byName} a passé la plateforme en lecture seule : les membres lisent, aucune écriture ne passe (sauf connexion et back-office).` },
      LIFTED: { subject: "Maintenance levée sur Yamba", title: "Retour à la normale", body: `${p.byName} a levé la maintenance : la plateforme est de nouveau ouverte aux écritures, les bandeaux disparaissent.` },
      SCHEDULED: { subject: "Maintenance planifiée sur Yamba", title: "Maintenance annoncée", body: `${p.byName} a annoncé une maintenance pour le ${quand} : le bandeau est affiché sur les deux fronts, rien n'est bloqué.` },
      UNSCHEDULED: { subject: "Annonce de maintenance retirée sur Yamba", title: "Annonce retirée", body: `${p.byName} a retiré l'annonce de maintenance : plus aucun bandeau n'est affiché.` },
      UPDATED: { subject: "Maintenance modifiée sur Yamba", title: p.enabled ? "Lecture seule : message modifié" : "Annonce modifiée", body: p.enabled ? `${p.byName} a modifié le message de la lecture seule en cours.` : quand ? `${p.byName} a modifié l'annonce de maintenance du ${quand}.` : `${p.byName} a modifié l'état de maintenance.` },
    }[p.kind];
    return {
      subject: texte.subject,
      content: {
        preheader: `${p.byName} a modifié l'état de maintenance.`,
        title: texte.title,
        greeting: `Bonjour ${p.firstName},`,
        paragraphs: [texte.body, p.message ? `Message affiché : « ${p.message} »` : "Aucun message personnalisé.", `Motif : ${p.reason}`],
        cta: { label: "Voir l'état des services", url: p.statusUrl },
        reason: "Tu reçois cet email parce que tu es super administrateur Yamba : chaque changement d'état de maintenance est annoncé à tous les super administrateurs (D64).",
      },
    };
  },
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
  adminRolesChanged: (p) => ({
    subject: "Your Yamba back-office profiles changed",
    content: {
      preheader: `${p.before} → ${p.after}`,
      title: "Profiles changed",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`${p.changedBy} changed your Yamba back-office profiles: "${p.before}" becomes "${p.after}". Your permissions follow from your next action.`],
      notice: { tone: "warning", text: "If you did not expect this change, tell support right away: someone may have access to a super administrator account." },
      reason: "You receive this email whenever your back-office access changes (security).",
      footnotes: [`Report: ${p.supportEmail}`],
    },
  }),
  adminAccessRevoked: (p) => ({
    subject: "Your Yamba back-office access was removed",
    content: {
      preheader: `Access removed by ${p.revokedBy}.`,
      title: "Access removed",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`${p.revokedBy} removed your access to the Yamba back-office. Your admin sessions are closed and your admin two-factor authentication is deleted.`, "Your Yamba account, if you also use it to send or carry parcels, is not affected."],
      notice: { tone: "info", text: "If you did not expect this, write to support." },
      reason: "You receive this email whenever your back-office access changes (security).",
      footnotes: [`Any question? ${p.supportEmail}`],
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
  maintenanceChanged: (p) => {
    const when = p.scheduledAt ? new Date(p.scheduledAt).toLocaleString("en-GB", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }) : null;
    const text = {
      ENABLED: { subject: "Maintenance enabled on Yamba", title: "Platform in read-only mode", body: `${p.byName} switched the platform to read-only: members can read, no write goes through (except sign-in and the back-office).` },
      LIFTED: { subject: "Maintenance lifted on Yamba", title: "Back to normal", body: `${p.byName} lifted the maintenance: the platform is open to writes again, the banners disappear.` },
      SCHEDULED: { subject: "Maintenance scheduled on Yamba", title: "Maintenance announced", body: `${p.byName} announced a maintenance for ${when}: the banner is shown on both fronts, nothing is blocked.` },
      UNSCHEDULED: { subject: "Maintenance announcement withdrawn on Yamba", title: "Announcement withdrawn", body: `${p.byName} withdrew the maintenance announcement: no banner is shown any more.` },
      UPDATED: { subject: "Maintenance updated on Yamba", title: p.enabled ? "Read-only: message updated" : "Announcement updated", body: p.enabled ? `${p.byName} updated the message of the ongoing read-only mode.` : when ? `${p.byName} updated the maintenance announcement for ${when}.` : `${p.byName} changed the maintenance state.` },
    }[p.kind];
    return {
      subject: text.subject,
      content: {
        preheader: `${p.byName} changed the maintenance state.`,
        title: text.title,
        greeting: `Hello ${p.firstName},`,
        paragraphs: [text.body, p.message ? `Displayed message: “${p.message}”` : "No custom message.", `Reason: ${p.reason}`],
        cta: { label: "Open the service status", url: p.statusUrl },
        reason: "You receive this email because you are a Yamba super administrator: every maintenance change is announced to all super administrators (D64).",
      },
    };
  },
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

/**
 * ANO-ADM-53 (recette 02-ADMIN § 5.20) — la valeur d'un paramètre dans l'email aux super administrateurs, dans la langue du
 * destinataire. L'email français annonçait « 48 hours → 50 hours » et « 3.00 € » : l'unité brute du catalogue et le point
 * décimal anglais. Même règle d'affichage que l'écran (`apps/admin-ui/src/lib/settings-format.ts`).
 */
const SETTING_UNIT_SUFFIX: Record<SupportedLocale, Record<string, string>> = {
  fr: { kg: "kg", hours: "h", days: "j", minutes: "min", mb: "Mo" },
  en: { kg: "kg", hours: "h", days: "d", minutes: "min", mb: "MB" },
};
export function formatSettingValue(locale: string | null | undefined, unit: string, value: number): string {
  const loc = resolveLocale(locale);
  const tag = loc === "fr" ? "fr-FR" : "en-GB";
  const n = (v: number, digits?: number) => v.toLocaleString(tag, digits === undefined ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits });
  switch (unit) {
    case "cents": return `${n(value / 100, 2)} €`;
    case "percent": return loc === "fr" ? `${n(value)} %` : `${n(value)}%`;
    case "coef": return `× ${n(value)}`;
    case "rating": return `${n(value)} / 5`;
    case "count": return n(value);
    default: return SETTING_UNIT_SUFFIX[loc][unit] ? `${n(value)} ${SETTING_UNIT_SUFFIX[loc][unit]}` : n(value);
  }
}

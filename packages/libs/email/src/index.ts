/**
 * @packages/email — couche d'envoi transactionnelle partagée (D41)
 * ================================================================
 * Née « au 1er email B2 » (handoff PR-A) pour éviter le 3e clone
 * Nodemailer+EJS (auth-service et trip-service en portent déjà un
 * chacun — leur migration est au backlog §7.2).
 *
 * Contrat volontairement minimal : un FOURNISSEUR (D35 : Resend, SMTP ou
 * faux — `provider.ts`) derrière une interface, un rendu EJS par fichier.
 * Les appelants et les gabarits ne connaissent pas le fournisseur.
 *
 * Transport PARESSEUX : créé au premier envoi, jamais à l'import —
 * un service qui n'envoie pas d'email ne paie rien, et les tests
 * mockent le module sans jamais toucher au réseau.
 */
import { createEmailProviderFromEnv, type EmailProvider, type SendResult } from "./provider";
export * from "./provider";
export * from "./webhook";
import ejs from "ejs";
import path from "path";
import { LAYOUT_EJS, NOTICE_STYLES, type EmailContent } from "./layout";

export type { EmailContent, EmailNoticeTone } from "./layout";

let provider: EmailProvider | null = null;
/** Le fournisseur (D35 2A), créé au premier envoi ; `setEmailProvider` pour les tests. */
export function getEmailProvider(): EmailProvider {
  if (!provider) provider = createEmailProviderFromEnv();
  return provider;
}
export function setEmailProvider(p: EmailProvider | null): void {
  provider = p;
}

/** Vrai si le transport SMTP est configuré — les appelants best-effort
 *  (dispatcher notification-service, A36) sautent l'envoi sinon. */
export function isEmailConfigured(): boolean {
  try {
    return Boolean(getEmailProvider()); // D35 : FAKE compte comme configuré hors production (les flux jouent, les envois se lisent en mémoire)
  } catch {
    return false;
  }
}

export type TemplatedEmail = {
  to: string;
  subject: string;
  /** Racine des gabarits du service appelant (chaque service garde les siens). */
  templatesDir: string;
  /** Chemin du gabarit relatif à templatesDir, sans « .ejs ». */
  template: string;
  data: Record<string, unknown>;
};

export async function sendTemplatedEmail(email: TemplatedEmail & { tags?: Record<string, string>; idempotencyKey?: string }): Promise<SendResult> {
  const templatePath = path.join(email.templatesDir, `${email.template}.ejs`);
  const html = await ejs.renderFile(templatePath, email.data, { async: true });
  return getEmailProvider().send({ from: getFromAddress(), to: email.to, subject: email.subject, html, tags: { template: email.template, ...(email.tags ?? {}) }, idempotencyKey: email.idempotencyKey });
}

/**
 * Expéditeur affiché : `SMTP_FROM` complet si présent, sinon
 * `SMTP_FROM_NAME <SMTP_USER>` (recette 03/09 : `SMTP_FROM_NAME` était posé
 * dans le .env mais jamais lu par cette lib).
 */
export function getFromAddress(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM; // D35 : indépendant du fournisseur
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  const name = process.env.SMTP_FROM_NAME || "Yamba";
  const address = process.env.SMTP_USER || "no-reply@yamba.app";
  return `${name} <${address}>`;
}

/* ══ D44 ④ — gabarit unique, emails = données ═══════════════════ */

export type TransactionalEmail = {
  to: string;
  /** D35 : étiquettes de rapprochement et clé d'idempotence (jamais de donnée personnelle). */
  tags?: Record<string, string>;
  idempotencyKey?: string;
  /** Locale du DESTINATAIRE (jamais de l'acteur) — déjà résolue. */
  locale: string;
  subject: string;
  content: EmailContent;
};

/** Rend le gabarit partagé (pur : pas de réseau, pas de disque). */
export function renderTransactionalEmail(email: Pick<TransactionalEmail, "locale" | "subject" | "content">): string {
  const noticeStyle = email.content.notice ? NOTICE_STYLES[email.content.notice.tone] : null;
  return ejs.render(LAYOUT_EJS, {
    locale: email.locale,
    subject: email.subject,
    content: email.content,
    noticeStyle,
    year: new Date().getFullYear(),
  });
}

/** Envoie un email rendu par le gabarit partagé. */
export async function sendTransactionalEmail(email: TransactionalEmail): Promise<SendResult> {
  const html = renderTransactionalEmail(email);
  return getEmailProvider().send({ from: getFromAddress(), to: email.to, subject: email.subject, html, tags: email.tags, idempotencyKey: email.idempotencyKey });
}

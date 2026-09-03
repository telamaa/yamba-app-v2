/**
 * @packages/email — couche d'envoi transactionnelle partagée (D41)
 * ================================================================
 * Née « au 1er email B2 » (handoff PR-A) pour éviter le 3e clone
 * Nodemailer+EJS (auth-service et trip-service en portent déjà un
 * chacun — leur migration est au backlog §7.2).
 *
 * Contrat volontairement minimal : un transport SMTP par env, un
 * rendu EJS par fichier, rien de plus. Le provider transactionnel
 * dédié (Resend/Postmark/SES — candidat D35) se branchera DERRIÈRE
 * cette interface sans toucher aux appelants ni aux gabarits.
 *
 * Transport PARESSEUX : créé au premier envoi, jamais à l'import —
 * un service qui n'envoie pas d'email ne paie rien, et les tests
 * mockent le module sans jamais toucher au réseau.
 */
import nodemailer, { type Transporter } from "nodemailer";
import ejs from "ejs";
import path from "path";
import { LAYOUT_EJS, NOTICE_STYLES, type EmailContent } from "./layout";

export type { EmailContent, EmailNoticeTone } from "./layout";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      // Port 465 = SSL implicite (secure=true), 587 = STARTTLS (secure=false)
      secure: port === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

/** Vrai si le transport SMTP est configuré — les appelants best-effort
 *  (dispatcher notification-service, A36) sautent l'envoi sinon. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER);
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

export async function sendTemplatedEmail(email: TemplatedEmail): Promise<void> {
  const templatePath = path.join(email.templatesDir, `${email.template}.ejs`);
  const html = await ejs.renderFile(templatePath, email.data, { async: true });

  await getTransporter().sendMail({
    from: getFromAddress(),
    to: email.to,
    subject: email.subject,
    html,
  });
}

/**
 * Expéditeur affiché : `SMTP_FROM` complet si présent, sinon
 * `SMTP_FROM_NAME <SMTP_USER>` (recette 03/09 : `SMTP_FROM_NAME` était posé
 * dans le .env mais jamais lu par cette lib).
 */
export function getFromAddress(): string {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  const name = process.env.SMTP_FROM_NAME || "Yamba";
  const address = process.env.SMTP_USER || "no-reply@yamba.app";
  return `${name} <${address}>`;
}

/* ══ D44 ④ — gabarit unique, emails = données ═══════════════════ */

export type TransactionalEmail = {
  to: string;
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
export async function sendTransactionalEmail(email: TransactionalEmail): Promise<void> {
  const html = renderTransactionalEmail(email);
  await getTransporter().sendMail({
    from: getFromAddress(),
    to: email.to,
    subject: email.subject,
    html,
  });
}

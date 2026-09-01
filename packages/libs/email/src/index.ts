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
    from: process.env.SMTP_FROM ?? "Yamba <no-reply@yamba.app>",
    to: email.to,
    subject: email.subject,
    html,
  });
}

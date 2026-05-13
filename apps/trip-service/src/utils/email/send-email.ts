import nodemailer from "nodemailer";
import ejs from "ejs";
import path from "path";

// ─── Transport singleton ──────────────────────
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 587);
// Port 465 = SSL implicite (secure=true), 587 = STARTTLS (secure=false)
const SMTP_SECURE = SMTP_PORT === 465;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM_EMAIL = process.env.SMTP_FROM ?? "Yamba <no-reply@yamba.app>";

const TEMPLATES_DIR = path.join(
  process.cwd(),
  "apps/trip-service/src/utils/templates"
);

/**
 * Envoie un email à partir d'un template EJS.
 *
 * @param to       Destinataire
 * @param subject  Sujet
 * @param template Chemin du template relatif à templates/ (sans .ejs)
 *                 ex: "trip-notifications/trip-published"
 * @param data     Variables à injecter dans le template
 */
export async function sendEmail(
  to: string,
  subject: string,
  template: string,
  data: Record<string, unknown>
): Promise<void> {
  const templatePath = path.join(TEMPLATES_DIR, `${template}.ejs`);

  const html = await ejs.renderFile(templatePath, data, { async: true });

  await transporter.sendMail({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });
}

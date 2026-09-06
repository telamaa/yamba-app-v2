/**
 * send-email.ts — les emails du trip-service passent par la lib partagée (D35 5A)
 * ==============================================================================
 * Le transport Nodemailer dupliqué a disparu : `sendTemplatedEmail` (@packages/email) rend le
 * gabarit EJS de ce service et l'envoie par le fournisseur choisi (Resend, SMTP, faux).
 * Les gabarits restent ici (dette D44 : ternaires FR/EN) ; seule la signature est conservée.
 */
import path from "path";
import { sendTemplatedEmail } from "@packages/email";

const TEMPLATES_DIR = path.join(process.cwd(), "apps/trip-service/src/utils/templates");

/**
 * Envoie un email à partir d'un template EJS.
 * @param template Chemin relatif à templates/ (sans .ejs), ex. "trip-notifications/trip-published"
 */
export async function sendEmail(to: string, subject: string, template: string, data: Record<string, unknown>): Promise<void> {
  await sendTemplatedEmail({ to, subject, templatesDir: TEMPLATES_DIR, template, data, tags: { service: "trip-service" } });
}

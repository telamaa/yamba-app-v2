/**
 * send-auth-email.ts — envoi best-effort des emails de l'auth-service
 * ==================================================================
 * Remplace l'ancien `utils/sendMail` (Nodemailer + EJS locaux, sujets en
 * dur) par le gabarit partagé de `@packages/email` (D44 ④). Le transport
 * SMTP est celui du `.env` racine (`SMTP_*`), créé paresseusement.
 *
 * Best-effort conservé : un échec SMTP est loggé, jamais propagé — un
 * utilisateur qui ne reçoit pas son code utilise « Renvoyer le code ».
 */
import { isEmailConfigured, sendTransactionalEmail } from "@packages/email";
import { resolveLocale } from "@packages/api-contracts";
import type { AuthEmail } from "./auth-emails";

export async function sendAuthEmail(
  to: string,
  locale: string | null | undefined,
  email: AuthEmail
): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[auth-email] SMTP not configured — "${email.subject}" to ${to} skipped`);
    return false;
  }
  try {
    await sendTransactionalEmail({
      to,
      locale: resolveLocale(locale),
      subject: email.subject,
      content: email.content,
    });
    return true;
  } catch (error) {
    console.error(`[auth-email] Failed to send "${email.subject}" to ${to}:`, error);
    return false;
  }
}

/**
 * carrier-mailer.ts — l'email d'administration au Voyageur (billet, masquage), sans ignorer D35
 * ============================================================================================
 * ANO-ADM-10 (recette 02-ADMIN § 5.5) : `emailCarrier` d'`admin-trips.controller.ts` lisait le compte
 * sans `isDeleted` ni `emailSuppressedAt` — un Voyageur dont l'adresse avait rebondi dur recevait
 * quand même « Billet vérifié », « Ton trajet est masqué »… Ce module applique la règle partagée
 * `canReceiveEmail` et dit POURQUOI rien n'est parti (journal du service, jamais muet).
 */
import type { EmailContent } from "@packages/email";
import { canReceiveEmail } from "@packages/email";
import { resolveLocale } from "@packages/api-contracts";

export type CarrierRecipient = { firstName: string; email: string; preferredLocale: string | null; isDeleted: boolean | null; emailSuppressedAt: Date | null };
export type CarrierMail = { subject: string; content: EmailContent };
export type CarrierMailOutcome = "SENT" | "NOT_CONFIGURED" | "NO_ACCOUNT" | "UNREACHABLE" | "FAILED";

export function makeCarrierMailer(deps: {
  isConfigured: () => boolean;
  findUser: (userId: string) => Promise<CarrierRecipient | null>;
  send: (mail: { to: string; locale: string; subject: string; content: EmailContent }) => Promise<unknown>;
  log?: (message: string) => void;
}) {
  return async function emailCarrier(userId: string, build: (locale: string, u: { firstName: string; email: string }) => CarrierMail): Promise<CarrierMailOutcome> {
    if (!deps.isConfigured()) return "NOT_CONFIGURED";
    const u = await deps.findUser(userId);
    if (!u) return "NO_ACCOUNT";
    if (!canReceiveEmail(u)) {
      // D35 4A : compte effacé ou adresse sur la liste de suppression — rien ne part, et on le dit.
      deps.log?.(`[admin-trips] email non envoyé au compte ${userId} : ${u.isDeleted ? "compte effacé" : "adresse sur la liste de suppression"} (D35)`);
      return "UNREACHABLE";
    }
    const locale = resolveLocale(u.preferredLocale);
    const mail = build(locale, u);
    try {
      await deps.send({ to: u.email, locale, subject: mail.subject, content: mail.content });
      return "SENT";
    } catch (err) {
      // Best effort, mais JAMAIS muet : un email métier qui ne part pas se lit dans les journaux (recette 5.8).
      deps.log?.(`[admin-trips] email « ${mail.subject} » non envoyé à ${u.email} : ${err instanceof Error ? err.message : String(err)}`);
      return "FAILED";
    }
  };
}

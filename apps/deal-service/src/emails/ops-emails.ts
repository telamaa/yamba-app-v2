/**
 * ops-emails.ts — emails d'exploitation du deal-service, en DONNÉES (D44)
 * ======================================================================
 * Deux emails hors événement de booking (donc hors notification-service) :
 *  - `payoutFailedCarrier` : la banque du Voyageur a refusé le virement
 *    (webhook Connect `payout.failed`, A87) — bouton vers Finances (puis
 *    son tableau de bord Stripe pour le RIB), copie calme, jamais le
 *    message brut de la banque.
 *  - `opsDigest` : récapitulatif quotidien à l'adresse support (A88) —
 *    versements en échec depuis > 24 h, transferts renversés, retenues
 *    « à arbitrer ». Filet de sécurité avant l'admin (chantier C).
 */
import type { EmailContent } from "@packages/email";
import type { SupportedLocale } from "@packages/api-contracts";

export type OpsEmail = { subject: string; content: EmailContent };

export type PayoutFailedParams = { firstName: string; financesUrl: string };
export type OpsDigestLine = { label: string; amount: string; since: string; url: string };
export type OpsDigestParams = { date: string; failed: OpsDigestLine[]; reversed: OpsDigestLine[]; held: OpsDigestLine[]; appUrl: string };
export type OpsAlertsParams = { date: string; alerts: Array<{ title: string; detail: string; url: string }>; adminUrl: string };

type Dictionary = {
  payoutFailedCarrier(p: PayoutFailedParams): OpsEmail;
  opsDigest(p: OpsDigestParams): OpsEmail;
  /** C-PR6b (D59 3A) — alertes de seuil nouvelles du jour, une par ligne avec le lien admin */
  opsAlerts(p: OpsAlertsParams): OpsEmail;
};

const fr: Dictionary = {
  payoutFailedCarrier: (p) => ({
    subject: "Ton virement bancaire n'a pas abouti",
    content: {
      preheader: "Ta banque a refusé le virement Yamba : vérifie ton RIB sur Stripe.",
      title: "Ton virement n'a pas abouti",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [
        "Ta banque a refusé le virement de tes gains Yamba. Le plus souvent, c'est un RIB incomplet ou un compte fermé.",
        "Vérifie tes coordonnées bancaires depuis Finances → « Voir mes virements sur Stripe » : le virement sera relancé automatiquement dès qu'elles seront à jour. Ton argent reste sur ton compte de paiement, rien n'est perdu.",
      ],
      notice: { tone: "warning", text: "Aucune action de notre côté n'est possible sans un RIB valide." },
      cta: { label: "Vérifier mon RIB", url: p.financesUrl },
      reason: "Tu reçois cet email parce qu'un virement de tes gains Yamba a été refusé par ta banque.",
    },
  }),
  opsDigest: (p) => {
    const lines = (title: string, items: OpsDigestLine[]) =>
      items.length ? [`${title} (${items.length})`, ...items.map((l) => `• ${l.label} — ${l.amount} — depuis le ${l.since} — ${l.url}`)] : [`${title} : aucun`];
    return {
      subject: `Yamba — argent à surveiller (${p.date})`,
      content: {
        preheader: `${p.failed.length} versement(s) en échec, ${p.reversed.length} renversé(s), ${p.held.length} retenue(s) à arbitrer.`,
        title: "Argent à surveiller",
        greeting: "Bonjour,",
        paragraphs: [
          ...lines("Versements en échec depuis plus de 24 h", p.failed),
          ...lines("Transferts renversés par Stripe", p.reversed),
          ...lines("Retenues d'annulation à arbitrer", p.held),
        ],
        cta: { label: "Ouvrir l'application", url: p.appUrl },
        reason: "Récapitulatif quotidien du deal-service (A88) — désactivable avec OPS_DIGEST_CRON_ENABLED=false.",
      },
    };
  },
  opsAlerts: (p) => ({
    subject: `Yamba — ${p.alerts.length} alerte(s) (${p.date})`,
    content: {
      preheader: p.alerts.map((a) => a.title).join(" · "),
      title: "Alertes de seuil",
      greeting: "Bonjour,",
      paragraphs: p.alerts.map((a) => `• ${a.title} — ${a.detail} — ${a.url}`),
      notice: { tone: "warning", text: "Chaque alerte n'est envoyée qu'une fois par jour ; l'accueil admin la montre tant qu'elle est active." },
      cta: { label: "Ouvrir l'admin", url: p.adminUrl },
      reason: "Cron horaire du deal-service (C-PR6b) — désactivable avec OPS_ALERTS_CRON_ENABLED=false.",
    },
  }),
};

const en: Dictionary = {
  payoutFailedCarrier: (p) => ({
    subject: "Your bank transfer did not go through",
    content: {
      preheader: "Your bank refused the Yamba transfer: check your bank details on Stripe.",
      title: "Your transfer did not go through",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [
        "Your bank refused the transfer of your Yamba earnings. Most of the time it is an incomplete bank account number or a closed account.",
        "Check your bank details from Finances → “View my payouts on Stripe”: the transfer will be retried automatically once they are up to date. Your money stays on your payment account, nothing is lost.",
      ],
      notice: { tone: "warning", text: "Nothing can be done on our side without valid bank details." },
      cta: { label: "Check my bank details", url: p.financesUrl },
      reason: "You are receiving this email because a transfer of your Yamba earnings was refused by your bank.",
    },
  }),
  opsDigest: (p) => {
    const lines = (title: string, items: OpsDigestLine[]) =>
      items.length ? [`${title} (${items.length})`, ...items.map((l) => `• ${l.label} — ${l.amount} — since ${l.since} — ${l.url}`)] : [`${title}: none`];
    return {
      subject: `Yamba — money to watch (${p.date})`,
      content: {
        preheader: `${p.failed.length} failed payout(s), ${p.reversed.length} reversed, ${p.held.length} retention(s) to arbitrate.`,
        title: "Money to watch",
        greeting: "Hello,",
        paragraphs: [
          ...lines("Payouts failed for more than 24h", p.failed),
          ...lines("Transfers reversed by Stripe", p.reversed),
          ...lines("Cancellation retentions to arbitrate", p.held),
        ],
        cta: { label: "Open the app", url: p.appUrl },
        reason: "Daily deal-service digest (A88) — disable with OPS_DIGEST_CRON_ENABLED=false.",
      },
    };
  },
  opsAlerts: (p) => ({
    subject: `Yamba — ${p.alerts.length} alert(s) (${p.date})`,
    content: {
      preheader: p.alerts.map((a) => a.title).join(" · "),
      title: "Threshold alerts",
      greeting: "Hello,",
      paragraphs: p.alerts.map((a) => `• ${a.title} — ${a.detail} — ${a.url}`),
      notice: { tone: "warning", text: "Each alert is sent once a day; the admin home shows it while it stays active." },
      cta: { label: "Open the admin", url: p.adminUrl },
      reason: "Hourly cron of the deal-service (C-PR6b) — disable with OPS_ALERTS_CRON_ENABLED=false.",
    },
  }),
};

export const OPS_EMAILS: Record<SupportedLocale, Dictionary> = { fr, en };

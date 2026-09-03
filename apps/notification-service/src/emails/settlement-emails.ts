/**
 * settlement-emails.ts — les emails B4 « argent sortant », en DONNÉES, par langue (D44/D52)
 * ==========================================================================================
 * Emplacement : apps/notification-service/src/emails/settlement-emails.ts
 *
 * Un dictionnaire par locale supportée ; chaque entrée est une fonction
 * (paramètres → sujet + contenu) rendue par le gabarit partagé de
 * `@packages/email` (`sendTransactionalEmail`). Ajouter une langue = une
 * clé dans SETTLEMENT_EMAILS (tsc casse si une entrée manque).
 *
 * Registre de marque (D45) : tutoiement, prénom réel, « Voyageur » /
 * « Expéditeur » en repli quand la contrepartie est effacée, aucun emoji
 * dans les sujets. Décisions utilisateur 03/09 : copie honnête sur le
 * versement (« parti vers ton compte, 2 à 7 jours »), aucun bouton
 * « Noter » avant B5, ton calme pour le Voyageur d'un deal disputé, et la
 * catégorie du litige lui est dite (jamais le dossier).
 */
import type { EmailContent } from "@packages/email";
import type { DisputeCategory, SupportedLocale } from "@packages/api-contracts";

export type SettlementEmail = { subject: string; content: EmailContent };

type Base = {
  firstName: string;
  /** Prénom de l'AUTRE partie — null si compte effacé (le texte replie sur le rôle). */
  counterpartFirstName: string | null;
  route: string;
  ctaUrl: string;
};
export type CompletedParams = Base & { weightKg: number; transport: string; completedBy: "SHIPPER" | "SYSTEM" };
export type PayoutSentParams = Base & { amount: string };
export type DisputedShipperParams = Base & { ticketNumber: string; supportEmail: string };
export type DisputedCarrierParams = Base & { ticketNumber: string; disputeCategory: DisputeCategory | null; supportEmail: string };
export type VerificationReminderParams = Base & { payoutDueAt: string; transport: string };

export type SettlementEmailDictionary = {
  completedShipper(p: CompletedParams): SettlementEmail;
  payoutSentCarrier(p: PayoutSentParams): SettlementEmail;
  disputedShipper(p: DisputedShipperParams): SettlementEmail;
  disputedCarrier(p: DisputedCarrierParams): SettlementEmail;
  verificationReminderShipper(p: VerificationReminderParams): SettlementEmail;
};

const DISPUTE_CATEGORY_LABELS: Record<SupportedLocale, Record<DisputeCategory, string>> = {
  fr: {
    NOT_DELIVERED: "colis non livré",
    CONTENT_MISSING: "contenu manquant",
    DAMAGED: "colis endommagé",
    SIGNIFICANT_DELAY: "retard important",
    RECIPIENT_ISSUE: "problème avec le destinataire",
    OTHER: "autre motif",
  },
  en: {
    NOT_DELIVERED: "parcel not delivered",
    CONTENT_MISSING: "missing content",
    DAMAGED: "damaged parcel",
    SIGNIFICANT_DELAY: "significant delay",
    RECIPIENT_ISSUE: "issue with the recipient",
    OTHER: "other reason",
  },
};

export function disputeCategoryLabel(locale: SupportedLocale, category: DisputeCategory | null): string | null {
  return category ? DISPUTE_CATEGORY_LABELS[locale][category] : null;
}

const fr: SettlementEmailDictionary = {
  completedShipper: (p) => {
    const carrier = p.counterpartFirstName ?? "ton Voyageur";
    return {
      subject: `Transaction terminée pour ton envoi ${p.route}`,
      content: {
        preheader: `Le paiement de ${carrier} est libéré — merci d'avoir fait confiance à Yamba.`,
        title: "Transaction terminée",
        greeting: `Bonjour ${p.firstName},`,
        paragraphs: [
          p.completedBy === "SHIPPER"
            ? `Tu as confirmé la bonne réception de ton colis ${p.route} (${p.weightKg} kg). Le paiement de ${carrier} (${p.transport}) est libéré.`
            : `La période de vérification de ton colis ${p.route} (${p.weightKg} kg) est terminée sans signalement de ta part. Le paiement de ${carrier} (${p.transport}) est libéré automatiquement.`,
          "Cette transaction est maintenant close : il n'est plus possible d'ouvrir un signalement.",
        ],
        cta: { label: "Voir mon envoi", url: p.ctaUrl },
        footnotes: ["Tu pourras bientôt laisser une note à ton Voyageur depuis ton suivi."],
        reason: "Tu reçois cet email parce que ton envoi Yamba vient d'être clôturé.",
      },
    };
  },
  payoutSentCarrier: (p) => {
    const shipper = p.counterpartFirstName ?? "l'Expéditeur";
    return {
      subject: `${p.amount} en route vers ton compte pour ${p.route}`,
      content: {
        preheader: `Ton paiement pour le colis de ${shipper} est parti.`,
        title: "Ton paiement est parti",
        greeting: `Bonjour ${p.firstName},`,
        paragraphs: [
          `Le transport ${p.route} pour ${shipper} est terminé : ${p.amount} viennent d'être envoyés vers ton compte de paiement.`,
          "Selon ta banque, la somme apparaît sur ton compte bancaire sous 2 à 7 jours. Rien à faire de ton côté.",
        ],
        cta: { label: "Voir le deal", url: p.ctaUrl },
        footnotes: ["Le détail de tes versements est disponible dans ton espace de paiement Stripe."],
        reason: "Tu reçois cet email parce qu'un versement Yamba vient d'être émis vers ton compte.",
      },
    };
  },
  disputedShipper: (p) => {
    const carrier = p.counterpartFirstName ?? "ton Voyageur";
    return {
      subject: `Signalement ${p.ticketNumber} enregistré pour ton envoi ${p.route}`,
      content: {
        preheader: `Ton dossier ${p.ticketNumber} est ouvert — le paiement est gelé pendant l'examen.`,
        title: "Ton signalement est enregistré",
        greeting: `Bonjour ${p.firstName},`,
        paragraphs: [
          `Nous avons bien reçu ton signalement concernant le colis ${p.route}. Ton numéro de dossier est ${p.ticketNumber} : garde-le pour tout échange avec nous.`,
          `Le paiement de ${carrier} est gelé pendant toute la durée de l'examen. Nous te répondons sous 48 h ouvrées, puis nous recueillons la version de ${carrier} avant de décider sous 5 jours ouvrés.`,
        ],
        notice: { tone: "info", text: `Dossier ${p.ticketNumber} — un signalement est définitif : il ne peut plus être modifié.` },
        cta: { label: "Voir mon envoi", url: p.ctaUrl },
        footnotes: [`Une question sur ton dossier ? Écris-nous à ${p.supportEmail} en rappelant le numéro ${p.ticketNumber}.`],
        reason: "Tu reçois cet email parce que tu as ouvert un signalement sur un envoi Yamba.",
      },
    };
  },
  disputedCarrier: (p) => {
    const shipper = p.counterpartFirstName ?? "l'Expéditeur";
    const label = disputeCategoryLabel("fr", p.disputeCategory);
    return {
      subject: `Un signalement a été ouvert sur ton transport ${p.route}`,
      content: {
        preheader: `Dossier ${p.ticketNumber} — ton paiement est mis en attente le temps de l'examen.`,
        title: "Un signalement a été ouvert",
        greeting: `Bonjour ${p.firstName},`,
        paragraphs: [
          `${shipper} a ouvert un signalement sur le colis ${p.route}${label ? ` (motif : ${label})` : ""}. Le dossier porte le numéro ${p.ticketNumber}.`,
          "Ton paiement pour ce transport est mis en attente pendant l'examen. Ce n'est pas une décision : nous allons te contacter pour recueillir ta version et tes éléments (photos de prise en charge, échanges).",
          "Nous décidons sous 5 jours ouvrés après avoir entendu les deux parties.",
        ],
        notice: { tone: "info", text: `Dossier ${p.ticketNumber} — garde ce numéro pour nos échanges.` },
        cta: { label: "Voir le deal", url: p.ctaUrl },
        footnotes: [`Tu peux nous écrire dès maintenant à ${p.supportEmail} en rappelant le numéro ${p.ticketNumber}.`],
        reason: "Tu reçois cet email parce qu'un signalement concerne un transport que tu as effectué avec Yamba.",
      },
    };
  },
  verificationReminderShipper: (p) => {
    const carrier = p.counterpartFirstName ?? "ton Voyageur";
    return {
      subject: `Dernier jour pour vérifier ton colis ${p.route}`,
      content: {
        preheader: `Sans action de ta part, le paiement de ${carrier} sera libéré le ${p.payoutDueAt}.`,
        title: "Dernier jour pour vérifier",
        greeting: `Bonjour ${p.firstName},`,
        paragraphs: [
          `Ton colis ${p.route} a été remis il y a trois jours. Si tout va bien, tu n'as rien à faire : le paiement de ${carrier} (${p.transport}) sera libéré automatiquement le ${p.payoutDueAt}.`,
          "Si quelque chose ne va pas (contenu manquant, colis abîmé), signale-le avant cette date depuis ton suivi. Passé ce délai, la transaction sera close.",
        ],
        cta: { label: "Vérifier ma livraison", url: p.ctaUrl },
        footnotes: ["Conseil : demande au destinataire d'ouvrir le colis avant de confirmer."],
        reason: "Tu reçois cet email parce que la période de vérification de ton envoi Yamba se termine demain.",
      },
    };
  },
};

const en: SettlementEmailDictionary = {
  completedShipper: (p) => {
    const carrier = p.counterpartFirstName ?? "your carrier";
    return {
      subject: `Transaction completed for your shipment ${p.route}`,
      content: {
        preheader: `${carrier}'s payment has been released — thank you for trusting Yamba.`,
        title: "Transaction completed",
        greeting: `Hi ${p.firstName},`,
        paragraphs: [
          p.completedBy === "SHIPPER"
            ? `You confirmed the safe receipt of your parcel ${p.route} (${p.weightKg} kg). ${carrier}'s payment (${p.transport}) has been released.`
            : `The verification period for your parcel ${p.route} (${p.weightKg} kg) ended without a report from you. ${carrier}'s payment (${p.transport}) has been released automatically.`,
          "This transaction is now closed: it is no longer possible to open a report.",
        ],
        cta: { label: "View my shipment", url: p.ctaUrl },
        footnotes: ["You will soon be able to rate your carrier from your tracking page."],
        reason: "You are receiving this email because your Yamba shipment has just been closed.",
      },
    };
  },
  payoutSentCarrier: (p) => {
    const shipper = p.counterpartFirstName ?? "the shipper";
    return {
      subject: `${p.amount} on its way to your account for ${p.route}`,
      content: {
        preheader: `Your payment for ${shipper}'s parcel has been sent.`,
        title: "Your payment is on its way",
        greeting: `Hi ${p.firstName},`,
        paragraphs: [
          `The transport ${p.route} for ${shipper} is complete: ${p.amount} has just been sent to your payment account.`,
          "Depending on your bank, the money shows up on your bank account within 2 to 7 days. Nothing to do on your side.",
        ],
        cta: { label: "View the deal", url: p.ctaUrl },
        footnotes: ["The details of your payouts are available in your Stripe payment dashboard."],
        reason: "You are receiving this email because a Yamba payout has just been issued to your account.",
      },
    };
  },
  disputedShipper: (p) => {
    const carrier = p.counterpartFirstName ?? "your carrier";
    return {
      subject: `Report ${p.ticketNumber} received for your shipment ${p.route}`,
      content: {
        preheader: `Your case ${p.ticketNumber} is open — the payment is frozen during the review.`,
        title: "Your report has been received",
        greeting: `Hi ${p.firstName},`,
        paragraphs: [
          `We have received your report about the parcel ${p.route}. Your case number is ${p.ticketNumber}: keep it for any exchange with us.`,
          `${carrier}'s payment is frozen for the whole duration of the review. We get back to you within 48 business hours, then collect ${carrier}'s side before deciding within 5 business days.`,
        ],
        notice: { tone: "info", text: `Case ${p.ticketNumber} — a report is final: it can no longer be edited.` },
        cta: { label: "View my shipment", url: p.ctaUrl },
        footnotes: [`A question about your case? Write to ${p.supportEmail} quoting ${p.ticketNumber}.`],
        reason: "You are receiving this email because you opened a report on a Yamba shipment.",
      },
    };
  },
  disputedCarrier: (p) => {
    const shipper = p.counterpartFirstName ?? "the shipper";
    const label = disputeCategoryLabel("en", p.disputeCategory);
    return {
      subject: `A report has been opened on your transport ${p.route}`,
      content: {
        preheader: `Case ${p.ticketNumber} — your payment is on hold while we review.`,
        title: "A report has been opened",
        greeting: `Hi ${p.firstName},`,
        paragraphs: [
          `${shipper} opened a report on the parcel ${p.route}${label ? ` (reason: ${label})` : ""}. The case number is ${p.ticketNumber}.`,
          "Your payment for this transport is on hold during the review. This is not a decision: we will contact you to collect your side and your evidence (pickup photos, exchanges).",
          "We decide within 5 business days after hearing both parties.",
        ],
        notice: { tone: "info", text: `Case ${p.ticketNumber} — keep this number for our exchanges.` },
        cta: { label: "View the deal", url: p.ctaUrl },
        footnotes: [`You can write to us right away at ${p.supportEmail} quoting ${p.ticketNumber}.`],
        reason: "You are receiving this email because a report concerns a transport you carried out with Yamba.",
      },
    };
  },
  verificationReminderShipper: (p) => {
    const carrier = p.counterpartFirstName ?? "your carrier";
    return {
      subject: `Last day to check your parcel ${p.route}`,
      content: {
        preheader: `Without action from you, ${carrier}'s payment will be released on ${p.payoutDueAt}.`,
        title: "Last day to check",
        greeting: `Hi ${p.firstName},`,
        paragraphs: [
          `Your parcel ${p.route} was handed over three days ago. If all is well, there is nothing to do: ${carrier}'s payment (${p.transport}) will be released automatically on ${p.payoutDueAt}.`,
          "If something is wrong (missing content, damaged parcel), report it before that date from your tracking page. After that, the transaction will be closed.",
        ],
        cta: { label: "Review my delivery", url: p.ctaUrl },
        footnotes: ["Tip: ask the recipient to open the parcel before you confirm."],
        reason: "You are receiving this email because the verification period of your Yamba shipment ends tomorrow.",
      },
    };
  },
};

export const SETTLEMENT_EMAILS: Record<SupportedLocale, SettlementEmailDictionary> = { fr, en };

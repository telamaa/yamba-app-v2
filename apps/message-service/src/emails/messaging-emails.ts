/**
 * messaging-emails.ts — emails du chat, par locale (F-PR3, D61 6A / D44)
 * =======================================================================
 * Une seule lettre : la relance d'un message non lu. Elle ne cite JAMAIS le message (le fil
 * peut porter des coordonnées signalées, et rien du chat ne doit vivre dans une boîte mail) :
 * elle dit qui a écrit, sur quel trajet, et mène au fil. Langue = celle du DESTINATAIRE.
 */
import type { EmailContent } from "@packages/email";
import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "@packages/api-contracts";

export type MessagingEmail = { subject: string; content: EmailContent };
type ReminderParams = { firstName: string; counterpartFirstName: string; route: string; conversationUrl: string };
export type MessagingEmailDictionary = {
  unreadReminder(p: ReminderParams): MessagingEmail;
};

const fr: MessagingEmailDictionary = {
  unreadReminder: (p) => ({
    subject: `${p.counterpartFirstName} t'a écrit à propos de ${p.route}`,
    content: {
      preheader: "Un message t'attend dans Yamba.",
      title: "Nouveau message",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`${p.counterpartFirstName} t'a envoyé un message à propos du trajet ${p.route}. Pour organiser la remise du colis, réponds directement dans l'application.`],
      cta: { label: "Lire le message", url: p.conversationUrl },
      footnotes: ["Le code de livraison se donne en main propre, jamais par écrit."],
      reason: "Tu reçois cet email parce qu'un message Yamba est resté sans lecture pendant quinze minutes. Au plus un rappel par heure et par conversation.",
    },
  }),
};

const en: MessagingEmailDictionary = {
  unreadReminder: (p) => ({
    subject: `${p.counterpartFirstName} sent you a message about ${p.route}`,
    content: {
      preheader: "A message is waiting for you in Yamba.",
      title: "New message",
      greeting: `Hello ${p.firstName},`,
      paragraphs: [`${p.counterpartFirstName} sent you a message about the ${p.route} trip. To organise the handover, reply directly in the app.`],
      cta: { label: "Read the message", url: p.conversationUrl },
      footnotes: ["The delivery code is given in person, never in writing."],
      reason: "You receive this email because a Yamba message stayed unread for fifteen minutes. At most one reminder per hour and per conversation.",
    },
  }),
};

const DICTIONARIES: Record<SupportedLocale, MessagingEmailDictionary> = { fr, en };

export function messagingEmailsFor(locale: string | null | undefined): { locale: SupportedLocale; dictionary: MessagingEmailDictionary } {
  const resolved = resolveLocale(locale) ?? DEFAULT_LOCALE;
  return { locale: resolved, dictionary: DICTIONARIES[resolved] ?? DICTIONARIES[DEFAULT_LOCALE] };
}

/**
 * admin-trip-emails.ts — emails au Voyageur après un geste admin (C-PR4, D57), par locale (D44)
 */
import type { EmailContent } from "@packages/email";
import { DEFAULT_LOCALE, resolveLocale, type SupportedLocale } from "@packages/api-contracts";

export type TripEmail = { subject: string; content: EmailContent };
type Base = { firstName: string; route: string; tripUrl: string; supportEmail: string };
export type TripEmailDictionary = {
  ticketVerified(p: Base): TripEmail;
  ticketRejected(p: Base & { reasonLabel: string }): TripEmail;
  /** D57 3A — motif GÉNÉRIQUE : le motif interne de l'admin reste dans le journal, jamais dans l'email. */
  tripHidden(p: Base): TripEmail;
  tripUnhidden(p: Base): TripEmail;
};

const fr: TripEmailDictionary = {
  ticketVerified: (p) => ({
    subject: `Billet vérifié pour ton trajet ${p.route}`,
    content: {
      preheader: "Le badge « billet vérifié » est affiché.",
      title: "Billet vérifié",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`Nous avons vérifié le billet de ton trajet ${p.route}. Le badge « billet vérifié » est maintenant visible par les Expéditeurs : c'est un vrai plus pour tes réservations.`],
      cta: { label: "Voir mon trajet", url: p.tripUrl },
      reason: "Tu reçois cet email parce qu'un document de ton trajet Yamba a été examiné.",
    },
  }),
  ticketRejected: (p) => ({
    subject: `Billet non validé pour ton trajet ${p.route}`,
    content: {
      preheader: `Motif : ${p.reasonLabel}.`,
      title: "Billet non validé",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`Nous n'avons pas pu valider le billet de ton trajet ${p.route} : ${p.reasonLabel}.`, "Ton trajet reste en ligne. Tu peux déposer un nouveau document depuis la page du trajet."],
      cta: { label: "Déposer un autre billet", url: p.tripUrl },
      reason: "Tu reçois cet email parce qu'un document de ton trajet Yamba a été examiné.",
      footnotes: [`Une question ? ${p.supportEmail}`],
    },
  }),
  tripHidden: (p) => ({
    subject: `Ton trajet ${p.route} est masqué`,
    content: {
      preheader: "Il n'apparaît plus dans la recherche pendant l'examen.",
      title: "Trajet masqué",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`Ton trajet ${p.route} n'apparaît plus dans la recherche ni sur sa page publique : il fait l'objet d'un examen par notre équipe (informations du trajet, justificatifs ou signalement).`, "Les réservations déjà acceptées continuent normalement. Ce n'est pas une annulation, et le trajet peut être rétabli."],
      notice: { tone: "warning", text: `Pour en discuter, écris-nous à ${p.supportEmail}.` },
      reason: "Tu reçois cet email parce qu'une décision a été prise sur un de tes trajets Yamba.",
    },
  }),
  tripUnhidden: (p) => ({
    subject: `Ton trajet ${p.route} est de nouveau visible`,
    content: {
      preheader: "Il réapparaît dans la recherche.",
      title: "Trajet rétabli",
      greeting: `Bonjour ${p.firstName},`,
      paragraphs: [`Ton trajet ${p.route} est de nouveau visible dans la recherche et sur sa page publique.`],
      cta: { label: "Voir mon trajet", url: p.tripUrl },
      reason: "Tu reçois cet email parce qu'une décision a été prise sur un de tes trajets Yamba.",
    },
  }),
};

const en: TripEmailDictionary = {
  ticketVerified: (p) => ({
    subject: `Ticket verified for your trip ${p.route}`,
    content: {
      preheader: "The “verified ticket” badge is shown.",
      title: "Ticket verified",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`We verified the ticket of your trip ${p.route}. The “verified ticket” badge is now visible to shippers: a real plus for your bookings.`],
      cta: { label: "View my trip", url: p.tripUrl },
      reason: "You receive this email because a document of your Yamba trip was reviewed.",
    },
  }),
  ticketRejected: (p) => ({
    subject: `Ticket not validated for your trip ${p.route}`,
    content: {
      preheader: `Reason: ${p.reasonLabel}.`,
      title: "Ticket not validated",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`We could not validate the ticket of your trip ${p.route}: ${p.reasonLabel}.`, "Your trip stays online. You can upload another document from the trip page."],
      cta: { label: "Upload another ticket", url: p.tripUrl },
      reason: "You receive this email because a document of your Yamba trip was reviewed.",
      footnotes: [`Questions? ${p.supportEmail}`],
    },
  }),
  tripHidden: (p) => ({
    subject: `Your trip ${p.route} is hidden`,
    content: {
      preheader: "It no longer shows in search during the review.",
      title: "Trip hidden",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`Your trip ${p.route} no longer shows in search nor on its public page: it is under review by our team (trip details, documents or a report).`, "Bookings already accepted continue normally. This is not a cancellation, and the trip can be restored."],
      notice: { tone: "warning", text: `To discuss it, write to ${p.supportEmail}.` },
      reason: "You receive this email because a decision was made on one of your Yamba trips.",
    },
  }),
  tripUnhidden: (p) => ({
    subject: `Your trip ${p.route} is visible again`,
    content: {
      preheader: "It shows in search again.",
      title: "Trip restored",
      greeting: `Hi ${p.firstName},`,
      paragraphs: [`Your trip ${p.route} is visible again in search and on its public page.`],
      cta: { label: "View my trip", url: p.tripUrl },
      reason: "You receive this email because a decision was made on one of your Yamba trips.",
    },
  }),
};

export const TRIP_ADMIN_EMAILS: Record<SupportedLocale, TripEmailDictionary> = { fr, en };
export function getTripAdminEmails(locale: string | null | undefined): TripEmailDictionary {
  return TRIP_ADMIN_EMAILS[resolveLocale(locale)] ?? TRIP_ADMIN_EMAILS[DEFAULT_LOCALE];
}

/**
 * quick-replies.ts — réponses rapides traduites (chantier F, D61 2A)
 * ==================================================================
 * Sur mobile, entre deux langues, un bouton vaut mieux qu'un clavier. Servies dans la langue
 * du LECTEUR (D44) ; le client les envoie comme un message ordinaire.
 */
import { DEFAULT_LOCALE, resolveLocale, type QuickReply, type SupportedLocale } from "@packages/api-contracts";

export const QUICK_REPLIES: Record<SupportedLocale, QuickReply[]> = {
  fr: [
    { key: "onMyWay", kind: null, text: "Je suis en route." },
    { key: "late20", kind: null, text: "J'ai environ 20 minutes de retard." },
    { key: "whichTerminal", kind: "PICKUP", text: "À quel terminal es-tu ?" },
    { key: "atTerminal", kind: "PICKUP", text: "Je suis au terminal, près des comptoirs d'enregistrement." },
    { key: "flightNumber", kind: "PICKUP", text: "Quel est ton numéro de vol ?" },
    { key: "parcelReady", kind: "PICKUP", text: "Le colis est prêt, emballé et fermé." },
    { key: "landed", kind: "DELIVERY", text: "J'ai atterri, je récupère mes bagages." },
    { key: "recipientReady", kind: "DELIVERY", text: "Le destinataire est prévenu et disponible." },
    { key: "callMe", kind: null, text: "Appelle-moi quand tu arrives." },
  ],
  en: [
    { key: "onMyWay", kind: null, text: "I'm on my way." },
    { key: "late20", kind: null, text: "I'm running about 20 minutes late." },
    { key: "whichTerminal", kind: "PICKUP", text: "Which terminal are you at?" },
    { key: "atTerminal", kind: "PICKUP", text: "I'm at the terminal, near the check-in desks." },
    { key: "flightNumber", kind: "PICKUP", text: "What is your flight number?" },
    { key: "parcelReady", kind: "PICKUP", text: "The parcel is ready, packed and sealed." },
    { key: "landed", kind: "DELIVERY", text: "I've landed, collecting my luggage." },
    { key: "recipientReady", kind: "DELIVERY", text: "The recipient is informed and available." },
    { key: "callMe", kind: null, text: "Call me when you arrive." },
  ],
};

export function quickRepliesFor(locale: string | null | undefined): QuickReply[] {
  return QUICK_REPLIES[resolveLocale(locale)] ?? QUICK_REPLIES[DEFAULT_LOCALE];
}

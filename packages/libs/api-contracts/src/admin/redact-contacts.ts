/**
 * redact-contacts.ts — masquer adresses et numéros dans un texte (recette 02-ADMIN § 5.12, partagé au § 5.18)
 */
/**
 * Recette 02-ADMIN § 5.12 — une erreur TECHNIQUE (SMTP, fournisseur d'email, relais) cite souvent le destinataire
 * (« 550 5.1.1 <aminata@…>: mailbox unavailable »). La chronologie est lue par des profils qui n'ont pas la lecture des
 * coordonnées : adresses email et numéros de téléphone y sont masqués. Pur, testé.
 * § 5.18 : partagée — le fil d'une conversation lu au back-office masque aussi ce qu'un membre a TAPÉ (la page promet
 * « le numéro de téléphone n'apparaît jamais ici »), en laissant la trace qu'une coordonnée a été partagée.
 */
export function redactContacts(text: string): string;
export function redactContacts(text: string | null): string | null;
export function redactContacts(text: string | null): string | null {
  if (!text) return text;
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[adresse masquée]")
    // Un numéro, c'est 9 chiffres au moins : « 550 5.1.1 » (code SMTP) n'en est pas un.
    .replace(/\+?\d[\d .-]{7,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[numéro masqué]" : m));
}

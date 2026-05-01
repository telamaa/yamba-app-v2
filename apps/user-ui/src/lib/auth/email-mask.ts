/**
 * Masquage partiel d'un email pour affichage sécurisé.
 *
 * Exemples :
 * - "enrique0goio@gmail.com" → "e*********0@g***.com"
 * - "ab@test.com" → "a*@t***.com"
 * - "abc@test.fr" → "a**@t***.fr"
 *
 * Pattern utilisé par Apple, Stripe, Wise pour limiter l'exposition
 * lors de captures d'écran ou affichage public.
 */
export function maskEmail(email: string): string {
  if (!email || typeof email !== "string") return "";

  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex === -1) return trimmed; // Pas un email valide

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  // Masque la partie locale : garde 1er + dernier caractère, masque le reste
  let maskedLocal: string;
  if (localPart.length <= 2) {
    maskedLocal = localPart[0] + "*";
  } else if (localPart.length <= 4) {
    maskedLocal = localPart[0] + "**" + localPart[localPart.length - 1];
  } else {
    const middleStars = "*".repeat(Math.min(localPart.length - 2, 9));
    maskedLocal = localPart[0] + middleStars + localPart[localPart.length - 1];
  }

  // Masque le domaine : garde 1er caractère + extension
  const dotIndex = domain.lastIndexOf(".");
  if (dotIndex === -1) return `${maskedLocal}@${domain}`; // Pas d'extension

  const domainName = domain.slice(0, dotIndex);
  const extension = domain.slice(dotIndex);

  let maskedDomain: string;
  if (domainName.length <= 1) {
    maskedDomain = domainName + "***";
  } else {
    maskedDomain = domainName[0] + "***";
  }

  return `${maskedLocal}@${maskedDomain}${extension}`;
}

/**
 * message-guard.rules.ts — ce qui ne doit pas passer dans un message (chantier F, D61 4A / 5A)
 * ============================================================================================
 * Deux gardes, deux traitements :
 *  - le CODE DE LIVRAISON (D43) ne voyage jamais : le serveur extrait les groupes de six
 *    chiffres et les compare au hash du deal ; si l'un correspond, le message est REFUSÉ ;
 *  - les COORDONNÉES (téléphone, email) sont détectées, le message passe avec un drapeau
 *    (bloquer casserait des usages légitimes et se contourne en écrivant « zero six »).
 * Fonctions pures : la comparaison bcrypt est faite par l'appelant, sur les groupes extraits.
 */
export const SIX_DIGITS = /\b\d{6}\b/g;
/** Au plus trois comparaisons bcrypt par message : au-delà, c'est du bruit, pas un code. */
export const MAX_CODE_CANDIDATES = 3;

/** Groupes de SIX chiffres isolés (un numéro de vol ou une date n'en produit pas). */
export function sixDigitCandidates(text: string): string[] {
  const found = text.match(SIX_DIGITS) ?? [];
  return [...new Set(found)].slice(0, MAX_CODE_CANDIDATES);
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]{2,}/;
/** Au moins huit chiffres, séparateurs usuels tolérés : un numéro, pas un code postal ni un vol. */
const PHONE = /(?:\+?\d[\s.\-()]{0,2}){8,}/;

export type ContactDetection = { hasEmail: boolean; hasPhone: boolean; flagged: boolean };
export function detectContactInfo(text: string): ContactDetection {
  const hasEmail = EMAIL.test(text);
  const hasPhone = PHONE.test(text);
  return { hasEmail, hasPhone, flagged: hasEmail || hasPhone };
}

/** Normalise le corps : caractères de contrôle retirés, lignes vides réduites, bords coupés. */
export function normalizeBody(text: string): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

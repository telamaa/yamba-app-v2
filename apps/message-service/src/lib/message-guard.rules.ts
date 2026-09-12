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

/** Ce qu'on glisse entre des chiffres pour « aérer » un code : espace, point, tiret, apostrophe, barre. */
const DIGIT_SEPARATOR = /(?<=\d)[\s.\-–_'’/]+(?=\d)/g;

/**
 * Groupes de SIX chiffres isolés (un numéro de vol ou une date n'en produit pas).
 *
 * ANO-WEB-46 (recette 5.15, BLOQUANTE) : « Le code : 742 891 » passait — la lecture ne voyait que les
 * six chiffres COLLÉS. Les séparateurs entre chiffres sont retirés avant une seconde lecture :
 * « 742 891 », « 74-28-91 », « 7 4 2 8 9 1 » deviennent des candidats. Un numéro de téléphone
 * (dix chiffres) ou une date (huit) ne forment toujours pas un groupe de six isolé.
 */
export function sixDigitCandidates(text: string): string[] {
  const isolated = text.match(SIX_DIGITS) ?? [];
  const collapsed = text.replace(DIGIT_SEPARATOR, "").match(SIX_DIGITS) ?? [];
  return [...new Set([...isolated, ...collapsed])].slice(0, MAX_CODE_CANDIDATES);
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

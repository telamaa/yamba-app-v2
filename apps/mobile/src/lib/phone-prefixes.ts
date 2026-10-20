/**
 * phone-prefixes.ts — les indicatifs proposés pour le destinataire.
 * =================================================================
 * MIROIR ASSUMÉ de `apps/user-ui/src/components/booking/booking.config.ts`
 * (même liste, même ordre, même conversion E.164), au même titre que
 * `trip-format.ts` et `pricing-example.ts`. Porte de sortie identique : un
 * paquet partagé le jour du troisième front.
 *
 * Pourquoi ne pas mutualiser tout de suite : ces données ne sont lues par AUCUN
 * service, donc un `@packages/*` obligerait à déclarer un alias dans
 * `tsconfig.base.json`, dans celui du mobile et dans les webpack des services
 * qui ne s'en servent pas. Le coût dépasse le bénéfice à deux appelants.
 *
 * L'ordre est celui de la fréquence attendue (marchés de lancement, puis
 * diasporas) : la première entrée est le défaut du brouillon.
 */

export type PhonePrefix = { prefix: string; code: string; labelFr: string; labelEn: string };

export const PHONE_PREFIXES: PhonePrefix[] = [
  { prefix: "+33", code: "FR", labelFr: "France", labelEn: "France" },
  { prefix: "+32", code: "BE", labelFr: "Belgique", labelEn: "Belgium" },
  { prefix: "+41", code: "CH", labelFr: "Suisse", labelEn: "Switzerland" },
  { prefix: "+44", code: "GB", labelFr: "Royaume-Uni", labelEn: "United Kingdom" },
  { prefix: "+31", code: "NL", labelFr: "Pays-Bas", labelEn: "Netherlands" },
  { prefix: "+49", code: "DE", labelFr: "Allemagne", labelEn: "Germany" },
  { prefix: "+242", code: "CG", labelFr: "Congo", labelEn: "Congo" },
  { prefix: "+243", code: "CD", labelFr: "RD Congo", labelEn: "DR Congo" },
  { prefix: "+237", code: "CM", labelFr: "Cameroun", labelEn: "Cameroon" },
  { prefix: "+241", code: "GA", labelFr: "Gabon", labelEn: "Gabon" },
  { prefix: "+221", code: "SN", labelFr: "Sénégal", labelEn: "Senegal" },
  { prefix: "+225", code: "CI", labelFr: "Côte d'Ivoire", labelEn: "Ivory Coast" },
  { prefix: "+223", code: "ML", labelFr: "Mali", labelEn: "Mali" },
  { prefix: "+212", code: "MA", labelFr: "Maroc", labelEn: "Morocco" },
  { prefix: "+213", code: "DZ", labelFr: "Algérie", labelEn: "Algeria" },
  { prefix: "+216", code: "TN", labelFr: "Tunisie", labelEn: "Tunisia" },
  { prefix: "+1", code: "US", labelFr: "États-Unis / Canada", labelEn: "United States / Canada" },
  { prefix: "+91", code: "IN", labelFr: "Inde", labelEn: "India" },
  { prefix: "+86", code: "CN", labelFr: "Chine", labelEn: "China" },
  { prefix: "+84", code: "VN", labelFr: "Viêt Nam", labelEn: "Vietnam" },
];

/**
 * « +33 » + « 06 42 18 81 12 » → « +33642188112 ». `null` si le résultat n'est
 * pas un E.164 plausible — on ne fabrique jamais un numéro à moitié valide.
 *
 * Les trois nettoyages viennent de ce que les gens tapent vraiment : le « 00 »
 * international, l'indicatif retapé en double, et le zéro national qui ne
 * survit pas au passage en E.164.
 */
export function toE164(prefix: string, national: string): string | null {
  const p = prefix.replace(/\D/g, '');
  let n = national.replace(/\D/g, '');
  if (!p || !n) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith(p)) n = n.slice(p.length);
  n = n.replace(/^0+/, '');
  const e164 = `+${p}${n}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

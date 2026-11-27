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
 * Le zéro de tête est-il un préfixe d'ACHEMINEMENT à retirer (D121) ?
 *
 * ── POURQUOI CETTE TABLE EXISTE ─────────────────────────────────────────
 * `toE164` retirait le zéro de tête partout, comme s'il s'agissait toujours
 * d'un préfixe d'acheminement. C'est vrai en France ou au Royaume-Uni ; au
 * Congo-Brazzaville et en Côte d'Ivoire, le 0 appartient au numéro de
 * l'abonné, et le retirer fabrique un numéro injoignable — par lequel le
 * DESTINATAIRE devait recevoir son code de livraison (D43). Le serveur ne
 * rattrape pas : il ne vérifie que la FORME E.164, que le numéro amputé
 * respecte parfaitement.
 *
 * ── CE QUI EST ÉTABLI, ET CE QUI NE L'EST PAS ───────────────────────────
 * **`false` n'est écrit que pour les pays ÉTABLIS** — avec, pour chacun, la
 * preuve en commentaire. Tout le reste vaut `true`, c'est-à-dire le
 * comportement d'avant ce lot : **on corrige ce qui est prouvé et on ne
 * change rien là où il faudrait deviner.** Une table remplie à l'intuition
 * casserait des pays qui marchent pour en réparer deux.
 *
 * Les entrées `true` ci-dessous ne sont donc PAS toutes des faits vérifiés :
 * certaines sont l'héritage. Elles sont sûres pour une raison simple — dans
 * ces pays, le numéro national ne commence pas par 0, donc retirer un zéro
 * ne retire rien ; et si l'utilisateur en tape un par habitude, le retirer
 * est le geste indulgent.
 */
export const ZERO_DACHEMINEMENT: Record<string, boolean> = {
  // ── ÉTABLIS : le 0 APPARTIENT au numéro, on le garde ──────────────────
  // Congo-Brazzaville : neuf chiffres commençant par 0 (05/06). Prouvé par
  // les données de recette du dépôt : `+242061234567`.
  CG: false,
  // Côte d'Ivoire : dix chiffres depuis 2021 (01/05/07), le 0 en fait
  // partie. C'est l'un des deux cas nommés par A223 le 23/10.
  CI: false,

  // ── ÉTABLIS : le 0 est un préfixe d'acheminement, on le retire ─────────
  // Prouvés par les données de recette : `+243812345678` (RD Congo, le 0 de
  // « 081 » disparaît), `+33612345601`, `+447712345604`, `+32471234606`,
  // `+84901234567`.
  CD: true,
  FR: true,
  GB: true,
  BE: true,
  VN: true,

  // ── HÉRITAGE : comportement d'avant D121, non revérifié ───────────────
  // Sûr en pratique : le numéro national n'y commence pas par 0, donc le
  // retrait ne retire rien ; et un 0 tapé par habitude est une faute de
  // frappe qu'on pardonne.
  CH: true,
  NL: true,
  DE: true,
  CM: true,
  GA: true,
  SN: true,
  ML: true,
  MA: true,
  DZ: true,
  TN: true,
  US: true,
  IN: true,
  CN: true,
};

/** Par défaut on retire : c'est le comportement d'avant ce lot. */
export function retireLeZero(code: string): boolean {
  return ZERO_DACHEMINEMENT[code] ?? true;
}

/**
 * « +33 » + « 06 42 18 81 12 » → « +33642188112 ». `null` si le résultat n'est
 * pas un E.164 plausible — on ne fabrique jamais un numéro à moitié valide.
 *
 * Les trois nettoyages viennent de ce que les gens tapent vraiment : le « 00 »
 * international, l'indicatif retapé en double, et le zéro national qui ne
 * survit pas au passage en E.164.
 */
export function toE164(prefix: string, national: string, code?: string): string | null {
  const p = prefix.replace(/\D/g, '');
  let n = national.replace(/\D/g, '');
  if (!p || !n) return null;
  if (n.startsWith('00')) n = n.slice(2);
  if (n.startsWith(p)) n = n.slice(p.length);
  // D121 — UN zéro, et seulement s'il en est un. `^0+` amputait aussi les
  // fautes de frappe à deux zéros, et surtout il retirait le 0 des pays où
  // il appartient au numéro de l'abonné.
  const pays = code ?? paysDuPrefixe(prefix);
  if (n.startsWith('0') && (pays === undefined || retireLeZero(pays))) n = n.slice(1);
  const e164 = `+${p}${n}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

/**
 * Le pays d'un indicatif, quand il est unique dans la liste.
 *
 * `+1` couvre les États-Unis ET le Canada : l'entrée de la liste porte
 * « US », et les deux ont la même règle. Un indicatif inconnu rend
 * `undefined`, et l'appelant retombe sur le comportement par défaut.
 */
function paysDuPrefixe(prefix: string): string | undefined {
  const normalise = `+${prefix.replace(/\D/g, '')}`;
  return PHONE_PREFIXES.find((entree) => entree.prefix === normalise)?.code;
}

/**
 * orphan-holds.rules.ts — l'empreinte orpheline (D82 9A)
 * ======================================================
 * Le défaut que ces règles ferment est né avec les moyens de paiement à REDIRECTION.
 *
 * Ordre des gestes (A45, D31) : on pose l'empreinte, PUIS on crée la réservation. Avec une
 * carte, les deux sont séparés par quelques millisecondes. Avec Klarna ou PayPal, le membre
 * QUITTE l'app ou la page entre les deux — et peut ne jamais revenir. Reste alors une
 * autorisation vivante sur son moyen de paiement, pour une réservation qui n'existe pas :
 * ~7 jours sur une carte, et **28 jours** chez Klarna. Personne ne le voit, et c'est lui qui
 * le découvre sur son relevé.
 *
 * Et nous ne pouvons pas la retrouver chez nous : la création de l'intention n'écrit RIEN en
 * base (D37). L'orpheline n'existe que chez le fournisseur — d'où une chasse qui LIT chez lui
 * et ne garde que ce qui est à nous.
 *
 * Trois conditions, et les trois comptent :
 *   1. **l'empreinte est à NOUS** — `metadata.tripId` et `metadata.shipperId` sont posés par
 *      `authorize()` à chaque fois. Un compte Stripe peut servir plusieurs applications, un
 *      bac à sable est partagé : annuler l'empreinte d'un autre serait un vol, pas un ménage ;
 *   2. **elle a passé le délai de grâce** — en dessous, le membre est peut-être simplement
 *      en train de payer. On ne coupe jamais sous les pieds de quelqu'un ;
 *   3. **aucune réservation ne la porte** — c'est la définition même de l'orpheline.
 *
 * Rien ici ne lit la base ni n'appelle le fournisseur : fonctions pures, donc testables sans
 * rien monter (D30).
 */

/** Ce que le fournisseur nous apprend d'une empreinte posée (sous-ensemble utile). */
export type HoldToJudge = {
  intentId: string;
  createdAt: Date;
  metadata: Record<string, string>;
};

/**
 * Délai de grâce par DÉFAUT, en minutes (D62 : la constante reste l'argument par défaut
 * d'une règle pure — pas de clé de catalogue sans consommateur réel).
 *
 * Deux heures : très au-dessus d'un tunnel de réservation (quelques minutes), très en
 * dessous de la plus courte rétention d'empreinte (~7 jours pour une carte). La marge est
 * du côté du membre : on préfère libérer tard que couper un paiement en cours.
 */
export const ORPHAN_HOLD_GRACE_MINUTES = 120;

const MINUTE = 60_000;

/** L'empreinte porte-t-elle nos clés de rapprochement ? (condition 1) */
export function isOurHold(hold: HoldToJudge): boolean {
  const tripId = hold.metadata.tripId?.trim();
  const shipperId = hold.metadata.shipperId?.trim();
  return !!tripId && !!shipperId;
}

/** A-t-elle dépassé le délai de grâce ? (condition 2) */
export function isPastGrace(hold: HoldToJudge, now: Date, graceMinutes: number = ORPHAN_HOLD_GRACE_MINUTES): boolean {
  return now.getTime() - hold.createdAt.getTime() >= graceMinutes * MINUTE;
}

/**
 * Orpheline = à nous, hors délai de grâce, et qu'aucune réservation ne porte.
 *
 * `knownIntentIds` est l'ensemble des `paymentIntentId` trouvés en base pour CES empreintes :
 * une réservation annulée ou expirée compte comme connue — son sort appartient à la machine à
 * états et au webhook, pas à ce ménage-ci.
 */
export function isOrphanHold(
  hold: HoldToJudge,
  args: { now: Date; knownIntentIds: ReadonlySet<string>; graceMinutes?: number }
): boolean {
  if (!isOurHold(hold)) return false;
  if (!isPastGrace(hold, args.now, args.graceMinutes)) return false;
  return !args.knownIntentIds.has(hold.intentId);
}

/** Le tri d'une fenêtre entière, dans l'ordre reçu (déterminisme, A199). */
export function selectOrphanHolds<T extends HoldToJudge>(
  holds: readonly T[],
  args: { now: Date; knownIntentIds: ReadonlySet<string>; graceMinutes?: number }
): T[] {
  return holds.filter((h) => isOrphanHold(h, args));
}

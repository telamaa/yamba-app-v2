/**
 * meetup.rules.ts — le rendez-vous est un objet, pas une conversation (chantier F, D61 1A)
 * ========================================================================================
 * L'un propose un lieu et un créneau, l'autre accepte ou contre-propose. La dernière
 * proposition d'un type (remise / livraison) fait foi ; accepter est réservé à celui qui
 * n'a pas proposé. Pures : aucune base, aucune horloge implicite.
 */
export const MEETUP_MIN_LEAD_MINUTES = 30;
export const MEETUP_MAX_WINDOW_HOURS = 12;
export const MEETUP_MAX_AHEAD_DAYS = 90;

export type MeetupSlot = { startAt: Date; endAt: Date };
export type SlotCheck = { ok: boolean; reason: string | null };

export function validateMeetupSlot(slot: MeetupSlot, now: Date): SlotCheck {
  if (Number.isNaN(slot.startAt.getTime()) || Number.isNaN(slot.endAt.getTime())) return { ok: false, reason: "INVALID_DATES" };
  if (slot.endAt.getTime() <= slot.startAt.getTime()) return { ok: false, reason: "END_BEFORE_START" };
  if (slot.startAt.getTime() < now.getTime() + MEETUP_MIN_LEAD_MINUTES * 60_000) return { ok: false, reason: "TOO_SOON" };
  if (slot.startAt.getTime() > now.getTime() + MEETUP_MAX_AHEAD_DAYS * 86_400_000) return { ok: false, reason: "TOO_FAR" };
  if (slot.endAt.getTime() - slot.startAt.getTime() > MEETUP_MAX_WINDOW_HOURS * 3_600_000) return { ok: false, reason: "WINDOW_TOO_LONG" };
  return { ok: true, reason: null };
}

/** Accepter est réservé à l'AUTRE partie : on n'accepte pas sa propre proposition. */
export function canAcceptMeetup(meetup: { status: string; proposedByRole: string }, actorRole: "SHIPPER" | "CARRIER"): SlotCheck {
  if (meetup.status !== "PROPOSED") return { ok: false, reason: "NOT_PROPOSED" };
  if (meetup.proposedByRole === actorRole) return { ok: false, reason: "OWN_PROPOSAL" };
  return { ok: true, reason: null };
}

/**
 * Le rendez-vous qui compte : le prochain ACCEPTÉ à venir, sinon la dernière proposition — SAUF si une
 * proposition est plus récente que l'acceptation : c'est une re-proposition (l'un des deux veut changer
 * l'heure ou le lieu), et elle doit être visible pour pouvoir être acceptée (ANO-WEB-47, recette 5.15 :
 * après un rendez-vous confirmé, une nouvelle proposition restait invisible derrière le confirmé).
 */
export function nextMeetupOf<T extends { status: string; startAt: Date; createdAt: Date; acceptedAt?: Date | null }>(meetups: T[], now: Date): T | null {
  const accepted = meetups
    .filter((m) => m.status === "ACCEPTED" && m.startAt.getTime() >= now.getTime())
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const proposed = meetups.filter((m) => m.status === "PROPOSED").sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const confirmed = accepted[0] ?? null;
  const latest = proposed[0] ?? null;
  if (confirmed && latest && latest.createdAt.getTime() > (confirmed.acceptedAt ?? confirmed.createdAt).getTime()) return latest;
  return confirmed ?? latest;
}

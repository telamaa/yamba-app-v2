/**
 * conversation.rules.ts — quand le fil s'ouvre, quand il se ferme (chantier F, D61 2A)
 * ====================================================================================
 * Pures : un instantané du deal + une horloge → ce que l'appelant a le droit de faire.
 * Le fil naît à l'ACCEPTATION (avant, la demande porte déjà un message, et ouvrir plus tôt
 * invite à sortir de la plateforme), reste ouvert pendant le transport, passe en lecture
 * seule pendant un litige (les échanges passent par la médiation, D55) et se ferme à
 * l'écriture 14 jours après la fin du deal. La lecture reste jusqu'à la purge (D61 8A).
 */
import { CONVERSATION_WRITE_DAYS_AFTER_END, type ConversationAccess } from "@packages/api-contracts";

export type BookingForConversation = {
  status: string;
  acceptedAt?: Date | null;
  completedAt?: Date | null;
  closedAt?: Date | null;
};

/** Statuts où le deal est engagé : le fil existe. */
export const CONVERSATION_OPEN_STATUSES = ["ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED", "COMPLETED", "CANCELLED"] as const;

export function conversationExists(b: BookingForConversation): boolean {
  return (CONVERSATION_OPEN_STATUSES as readonly string[]).includes(b.status);
}

export function conversationAccess(b: BookingForConversation, now: Date): ConversationAccess {
  if (!conversationExists(b)) {
    return { canRead: false, canWrite: false, reason: "NOT_ACCEPTED_YET", writeClosesAt: null };
  }
  if (b.status === "DISPUTED") {
    // D55 — pendant un litige, chaque partie s'adresse à la médiation, pas à l'autre.
    return { canRead: true, canWrite: false, reason: "DISPUTE_OPEN", writeClosesAt: null };
  }
  if (b.status === "COMPLETED" || b.status === "CANCELLED") {
    const end = b.completedAt ?? b.closedAt ?? null;
    if (!end) return { canRead: true, canWrite: false, reason: "DEAL_CLOSED", writeClosesAt: null };
    const closesAt = new Date(end.getTime() + CONVERSATION_WRITE_DAYS_AFTER_END * 86_400_000);
    return now.getTime() < closesAt.getTime()
      ? { canRead: true, canWrite: true, reason: null, writeClosesAt: closesAt.toISOString() }
      : { canRead: true, canWrite: false, reason: "WRITE_WINDOW_OVER", writeClosesAt: closesAt.toISOString() };
  }
  return { canRead: true, canWrite: true, reason: null, writeClosesAt: null };
}

/** Le rôle de l'appelant dans ce deal, ou null s'il n'est pas partie (403). */
export function roleOf(userId: string, parties: { shipperId: string; carrierId: string }): "SHIPPER" | "CARRIER" | null {
  if (userId === parties.shipperId) return "SHIPPER";
  if (userId === parties.carrierId) return "CARRIER";
  return null;
}
export const counterpartIdOf = (role: "SHIPPER" | "CARRIER", parties: { shipperId: string; carrierId: string }) =>
  role === "SHIPPER" ? parties.carrierId : parties.shipperId;

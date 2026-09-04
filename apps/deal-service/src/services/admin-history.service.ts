/**
 * admin-history.service.ts — « tout ce qui est arrivé à ce deal » (C-PR6a, D59 5A)
 * ================================================================================
 * Chronologie LECTURE SEULE fusionnant quatre sources de la base partagée : l'outbox
 * (avec l'état de relais), le journal admin, les notifications in-app et les envois
 * d'emails. Le payload outbox est réduit à une WHITELIST (jamais un code, un secret, une
 * photo, une adresse). La consultation est journalisée (DEAL_HISTORY_VIEWED).
 */
import prisma from "@packages/libs/prisma";
import { NotFoundError } from "@packages/error-handler";
import { recordAdminAction } from "@packages/admin-audit";
import type { DealHistoryEvent, DealHistoryResponse } from "@packages/api-contracts";

/** Clés de payload servies à l'admin — tout le reste est ignoré (D43 : le code ne voyage jamais, ici on ne prend même pas le risque). */
export const HISTORY_PAYLOAD_WHITELIST = [
  "actor", "status", "from", "to", "amountCents", "currencyCode", "reason", "cancelledBy", "wasAccepted", "step", "ticketNumber", "category",
  "outcome", "refundCents", "carrierPayoutCents", "transferId", "completedBy", "kind", "attempt", "payoutDueAt", "refundedAt", "closedAt", "completedAt",
] as const;
export const RELAY_PARKED_ATTEMPTS = 10;

export type OutboxRow = { eventType: string; payload: unknown; occurredAt: Date; publishedAt: Date | null; attempts: number; lastError: string | null; id: string };
export type AdminActionRow = { action: string; adminUserId: string; createdAt: Date; after: unknown };
export type NotificationRow = { type: string; userId: string; createdAt: Date; readAt: Date | null };
export type EmailRow = { template: string; userId: string; status: string; sentAt: Date | null; claimedAt: Date; lastError: string | null };

export function whitelistPayload(payload: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const src = (payload && typeof payload === "object" && "payload" in (payload as Record<string, unknown>) ? (payload as { payload: unknown }).payload : payload) as Record<string, unknown> | null;
  if (!src || typeof src !== "object") return out;
  for (const k of HISTORY_PAYLOAD_WHITELIST) if (src[k] !== undefined && src[k] !== null) out[k] = src[k];
  return out;
}

/** Fusion PURE des quatre sources, triée par date ; `roleOf` traduit un id en SHIPPER / CARRIER, `nameOf` un admin en nom court. */
export function mergeDealHistory(
  input: { outbox: OutboxRow[]; adminActions: AdminActionRow[]; notifications: NotificationRow[]; emails: EmailRow[] },
  roleOf: (userId: string) => string | null,
  nameOf: (adminUserId: string) => string
): DealHistoryEvent[] {
  const events: DealHistoryEvent[] = [];
  for (const o of input.outbox) {
    const summary = whitelistPayload(o.payload);
    const parked = !o.publishedAt && o.attempts >= RELAY_PARKED_ATTEMPTS;
    events.push({
      at: o.occurredAt.toISOString(),
      source: "OUTBOX",
      type: o.eventType,
      actor: typeof summary.actor === "string" ? summary.actor : null,
      recipient: null,
      summary,
      relay: { publishedAt: o.publishedAt ? o.publishedAt.toISOString() : null, attempts: o.attempts, parked, lastError: o.lastError },
      status: o.publishedAt ? "PUBLISHED" : parked ? "PARKED" : "PENDING",
    });
  }
  for (const a of input.adminActions) {
    events.push({ at: a.createdAt.toISOString(), source: "ADMIN", type: a.action, actor: nameOf(a.adminUserId), recipient: null, summary: whitelistPayload(a.after), relay: null, status: null });
  }
  for (const n of input.notifications) {
    events.push({ at: n.createdAt.toISOString(), source: "NOTIFICATION", type: n.type, actor: null, recipient: roleOf(n.userId), summary: {}, relay: null, status: n.readAt ? "READ" : "UNREAD" });
  }
  for (const e of input.emails) {
    events.push({ at: (e.sentAt ?? e.claimedAt).toISOString(), source: "EMAIL", type: e.template, actor: null, recipient: roleOf(e.userId), summary: e.lastError ? { reason: e.lastError.slice(0, 200) } : {}, relay: null, status: e.status });
  }
  return events.sort((x, y) => x.at.localeCompare(y.at) || x.source.localeCompare(y.source));
}

export type AdminActor = { id: string; ip: string | null; userAgent: string | null };

export function makeAdminHistoryService(clock: () => Date = () => new Date()) {
  return {
    async getDealHistory(admin: AdminActor, bookingId: string): Promise<DealHistoryResponse> {
      const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, shipperId: true, carrierId: true, isDeleted: true } });
      if (!booking || booking.isDeleted) throw new NotFoundError("Deal not found.");
      const [outbox, adminActions, notifications] = await Promise.all([
        prisma.outboxEvent.findMany({ where: { aggregateType: "booking", aggregateId: bookingId }, orderBy: { occurredAt: "asc" }, take: 500, select: { id: true, eventType: true, payload: true, occurredAt: true, publishedAt: true, attempts: true, lastError: true } }),
        prisma.adminAction.findMany({ where: { targetId: bookingId }, orderBy: { createdAt: "asc" }, take: 200, select: { action: true, adminUserId: true, createdAt: true, after: true } }),
        prisma.notification.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" }, take: 500, select: { type: true, userId: true, createdAt: true, readAt: true } }),
      ]);
      const emails = outbox.length
        ? await prisma.emailDelivery.findMany({ where: { eventId: { in: outbox.map((o) => o.id) } }, orderBy: { claimedAt: "asc" }, take: 500, select: { template: true, userId: true, status: true, sentAt: true, claimedAt: true, lastError: true } })
        : [];
      const adminIds = [...new Set(adminActions.map((a) => a.adminUserId))];
      const admins = adminIds.length ? await prisma.user.findMany({ where: { id: { in: adminIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
      const nameOf = (id: string) => { const a = admins.find((x) => x.id === id); return a ? `${a.firstName} ${a.lastName.charAt(0)}.` : id; };
      const roleOf = (id: string) => (id === booking.shipperId ? "SHIPPER" : id === booking.carrierId ? "CARRIER" : null);
      const events = mergeDealHistory(
        { outbox, adminActions, notifications, emails: emails.map((e) => ({ ...e, status: String(e.status) })) },
        roleOf, nameOf
      );
      await recordAdminAction(prisma, { adminUserId: admin.id, action: "DEAL_HISTORY_VIEWED", targetType: "BOOKING", targetId: bookingId, ip: admin.ip, userAgent: admin.userAgent });
      return {
        bookingId,
        events,
        counts: { outbox: outbox.length, admin: adminActions.length, notifications: notifications.length, emails: emails.length, parked: events.filter((e) => e.relay?.parked).length },
        generatedAt: clock().toISOString(),
      };
    },
  };
}
export type AdminHistoryService = ReturnType<typeof makeAdminHistoryService>;

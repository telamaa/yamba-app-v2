/**
 * notification-view.mapper.ts — DTO whitelist (A13, PR4bis)
 * ==========================================================
 * Le mapper CONSTRUIT explicitement chaque champ exposé — un champ
 * ajouté demain au modèle ne sort pas tant qu'il n'est pas listé ici
 * (spread-résistant, pattern booking-view.mapper). Le parse final
 * verrouille la forme au contrat (strict) : toute divergence est un
 * bug attrapé côté serveur, jamais découvert par un client.
 */
import type { Notification } from "@prisma/client";
import {
  NotificationViewSchema,
  type NotificationView,
} from "@packages/api-contracts";

export type NotificationRecord = Notification;

export function toNotificationView(
  record: NotificationRecord
): NotificationView {
  return NotificationViewSchema.parse({
    id: record.id,
    type: record.type,
    bookingId: record.bookingId,
    payload: record.payload as Record<string, unknown>,
    readAt: record.readAt ? record.readAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
  });
}

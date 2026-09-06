/**
 * notification.schema.ts — contrats de la boîte aux lettres (PR4bis, A27)
 * =======================================================================
 * DTO en LISTE BLANCHE (A13) : userId et eventId — plomberie interne —
 * ne sortent JAMAIS. Le payload exposé est celui de l'événement,
 * déjà whitelisté par le contrat booking-events (aucun code/hash).
 * Ces schémas génèrent l'OAS (D3) ET valident à l'exécution.
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { BookingEventTypeSchema } from "../booking/booking-events.schema";

/** Notifications qui ne viennent PAS d'un événement de deal (A87 : compte Stripe). */
export const SYSTEM_NOTIFICATION_TYPES = ["carrier.payout_failed"] as const;
export const NotificationTypeSchema = z
  .union([BookingEventTypeSchema, z.enum(SYSTEM_NOTIFICATION_TYPES)])
  .meta({ id: "NotificationType", description: "Booking event key, or a system notification (A87)" });

export const NotificationViewSchema = z
  .object({
    id: ObjectIdSchema,
    type: NotificationTypeSchema,
    bookingId: ObjectIdSchema.nullable(),
    payload: z.record(z.string(), z.unknown()),
    /** Prénom de l'AUTRE partie du deal (A91) — null si compte effacé ou notification système. */
    counterpartFirstName: z.string().nullable(),
    readAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .meta({
    id: "NotificationView",
    description: "In-app notification (whitelist DTO — A13): userId/eventId never exposed",
  });
export type NotificationView = z.infer<typeof NotificationViewSchema>;

export const MyNotificationsResponseSchema = z
  .object({
    notifications: z.array(NotificationViewSchema),
    unreadCount: z.int().nonnegative(),
  })
  .strict()
  .meta({
    id: "MyNotificationsResponse",
    description: "GET /me/notifications — latest first, unread count included",
  });
export type MyNotificationsResponse = z.infer<typeof MyNotificationsResponseSchema>;

export const MarkNotificationReadResponseSchema = z
  .object({
    notification: NotificationViewSchema,
  })
  .strict()
  .meta({
    id: "MarkNotificationReadResponse",
    description: "PATCH /me/notifications/{id}/read — the updated notification",
  });
export type MarkNotificationReadResponse = z.infer<typeof MarkNotificationReadResponseSchema>;

export const MarkAllNotificationsReadResponseSchema = z
  .object({
    updatedCount: z.int().nonnegative(),
  })
  .strict()
  .meta({ id: "MarkAllNotificationsReadResponse", description: "PATCH /me/notifications/read-all — how many were unread" });
export type MarkAllNotificationsReadResponse = z.infer<typeof MarkAllNotificationsReadResponseSchema>;

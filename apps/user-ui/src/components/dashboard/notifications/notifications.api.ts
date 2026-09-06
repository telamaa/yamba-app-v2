import apiClient from "@/lib/api-client";
import type { NotificationListItem } from "./notifications.types";

/**
 * notifications.api.ts — couche API de la boîte (PR5, Lot 3)
 * ===========================================================
 * Backend : notification-service (PR4bis) via le gateway.
 * - GET   /me/notifications           → 50 dernières + unreadCount
 * - PATCH /me/notifications/:id/read  → marquage lu (idempotent)
 * Le DTO backend (NotificationView, whitelist A13) correspond champ
 * à champ à NotificationListItem — pas d'adaptateur nécessaire, la
 * présentation (icône/tone/textes) vit dans notifications.types.
 */

type MyNotificationsResponse = {
  notifications: NotificationListItem[];
  unreadCount: number;
};

export type MyNotifications = {
  items: NotificationListItem[];
  unreadCount: number;
};

export async function getMyNotifications(): Promise<MyNotifications> {
  const res = await apiClient.get<MyNotificationsResponse>(
    "/me/notifications",
    { requireAuth: true }
  );
  return {
    items: res.data.notifications,
    unreadCount: res.data.unreadCount,
  };
}

export async function markNotificationRead(
  id: string
): Promise<NotificationListItem> {
  const res = await apiClient.patch<{ notification: NotificationListItem }>(
    `/me/notifications/${id}/read`,
    {},
    { requireAuth: true }
  );
  return res.data.notification;
}

/** PATCH /me/notifications/read-all — idempotent (A91). */
export async function markAllNotificationsRead(): Promise<number> {
  const res = await apiClient.patch<{ updatedCount: number }>("/me/notifications/read-all", {}, { requireAuth: true });
  return res.data.updatedCount;
}

/**
 * notification.controller.ts — la boîte aux lettres (PR4bis, A27)
 * ================================================================
 * A21 — sémantique d'erreurs propre (pattern deal.controller) :
 *   400 ValidationError → id malformé uniquement
 *   403 ForbiddenError  → authentifié mais pas destinataire
 *   404 NotFoundError   → notification inexistante
 * Lecture bornée (take 50, createdAt desc) + unreadCount calculé.
 * Marquage lu IDEMPOTENT : re-marquer ne change pas readAt.
 */
import { NextFunction, Response } from "express";
import prisma from "@packages/libs/prisma";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "@packages/error-handler";
import type { AuthenticatedRequest } from "@packages/middleware/isAuthenticated";
import { ObjectIdSchema } from "@packages/api-contracts";
import { toNotificationView } from "../services/notification-view.mapper";

const PAGE_SIZE = 50;

export async function getMyNotifications(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user.id;
    const [rows, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: PAGE_SIZE,
      }),
      prisma.notification.count({
        // Prisma/Mongo : un champ ABSENT n'est pas matche par `null` (famille
        // §6.5) — les rows nees du consumer sans readAt sont non-lues AUSSI.
        where: {
          userId,
          OR: [{ readAt: null }, { readAt: { isSet: false } }],
        },
      }),
    ]);
    res.json({
      notifications: rows.map(toNotificationView),
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
}

export async function markNotificationRead(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = ObjectIdSchema.safeParse(req.params.id);
    if (!parsed.success) {
      throw new ValidationError("Invalid notification id.");
    }
    const notification = await prisma.notification.findUnique({
      where: { id: parsed.data },
    });
    if (!notification) {
      throw new NotFoundError("Notification not found.");
    }
    if (notification.userId !== req.user.id) {
      throw new ForbiddenError("You are not the recipient of this notification.");
    }
    const updated = notification.readAt
      ? notification
      : await prisma.notification.update({
          where: { id: notification.id },
          data: { readAt: new Date() },
        });
    res.json({ notification: toNotificationView(updated) });
  } catch (err) {
    next(err);
  }
}

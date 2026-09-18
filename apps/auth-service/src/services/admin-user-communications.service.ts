/**
 * admin-user-communications.service.ts — fiche membre : ses communications (D79)
 * ==============================================================================
 * « Ce membre dit ne rien recevoir » : les 30 dernières notifications in-app et
 * les 30 derniers envois d'emails, TYPES ET STATUTS SEULEMENT — jamais un corps
 * de message, jamais le code de livraison (D43). Les erreurs d'envoi citent
 * souvent une adresse : expurgées par `redactContacts` (règle du § 5.12).
 * Lecture seule, permission `users.read`, non journalisée (comme la fiche, 3A).
 */
import prismaDefault from "@packages/libs/prisma";
import { NotFoundError } from "@packages/error-handler";
import { redactContacts, type AdminUserCommunicationsResponse } from "@packages/api-contracts";

const PROFONDEUR = 30;
const EMAIL_EN_ECHEC = ["FAILED", "BOUNCED", "COMPLAINED"] as const;

/** Le strict nécessaire de Prisma — injectable dans les tests (pattern email-suppression). */
export type UserCommunicationsDb = {
  user: { findUnique(args: { where: { id: string }; select: { id: true } }): Promise<{ id: string } | null> };
  notification: {
    findMany(args: {
      where: { userId: string };
      orderBy: { createdAt: "desc" };
      take: number;
      select: { type: true; bookingId: true; createdAt: true; readAt: true };
    }): Promise<Array<{ type: string; bookingId: string | null; createdAt: Date; readAt: Date | null }>>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
  };
  emailDelivery: {
    findMany(args: {
      where: { userId: string };
      orderBy: { claimedAt: "desc" };
      take: number;
      select: { eventId: true; template: true; status: true; claimedAt: true; sentAt: true; lastError: true };
    }): Promise<Array<{ eventId: string; template: string; status: string; claimedAt: Date; sentAt: Date | null; lastError: string | null }>>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
  };
  outboxEvent: {
    findMany(args: {
      where: { id: { in: string[] } };
      select: { id: true; aggregateType: true; aggregateId: true };
    }): Promise<Array<{ id: string; aggregateType: string; aggregateId: string }>>;
  };
};

export function makeAdminUserCommunicationsService(db: UserCommunicationsDb = prismaDefault as unknown as UserCommunicationsDb, clock: () => Date = () => new Date()) {
  return {
    async getCommunications(userId: string): Promise<AdminUserCommunicationsResponse> {
      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new NotFoundError("User not found.", { code: "USER_NOT_FOUND" });

      const [notifications, emails, notifTotal, notifNonLues, emailTotal, emailEchecs] = await Promise.all([
        db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: PROFONDEUR, select: { type: true, bookingId: true, createdAt: true, readAt: true } }),
        db.emailDelivery.findMany({ where: { userId }, orderBy: { claimedAt: "desc" }, take: PROFONDEUR, select: { eventId: true, template: true, status: true, claimedAt: true, sentAt: true, lastError: true } }),
        db.notification.count({ where: { userId } }),
        // Piège Mongo (§ pièges) : `readAt: null` rate un champ ABSENT — le OR isSet est obligatoire sur tout filtre nullable.
        db.notification.count({ where: { userId, OR: [{ readAt: null }, { readAt: { isSet: false } }] } }),
        db.emailDelivery.count({ where: { userId } }),
        db.emailDelivery.count({ where: { userId, status: { in: [...EMAIL_EN_ECHEC] } } }),
      ]);

      // Le deal d'un email se retrouve par son événement source (outbox) — null pour un événement non-deal.
      const eventIds = [...new Set(emails.map((e) => e.eventId))];
      const outbox = eventIds.length ? await db.outboxEvent.findMany({ where: { id: { in: eventIds } }, select: { id: true, aggregateType: true, aggregateId: true } }) : [];
      const bookingOf = new Map(outbox.filter((o) => o.aggregateType === "booking").map((o) => [o.id, o.aggregateId]));

      return {
        userId,
        notifications: notifications.map((n) => ({
          type: n.type,
          bookingId: n.bookingId ?? null,
          createdAt: n.createdAt.toISOString(),
          readAt: n.readAt ? n.readAt.toISOString() : null,
        })),
        emails: emails.map((e) => ({
          template: e.template,
          status: String(e.status),
          bookingId: bookingOf.get(e.eventId) ?? null,
          claimedAt: e.claimedAt.toISOString(),
          sentAt: e.sentAt ? e.sentAt.toISOString() : null,
          lastError: e.lastError ? redactContacts(e.lastError.slice(0, 200)) : null,
        })),
        counts: { notifications: notifTotal, unreadNotifications: notifNonLues, emails: emailTotal, failedEmails: emailEchecs },
        generatedAt: clock().toISOString(),
      };
    },
  };
}
export type AdminUserCommunicationsService = ReturnType<typeof makeAdminUserCommunicationsService>;

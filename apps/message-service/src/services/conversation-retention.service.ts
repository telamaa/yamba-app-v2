/**
 * conversation-retention.service.ts — purge à un an (F-PR3, D61 8A)
 * ===================================================================
 * Chaque nuit : les conversations silencieuses depuis plus d'un an sont confrontées à la
 * règle pure (deal terminé ET un an après la plus tardive des deux dates). Les messages,
 * rendez-vous et traces de révélation partent avec le fil ; les SIGNALEMENTS restent (ce
 * sont des dossiers de modération, pas des propos) — ils perdent seulement leur corps.
 */
import prisma from "@packages/libs/prisma";
import { CONVERSATION_RETENTION_DAYS } from "@packages/api-contracts";
import { isPurgeable } from "../lib/conversation-retention.rules";

const DAY = 86_400_000;
const BATCH = 100;

export type ConversationRetentionService = ReturnType<typeof makeConversationRetentionService>;

export function makeConversationRetentionService(clock: () => Date = () => new Date()) {
  return {
    /** Un passage : renvoie le nombre de conversations purgées. */
    async purgeOnce(now: Date = clock()): Promise<{ examined: number; purged: number }> {
      const candidates = await prisma.conversation.findMany({
        where: { updatedAt: { lt: new Date(now.getTime() - CONVERSATION_RETENTION_DAYS * DAY) } },
        select: { id: true, bookingId: true, updatedAt: true },
        orderBy: { updatedAt: "asc" },
        take: BATCH,
      });
      if (candidates.length === 0) return { examined: 0, purged: 0 };
      const bookings = await prisma.booking.findMany({
        where: { id: { in: candidates.map((c) => c.bookingId) } },
        select: { id: true, status: true, completedAt: true, closedAt: true },
      });
      const byId = new Map(bookings.map((b) => [b.id, b]));
      let purged = 0;
      for (const c of candidates) {
        const booking = byId.get(c.bookingId);
        // Deal introuvable (supprimé) : le fil n'a plus de raison d'être — même règle qu'un deal terminé.
        const input = booking
          ? { bookingStatus: booking.status, bookingEndedAt: booking.completedAt ?? booking.closedAt ?? null, conversationUpdatedAt: c.updatedAt }
          : { bookingStatus: "CANCELLED", bookingEndedAt: null, conversationUpdatedAt: c.updatedAt };
        if (!isPurgeable(input, now)) continue;
        await prisma.$transaction([
          prisma.phoneReveal.deleteMany({ where: { conversationId: c.id } }),
          prisma.meetup.deleteMany({ where: { conversationId: c.id } }),
          prisma.message.deleteMany({ where: { conversationId: c.id } }),
          prisma.conversation.delete({ where: { id: c.id } }),
        ]);
        purged += 1;
      }
      return { examined: candidates.length, purged };
    },
  };
}

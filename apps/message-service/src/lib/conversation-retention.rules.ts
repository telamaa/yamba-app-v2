/**
 * conversation-retention.rules.ts — conservation d'une conversation (F-PR3, D61 8A)
 * ===================================================================================
 * Une conversation est purgée UN AN après la fin du deal ET la dernière activité du fil,
 * la plus tardive des deux. Un deal encore vivant (ou en litige) n'est jamais purgé, quel
 * que soit son âge : la médiation a besoin du fil. Règle pure, testée sans base.
 */
import { BOOKING_TERMINAL_STATUSES, CONVERSATION_RETENTION_DAYS, type BookingStatus } from "@packages/api-contracts";

export type RetentionInput = {
  bookingStatus: string;
  /** Fin du deal : completedAt ou closedAt, ce que le deal a. */
  bookingEndedAt: Date | null;
  /** Dernière activité du fil (dernier message, lecture, rendez-vous). */
  conversationUpdatedAt: Date;
};

const DAY = 86_400_000;

export function retentionAnchor(input: RetentionInput): Date {
  const ended = input.bookingEndedAt?.getTime() ?? 0;
  return new Date(Math.max(ended, input.conversationUpdatedAt.getTime()));
}

export function isPurgeable(input: RetentionInput, now: Date): boolean {
  if (!BOOKING_TERMINAL_STATUSES.includes(input.bookingStatus as BookingStatus)) return false;
  return retentionAnchor(input).getTime() < now.getTime() - CONVERSATION_RETENTION_DAYS * DAY;
}

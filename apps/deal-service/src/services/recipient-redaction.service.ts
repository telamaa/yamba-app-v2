/**
 * recipient-redaction.service.ts — cron nocturne d'effacement du destinataire (C-PR8b, D63 5A)
 * ===========================================================================================
 * Candidats : deals terminaux, non encore effacés, finis depuis plus de N jours (N lu dans les
 * paramètres à chaque passage). Un `$set` par réservation sur le composite `recipient` (une étape
 * de pipeline — jamais le plafond de 50).
 */
import prisma from "@packages/libs/prisma";
import { BOOKING_TERMINAL_STATUSES } from "@packages/api-contracts";
import { platformSettings } from "@packages/libs/settings/default";
import type { SettingsReader } from "@packages/libs/settings";
import { REDACTED_RECIPIENT, isRecipientRedactable } from "../lib/recipient-redaction.rules";

const DAY = 86_400_000;
const BATCH = 200;

export function makeRecipientRedactionService(clock: () => Date = () => new Date(), settings: SettingsReader = platformSettings()) {
  return {
    async runOnce(now: Date = clock()): Promise<{ examined: number; redacted: number }> {
      const retentionDays = (await settings.get())["privacy.recipientRetentionDays"];
      const before = new Date(now.getTime() - retentionDays * DAY);
      const candidates = await prisma.booking.findMany({
        where: {
          status: { in: [...BOOKING_TERMINAL_STATUSES] },
          OR: [{ recipientRedactedAt: null }, { recipientRedactedAt: { isSet: false } }],
          AND: [{ OR: [{ completedAt: { lt: before } }, { closedAt: { lt: before } }] }],
        } as never,
        select: { id: true, status: true, completedAt: true, closedAt: true, recipientRedactedAt: true },
        take: BATCH,
      });
      let redacted = 0;
      for (const b of candidates) {
        if (!isRecipientRedactable({ status: b.status, completedAt: b.completedAt, closedAt: b.closedAt, recipientRedactedAt: b.recipientRedactedAt ?? null }, now, retentionDays)) continue;
        await prisma.booking.update({ where: { id: b.id }, data: { recipient: { ...REDACTED_RECIPIENT }, recipientRedactedAt: now } as never });
        redacted += 1;
      }
      return { examined: candidates.length, redacted };
    },
  };
}
export type RecipientRedactionService = ReturnType<typeof makeRecipientRedactionService>;

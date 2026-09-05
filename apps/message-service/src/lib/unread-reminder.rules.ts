/**
 * unread-reminder.rules.ts — quand relancer par email un message non lu (F-PR3, D61 6A)
 * ======================================================================================
 * Règle pure, sans horloge ni base : le service lui donne l'état d'une conversation et
 * l'instant, elle répond « relance due ou non » et pourquoi. Trois garde-fous :
 *  - on ne relance que l'AUTRE partie (jamais l'auteur, jamais pour un message système) ;
 *  - 15 minutes sans lecture avant la première relance ;
 *  - au plus UNE relance par heure et par conversation, et jamais deux fois pour le même
 *    message : une relance déjà postérieure au dernier message a fait son travail.
 */
import { UNREAD_REMINDER_DELAY_MINUTES, UNREAD_REMINDER_MIN_INTERVAL_MINUTES } from "@packages/api-contracts";

export type ReminderRole = "SHIPPER" | "CARRIER";

export type ReminderInput = {
  lastMessageAt: Date | null;
  lastMessageAuthorRole: string | null;
  recipientRole: ReminderRole;
  recipientLastReadAt: Date | null;
  recipientRemindedAt: Date | null;
};

export type ReminderVerdict =
  | { due: true; reason: null }
  | { due: false; reason: "NO_MESSAGE" | "NOT_FROM_COUNTERPART" | "TOO_RECENT" | "ALREADY_READ" | "ALREADY_REMINDED" | "RATE_LIMITED" };

const MIN = 60_000;

export function unreadReminderDue(input: ReminderInput, now: Date): ReminderVerdict {
  if (!input.lastMessageAt) return { due: false, reason: "NO_MESSAGE" };
  const counterpart: ReminderRole = input.recipientRole === "SHIPPER" ? "CARRIER" : "SHIPPER";
  if (input.lastMessageAuthorRole !== counterpart) return { due: false, reason: "NOT_FROM_COUNTERPART" };
  if (input.lastMessageAt.getTime() > now.getTime() - UNREAD_REMINDER_DELAY_MINUTES * MIN) return { due: false, reason: "TOO_RECENT" };
  if (input.recipientLastReadAt && input.recipientLastReadAt.getTime() >= input.lastMessageAt.getTime()) return { due: false, reason: "ALREADY_READ" };
  if (input.recipientRemindedAt) {
    if (input.recipientRemindedAt.getTime() >= input.lastMessageAt.getTime()) return { due: false, reason: "ALREADY_REMINDED" };
    if (input.recipientRemindedAt.getTime() > now.getTime() - UNREAD_REMINDER_MIN_INTERVAL_MINUTES * MIN) return { due: false, reason: "RATE_LIMITED" };
  }
  return { due: true, reason: null };
}

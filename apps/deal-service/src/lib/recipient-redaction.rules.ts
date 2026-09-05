/**
 * recipient-redaction.rules.ts — le tiers destinataire s'oublie (C-PR8b, D63 5A, RGP-02)
 * ======================================================================================
 * Le destinataire d'une réservation n'a pas de compte : son nom, son téléphone et son email
 * vivent dans le snapshot de la réservation pour la remise. `privacy.recipientRetentionDays`
 * (paramètre d'exploitation, D62) après la FIN du deal, on les efface. Jamais avant : un litige
 * ou une preuve de remise peut en avoir besoin. Règle pure, testée sans base.
 */
import { BOOKING_TERMINAL_STATUSES, type BookingStatus } from "@packages/api-contracts";

const DAY = 86_400_000;
export const DEFAULT_RECIPIENT_RETENTION_DAYS = 30;

export type RedactionInput = { status: string; completedAt: Date | null; closedAt: Date | null; recipientRedactedAt: Date | null };

export function bookingEndedAt(b: Pick<RedactionInput, "completedAt" | "closedAt">): Date | null {
  return b.completedAt ?? b.closedAt ?? null;
}

/** Vrai si le deal est terminé depuis plus de `retentionDays` et que le destinataire n'a pas encore été effacé. */
export function isRecipientRedactable(b: RedactionInput, now: Date, retentionDays: number = DEFAULT_RECIPIENT_RETENTION_DAYS): boolean {
  if (b.recipientRedactedAt) return false;
  if (!BOOKING_TERMINAL_STATUSES.includes(b.status as BookingStatus)) return false;
  const ended = bookingEndedAt(b);
  if (!ended) return false;
  return ended.getTime() < now.getTime() - retentionDays * DAY;
}

/** Ce que devient le snapshot : les champs obligatoires portent un marqueur, jamais une chaîne vide ambiguë. */
export const REDACTED_RECIPIENT = { firstName: "—", lastName: "—", phoneE164: "+00000000000", email: null } as const;

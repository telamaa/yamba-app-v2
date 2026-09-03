/**
 * notifications.types.ts — DTO + présentation de la boîte (PR5, Lot 3)
 * =====================================================================
 * Le backend (notification-service, PR4bis) renvoie NotificationView :
 * { id, type (event key), bookingId, payload (payload d'événement A15),
 *   readAt, createdAt }. Ici : le type front, la table de présentation
 * (icône/tone par event key — en DATA, moule du preview) et les helpers
 * d'affichage. Les textes vivent en i18n (namespace "notifications",
 * clés = event key avec "_" : booking.requested → booking_requested).
 */
import {
  BadgeCheck,
  KeyRound,
  Mail,
  PackageCheck,
  PartyPopper,
  Plane,
  Star,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NotificationListItem = {
  id: string;
  /** Event key du contrat (ex. "booking.requested"). */
  type: string;
  bookingId: string | null;
  /** Payload d'événement (A15) — accès défensif via les helpers. */
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};

export type NotificationTone = "amber" | "emerald" | "teal" | "red" | "slate";

export type NotificationPresentation = {
  icon: LucideIcon;
  tone: NotificationTone;
  /** Clé i18n (event key, points remplacés par des underscores). */
  i18nKey: string;
};

const PRESENTATION: Record<string, Omit<NotificationPresentation, "i18nKey">> = {
  "booking.requested": { icon: Mail, tone: "amber" },
  "booking.accepted": { icon: BadgeCheck, tone: "emerald" },
  "booking.declined": { icon: Mail, tone: "slate" },
  "booking.expired": { icon: Mail, tone: "slate" },
  "booking.cancelled": { icon: Mail, tone: "slate" },
  "booking.picked_up": { icon: KeyRound, tone: "amber" },
  "booking.pickup_refused": { icon: Mail, tone: "red" },
  "booking.tracking_event": { icon: Plane, tone: "teal" },
  "booking.delivered": { icon: PackageCheck, tone: "emerald" },
  "booking.completed": { icon: PartyPopper, tone: "emerald" },
  "booking.payout_sent": { icon: Wallet, tone: "emerald" },
  "booking.disputed": { icon: BadgeCheck, tone: "red" },
  "booking.verification_reminder": { icon: Star, tone: "amber" },
  "booking.rating_reminder": { icon: Star, tone: "amber" },
  "booking.rating_revealed": { icon: PartyPopper, tone: "emerald" },
};

/** Fallback : un event key inconnu (18e événement futur) s'affiche
 *  neutre plutôt que de casser la liste. */
const FALLBACK: Omit<NotificationPresentation, "i18nKey"> = {
  icon: Mail,
  tone: "slate",
};

export function getNotificationPresentation(
  type: string
): NotificationPresentation {
  const base = PRESENTATION[type] ?? FALLBACK;
  return { ...base, i18nKey: type.replace(/\./g, "_") };
}

/* ── Accès défensif au payload (Record<string, unknown>) ─────── */

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** "Paris → Brazzaville" — depuis payload.corridor, sinon undefined. */
export function getCorridorLabel(
  payload: Record<string, unknown>
): string | undefined {
  const corridor = payload.corridor as Record<string, unknown> | undefined;
  if (!corridor) return undefined;
  const origin = str(corridor.originCity);
  const destination = str(corridor.destinationCity);
  return origin && destination ? origin + " → " + destination : undefined;
}

export function getWeightKg(
  payload: Record<string, unknown>
): number | undefined {
  const weight = payload.weightKg;
  return typeof weight === "number" ? weight : undefined;
}

/* ── Temps relatif ("il y a 2 h" / "2 h ago") ────────────────── */

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function formatWhen(
  createdAtIso: string,
  nowMs: number,
  locale: string
): string {
  const diff = Math.max(0, nowMs - new Date(createdAtIso).getTime());
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((diff % HOUR_MS) / 60_000);
  const fr = locale === "fr";
  if (days > 0) return fr ? `il y a ${days} j` : `${days} d ago`;
  if (hours > 0) return fr ? `il y a ${hours} h` : `${hours} h ago`;
  return fr ? `il y a ${minutes} min` : `${minutes} min ago`;
}

/** Un type est "connu" s'il a une entrée de présentation dédiée —
 *  sinon la section affiche le titre fallback (18e événement futur). */
export function isKnownNotificationType(type: string): boolean {
  return type in PRESENTATION;
}

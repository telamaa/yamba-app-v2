/* ── Types ─────────────────────────────────── */

export type TripStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type TransportMode = "PLANE" | "TRAIN" | "CAR";

export type TripListItem = {
  id: string;
  status: TripStatus;
  transportMode: TransportMode | null;
  tripType: string;
  originLabel: string | null;
  originCity: string | null;
  destinationLabel: string | null;
  destinationCity: string | null;
  departureDateLocal: string | null;
  arrivalDateLocal: string | null;
  departureTimeLocal: string | null;
  arrivalTimeLocal: string | null;
  travelReference: string | null;
  acceptedCategories: string[];
  handDeliveryOnly: boolean;
  instantBooking: boolean;
  publishedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/* ── Colors ───────────────────────────────── */

export const MANGO = "#FF9900";
export const TEAL = "#0F766E";

/* ── Status display config ────────────────── */
// ⭐ i18n : les labels vivent dans messages/{locale}/myTrips.json sous
// `status.*` — les composants font t(STATUS_CONFIG[status].labelKey).

export type StatusDisplay = {
  /** Clé i18n dans le namespace "myTrips" (ex: "status.DRAFT") */
  labelKey: string;
  bg: string;
  text: string;
  dot: string;
};

export const STATUS_CONFIG: Record<TripStatus, StatusDisplay> = {
  DRAFT: {
    labelKey: "status.DRAFT",
    bg: "rgba(100,116,139,0.12)", text: "#94a3b8", dot: "#64748b",
  },
  PUBLISHED: {
    labelKey: "status.PUBLISHED",
    bg: "rgba(16,185,129,0.12)", text: "#34d399", dot: "#10b981",
  },
  PAUSED: {
    labelKey: "status.PAUSED",
    bg: "rgba(245,158,11,0.12)", text: "#fbbf24", dot: "#f59e0b",
  },
  COMPLETED: {
    labelKey: "status.COMPLETED",
    bg: "rgba(15,118,110,0.12)", text: "#5eead4", dot: TEAL,
  },
  CANCELLED: {
    labelKey: "status.CANCELLED",
    bg: "rgba(239,68,68,0.10)", text: "#f87171", dot: "#ef4444",
  },
  ARCHIVED: {
    labelKey: "status.ARCHIVED",
    bg: "rgba(100,116,139,0.08)", text: "#64748b", dot: "#475569",
  },
};

/* ── Transport labels ─────────────────────── */

/** Clés i18n (namespace "myTrips") — t(TRANSPORT_LABEL_KEYS[mode]) */
export const TRANSPORT_LABEL_KEYS: Record<TransportMode, string> = {
  PLANE: "transport.PLANE",
  TRAIN: "transport.TRAIN",
  CAR: "transport.CAR",
};

/* ── Action definitions ───────────────────── */

export type TripActionKey =
  | "view"
  | "viewPublic"
  | "edit"
  | "activate"        // DRAFT → PUBLISHED (ou PAUSED → PUBLISHED)
  | "pause"           // PUBLISHED → PAUSED
  | "revertToDraft"   // PUBLISHED/PAUSED → DRAFT
  | "duplicate"
  | "archive"
  | "restoreDraft"    // CANCELLED → DRAFT
  | "cancel"
  | "delete";

export type TripAction = {
  key: TripActionKey;
  /** Clé i18n dans le namespace "myTrips" (ex: "actionsMenu.view") */
  labelKey: string;
  icon: string;
  danger: boolean;
  needsConfirm: boolean;
};

export function getActionsForStatus(
  status: TripStatus,
  isPastDeparture: boolean
): TripAction[] {
  const a = (
    key: TripActionKey,
    labelKey: string,
    icon: string,
    danger = false,
    needsConfirm = false
  ): TripAction => ({ key, labelKey, icon, danger, needsConfirm });

  const actions: TripAction[] = [
    a("view", "actionsMenu.view", "eye"),
  ];

  if (["PUBLISHED", "PAUSED", "COMPLETED"].includes(status)) {
    actions.push(a("viewPublic", "actionsMenu.viewPublic", "external"));
  }

  if (["DRAFT", "PUBLISHED", "PAUSED"].includes(status))
    actions.push(a("edit", "actionsMenu.edit", "pencil"));

  // Activate pour DRAFT / Resume pour PAUSED (même key, label distinct)
  if (status === "DRAFT" && !isPastDeparture)
    actions.push(a("activate", "actionsMenu.activate", "zap"));

  if (status === "PAUSED" && !isPastDeparture)
    actions.push(a("activate", "actionsMenu.resume", "play"));

  if (status === "PUBLISHED")
    actions.push(a("pause", "actionsMenu.pause", "pause"));

  if (["PUBLISHED", "PAUSED"].includes(status))
    actions.push(a("revertToDraft", "actionsMenu.revertToDraft", "file-text"));

  actions.push(a("duplicate", "actionsMenu.duplicate", "copy"));

  if (["COMPLETED", "CANCELLED"].includes(status))
    actions.push(a("archive", "actionsMenu.archive", "archive"));

  if (status === "CANCELLED" && !isPastDeparture)
    actions.push(a("restoreDraft", "actionsMenu.restoreDraft", "rotate"));

  if (["PUBLISHED", "PAUSED"].includes(status))
    actions.push(a("cancel", "actionsMenu.cancel", "x-circle", true, true));

  if (status === "DRAFT")
    actions.push(a("delete", "actionsMenu.delete", "trash", true, true));

  return actions;
}

/* ── Helpers ──────────────────────────────── */

/**
 * Formate une date locale de trajet ("2026-04-26") pour l'affichage.
 * i18n : accepte n'importe quelle locale ("fr", "en", "pt", ...) —
 * Intl gère nativement. Passer useLocale() de next-intl.
 */
export function formatTripDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(locale, {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function isTripPastDeparture(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr + "T23:59:59") < new Date();
}

/* ── Pagination ───────────────────────────── */

export const TRIPS_PER_PAGE = 10;

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
  pendingDemandsCount?: number;
};

/* ── Colors ───────────────────────────────── */

export const MANGO = "#FF9900";
export const TEAL = "#0F766E";

/* ── Status display config ────────────────── */

export type StatusDisplay = {
  labelFr: string;
  labelEn: string;
  bg: string;
  text: string;
  dot: string;
};

export const STATUS_CONFIG: Record<TripStatus, StatusDisplay> = {
  DRAFT: {
    labelFr: "Brouillon", labelEn: "Draft",
    bg: "rgba(100,116,139,0.12)", text: "#94a3b8", dot: "#64748b",
  },
  PUBLISHED: {
    labelFr: "Actif", labelEn: "Active",
    bg: "rgba(16,185,129,0.12)", text: "#34d399", dot: "#10b981",
  },
  PAUSED: {
    labelFr: "En pause", labelEn: "Paused",
    bg: "rgba(245,158,11,0.12)", text: "#fbbf24", dot: "#f59e0b",
  },
  COMPLETED: {
    labelFr: "Terminé", labelEn: "Completed",
    bg: "rgba(15,118,110,0.12)", text: "#5eead4", dot: TEAL,
  },
  CANCELLED: {
    labelFr: "Annulé", labelEn: "Cancelled",
    bg: "rgba(239,68,68,0.10)", text: "#f87171", dot: "#ef4444",
  },
  ARCHIVED: {
    labelFr: "Archivé", labelEn: "Archived",
    bg: "rgba(100,116,139,0.08)", text: "#64748b", dot: "#475569",
  },
};

/* ── Transport labels ─────────────────────── */

export const TRANSPORT_LABELS: Record<TransportMode, { fr: string; en: string }> = {
  PLANE: { fr: "Avion", en: "Plane" },
  TRAIN: { fr: "Train", en: "Train" },
  CAR: { fr: "Voiture", en: "Car" },
};

/* ── Action definitions ───────────────────── */

export type TripActionKey =
  | "view"
  | "viewPublic"
  | "edit"
  | "activate"        // NEW: DRAFT → PUBLISHED (or PAUSED → PUBLISHED)
  | "pause"           // PUBLISHED → PAUSED
  | "revertToDraft"   // NEW: PUBLISHED/PAUSED → DRAFT
  | "duplicate"
  | "archive"
  | "restoreDraft"    // NEW: CANCELLED → DRAFT
  | "cancel"
  | "delete";

export type TripAction = {
  key: TripActionKey;
  labelFr: string;
  labelEn: string;
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
    labelFr: string,
    labelEn: string,
    icon: string,
    danger = false,
    needsConfirm = false
  ): TripAction => ({ key, labelFr, labelEn, icon, danger, needsConfirm });

  const actions: TripAction[] = [
    a("view", "Voir le détail", "View details", "eye"),
  ];

  if (["PUBLISHED", "PAUSED", "COMPLETED"].includes(status)) {
    actions.push(a("viewPublic", "Voir en tant qu'expéditeur", "View as shipper", "external"));
  }

  if (["DRAFT", "PUBLISHED", "PAUSED"].includes(status))
    actions.push(a("edit", "Modifier", "Edit", "pencil"));

  // NEW: Activate action for DRAFT and PAUSED
  if (status === "DRAFT" && !isPastDeparture)
    actions.push(a("activate", "Activer", "Activate", "zap"));

  if (status === "PAUSED" && !isPastDeparture)
    actions.push(a("activate", "Reprendre", "Resume", "play"));

  // Pause for PUBLISHED
  if (status === "PUBLISHED")
    actions.push(a("pause", "Mettre en pause", "Pause", "pause"));

  // NEW: Revert to draft (PUBLISHED/PAUSED → DRAFT)
  if (["PUBLISHED", "PAUSED"].includes(status))
    actions.push(a("revertToDraft", "Repasser en brouillon", "Revert to draft", "file-text"));

  actions.push(a("duplicate", "Dupliquer", "Duplicate", "copy"));

  if (["COMPLETED", "CANCELLED"].includes(status))
    actions.push(a("archive", "Archiver", "Archive", "archive"));

  // NEW: Restore cancelled as draft
  if (status === "CANCELLED" && !isPastDeparture)
    actions.push(a("restoreDraft", "Restaurer en brouillon", "Restore as draft", "rotate"));

  if (["PUBLISHED", "PAUSED"].includes(status))
    actions.push(a("cancel", "Annuler", "Cancel", "x-circle", true, true));

  if (status === "DRAFT")
    actions.push(a("delete", "Supprimer", "Delete", "trash", true, true));

  return actions;
}

/* ── Helpers ──────────────────────────────── */

export function formatTripDate(dateStr: string | null, isFr: boolean): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(isFr ? "fr-FR" : "en-US", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function isTripPastDeparture(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr + "T23:59:59") < new Date();
}

/* ── Pagination ───────────────────────────── */

export const TRIPS_PER_PAGE = 10;

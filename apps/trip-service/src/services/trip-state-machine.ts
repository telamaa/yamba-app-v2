/**
 * trip-state-machine.ts
 * =====================
 * Source de vérité SERVER-SIDE du cycle de vie d'un Trip.
 *
 * Tous les endpoints lifecycle du trip.controller doivent passer par
 * `canPerform()` au lieu de checks ad hoc. Le frontend (my-trips.config.ts)
 * ne fait que REFLÉTER ce que cette machine autorise — jamais l'inverse.
 *
 * Emplacement : apps/trip-service/src/services/trip-state-machine.ts
 *
 * v2 (Lot 3) : isPastArrival retombe sur departureAt quand arrivalAt est
 * absent — publishTrip n'exige que departureAt, donc un trip publié sans
 * date d'arrivée ne se serait jamais terminé via le cron complete-trips.
 *
 * Design :
 * - Zéro dépendance (ni Prisma, ni Express) → testable unitairement.
 * - Les guards retournent un message d'erreur (string) ou null si OK.
 *   Le controller enveloppe le message dans ValidationError.
 * - `ctx.hasActiveBookings` est STUBBÉ à false tant que le Booking model
 *   n'existe pas. Au chantier Deal lifecycle, on branchera la vraie requête
 *   (count des bookings non terminaux) sans toucher à cette machine.
 *
 * Mapping machine → endpoints → clés frontend (TripActionKey) :
 * ┌───────────────┬──────────────────────────────┬──────────────────┐
 * │ Machine       │ Endpoint                     │ Front            │
 * ├───────────────┼──────────────────────────────┼──────────────────┤
 * │ publish       │ POST /trips/:id/publish      │ activate (DRAFT) │
 * │ pause         │ POST /trips/:id/pause        │ pause            │
 * │ resume        │ POST /trips/:id/resume       │ activate (PAUSED)│
 * │ unpublish     │ POST /trips/:id/unpublish    │ revertToDraft    │
 * │ restore       │ POST /trips/:id/restore      │ restoreDraft     │
 * │ cancel        │ POST /trips/:id/cancel       │ cancel           │
 * │               │ (+ DELETE /trips/:id alias)  │                  │
 * │ delete        │ DELETE /trips/:id?hard=true  │ delete           │
 * │               │ (soft delete → deletedAt)    │                  │
 * │ archive       │ POST /trips/:id/archive      │ archive          │
 * │ complete      │ (cron uniquement)            │ —                │
 * │ edit          │ PUT /trips/:id               │ edit             │
 * │ view          │ GET /trips/:id               │ view             │
 * │ viewPublic    │ GET /trips/:id/public        │ viewPublic       │
 * │ duplicate     │ (composé côté front)         │ duplicate        │
 * └───────────────┴──────────────────────────────┴──────────────────┘
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type TripStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

/** Actions avec transition de statut */
export type TripTransitionAction =
  | "publish"
  | "pause"
  | "resume"
  | "unpublish"
  | "restore"
  | "cancel"
  | "delete"
  | "archive"
  | "complete";

/** Actions sans transition (lecture / édition / duplication) */
export type TripReadAction = "view" | "viewPublic" | "edit" | "duplicate";

export type TripAction = TripTransitionAction | TripReadAction;

/**
 * Sous-ensemble de Trip nécessaire à la machine.
 * On accepte Date ou string ISO pour rester compatible avec les
 * objets Prisma comme avec les DTOs sérialisés.
 */
export type TripLike = {
  status: TripStatus;
  isDeleted?: boolean | null;
  departureAt?: Date | string | null;
  arrivalAt?: Date | string | null;
};

export type TripLifecycleContext = {
  /**
   * ⚠️ STUB — Booking model pas encore implémenté.
   * À brancher au chantier Deal lifecycle sur :
   *   prisma.booking.count({ where: { tripId, status: { notIn: TERMINAL } } }) > 0
   */
  hasActiveBookings: boolean;
  /** Horloge injectable pour les tests. Défaut : new Date() */
  now?: Date;
};

export type TransitionCheck =
  | { allowed: true; to: TripStatus | null }
  | { allowed: false; reason: string };

// ─────────────────────────────────────────────
// Helpers dates
// ─────────────────────────────────────────────

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isPastDeparture(trip: TripLike, now: Date = new Date()): boolean {
  const dep = toDate(trip.departureAt);
  return dep !== null && dep < now;
}

/**
 * Le voyage est-il physiquement terminé ?
 * v2 : si arrivalAt est absent (publishTrip n'exige que departureAt),
 * on retombe sur departureAt — sinon un trip publié sans date d'arrivée
 * ne se terminerait jamais via le cron complete-trips.
 */
export function isPastArrival(trip: TripLike, now: Date = new Date()): boolean {
  const arr = toDate(trip.arrivalAt) ?? toDate(trip.departureAt);
  return arr !== null && arr < now;
}

// ─────────────────────────────────────────────
// Définition des transitions
// ─────────────────────────────────────────────

type GuardFn = (trip: TripLike, ctx: Required<TripLifecycleContext>) => string | null;

type TransitionDef = {
  /** Statuts depuis lesquels l'action est légale */
  from: TripStatus[];
  /**
   * Statut cible. `null` pour les actions sans changement de statut
   * (view/edit/duplicate) et pour `delete` (soft delete via deletedAt,
   * le statut reste inchangé mais le trip sort de toutes les listes).
   */
  to: TripStatus | null;
  guard?: GuardFn;
};

const notPastDeparture: GuardFn = (trip, ctx) =>
  isPastDeparture(trip, ctx.now)
    ? "Cannot perform this action: the departure date has passed."
    : null;

const noActiveBookings =
  (message: string): GuardFn =>
    (_trip, ctx) =>
      ctx.hasActiveBookings ? message : null;

const ALL_STATUSES: TripStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

const TRANSITIONS: Record<TripAction, TransitionDef> = {
  // ── Lecture ──────────────────────────────
  view: { from: ALL_STATUSES, to: null },
  viewPublic: { from: ["PUBLISHED", "PAUSED", "COMPLETED"], to: null },
  duplicate: { from: ALL_STATUSES, to: null },

  // ── Édition ──────────────────────────────
  // DRAFT : toujours éditable.
  // PUBLISHED / PAUSED : éditable UNIQUEMENT sans réservation active
  // (pattern BlaBlaCar strict : trajet réservé = intouchable).
  edit: {
    from: ["DRAFT", "PUBLISHED", "PAUSED"],
    guard: (trip, ctx) =>
      trip.status !== "DRAFT" && ctx.hasActiveBookings
        ? "Cannot edit a trip with active bookings. Cancel the trip instead."
        : null,
    to: null,
  },

  // ── Cycle de vie ─────────────────────────
  publish: {
    from: ["DRAFT"],
    to: "PUBLISHED",
    guard: notPastDeparture,
  },
  pause: {
    // Pause = masquer de la recherche. Les réservations en cours
    // continuent leur vie → pas de guard booking.
    from: ["PUBLISHED"],
    to: "PAUSED",
  },
  resume: {
    from: ["PAUSED"],
    to: "PUBLISHED",
    guard: notPastDeparture,
  },
  unpublish: {
    // Repasser en brouillon = retirer le trajet du monde.
    // Interdit avec réservations actives : un expéditeur a payé
    // pour un trajet qui existe.
    from: ["PUBLISHED", "PAUSED"],
    to: "DRAFT",
    guard: noActiveBookings(
      "Cannot revert to draft: this trip has active bookings. Cancel the trip instead."
    ),
  },
  restore: {
    from: ["CANCELLED"],
    to: "DRAFT",
    guard: notPastDeparture,
  },
  cancel: {
    // Autorisé même avec réservations actives — mais dans ce cas le
    // controller devra déclencher les side-effects (remboursements,
    // notifications expéditeurs) au chantier Booking.
    from: ["PUBLISHED", "PAUSED"],
    to: "CANCELLED",
  },
  delete: {
    // Soft delete — réservé aux brouillons. Le controller pose
    // isDeleted=true + deletedAt, le statut ne change pas.
    from: ["DRAFT"],
    to: null,
  },
  archive: {
    // One-way (décision MVP) : pas de désarchivage, Dupliquer reste
    // disponible sur un trip archivé.
    from: ["COMPLETED", "CANCELLED"],
    to: "ARCHIVED",
  },
  complete: {
    // Réservé au cron (jamais exposé en endpoint user).
    // Règle 1 (MVP, sans Booking) : arrivée passée + aucune réservation.
    // Règle 2 (chantier Booking) : tous les deals en état terminal
    // logistique — litiges NON bloquants.
    from: ["PUBLISHED", "PAUSED"],
    to: "COMPLETED",
    guard: (trip, ctx) => {
      if (!isPastArrival(trip, ctx.now)) {
        return "Cannot complete a trip before its arrival date.";
      }
      if (ctx.hasActiveBookings) {
        return "Cannot complete a trip with bookings still in progress.";
      }
      return null;
    },
  },
};

// ─────────────────────────────────────────────
// API publique de la machine
// ─────────────────────────────────────────────

/**
 * Vérifie si `action` est légale pour ce trip dans ce contexte.
 * Ne modifie rien — le controller applique la transition retournée.
 */
export function canPerform(
  trip: TripLike,
  action: TripAction,
  ctx: TripLifecycleContext
): TransitionCheck {
  // Un trip soft-deleted est mort pour toutes les actions.
  if (trip.isDeleted) {
    return { allowed: false, reason: "Trip not found." };
  }

  const def = TRANSITIONS[action];
  if (!def) {
    return { allowed: false, reason: `Unknown action "${action}".` };
  }

  if (!def.from.includes(trip.status)) {
    return {
      allowed: false,
      reason: `Action "${action}" is not allowed from status ${trip.status}.`,
    };
  }

  const fullCtx: Required<TripLifecycleContext> = {
    hasActiveBookings: ctx.hasActiveBookings,
    now: ctx.now ?? new Date(),
  };

  const guardError = def.guard?.(trip, fullCtx) ?? null;
  if (guardError) {
    return { allowed: false, reason: guardError };
  }

  return { allowed: true, to: def.to };
}

/**
 * Liste des actions autorisées pour ce trip — à exposer dans les DTOs
 * (getMyTrips / getTrip) pour que le front affiche exactement ce que
 * l'API accepte, sans dupliquer la logique.
 */
export function getAllowedActions(
  trip: TripLike,
  ctx: TripLifecycleContext
): TripAction[] {
  return (Object.keys(TRANSITIONS) as TripAction[]).filter(
    (action) => action !== "complete" && canPerform(trip, action, ctx).allowed
  );
}

// ─────────────────────────────────────────────
// Comptabilité carrier — pool public
// ─────────────────────────────────────────────
// `totalTripsPublished` doit refléter les trips visibles ou en pause,
// c'est-à-dire le "pool public" = { PUBLISHED, PAUSED }.
// Les deltas se calculent sur la TRANSITION (from → to), jamais sur le
// statut courant seul — c'est ce qui corrige le bug du chemin PAUSED
// (publish +1, pause, puis cancel/unpublish qui ne décrémentait pas).

const PUBLIC_POOL: ReadonlySet<TripStatus> = new Set(["PUBLISHED", "PAUSED"]);

export function entersPublicPool(from: TripStatus, to: TripStatus): boolean {
  return !PUBLIC_POOL.has(from) && PUBLIC_POOL.has(to);
}

export function leavesPublicPool(from: TripStatus, to: TripStatus): boolean {
  return PUBLIC_POOL.has(from) && !PUBLIC_POOL.has(to);
}

/**
 * Deltas à appliquer sur CarrierPage lors d'une transition.
 * Usage controller :
 *   const deltas = getCarrierStatDeltas(trip.status, check.to);
 *   if (deltas) await prisma.carrierPage.update({ ..., data: deltas });
 */
export function getCarrierStatDeltas(
  from: TripStatus,
  to: TripStatus | null
): { totalTripsPublished?: { increment: number } | { decrement: number }; totalTripsCancelled?: { increment: number } } | null {
  if (to === null || from === to) return null;

  const deltas: {
    totalTripsPublished?: { increment: number } | { decrement: number };
    totalTripsCancelled?: { increment: number };
  } = {};

  if (entersPublicPool(from, to)) {
    deltas.totalTripsPublished = { increment: 1 };
  } else if (leavesPublicPool(from, to)) {
    deltas.totalTripsPublished = { decrement: 1 };
  }

  if (to === "CANCELLED") {
    deltas.totalTripsCancelled = { increment: 1 };
  }

  return Object.keys(deltas).length > 0 ? deltas : null;
}

// ─────────────────────────────────────────────
// Stub booking — point de branchement unique
// ─────────────────────────────────────────────

/**
 * ⚠️ STUB — retourne toujours false tant que le Booking model n'existe pas.
 * Au chantier Deal lifecycle, remplacer le corps par la vraie requête :
 *
 *   const count = await prisma.booking.count({
 *     where: { tripId, status: { notIn: BOOKING_TERMINAL_STATUSES } },
 *   });
 *   return count > 0;
 *
 * Le reste du code (controller, machine) ne bougera pas.
 */
export async function hasActiveBookings(_tripId: string): Promise<boolean> {
  return false;
}

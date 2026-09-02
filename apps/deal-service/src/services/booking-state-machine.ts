/**
 * booking-state-machine.ts
 * ========================
 * Source de vérité SERVER-SIDE du cycle de vie d'un Deal (Booking).
 * Miroir exécutable de SPECIFICATIONS-WORKFLOW-YAMBA.md §2.2 et des
 * matrices ANN-01 / ANN-02 / CAP-02 (règles métier v1.2).
 *
 * Emplacement : apps/deal-service/src/services/booking-state-machine.ts
 *
 * Design (hérité de trip-state-machine, étendu) :
 * - Zéro dépendance d'infrastructure (ni Prisma, ni Express) →
 *   testable unitairement. Seule dépendance : les ensembles de statuts
 *   partagés de @packages/api-contracts (A19, source unique).
 * - L'ACTEUR fait partie de la transition : `cancel` depuis ACCEPTED
 *   n'a pas les mêmes effets selon SHIPPER (ANN-01) ou CARRIER (ANN-02).
 * - Les EFFETS DE BORD sont déclarés en data, pas codés dans les
 *   endpoints (généralisation de getCarrierStatDeltas). En B1, seuls
 *   RELEASE_CAPACITY et l'écriture outbox sont exécutés ; B2-B5
 *   brancheront les exécuteurs paiement/notification sans toucher ici.
 * - Guards à horloge injectée : un PENDING dont expiresAt est passé se
 *   comporte comme EXPIRED avant même le passage du cron.
 * - Les messages d'erreur (surface publique API) sont en ANGLAIS ;
 *   commentaires internes en français (convention repo).
 *
 * Hors machine (validations service, PAS des transitions) :
 * - Comparaison bcrypt du code de livraison (le guard ne vérifie que
 *   lock + compteur ; le service incrémente deliveryAttempts).
 * - Checklist pickup 5/5 + ≥1 photo (validation de payload, B3).
 * - Événements de tracking : séquenceur canConfirmTrackingStep ci-bas.
 * - Régénération du code : canRegenerateCode ci-bas.
 *
 * Résolutions ADMIN du chantier C (médiation DISPUTED → COMPLETED ou
 * remboursement) : l'acteur ADMIN est réservé dans le type mais AUCUNE
 * transition ne l'utilise encore — la matrice de remboursement
 * médiation n'est pas spécifiée. DISPUTED est terminal dans cette v1.
 */

// A19 — source unique des ensembles de statuts (partagée avec
// trip-service). Import en tête, re-export plus bas (backward compat).
import {
  BOOKING_ACTIVE_STATUSES,
  BOOKING_TERMINAL_STATUSES,
} from "@packages/api-contracts";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type BookingStatus =
  | "PENDING"
  | "ACCEPTED"
  | "PICKED_UP"
  | "DELIVERED"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"
  | "DISPUTED";

export type BookingActor = "SHIPPER" | "CARRIER" | "SYSTEM" | "ADMIN";

/** Actions avec transition de statut */
export type BookingTransitionAction =
  | "accept"
  | "decline"
  | "expire"
  | "cancel"
  | "pickup"
  | "refusePickup"
  | "deliver"
  | "confirmEarly"
  | "autoComplete"
  | "dispute";

/** Opérations gardées SANS transition de statut */
export type BookingGuardedOperation = "regenerateCode" | "confirmTrackingStep";

// ─────────────────────────────────────────────
// Constantes serveur (spec §5.4)
// ─────────────────────────────────────────────

export const MAX_CODE_REGENERATIONS = 5;
export const MAX_DELIVERY_ATTEMPTS = 3;
export const DELIVERY_LOCK_MINUTES = 15;
/** J+4 : payoutDueAt = deliveredAt + PAYOUT_DELAY_DAYS (spec §3.5 — cron B4). */
export const PAYOUT_DELAY_DAYS = 4;

/** Séquence stricte des jalons de tracking (dans PICKED_UP) */
export const TRACKING_SEQUENCE = [
  "AT_AIRPORT",
  "FLIGHT_DEPARTED",
  "FLIGHT_ARRIVED",
] as const;
export type TrackingStep = (typeof TRACKING_SEQUENCE)[number];

/**
 * A19 — les ensembles ACTIF/TERMINAL/BLOQUANT-COMPLÉTION vivent dans
 * @packages/api-contracts/booking/booking.enums.ts (source UNIQUE,
 * partagée avec trip-service). Re-exportés ici pour la compatibilité
 * des imports existants (spec, services du deal-service).
 * DISPUTED est ACTIF (conserve les kg) mais ne bloque PAS la
 * complétion du trip — cette nuance vit dans
 * BOOKING_COMPLETION_BLOCKING_STATUSES (A20), consommée côté trip.
 */
export { BOOKING_ACTIVE_STATUSES, BOOKING_TERMINAL_STATUSES };

// ─────────────────────────────────────────────
// Effets de bord déclarés (exécutés en B2-B5)
// ─────────────────────────────────────────────

export type BookingEffect =
  | "RELEASE_CAPACITY" // CAP-02 — décrémenter Trip.reservedKg (exécuté dès B1/PR3)
  | "CAPTURE_PAYMENT" // D39 — capture de l'empreinte à l'acceptation (B2)
  | "FULL_REFUND" // remboursement 100 % transport + prime (B2)
  | "REFUND_PER_CANCELLATION_POLICY" // ANN-01 — barème J-2 calculé au moment T (B2)
  | "PENALIZE_CARRIER" // ANN-02 — impact réputation Voyageur (B5)
  | "GENERATE_CODE" // code 6 chiffres, hash bcrypt stocké (B3)
  | "REVEAL_CODE_TO_SHIPPER" // le code n'est JAMAIS montré au carrier (B3)
  | "SCHEDULE_PAYOUT" // payoutDueAt = deliveredAt + J+4 (B4)
  | "TRANSFER_PAYOUT" // Stripe transfers.create() (B4)
  | "FREEZE_PAYOUT" // litige : gel du versement (B4)
  | "CREATE_TICKET" // ticket YAM-XXXX (B4)
  | "UPDATE_STATS" // parcelsSentCount / totalParcelsCarried (B5)
  | "INVITE_RATING" // notation mutuelle double-aveugle (B5)
  | "NOTIFY_SHIPPER"
  | "NOTIFY_CARRIER";

// ─────────────────────────────────────────────
// Sous-ensemble de Booking nécessaire à la machine
// ─────────────────────────────────────────────

export type BookingLike = {
  status: BookingStatus;
  isDeleted?: boolean | null;
  expiresAt?: Date | string | null;
  payoutDueAt?: Date | string | null;
  deliveryLockedUntil?: Date | string | null;
  deliveryAttempts?: number | null;
  codeRegenerations?: number | null;
};

export type BookingLifecycleContext = {
  /** Horloge injectable pour les tests. Défaut : new Date() */
  now?: Date;
};

export type BookingTransitionCheck =
  | { allowed: true; to: BookingStatus; effects: readonly BookingEffect[] }
  | { allowed: false; reason: string };

export type BookingOperationCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

// ─────────────────────────────────────────────
// Helpers dates
// ─────────────────────────────────────────────

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** PENDING périmé : se comporte comme EXPIRED avant même le cron */
export function isExpired(booking: BookingLike, now: Date = new Date()): boolean {
  const exp = toDate(booking.expiresAt);
  return exp !== null && exp < now;
}

export function isPayoutDue(booking: BookingLike, now: Date = new Date()): boolean {
  const due = toDate(booking.payoutDueAt);
  return due !== null && due <= now;
}

export function isDeliveryLocked(
  booking: BookingLike,
  now: Date = new Date()
): boolean {
  const until = toDate(booking.deliveryLockedUntil);
  return until !== null && until > now;
}

// ─────────────────────────────────────────────
// Définition des transitions (from × action × acteur)
// ─────────────────────────────────────────────

type GuardFn = (
  booking: BookingLike,
  ctx: Required<BookingLifecycleContext>
) => string | null;

type TransitionDef = {
  from: BookingStatus;
  action: BookingTransitionAction;
  actor: BookingActor;
  to: BookingStatus;
  effects: readonly BookingEffect[];
  guard?: GuardFn;
};

const notExpired: GuardFn = (booking, ctx) =>
  isExpired(booking, ctx.now)
    ? "This request has expired and can no longer be actioned."
    : null;

const onlyIfExpired: GuardFn = (booking, ctx) =>
  isExpired(booking, ctx.now)
    ? null
    : "Cannot expire a request before its expiry time.";

const onlyIfPayoutDue: GuardFn = (booking, ctx) =>
  isPayoutDue(booking, ctx.now)
    ? null
    : "Cannot auto-complete before the payout due date.";

const beforePayoutDue: GuardFn = (booking, ctx) =>
  isPayoutDue(booking, ctx.now)
    ? "The verification period has ended; this deal can no longer be disputed."
    : null;

const deliveryAllowed: GuardFn = (booking, ctx) => {
  if (isDeliveryLocked(booking, ctx.now)) {
    return "Delivery confirmation is temporarily locked. Please try again later.";
  }
  if ((booking.deliveryAttempts ?? 0) >= MAX_DELIVERY_ATTEMPTS) {
    return "Maximum delivery code attempts reached. Delivery is locked.";
  }
  return null;
};

/**
 * LA table — miroir du §2.2. Toute divergence avec la spec est un bug
 * ici, jamais une "interprétation" dans un controller.
 *
 * Absences DÉLIBÉRÉES (testées par assertion explicite) :
 * - Aucun `cancel` depuis PICKED_UP ni DELIVERED (ANN-01 : après
 *   remise du colis, la seule voie de sortie est `dispute`).
 * - Aucune transition ADMIN (résolutions de litige : chantier C).
 * - Aucune transition depuis COMPLETED / DECLINED / EXPIRED /
 *   CANCELLED (terminaux) ni depuis DISPUTED (terminal v1).
 */
const TRANSITIONS: readonly TransitionDef[] = [
  // ── PENDING ──────────────────────────────
  {
    from: "PENDING",
    action: "accept",
    actor: "CARRIER",
    to: "ACCEPTED",
    // D39 — la capture a lieu À l'acceptation (jamais à J-1 : une
    // empreinte carte expire ~7 jours). Le gate D31 (profil + Stripe)
    // est une validation de service, pas une transition.
    effects: ["CAPTURE_PAYMENT", "NOTIFY_SHIPPER"],
    guard: notExpired,
  },
  {
    from: "PENDING",
    action: "decline",
    actor: "CARRIER",
    to: "DECLINED",
    effects: ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
    guard: notExpired,
  },
  {
    from: "PENDING",
    action: "expire",
    actor: "SYSTEM",
    to: "EXPIRED",
    effects: ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
    guard: onlyIfExpired,
  },
  {
    from: "PENDING",
    action: "cancel",
    actor: "SHIPPER",
    to: "CANCELLED",
    effects: ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_CARRIER"],
  },
  {
    from: "PENDING",
    action: "cancel",
    actor: "SYSTEM",
    to: "CANCELLED",
    // D40 — l'empreinte de paiement est morte SEULE (expiration ~7 j,
    // annulation côté fournisseur, webhook payment_intent.canceled) :
    // plus d'argent à libérer, seulement les kg et l'information.
    // Pas de guard d'expiration : l'événement Stripe fait foi.
    effects: ["RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
  },

  // ── ACCEPTED ─────────────────────────────
  {
    from: "ACCEPTED",
    action: "cancel",
    actor: "SHIPPER",
    to: "CANCELLED",
    // ANN-01 : 100 % si ≥ J-2 du départ, sinon partiel — le BARÈME est
    // calculé par le module remboursement (B2) au moment T ; la machine
    // déclare seulement la nature de l'effet.
    effects: ["REFUND_PER_CANCELLATION_POLICY", "RELEASE_CAPACITY", "NOTIFY_CARRIER"],
  },
  {
    from: "ACCEPTED",
    action: "cancel",
    actor: "CARRIER",
    to: "CANCELLED",
    // ANN-02 : défaut du Voyageur → remboursement intégral + réputation.
    effects: ["FULL_REFUND", "RELEASE_CAPACITY", "PENALIZE_CARRIER", "NOTIFY_SHIPPER"],
  },
  {
    from: "ACCEPTED",
    action: "pickup",
    actor: "CARRIER",
    to: "PICKED_UP",
    // Checklist 5/5 + ≥1 photo : validation de payload côté service (B3).
    effects: ["GENERATE_CODE", "REVEAL_CODE_TO_SHIPPER", "NOTIFY_SHIPPER"],
  },
  {
    from: "ACCEPTED",
    action: "refusePickup",
    actor: "CARRIER",
    to: "CANCELLED",
    // Refus de conformité au pickup : légitime, SANS pénalité réputation.
    effects: ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
  },

  // ── PICKED_UP ────────────────────────────
  {
    from: "PICKED_UP",
    action: "deliver",
    actor: "CARRIER",
    to: "DELIVERED",
    // La comparaison bcrypt du code est faite par le service ; ce guard
    // ne vérifie que le lock 15 min et le plafond de tentatives.
    effects: ["SCHEDULE_PAYOUT", "NOTIFY_SHIPPER"],
    guard: deliveryAllowed,
  },

  // ── DELIVERED ────────────────────────────
  {
    from: "DELIVERED",
    action: "confirmEarly",
    actor: "SHIPPER",
    to: "COMPLETED",
    effects: ["TRANSFER_PAYOUT", "UPDATE_STATS", "INVITE_RATING", "NOTIFY_CARRIER"],
  },
  {
    from: "DELIVERED",
    action: "autoComplete",
    actor: "SYSTEM",
    to: "COMPLETED",
    effects: ["TRANSFER_PAYOUT", "UPDATE_STATS", "INVITE_RATING", "NOTIFY_CARRIER"],
    guard: onlyIfPayoutDue,
  },
  {
    from: "DELIVERED",
    action: "dispute",
    actor: "SHIPPER",
    to: "DISPUTED",
    effects: ["FREEZE_PAYOUT", "CREATE_TICKET", "NOTIFY_CARRIER"],
    guard: beforePayoutDue,
  },
];

// ─────────────────────────────────────────────
// API publique de la machine
// ─────────────────────────────────────────────

/**
 * Vérifie si `action` est légale pour cet acteur, ce booking, ce
 * contexte. Ne modifie rien — le service applique la transition et
 * exécute les effets retournés (+ écriture OutboxEvent, même
 * transaction Mongo).
 */
export function canPerform(
  booking: BookingLike,
  action: BookingTransitionAction,
  actor: BookingActor,
  ctx: BookingLifecycleContext = {}
): BookingTransitionCheck {
  // Un booking soft-deleted est mort pour toutes les actions.
  if (booking.isDeleted) {
    return { allowed: false, reason: "Booking not found." };
  }

  const fullCtx: Required<BookingLifecycleContext> = {
    now: ctx.now ?? new Date(),
  };

  const candidates = TRANSITIONS.filter((t) => t.action === action);
  if (candidates.length === 0) {
    return { allowed: false, reason: `Unknown action "${action}".` };
  }

  const byActor = candidates.filter((t) => t.actor === actor);
  if (byActor.length === 0) {
    return {
      allowed: false,
      reason: `Action "${action}" is not allowed for role ${actor}.`,
    };
  }

  const def = byActor.find((t) => t.from === booking.status);
  if (!def) {
    return {
      allowed: false,
      reason: `Action "${action}" is not allowed from status ${booking.status}.`,
    };
  }

  const guardError = def.guard?.(booking, fullCtx) ?? null;
  if (guardError) {
    return { allowed: false, reason: guardError };
  }

  return { allowed: true, to: def.to, effects: def.effects };
}

/**
 * Actions autorisées pour ce booking et ce RÔLE — à exposer dans les
 * DTOs (GET /deals/:id, listes) pour que le front affiche exactement
 * ce que l'API accepte. Les actions SYSTEM ne sortent jamais ici.
 */
export function getAllowedActions(
  booking: BookingLike,
  actor: BookingActor,
  ctx: BookingLifecycleContext = {}
): BookingTransitionAction[] {
  if (actor === "SYSTEM" || actor === "ADMIN") return [];
  const actions = [
    ...new Set(TRANSITIONS.filter((t) => t.actor === actor).map((t) => t.action)),
  ];
  return actions.filter((a) => canPerform(booking, a, actor, ctx).allowed);
}

// ─────────────────────────────────────────────
// Opérations gardées SANS transition
// ─────────────────────────────────────────────

/**
 * Régénération du code de livraison par l'Expéditeur (PICKED_UP
 * uniquement, plafond serveur MAX_CODE_REGENERATIONS).
 */
export function canRegenerateCode(booking: BookingLike): BookingOperationCheck {
  if (booking.isDeleted) {
    return { allowed: false, reason: "Booking not found." };
  }
  if (booking.status !== "PICKED_UP") {
    return {
      allowed: false,
      reason: "The delivery code can only be regenerated while the parcel is in transit.",
    };
  }
  if ((booking.codeRegenerations ?? 0) >= MAX_CODE_REGENERATIONS) {
    return {
      allowed: false,
      reason: "Maximum code regenerations reached.",
    };
  }
  return { allowed: true };
}

/**
 * Jalons de tracking (optionnels, Voyageur, dans PICKED_UP) :
 * séquence stricte AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED,
 * sans saut ni doublon.
 */
export function canConfirmTrackingStep(
  booking: BookingLike,
  confirmedSteps: readonly string[],
  step: TrackingStep
): BookingOperationCheck {
  if (booking.isDeleted) {
    return { allowed: false, reason: "Booking not found." };
  }
  if (booking.status !== "PICKED_UP") {
    return {
      allowed: false,
      reason: "Tracking steps can only be confirmed while the parcel is in transit.",
    };
  }
  const index = TRACKING_SEQUENCE.indexOf(step);
  if (index === -1) {
    return { allowed: false, reason: `Unknown tracking step "${step}".` };
  }
  if (confirmedSteps.includes(step)) {
    return { allowed: false, reason: "This tracking step is already confirmed." };
  }
  const expected = TRACKING_SEQUENCE[confirmedSteps.length];
  if (step !== expected) {
    return {
      allowed: false,
      reason: `Tracking steps must be confirmed in order. Next expected step: "${expected}".`,
    };
  }
  return { allowed: true };
}

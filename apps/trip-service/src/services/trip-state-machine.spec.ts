import {
  canPerform,
  getAllowedActions,
  getCarrierStatDeltas,
  entersPublicPool,
  leavesPublicPool,
  isPastDeparture,
  isPastArrival,
  hasActiveBookings,
  type TripAction,
  type TripLike,
  type TripStatus,
  type TripLifecycleContext,
} from "./trip-state-machine";

/**
 * trip-state-machine.spec.ts (D30 — rétrofit 3bis)
 * ================================================
 * La table TRANSITIONS de la machine EST le plan de test : la matrice
 * from×action ci-dessous en est le miroir exécutable. Toute divergence
 * entre ce spec et la machine est une régression (ou une décision métier
 * à re-graver ici explicitement).
 *
 * Conventions :
 * - Horloge figée via ctx.now (jamais de new Date() implicite dans les cas).
 * - FUTURE/PAST relatifs à NOW pour des cas lisibles.
 */

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const NOW = new Date("2026-07-20T12:00:00.000Z");
const FUTURE = new Date("2026-08-01T10:00:00.000Z");
const PAST = new Date("2026-07-01T10:00:00.000Z");
const PAST_ARRIVAL = new Date("2026-07-02T18:00:00.000Z");

const ALL_STATUSES: TripStatus[] = [
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "ARCHIVED",
];

function makeTrip(overrides: Partial<TripLike> & { status: TripStatus }): TripLike {
  return {
    isDeleted: false,
    departureAt: FUTURE,
    arrivalAt: null,
    ...overrides,
  };
}

function ctx(overrides: Partial<TripLifecycleContext> = {}): TripLifecycleContext {
  return { hasActiveBookings: false, now: NOW, ...overrides };
}

// ─────────────────────────────────────────────
// canPerform — matrice from × action
// ─────────────────────────────────────────────

describe("canPerform — matrice from × action (miroir de TRANSITIONS)", () => {
  // Contexte neutre : départ futur, aucune réservation → seuls les
  // statuts décident. Les guards sont testés dans leurs blocs dédiés.
  const MATRIX: Array<{
    action: TripAction;
    legalFrom: TripStatus[];
    to: TripStatus | null;
  }> = [
    { action: "view", legalFrom: ALL_STATUSES, to: null },
    { action: "viewPublic", legalFrom: ["PUBLISHED", "PAUSED", "COMPLETED"], to: null },
    { action: "duplicate", legalFrom: ALL_STATUSES, to: null },
    { action: "edit", legalFrom: ["DRAFT", "PUBLISHED", "PAUSED"], to: null },
    { action: "publish", legalFrom: ["DRAFT"], to: "PUBLISHED" },
    { action: "pause", legalFrom: ["PUBLISHED"], to: "PAUSED" },
    { action: "resume", legalFrom: ["PAUSED"], to: "PUBLISHED" },
    { action: "unpublish", legalFrom: ["PUBLISHED", "PAUSED"], to: "DRAFT" },
    { action: "restore", legalFrom: ["CANCELLED"], to: "DRAFT" },
    { action: "cancel", legalFrom: ["PUBLISHED", "PAUSED"], to: "CANCELLED" },
    { action: "delete", legalFrom: ["DRAFT"], to: null },
    { action: "archive", legalFrom: ["COMPLETED", "CANCELLED"], to: "ARCHIVED" },
    { action: "complete", legalFrom: ["PUBLISHED", "PAUSED"], to: "COMPLETED" },
  ];

  for (const { action, legalFrom, to } of MATRIX) {
    describe(`action "${action}"`, () => {
      for (const status of ALL_STATUSES) {
        const legal = legalFrom.includes(status);

        if (legal && action === "complete") {
          // complete a des guards actifs même en contexte neutre
          // (arrivée non passée) — testé dans son bloc dédié.
          it(`depuis ${status} : statut légal (guards testés à part)`, () => {
            const check = canPerform(makeTrip({ status }), action, ctx());
            // Refusé ici, mais PAS pour une raison de statut :
            expect(check.allowed).toBe(false);
            if (!check.allowed) {
              expect(check.reason).not.toContain("is not allowed from status");
            }
          });
        } else if (legal) {
          it(`autorisée depuis ${status}, to=${String(to)}`, () => {
            const check = canPerform(makeTrip({ status }), action, ctx());
            expect(check).toEqual({ allowed: true, to });
          });
        } else {
          it(`refusée depuis ${status} (statut illégal)`, () => {
            const check = canPerform(makeTrip({ status }), action, ctx());
            expect(check.allowed).toBe(false);
            if (!check.allowed) {
              expect(check.reason).toBe(
                `Action "${action}" is not allowed from status ${status}.`
              );
            }
          });
        }
      }
    });
  }

  it('refuse une action inconnue avec le message "Unknown action"', () => {
    const check = canPerform(
      makeTrip({ status: "DRAFT" }),
      "teleport" as TripAction,
      ctx()
    );
    expect(check).toEqual({ allowed: false, reason: 'Unknown action "teleport".' });
  });
});

// ─────────────────────────────────────────────
// Guard soft-deleted
// ─────────────────────────────────────────────

describe("canPerform — trip soft-deleted", () => {
  const ACTIONS: TripAction[] = [
    "view", "viewPublic", "duplicate", "edit", "publish", "pause", "resume",
    "unpublish", "restore", "cancel", "delete", "archive", "complete",
  ];

  it.each(ACTIONS)('refuse "%s" avec "Trip not found." (même view)', (action) => {
    const trip = makeTrip({ status: "DRAFT", isDeleted: true });
    expect(canPerform(trip, action, ctx())).toEqual({
      allowed: false,
      reason: "Trip not found.",
    });
  });
});

// ─────────────────────────────────────────────
// Guards de date (publish / resume / restore)
// ─────────────────────────────────────────────

describe("canPerform — guard notPastDeparture", () => {
  const CASES: Array<{ action: TripAction; status: TripStatus }> = [
    { action: "publish", status: "DRAFT" },
    { action: "resume", status: "PAUSED" },
    { action: "restore", status: "CANCELLED" },
  ];

  it.each(CASES)("$action refusée si le départ est passé", ({ action, status }) => {
    const check = canPerform(makeTrip({ status, departureAt: PAST }), action, ctx());
    expect(check).toEqual({
      allowed: false,
      reason: "Cannot perform this action: the departure date has passed.",
    });
  });

  it.each(CASES)("$action autorisée si départ futur", ({ action, status }) => {
    const check = canPerform(makeTrip({ status, departureAt: FUTURE }), action, ctx());
    expect(check.allowed).toBe(true);
  });

  it.each(CASES)("$action autorisée sans departureAt (brouillon incomplet)", ({ action, status }) => {
    const check = canPerform(makeTrip({ status, departureAt: null }), action, ctx());
    expect(check.allowed).toBe(true);
  });

  it("frontière stricte : départ exactement à now → autorisé (dep < now)", () => {
    const check = canPerform(
      makeTrip({ status: "DRAFT", departureAt: new Date(NOW) }),
      "publish",
      ctx()
    );
    expect(check.allowed).toBe(true);
  });

  it("string ISO passée → refusé (compat DTO sérialisé)", () => {
    const check = canPerform(
      makeTrip({ status: "DRAFT", departureAt: PAST.toISOString() }),
      "publish",
      ctx()
    );
    expect(check.allowed).toBe(false);
  });

  it("string de date invalide → traitée comme absente, autorisé (comportement gravé)", () => {
    const check = canPerform(
      makeTrip({ status: "DRAFT", departureAt: "pas-une-date" }),
      "publish",
      ctx()
    );
    expect(check.allowed).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Guards booking (edit / unpublish / pause / cancel)
// ─────────────────────────────────────────────

describe("canPerform — guards booking", () => {
  const withBookings = ctx({ hasActiveBookings: true });

  it("edit autorisé sur DRAFT même avec réservations actives", () => {
    const check = canPerform(makeTrip({ status: "DRAFT" }), "edit", withBookings);
    expect(check.allowed).toBe(true);
  });

  it.each(["PUBLISHED", "PAUSED"] as TripStatus[])(
    "edit refusé sur %s avec réservations actives (pattern BlaBlaCar strict)",
    (status) => {
      const check = canPerform(makeTrip({ status }), "edit", withBookings);
      expect(check).toEqual({
        allowed: false,
        reason: "Cannot edit a trip with active bookings. Cancel the trip instead.",
      });
    }
  );

  it.each(["PUBLISHED", "PAUSED"] as TripStatus[])(
    "unpublish refusé sur %s avec réservations actives",
    (status) => {
      const check = canPerform(makeTrip({ status }), "unpublish", withBookings);
      expect(check).toEqual({
        allowed: false,
        reason:
          "Cannot revert to draft: this trip has active bookings. Cancel the trip instead.",
      });
    }
  );

  it("pause autorisée avec réservations actives (les réservations continuent leur vie)", () => {
    const check = canPerform(makeTrip({ status: "PUBLISHED" }), "pause", withBookings);
    expect(check).toEqual({ allowed: true, to: "PAUSED" });
  });

  it("cancel autorisé avec réservations actives (side-effects au chantier Booking)", () => {
    const check = canPerform(makeTrip({ status: "PUBLISHED" }), "cancel", withBookings);
    expect(check).toEqual({ allowed: true, to: "CANCELLED" });
  });
});

// ─────────────────────────────────────────────
// complete (cron) — guards v2
// ─────────────────────────────────────────────

describe("canPerform — complete (réservé au cron)", () => {
  it("refusé avant l'arrivée", () => {
    const trip = makeTrip({ status: "PUBLISHED", departureAt: PAST, arrivalAt: FUTURE });
    expect(canPerform(trip, "complete", ctx())).toEqual({
      allowed: false,
      reason: "Cannot complete a trip before its arrival date.",
    });
  });

  it("autorisé après l'arrivée (sans réservation)", () => {
    const trip = makeTrip({ status: "PUBLISHED", departureAt: PAST, arrivalAt: PAST_ARRIVAL });
    expect(canPerform(trip, "complete", ctx())).toEqual({
      allowed: true,
      to: "COMPLETED",
    });
  });

  it("v2 — fallback sur departureAt quand arrivalAt est absent (fix cron)", () => {
    const trip = makeTrip({ status: "PUBLISHED", departureAt: PAST, arrivalAt: null });
    expect(canPerform(trip, "complete", ctx())).toEqual({
      allowed: true,
      to: "COMPLETED",
    });
  });

  it("v2 — sans arrivalAt ni départ passé → refusé", () => {
    const trip = makeTrip({ status: "PUBLISHED", departureAt: FUTURE, arrivalAt: null });
    const check = canPerform(trip, "complete", ctx());
    expect(check.allowed).toBe(false);
  });

  it("refusé avec réservations en cours même arrivée passée", () => {
    const trip = makeTrip({ status: "PUBLISHED", departureAt: PAST, arrivalAt: PAST_ARRIVAL });
    expect(canPerform(trip, "complete", ctx({ hasActiveBookings: true }))).toEqual({
      allowed: false,
      reason: "Cannot complete a trip with bookings still in progress.",
    });
  });

  it("autorisé depuis PAUSED aussi", () => {
    const trip = makeTrip({ status: "PAUSED", departureAt: PAST, arrivalAt: PAST_ARRIVAL });
    expect(canPerform(trip, "complete", ctx()).allowed).toBe(true);
  });
});

// ─────────────────────────────────────────────
// getAllowedActions
// ─────────────────────────────────────────────

describe("getAllowedActions", () => {
  const sorted = (a: TripAction[]) => [...a].sort();

  function expectActions(trip: TripLike, c: TripLifecycleContext, expected: TripAction[]) {
    expect(sorted(getAllowedActions(trip, c))).toEqual(sorted(expected));
  }

  it('n\'expose JAMAIS "complete" (réservé au cron), même quand la transition serait légale', () => {
    const trip = makeTrip({ status: "PUBLISHED", departureAt: PAST, arrivalAt: PAST_ARRIVAL });
    expect(getAllowedActions(trip, ctx())).not.toContain("complete");
  });

  it("DRAFT (départ futur) : view, duplicate, edit, publish, delete", () => {
    expectActions(makeTrip({ status: "DRAFT" }), ctx(),
      ["view", "duplicate", "edit", "publish", "delete"]);
  });

  it("DRAFT (départ passé) : publish disparaît", () => {
    expectActions(makeTrip({ status: "DRAFT", departureAt: PAST }), ctx(),
      ["view", "duplicate", "edit", "delete"]);
  });

  it("PUBLISHED sans réservation : view, viewPublic, duplicate, edit, pause, unpublish, cancel", () => {
    expectActions(makeTrip({ status: "PUBLISHED" }), ctx(),
      ["view", "viewPublic", "duplicate", "edit", "pause", "unpublish", "cancel"]);
  });

  it("PUBLISHED avec réservations : edit et unpublish disparaissent", () => {
    expectActions(makeTrip({ status: "PUBLISHED" }), ctx({ hasActiveBookings: true }),
      ["view", "viewPublic", "duplicate", "pause", "cancel"]);
  });

  it("PAUSED (départ futur, sans réservation) : view, viewPublic, duplicate, edit, resume, unpublish, cancel", () => {
    expectActions(makeTrip({ status: "PAUSED" }), ctx(),
      ["view", "viewPublic", "duplicate", "edit", "resume", "unpublish", "cancel"]);
  });

  it("COMPLETED : view, viewPublic, duplicate, archive", () => {
    expectActions(makeTrip({ status: "COMPLETED", departureAt: PAST }), ctx(),
      ["view", "viewPublic", "duplicate", "archive"]);
  });

  it("CANCELLED (départ futur) : restore disponible", () => {
    expectActions(makeTrip({ status: "CANCELLED" }), ctx(),
      ["view", "duplicate", "restore", "archive"]);
  });

  it("CANCELLED (départ passé) : restore disparaît", () => {
    expectActions(makeTrip({ status: "CANCELLED", departureAt: PAST }), ctx(),
      ["view", "duplicate", "archive"]);
  });

  it("ARCHIVED : view et duplicate uniquement (one-way, pas de désarchivage)", () => {
    expectActions(makeTrip({ status: "ARCHIVED" }), ctx(), ["view", "duplicate"]);
  });

  it("soft-deleted : aucune action", () => {
    expect(getAllowedActions(makeTrip({ status: "DRAFT", isDeleted: true }), ctx())).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// getCarrierStatDeltas — comptabilité du pool public
// ─────────────────────────────────────────────

describe("getCarrierStatDeltas", () => {
  it("⭐ PAUSED → CANCELLED : decrement + totalTripsCancelled (LE bug corrigé)", () => {
    expect(getCarrierStatDeltas("PAUSED", "CANCELLED")).toEqual({
      totalTripsPublished: { decrement: 1 },
      totalTripsCancelled: { increment: 1 },
    });
  });

  it("PAUSED → DRAFT (unpublish depuis pause) : decrement", () => {
    expect(getCarrierStatDeltas("PAUSED", "DRAFT")).toEqual({
      totalTripsPublished: { decrement: 1 },
    });
  });

  it("DRAFT → PUBLISHED : increment", () => {
    expect(getCarrierStatDeltas("DRAFT", "PUBLISHED")).toEqual({
      totalTripsPublished: { increment: 1 },
    });
  });

  it("PUBLISHED → DRAFT : decrement", () => {
    expect(getCarrierStatDeltas("PUBLISHED", "DRAFT")).toEqual({
      totalTripsPublished: { decrement: 1 },
    });
  });

  it("PUBLISHED → CANCELLED : decrement + totalTripsCancelled", () => {
    expect(getCarrierStatDeltas("PUBLISHED", "CANCELLED")).toEqual({
      totalTripsPublished: { decrement: 1 },
      totalTripsCancelled: { increment: 1 },
    });
  });

  it("PUBLISHED ↔ PAUSED : mouvement interne au pool, aucun delta", () => {
    expect(getCarrierStatDeltas("PUBLISHED", "PAUSED")).toBeNull();
    expect(getCarrierStatDeltas("PAUSED", "PUBLISHED")).toBeNull();
  });

  it("PUBLISHED → COMPLETED (cron) : decrement, pas de cancelled", () => {
    expect(getCarrierStatDeltas("PUBLISHED", "COMPLETED")).toEqual({
      totalTripsPublished: { decrement: 1 },
    });
  });

  it("COMPLETED → ARCHIVED : hors pool des deux côtés, aucun delta", () => {
    expect(getCarrierStatDeltas("COMPLETED", "ARCHIVED")).toBeNull();
  });

  it("CANCELLED → DRAFT (restore) : hors pool des deux côtés, aucun delta", () => {
    expect(getCarrierStatDeltas("CANCELLED", "DRAFT")).toBeNull();
  });

  it("to=null (actions sans transition) : null", () => {
    expect(getCarrierStatDeltas("DRAFT", null)).toBeNull();
  });

  it("from === to : null", () => {
    expect(getCarrierStatDeltas("PUBLISHED", "PUBLISHED")).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Helpers pool & dates + stub
// ─────────────────────────────────────────────

describe("entersPublicPool / leavesPublicPool", () => {
  it("DRAFT → PUBLISHED entre, PUBLISHED → DRAFT sort", () => {
    expect(entersPublicPool("DRAFT", "PUBLISHED")).toBe(true);
    expect(leavesPublicPool("PUBLISHED", "DRAFT")).toBe(true);
  });
  it("PUBLISHED → PAUSED : ni entrée ni sortie", () => {
    expect(entersPublicPool("PUBLISHED", "PAUSED")).toBe(false);
    expect(leavesPublicPool("PUBLISHED", "PAUSED")).toBe(false);
  });
  it("CANCELLED → ARCHIVED : ni entrée ni sortie", () => {
    expect(entersPublicPool("CANCELLED", "ARCHIVED")).toBe(false);
    expect(leavesPublicPool("CANCELLED", "ARCHIVED")).toBe(false);
  });
});

describe("isPastDeparture / isPastArrival", () => {
  it("accepte Date et string ISO", () => {
    expect(isPastDeparture({ status: "DRAFT", departureAt: PAST }, NOW)).toBe(true);
    expect(isPastDeparture({ status: "DRAFT", departureAt: PAST.toISOString() }, NOW)).toBe(true);
    expect(isPastDeparture({ status: "DRAFT", departureAt: FUTURE }, NOW)).toBe(false);
  });
  it("null / absent / invalide → false", () => {
    expect(isPastDeparture({ status: "DRAFT", departureAt: null }, NOW)).toBe(false);
    expect(isPastDeparture({ status: "DRAFT" }, NOW)).toBe(false);
    expect(isPastDeparture({ status: "DRAFT", departureAt: "n'importe quoi" }, NOW)).toBe(false);
  });
  it("isPastArrival — v2 : fallback sur departureAt si arrivalAt absent", () => {
    expect(isPastArrival({ status: "PUBLISHED", departureAt: PAST, arrivalAt: null }, NOW)).toBe(true);
    expect(isPastArrival({ status: "PUBLISHED", departureAt: FUTURE, arrivalAt: null }, NOW)).toBe(false);
    expect(isPastArrival({ status: "PUBLISHED", departureAt: PAST, arrivalAt: FUTURE }, NOW)).toBe(false);
  });
});

describe("hasActiveBookings (stub chantier Booking)", () => {
  it("retourne toujours false tant que le Booking model n'existe pas", async () => {
    await expect(hasActiveBookings("665f1c2ab3d4e5f6a7b8c9d0")).resolves.toBe(false);
  });
});

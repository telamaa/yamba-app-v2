/**
 * booking-state-machine.spec.ts
 * =============================
 * Miroir TESTÉ de SPECIFICATIONS-WORKFLOW-YAMBA.md §2.2 et des
 * matrices ANN-01 / ANN-02 / CAP-02.
 *
 * Structure (196 tests) :
 *  S1  Chemins nominaux : 13 transitions → to + effets EXACTS      (13)
 *  S3  Mauvais acteur : refus par rôle, message dédié              (12)
 *  S4  ADMIN : seules les résolutions de litige (C-PR2)             (13)
 *  S5  Mauvais statut : matrice générée (12 paires action×acteur)  (95)
 *  S6  Absences délibérées de la spec (assertions nommées)          (3)
 *  S7  Guards temporels & compteurs, bornes EXACTES                (15)
 *  S8  Soft delete : mort pour tout                                 (3)
 *  S9  Action inconnue                                              (1)
 *  S10 getAllowedActions par rôle × 9 statuts + cas gardés         (23)
 *  S11 canRegenerateCode : statuts + bornes du compteur            (11)
 *  S12 canConfirmTrackingStep : séquence stricte                    (7)
 *  S13 Partition ACTIVE/TERMINAL + constantes §5.4                  (3)
 */
import {
  canRate,
  BOOKING_ACTIVE_STATUSES,
  BOOKING_TERMINAL_STATUSES,
  BookingActor,
  BookingLike,
  BookingStatus,
  BookingTransitionAction,
  DELIVERY_LOCK_MINUTES,
  MAX_CODE_REGENERATIONS,
  MAX_DELIVERY_ATTEMPTS,
  TRACKING_SEQUENCE,
  canConfirmTrackingStep,
  canPerform,
  canRegenerateCode,
  getAllowedActions,
} from "./booking-state-machine";

// ─────────────────────────────────────────────
// Fixtures — horloge fixe injectée partout
// ─────────────────────────────────────────────

const NOW = new Date("2026-07-18T12:00:00.000Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);
const hours = (n: number) => minutes(n * 60);

const ALL_STATUSES: BookingStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PICKED_UP",
  "DELIVERED",
  "COMPLETED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
  "DISPUTED",
];

/** Booking "sain" : pas expiré, pas de payout dû, pas de lock, compteurs à 0 */
function makeBooking(overrides: Partial<BookingLike> = {}): BookingLike {
  return {
    status: "PENDING",
    isDeleted: false,
    expiresAt: hours(24),
    payoutDueAt: null,
    deliveryLockedUntil: null,
    deliveryAttempts: 0,
    codeRegenerations: 0,
    ...overrides,
  };
}

const ctx = { now: NOW };

// ─────────────────────────────────────────────
// S1 — Chemins nominaux : to + effets EXACTS
// ─────────────────────────────────────────────

describe("S1 — chemins nominaux (12 transitions du §2.2)", () => {
  type Row = [
    string,
    BookingLike,
    BookingTransitionAction,
    BookingActor,
    BookingStatus,
    string[]
  ];
  const rows: Row[] = [
    [
      "PENDING --accept(CARRIER)--> ACCEPTED",
      makeBooking(),
      "accept",
      "CARRIER",
      "ACCEPTED",
      ["CAPTURE_PAYMENT", "NOTIFY_SHIPPER"],
    ],
    [
      "PENDING --decline(CARRIER)--> DECLINED",
      makeBooking(),
      "decline",
      "CARRIER",
      "DECLINED",
      ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
    ],
    [
      "PENDING --expire(SYSTEM)--> EXPIRED (une fois l'échéance passée)",
      makeBooking({ expiresAt: minutes(-1) }),
      "expire",
      "SYSTEM",
      "EXPIRED",
      ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
    ],
    [
      "PENDING --cancel(SHIPPER)--> CANCELLED",
      makeBooking(),
      "cancel",
      "SHIPPER",
      "CANCELLED",
      ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_CARRIER"],
    ],
    [
      "PENDING --cancel(SYSTEM)--> CANCELLED (empreinte morte — D40)",
      makeBooking(),
      "cancel",
      "SYSTEM",
      "CANCELLED",
      ["RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
    ],
    [
      "ACCEPTED --cancel(SHIPPER)--> CANCELLED (barème ANN-01)",
      makeBooking({ status: "ACCEPTED" }),
      "cancel",
      "SHIPPER",
      "CANCELLED",
      ["REFUND_PER_CANCELLATION_POLICY", "RELEASE_CAPACITY", "NOTIFY_CARRIER"],
    ],
    [
      "ACCEPTED --cancel(CARRIER)--> CANCELLED (défaut Voyageur ANN-02)",
      makeBooking({ status: "ACCEPTED" }),
      "cancel",
      "CARRIER",
      "CANCELLED",
      ["FULL_REFUND", "RELEASE_CAPACITY", "PENALIZE_CARRIER", "NOTIFY_SHIPPER"],
    ],
    [
      "ACCEPTED --pickup(CARRIER)--> PICKED_UP",
      makeBooking({ status: "ACCEPTED" }),
      "pickup",
      "CARRIER",
      "PICKED_UP",
      ["GENERATE_CODE", "REVEAL_CODE_TO_SHIPPER", "NOTIFY_SHIPPER"],
    ],
    [
      "ACCEPTED --refusePickup(CARRIER)--> CANCELLED (sans pénalité)",
      makeBooking({ status: "ACCEPTED" }),
      "refusePickup",
      "CARRIER",
      "CANCELLED",
      ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER"],
    ],
    [
      "PICKED_UP --deliver(CARRIER)--> DELIVERED",
      makeBooking({ status: "PICKED_UP" }),
      "deliver",
      "CARRIER",
      "DELIVERED",
      ["SCHEDULE_PAYOUT", "NOTIFY_SHIPPER"],
    ],
    [
      "DELIVERED --confirmEarly(SHIPPER)--> COMPLETED",
      makeBooking({ status: "DELIVERED", payoutDueAt: hours(96) }),
      "confirmEarly",
      "SHIPPER",
      "COMPLETED",
      ["TRANSFER_PAYOUT", "UPDATE_STATS", "INVITE_RATING", "NOTIFY_CARRIER"],
    ],
    [
      "DELIVERED --autoComplete(SYSTEM)--> COMPLETED (J+4 atteint)",
      makeBooking({ status: "DELIVERED", payoutDueAt: minutes(-1) }),
      "autoComplete",
      "SYSTEM",
      "COMPLETED",
      ["TRANSFER_PAYOUT", "UPDATE_STATS", "INVITE_RATING", "NOTIFY_CARRIER"],
    ],
    [
      "DELIVERED --dispute(SHIPPER)--> DISPUTED (avant J+4)",
      makeBooking({ status: "DELIVERED", payoutDueAt: hours(96) }),
      "dispute",
      "SHIPPER",
      "DISPUTED",
      ["FREEZE_PAYOUT", "CREATE_TICKET", "NOTIFY_CARRIER"],
    ],
    [
      "PICKED_UP --dispute(SHIPPER)--> DISPUTED (non livré, départ + 48 h — B4/D51)",
      makeBooking({ status: "PICKED_UP", departureAt: hours(-48) }),
      "dispute",
      "SHIPPER",
      "DISPUTED",
      ["CREATE_TICKET", "NOTIFY_CARRIER"],
    ],
  ];

  it.each(rows)("%s", (_label, booking, action, actor, to, effects) => {
    const check = canPerform(booking, action, actor, ctx);
    expect(check).toEqual({ allowed: true, to, effects });
  });
});

// ─────────────────────────────────────────────
// S3 — Mauvais acteur : refus par RÔLE
// ─────────────────────────────────────────────

describe("S3 — mauvais acteur (le rôle fait partie de la transition)", () => {
  type Row = [BookingTransitionAction, BookingActor, BookingLike];
  const rows: Row[] = [
    ["accept", "SHIPPER", makeBooking()],
    ["accept", "SYSTEM", makeBooking()],
    ["decline", "SHIPPER", makeBooking()],
    ["expire", "CARRIER", makeBooking({ expiresAt: minutes(-1) })],
    ["expire", "SHIPPER", makeBooking({ expiresAt: minutes(-1) })],
    ["pickup", "SHIPPER", makeBooking({ status: "ACCEPTED" })],
    ["refusePickup", "SHIPPER", makeBooking({ status: "ACCEPTED" })],
    ["deliver", "SHIPPER", makeBooking({ status: "PICKED_UP" })],
    ["confirmEarly", "CARRIER", makeBooking({ status: "DELIVERED" })],
    ["autoComplete", "SHIPPER", makeBooking({ status: "DELIVERED", payoutDueAt: minutes(-1) })],
    ["autoComplete", "CARRIER", makeBooking({ status: "DELIVERED", payoutDueAt: minutes(-1) })],
    ["dispute", "CARRIER", makeBooking({ status: "DELIVERED" })],
  ];

  it.each(rows)('"%s" est refusé au rôle %s', (action, actor, booking) => {
    const check = canPerform(booking, action, actor, ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) {
      expect(check.reason).toContain(`not allowed for role ${actor}`);
    }
  });
});

// ─────────────────────────────────────────────
// S4 — ADMIN : réservé, rien d'ouvert (chantier C)
// ─────────────────────────────────────────────

describe("S4 — ADMIN : seules les résolutions de litige lui sont ouvertes (C-PR2, D55)", () => {
  const actions: BookingTransitionAction[] = [
    "accept",
    "decline",
    "expire",
    "cancel",
    "pickup",
    "refusePickup",
    "deliver",
    "confirmEarly",
    "autoComplete",
    "dispute",
  ];
  it.each(actions.map((a) => [a] as [BookingTransitionAction]))(
    '"%s" est refusé à ADMIN',
    (action) => {
      const booking = makeBooking({ status: "DISPUTED" });
      const check = canPerform(booking, action, "ADMIN", ctx);
      expect(check.allowed).toBe(false);
    }
  );

  it("resolveDisputeKeep : DISPUTED → COMPLETED (versement, stats, les deux prévenus) — ADMIN seul", () => {
    const booking = makeBooking({ status: "DISPUTED" });
    expect(canPerform(booking, "resolveDisputeKeep", "ADMIN", ctx)).toEqual({
      allowed: true,
      to: "COMPLETED",
      effects: ["TRANSFER_PAYOUT", "UPDATE_STATS", "NOTIFY_SHIPPER", "NOTIFY_CARRIER"],
    });
    expect(canPerform(booking, "resolveDisputeKeep", "SHIPPER", ctx).allowed).toBe(false);
    expect(canPerform(booking, "resolveDisputeKeep", "CARRIER", ctx).allowed).toBe(false);
    expect(canPerform(booking, "resolveDisputeKeep", "SYSTEM", ctx).allowed).toBe(false);
  });

  it("resolveDisputeRefund : DISPUTED → CANCELLED (remboursement total) — ADMIN seul, jamais hors DISPUTED", () => {
    expect(canPerform(makeBooking({ status: "DISPUTED" }), "resolveDisputeRefund", "ADMIN", ctx)).toEqual({
      allowed: true,
      to: "CANCELLED",
      effects: ["FULL_REFUND", "RELEASE_CAPACITY", "NOTIFY_SHIPPER", "NOTIFY_CARRIER"],
    });
    for (const status of ["PENDING", "ACCEPTED", "PICKED_UP", "DELIVERED", "COMPLETED", "CANCELLED"] as const) {
      expect(canPerform(makeBooking({ status }), "resolveDisputeKeep", "ADMIN", ctx).allowed).toBe(false);
      expect(canPerform(makeBooking({ status }), "resolveDisputeRefund", "ADMIN", ctx).allowed).toBe(false);
    }
  });

  it("getAllowedActions ne sert jamais les actions ADMIN (le front admin a son propre contrat)", () => {
    expect(getAllowedActions(makeBooking({ status: "DISPUTED" }), "ADMIN", ctx)).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// S5 — Mauvais statut : matrice générée
// ─────────────────────────────────────────────

describe("S5 — mauvais statut (matrice action×acteur × statuts illégaux)", () => {
  // 11 paires (action, acteur) × leurs statuts LÉGAUX — tout le reste
  // doit être refusé avec le message de statut. 87 tests générés.
  const pairs: Array<{
    action: BookingTransitionAction;
    actor: BookingActor;
    legal: BookingStatus[];
  }> = [
    { action: "accept", actor: "CARRIER", legal: ["PENDING"] },
    { action: "decline", actor: "CARRIER", legal: ["PENDING"] },
    { action: "expire", actor: "SYSTEM", legal: ["PENDING"] },
    { action: "cancel", actor: "SHIPPER", legal: ["PENDING", "ACCEPTED"] },
    { action: "cancel", actor: "CARRIER", legal: ["ACCEPTED"] },
    { action: "cancel", actor: "SYSTEM", legal: ["PENDING"] },
    { action: "pickup", actor: "CARRIER", legal: ["ACCEPTED"] },
    { action: "refusePickup", actor: "CARRIER", legal: ["ACCEPTED"] },
    { action: "deliver", actor: "CARRIER", legal: ["PICKED_UP"] },
    { action: "confirmEarly", actor: "SHIPPER", legal: ["DELIVERED"] },
    { action: "autoComplete", actor: "SYSTEM", legal: ["DELIVERED"] },
    { action: "dispute", actor: "SHIPPER", legal: ["DELIVERED", "PICKED_UP"] },
  ];

  pairs.forEach(({ action, actor, legal }) => {
    const illegal = ALL_STATUSES.filter((s) => !legal.includes(s));
    illegal.forEach((status) => {
      it(`"${action}" (${actor}) est refusé depuis ${status}`, () => {
        const check = canPerform(makeBooking({ status }), action, actor, ctx);
        expect(check.allowed).toBe(false);
        if (!check.allowed) {
          expect(check.reason).toContain(`not allowed from status ${status}`);
        }
      });
    });
  });
});

// ─────────────────────────────────────────────
// S6 — Absences DÉLIBÉRÉES de la spec (nommées)
// ─────────────────────────────────────────────

describe("S6 — absences délibérées (ANN-01 : plus d'annulation après remise)", () => {
  it("aucune annulation depuis PICKED_UP, ni Shipper ni Carrier — seule voie : dispute (48 h après le départ)", () => {
    const booking = makeBooking({ status: "PICKED_UP", departureAt: hours(-48) });
    expect(canPerform(booking, "cancel", "SHIPPER", ctx).allowed).toBe(false);
    expect(canPerform(booking, "cancel", "CARRIER", ctx).allowed).toBe(false);
    expect(canPerform(booking, "dispute", "SHIPPER", ctx).allowed).toBe(true);
    expect(canPerform(booking, "dispute", "CARRIER", ctx).allowed).toBe(false);
  });

  // B4/D51 — « non livré » : la fenêtre s'ouvre à départ + 48 h, jamais avant, jamais sans date.
  it("dispute depuis PICKED_UP est refusé avant départ + 48 h, et sans date de départ (conservatif)", () => {
    const early = canPerform(makeBooking({ status: "PICKED_UP", departureAt: hours(-47) }), "dispute", "SHIPPER", ctx);
    expect(early.allowed).toBe(false);
    if (!early.allowed) expect(early.reason).toContain("48 hours after the trip departure");
    expect(canPerform(makeBooking({ status: "PICKED_UP", departureAt: hours(2) }), "dispute", "SHIPPER", ctx).allowed).toBe(false);
    expect(canPerform(makeBooking({ status: "PICKED_UP" }), "dispute", "SHIPPER", ctx).allowed).toBe(false);
    expect(canPerform(makeBooking({ status: "PICKED_UP", departureAt: hours(-48) }), "dispute", "SHIPPER", ctx).allowed).toBe(true);
  });

  it("aucune annulation depuis DELIVERED — seule voie : dispute (avant J+4)", () => {
    const booking = makeBooking({ status: "DELIVERED" });
    expect(canPerform(booking, "cancel", "SHIPPER", ctx).allowed).toBe(false);
    expect(canPerform(booking, "cancel", "CARRIER", ctx).allowed).toBe(false);
    expect(canPerform(booking, "dispute", "SHIPPER", ctx).allowed).toBe(true);
  });

  it("DISPUTED est terminal v1 : aucune action d'aucun rôle n'en sort", () => {
    const booking = makeBooking({ status: "DISPUTED" });
    const actions: BookingTransitionAction[] = [
      "accept", "decline", "expire", "cancel", "pickup",
      "refusePickup", "deliver", "confirmEarly", "autoComplete", "dispute",
    ];
    const actors: BookingActor[] = ["SHIPPER", "CARRIER", "SYSTEM", "ADMIN"];
    for (const action of actions) {
      for (const actor of actors) {
        expect(canPerform(booking, action, actor, ctx).allowed).toBe(false);
      }
    }
  });
});

// ─────────────────────────────────────────────
// S7 — Guards temporels & compteurs : bornes EXACTES
// ─────────────────────────────────────────────

describe("S7 — guards (horloge injectée, bornes à la milliseconde)", () => {
  // accept / decline : notExpired (exp < now → expiré)
  it("accept est refusé 1 min après l'expiration (avant même le cron)", () => {
    const check = canPerform(makeBooking({ expiresAt: minutes(-1) }), "accept", "CARRIER", ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("expired");
  });
  it("accept est encore permis À l'instant exact expiresAt (borne stricte)", () => {
    const check = canPerform(makeBooking({ expiresAt: NOW }), "accept", "CARRIER", ctx);
    expect(check.allowed).toBe(true);
  });
  it("decline est refusé après l'expiration", () => {
    const check = canPerform(makeBooking({ expiresAt: minutes(-1) }), "decline", "CARRIER", ctx);
    expect(check.allowed).toBe(false);
  });

  // expire : onlyIfExpired (le cron ne force pas avant l'heure)
  it("expire est refusé avant l'échéance", () => {
    const check = canPerform(makeBooking({ expiresAt: minutes(1) }), "expire", "SYSTEM", ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("before its expiry time");
  });
  it("expire est refusé À l'instant exact expiresAt (cohérent avec accept)", () => {
    const check = canPerform(makeBooking({ expiresAt: NOW }), "expire", "SYSTEM", ctx);
    expect(check.allowed).toBe(false);
  });
  it("expire est permis une fois l'échéance passée", () => {
    const check = canPerform(makeBooking({ expiresAt: minutes(-1) }), "expire", "SYSTEM", ctx);
    expect(check.allowed).toBe(true);
  });

  // autoComplete : onlyIfPayoutDue (due <= now)
  it("autoComplete est refusé avant payoutDueAt", () => {
    const b = makeBooking({ status: "DELIVERED", payoutDueAt: minutes(1) });
    expect(canPerform(b, "autoComplete", "SYSTEM", ctx).allowed).toBe(false);
  });
  it("autoComplete est permis À l'instant exact payoutDueAt (borne large)", () => {
    const b = makeBooking({ status: "DELIVERED", payoutDueAt: NOW });
    expect(canPerform(b, "autoComplete", "SYSTEM", ctx).allowed).toBe(true);
  });

  // dispute : beforePayoutDue (miroir exact d'autoComplete — jamais de trou)
  it("dispute est permis 1 min avant payoutDueAt", () => {
    const b = makeBooking({ status: "DELIVERED", payoutDueAt: minutes(1) });
    expect(canPerform(b, "dispute", "SHIPPER", ctx).allowed).toBe(true);
  });
  it("dispute est refusé À l'instant exact payoutDueAt (fenêtre fermée)", () => {
    const b = makeBooking({ status: "DELIVERED", payoutDueAt: NOW });
    const check = canPerform(b, "dispute", "SHIPPER", ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("verification period has ended");
  });

  // deliver : lock 15 min + plafond de tentatives
  it("deliver est refusé pendant le lock", () => {
    const b = makeBooking({
      status: "PICKED_UP",
      deliveryLockedUntil: minutes(DELIVERY_LOCK_MINUTES),
    });
    const check = canPerform(b, "deliver", "CARRIER", ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("temporarily locked");
  });
  it("deliver redevient permis une fois le lock échu", () => {
    const b = makeBooking({ status: "PICKED_UP", deliveryLockedUntil: minutes(-1) });
    expect(canPerform(b, "deliver", "CARRIER", ctx).allowed).toBe(true);
  });
  it("deliver est permis à MAX_DELIVERY_ATTEMPTS - 1 tentatives", () => {
    const b = makeBooking({ status: "PICKED_UP", deliveryAttempts: MAX_DELIVERY_ATTEMPTS - 1 });
    expect(canPerform(b, "deliver", "CARRIER", ctx).allowed).toBe(true);
  });
  it("deliver est refusé au plafond de tentatives", () => {
    const b = makeBooking({ status: "PICKED_UP", deliveryAttempts: MAX_DELIVERY_ATTEMPTS });
    const check = canPerform(b, "deliver", "CARRIER", ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("Maximum delivery code attempts");
  });
  it("lock actif ET plafond atteint : le message du lock prime", () => {
    const b = makeBooking({
      status: "PICKED_UP",
      deliveryLockedUntil: minutes(5),
      deliveryAttempts: MAX_DELIVERY_ATTEMPTS,
    });
    const check = canPerform(b, "deliver", "CARRIER", ctx);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("temporarily locked");
  });
});

// ─────────────────────────────────────────────
// S8 — Soft delete : mort pour tout
// ─────────────────────────────────────────────

describe("S8 — booking soft-deleted", () => {
  const dead = makeBooking({ isDeleted: true });
  it("canPerform refuse tout avec 'Booking not found.'", () => {
    const check = canPerform(dead, "accept", "CARRIER", ctx);
    expect(check).toEqual({ allowed: false, reason: "Booking not found." });
  });
  it("canRegenerateCode refuse", () => {
    expect(canRegenerateCode({ ...dead, status: "PICKED_UP" }).allowed).toBe(false);
  });
  it("canConfirmTrackingStep refuse", () => {
    const check = canConfirmTrackingStep({ ...dead, status: "PICKED_UP" }, [], "AT_AIRPORT");
    expect(check.allowed).toBe(false);
  });
});

// ─────────────────────────────────────────────
// S9 — Action inconnue
// ─────────────────────────────────────────────

describe("S9 — action inconnue", () => {
  it("est refusée avec un message explicite", () => {
    const check = canPerform(
      makeBooking(),
      "teleport" as unknown as BookingTransitionAction,
      "CARRIER",
      ctx
    );
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain('Unknown action "teleport"');
  });
});

// ─────────────────────────────────────────────
// S10 — getAllowedActions : le contrat des CTAs front
// ─────────────────────────────────────────────

describe("S10 — getAllowedActions par rôle (source des CTAs front)", () => {
  type Row = [BookingStatus, BookingActor, BookingTransitionAction[]];
  const rows: Row[] = [
    ["PENDING", "SHIPPER", ["cancel"]],
    ["PENDING", "CARRIER", ["accept", "decline"]],
    ["ACCEPTED", "SHIPPER", ["cancel"]],
    ["ACCEPTED", "CARRIER", ["cancel", "pickup", "refusePickup"]],
    ["PICKED_UP", "SHIPPER", []], // sans départ dépassé : rien (le guard 48 h ferme `dispute`)
    ["PICKED_UP", "CARRIER", ["deliver"]],
    ["DELIVERED", "SHIPPER", ["confirmEarly", "dispute"]],
    ["DELIVERED", "CARRIER", []],
    ["COMPLETED", "SHIPPER", []],
    ["COMPLETED", "CARRIER", []],
    ["DECLINED", "SHIPPER", []],
    ["DECLINED", "CARRIER", []],
    ["EXPIRED", "SHIPPER", []],
    ["EXPIRED", "CARRIER", []],
    ["CANCELLED", "SHIPPER", []],
    ["CANCELLED", "CARRIER", []],
    ["DISPUTED", "SHIPPER", []],
    ["DISPUTED", "CARRIER", []],
  ];
  it.each(rows)("%s × %s → %j", (status, actor, expected) => {
    const actions = getAllowedActions(makeBooking({ status }), actor, ctx);
    expect([...actions].sort()).toEqual([...expected].sort());
  });

  it("SYSTEM ne reçoit jamais d'actions (jamais exposé en DTO)", () => {
    expect(getAllowedActions(makeBooking(), "SYSTEM", ctx)).toEqual([]);
  });
  it("ADMIN ne reçoit jamais d'actions (chantier C)", () => {
    expect(getAllowedActions(makeBooking({ status: "DISPUTED" }), "ADMIN", ctx)).toEqual([]);
  });
  it("PENDING expiré : le Carrier n'a plus rien (guards intégrés aux CTAs)", () => {
    const b = makeBooking({ expiresAt: minutes(-1) });
    expect(getAllowedActions(b, "CARRIER", ctx)).toEqual([]);
  });
  it("PENDING expiré : le Shipper peut encore annuler (remboursement intégral)", () => {
    const b = makeBooking({ expiresAt: minutes(-1) });
    expect(getAllowedActions(b, "SHIPPER", ctx)).toEqual(["cancel"]);
  });
  it("DELIVERED après J+4 : dispute disparaît, confirmEarly reste", () => {
    const b = makeBooking({ status: "DELIVERED", payoutDueAt: minutes(-1) });
    expect(getAllowedActions(b, "SHIPPER", ctx)).toEqual(["confirmEarly"]);
  });
});

// ─────────────────────────────────────────────
// S11 — canRegenerateCode
// ─────────────────────────────────────────────

describe("S12 — notation (B5/D53) : COMPLETED, fenêtre 14 j, une fois par rôle", () => {
  it("C-PR2 (D54 4B) : un deal clos par médiation (completedBy ADMIN) ne se note jamais", () => {
    const b = makeBooking({ status: "COMPLETED", completedBy: "ADMIN" } as never);
    expect(canRate(b, "SHIPPER", ctx.now)).toEqual({ allowed: false, reason: "A deal closed by mediation cannot be rated." });
    expect(canRate(b, "CARRIER", ctx.now)).toEqual({ allowed: false, reason: "A deal closed by mediation cannot be rated." });
  });
  it("permise sur COMPLETED dans la fenêtre, par chaque rôle indépendamment", () => {
    const b = makeBooking({ status: "COMPLETED", ratingWindowEndsAt: hours(24) });
    expect(canRate(b, "SHIPPER", NOW).allowed).toBe(true);
    expect(canRate(b, "CARRIER", NOW).allowed).toBe(true);
    expect(canRate({ ...b, shipperRatedAt: hours(-1) }, "SHIPPER", NOW).allowed).toBe(false);
    expect(canRate({ ...b, shipperRatedAt: hours(-1) }, "CARRIER", NOW).allowed).toBe(true);
  });
  it("refusée hors COMPLETED, après la fenêtre, sur un booking effacé", () => {
    expect(canRate(makeBooking({ status: "DISPUTED" }), "SHIPPER", NOW).allowed).toBe(false);
    expect(canRate(makeBooking({ status: "CANCELLED" }), "SHIPPER", NOW).allowed).toBe(false);
    const closed = canRate(makeBooking({ status: "COMPLETED", ratingWindowEndsAt: NOW }), "SHIPPER", NOW);
    expect(closed.allowed).toBe(false);
    if (!closed.allowed) expect(closed.reason).toContain("14 days");
    expect(canRate(makeBooking({ status: "COMPLETED", isDeleted: true }), "SHIPPER", NOW).allowed).toBe(false);
  });
});

describe("S11 — régénération du code (Expéditeur, PICKED_UP, ≤ 5)", () => {
  it("permise en PICKED_UP, compteur à 0", () => {
    const b = makeBooking({ status: "PICKED_UP" });
    expect(canRegenerateCode(b)).toEqual({ allowed: true });
  });
  it("permise à MAX_CODE_REGENERATIONS - 1", () => {
    const b = makeBooking({ status: "PICKED_UP", codeRegenerations: MAX_CODE_REGENERATIONS - 1 });
    expect(canRegenerateCode(b).allowed).toBe(true);
  });
  it("refusée au plafond", () => {
    const b = makeBooking({ status: "PICKED_UP", codeRegenerations: MAX_CODE_REGENERATIONS });
    const check = canRegenerateCode(b);
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("Maximum code regenerations");
  });
  ALL_STATUSES.filter((s) => s !== "PICKED_UP").forEach((status) => {
    it(`refusée depuis ${status}`, () => {
      expect(canRegenerateCode(makeBooking({ status })).allowed).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// S12 — canConfirmTrackingStep : séquence stricte
// ─────────────────────────────────────────────

describe("S12 — tracking : AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED", () => {
  const inTransit = makeBooking({ status: "PICKED_UP" });

  it("étape 1 permise sur séquence vide", () => {
    expect(canConfirmTrackingStep(inTransit, [], "AT_AIRPORT")).toEqual({ allowed: true });
  });
  it("étape 2 permise après l'étape 1", () => {
    expect(canConfirmTrackingStep(inTransit, ["AT_AIRPORT"], "FLIGHT_DEPARTED").allowed).toBe(true);
  });
  it("étape 3 permise après les étapes 1 et 2", () => {
    expect(
      canConfirmTrackingStep(inTransit, ["AT_AIRPORT", "FLIGHT_DEPARTED"], "FLIGHT_ARRIVED").allowed
    ).toBe(true);
  });
  it("saut d'étape refusé (FLIGHT_DEPARTED sans AT_AIRPORT)", () => {
    const check = canConfirmTrackingStep(inTransit, [], "FLIGHT_DEPARTED");
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain('Next expected step: "AT_AIRPORT"');
  });
  it("doublon refusé", () => {
    const check = canConfirmTrackingStep(inTransit, ["AT_AIRPORT"], "AT_AIRPORT");
    expect(check.allowed).toBe(false);
    if (!check.allowed) expect(check.reason).toContain("already confirmed");
  });
  it("étape inconnue refusée", () => {
    const check = canConfirmTrackingStep(
      inTransit,
      [],
      "TELEPORTED" as unknown as (typeof TRACKING_SEQUENCE)[number]
    );
    expect(check.allowed).toBe(false);
  });
  it("refusé hors PICKED_UP (ex. ACCEPTED)", () => {
    const check = canConfirmTrackingStep(makeBooking({ status: "ACCEPTED" }), [], "AT_AIRPORT");
    expect(check.allowed).toBe(false);
  });
});

// ─────────────────────────────────────────────
// S13 — Partition ACTIVE / TERMINAL + constantes
// ─────────────────────────────────────────────

describe("S13 — partition des statuts (CAP-02) et constantes §5.4", () => {
  it("ACTIVE ∪ TERMINAL couvre exactement les 9 statuts", () => {
    const union = [...BOOKING_ACTIVE_STATUSES, ...BOOKING_TERMINAL_STATUSES].sort();
    expect(union).toEqual([...ALL_STATUSES].sort());
  });
  it("ACTIVE ∩ TERMINAL est vide — et DISPUTED est ACTIF (conserve les kg)", () => {
    const overlap = BOOKING_ACTIVE_STATUSES.filter((s) =>
      BOOKING_TERMINAL_STATUSES.includes(s)
    );
    expect(overlap).toEqual([]);
    expect(BOOKING_ACTIVE_STATUSES).toContain("DISPUTED");
  });
  it("constantes serveur conformes à la spec §5.4", () => {
    expect(MAX_CODE_REGENERATIONS).toBe(5);
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);
    expect(DELIVERY_LOCK_MINUTES).toBe(15);
    expect(TRACKING_SEQUENCE).toEqual(["AT_AIRPORT", "FLIGHT_DEPARTED", "FLIGHT_ARRIVED"]);
  });
});

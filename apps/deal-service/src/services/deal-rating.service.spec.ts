/**
 * deal-rating.service.spec.ts — notation mutuelle double-aveugle (B5, D53)
 * =======================================================================
 * Sections : A. submit (nominal, révélation quand l'autre a noté, 403, déjà noté, fenêtre close, non COMPLETED,
 * critères filtrés) · B. getContext (double-aveugle : la note de l'autre n'apparaît qu'une fois révélée) ·
 * C. cron (relances J+5/J+7 aux rôles muets, révélation à 14 j même avec une seule note, rien sans note).
 */
const prismaMock = {
  booking: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn(), count: jest.fn() },
  trip: { updateMany: jest.fn() },
  outboxEvent: { create: jest.fn() },
  review: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  carrierPage: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
// La réputation a ses propres tests (reputation.service.spec) : ici on vérifie seulement QUAND elle est recalculée.
const reputationMock = { recomputeBookingParties: jest.fn().mockResolvedValue(undefined) };
jest.mock("./reputation.service", () => reputationMock);

import { ForbiddenError } from "@packages/error-handler";
import { BookingDomainEventSchema } from "@packages/api-contracts";
import { filterCriteria, makeDealRatingService } from "./deal-rating.service";
import { BookingLifecycleError } from "./booking-lifecycle";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const BOOKING_ID = "64b0000000000000000000b1";
const SHIPPER_ID = "64b0000000000000000000e1";
const CARRIER_ID = "64b0000000000000000000c1";
const SHIPPER = { id: SHIPPER_ID };
const CARRIER = { id: CARRIER_ID };
const UPDATED_AT = new Date("2026-07-17T09:00:00.000Z");

function rec(o: Partial<Record<string, unknown>> = {}) {
  return {
    id: BOOKING_ID,
    tripId: "64b0000000000000000000a1",
    shipperId: SHIPPER_ID,
    carrierId: CARRIER_ID,
    status: "COMPLETED",
    isDeleted: false,
    expiresAt: days(-10),
    acceptedAt: days(-9),
    pickedUpAt: days(-6),
    paymentIntentId: "pi_fake",
    trip: { originCity: "Paris", originCountryCode: "FR", destinationCity: "Brazzaville", destinationCountryCode: "CG", departureAt: days(-6) },
    pricing: { weightKg: 2, transportCents: 2400, totalShipperCents: 2957, currencyCode: "EUR" },
    parcel: { category: "DOCUMENTS", categoryFamily: "DOCUMENTS_PAPERS" },
    pickup: null,
    trackingEvents: [],
    deliveryCodeHash: null,
    deliveryAttempts: 0,
    deliveryLockedUntil: null,
    codeRegenerations: 0,
    updatedAt: UPDATED_AT,
    completedAt: days(-2),
    ratingWindowEndsAt: days(12),
    shipperRatedAt: null,
    carrierRatedAt: null,
    ratingsRevealedAt: null,
    ratingRemindersSent: 0,
    ...o,
  };
}
function svc() { return makeDealRatingService(() => NOW); }
function updates() { return prismaMock.booking.updateMany.mock.calls.map((c) => c[0]); }
function events(): string[] { return prismaMock.outboxEvent.create.mock.calls.map((c) => c[0].data.eventType); }
async function expectCode(p: Promise<unknown>, code: string) {
  let caught: unknown;
  try { await p; } catch (e) { caught = e; }
  expect(caught).toBeInstanceOf(BookingLifecycleError);
  expect((caught as BookingLifecycleError).code).toBe(code);
  return caught as BookingLifecycleError;
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.booking.count.mockResolvedValue(0);
  prismaMock.booking.findMany.mockResolvedValue([]);
  prismaMock.outboxEvent.create.mockResolvedValue({});
  prismaMock.review.findFirst.mockResolvedValue(null);
  prismaMock.review.findMany.mockResolvedValue([]);
  prismaMock.review.create.mockResolvedValue({});
  prismaMock.review.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findUnique.mockResolvedValue({ id: CARRIER_ID, firstName: "Thomas", lastName: "Mbemba", avatar: null });
  prismaMock.user.update.mockResolvedValue({});
  prismaMock.carrierPage.findUnique.mockResolvedValue({ id: "cp" });
  prismaMock.carrierPage.update.mockResolvedValue({});
});

describe("A — submit", () => {
  it("l'Expéditeur note le Voyageur : Review AS_CARRIER non révélée, shipperRatedAt posé, verrou updatedAt, AUCUN événement (l'autre n'a pas noté)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec());
    const res = await svc().submit(SHIPPER, BOOKING_ID, { rating: 5, comment: "  Parfait, très ponctuel.  ", criteria: { PUNCTUALITY: "UP", DECLARATION_CLARITY: "UP" } });
    expect(res).toEqual({ bookingId: BOOKING_ID, submittedAt: NOW.toISOString(), revealed: false, revealedAt: null });
    const [u] = updates();
    expect(u.where).toEqual({ id: BOOKING_ID, status: "COMPLETED", updatedAt: UPDATED_AT });
    expect(u.data).toEqual({ shipperRatedAt: NOW });
    const created = prismaMock.review.create.mock.calls[0][0].data;
    expect(created).toMatchObject({ subjectUserId: CARRIER_ID, authorUserId: SHIPPER_ID, kind: "AS_CARRIER", bookingId: BOOKING_ID, rating: 5, comment: "Parfait, très ponctuel.", revealedAt: null });
    expect(created.criteria).toEqual({ PUNCTUALITY: "UP" }); // DECLARATION_CLARITY n'est pas un critère du Voyageur
    expect(events()).toEqual([]);
    expect(reputationMock.recomputeBookingParties).not.toHaveBeenCalled(); // pas de recalcul tant que rien n'est révélé
  });

  it("le Voyageur note en second : les DEUX avis sont révélés dans la transaction, booking.rating_revealed BOTH_RATED, réputation recalculée", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec({ shipperRatedAt: days(-1) }));
    prismaMock.user.findUnique.mockResolvedValue({ id: SHIPPER_ID, firstName: "Naomi", lastName: "K", avatar: null });
    const res = await svc().submit(CARRIER, BOOKING_ID, { rating: 4 });
    expect(res.revealed).toBe(true);
    expect(res.revealedAt).toBe(NOW.toISOString());
    expect(updates()[0].data).toEqual({ carrierRatedAt: NOW, ratingsRevealedAt: NOW });
    expect(prismaMock.review.create.mock.calls[0][0].data).toMatchObject({ kind: "AS_SHIPPER", subjectUserId: SHIPPER_ID, revealedAt: NOW });
    expect(prismaMock.review.updateMany).toHaveBeenCalledWith({ where: { bookingId: BOOKING_ID, revealedAt: null }, data: { revealedAt: NOW } });
    expect(events()).toEqual(["booking.rating_revealed"]);
    const payload = prismaMock.outboxEvent.create.mock.calls[0][0].data.payload;
    expect(() => BookingDomainEventSchema.parse(payload)).not.toThrow();
    expect(payload.payload).toMatchObject({ revealedReason: "BOTH_RATED" });
    expect(reputationMock.recomputeBookingParties).toHaveBeenCalledWith(expect.objectContaining({ shipperId: SHIPPER_ID, carrierId: CARRIER_ID }));
  });

  it("un tiers → 403 ; déjà noté → 409 ; fenêtre close → 409 ; deal non terminé (DISPUTED, CANCELLED) → 409", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec());
    await expect(svc().submit({ id: "64b0000000000000000000f9" }, BOOKING_ID, { rating: 5 })).rejects.toBeInstanceOf(ForbiddenError);
    prismaMock.booking.findUnique.mockResolvedValue(rec({ shipperRatedAt: days(-1) }));
    expect((await expectCode(svc().submit(SHIPPER, BOOKING_ID, { rating: 5 }), "TRANSITION_NOT_ALLOWED")).message).toContain("already rated");
    prismaMock.booking.findUnique.mockResolvedValue(rec({ ratingWindowEndsAt: days(-1) }));
    expect((await expectCode(svc().submit(SHIPPER, BOOKING_ID, { rating: 5 }), "TRANSITION_NOT_ALLOWED")).message).toContain("closed");
    for (const status of ["DISPUTED", "CANCELLED", "DELIVERED"]) {
      prismaMock.booking.findUnique.mockResolvedValue(rec({ status }));
      await expectCode(svc().submit(SHIPPER, BOOKING_ID, { rating: 5 }), "TRANSITION_NOT_ALLOWED");
    }
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("garde d'unicité de service (A9) : un avis existe déjà pour ce deal et cet auteur → 409, transaction annulée", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec());
    prismaMock.review.findFirst.mockResolvedValue({ id: "r1" });
    await expectCode(svc().submit(SHIPPER, BOOKING_ID, { rating: 5 }), "TRANSITION_NOT_ALLOWED");
    expect(prismaMock.review.create).not.toHaveBeenCalled();
  });

  it("filterCriteria : ne garde que les critères du rôle noté, null si rien ne reste", () => {
    expect(filterCriteria("CARRIER", { PUNCTUALITY: "UP", RESPONSIVENESS: "DOWN" })).toEqual({ PUNCTUALITY: "UP" });
    expect(filterCriteria("SHIPPER", { PARCEL_CARE: "UP" })).toBeNull();
    expect(filterCriteria("SHIPPER", undefined)).toBeNull();
  });
});

describe("B — getContext (double-aveugle)", () => {
  it("avant révélation : ma note visible, celle de l'autre NON même si elle existe ; canRate reflète la machine", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec({ shipperRatedAt: days(-1) }));
    prismaMock.review.findMany.mockResolvedValue([
      { authorUserId: SHIPPER_ID, subjectUserId: CARRIER_ID, rating: 5, comment: "Top", criteria: null, createdAt: days(-1), revealedAt: null },
      { authorUserId: CARRIER_ID, subjectUserId: SHIPPER_ID, rating: 2, comment: "Bof", criteria: null, createdAt: NOW, revealedAt: null },
    ]);
    const ctx = await svc().getContext(SHIPPER, BOOKING_ID);
    expect(ctx).toMatchObject({ viewerRole: "SHIPPER", ratedRole: "CARRIER", canRate: false, counterpartHasRated: true, revealedAt: null, counterpartRating: null });
    expect(ctx.myRating).toMatchObject({ rating: 5, comment: "Top" });
    expect(ctx.person).toMatchObject({ id: CARRIER_ID, firstName: "Thomas", lastInitial: "M." });
    expect(ctx.cannotRateReason).toContain("already rated");
  });

  it("après révélation : la note de l'autre apparaît", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec({ shipperRatedAt: days(-1), carrierRatedAt: NOW, ratingsRevealedAt: NOW }));
    prismaMock.review.findMany.mockResolvedValue([
      { authorUserId: CARRIER_ID, subjectUserId: SHIPPER_ID, rating: 4, comment: null, criteria: { RESPONSIVENESS: "UP" }, createdAt: NOW, revealedAt: NOW },
    ]);
    const ctx = await svc().getContext(SHIPPER, BOOKING_ID);
    expect(ctx.counterpartRating).toMatchObject({ rating: 4, criteria: { RESPONSIVENESS: "UP" } });
    expect(ctx.revealedAt).toBe(NOW.toISOString());
  });

  it("le Voyageur qui n'a pas encore noté, fenêtre ouverte → canRate true", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(rec());
    prismaMock.user.findUnique.mockResolvedValue({ id: SHIPPER_ID, firstName: "Naomi", lastName: null, avatar: { url: "https://x/a.jpg" } });
    const ctx = await svc().getContext(CARRIER, BOOKING_ID);
    expect(ctx).toMatchObject({ viewerRole: "CARRIER", ratedRole: "SHIPPER", canRate: true, cannotRateReason: null, myRating: null });
    expect(ctx.person).toMatchObject({ firstName: "Naomi", lastInitial: "", avatarUrl: "https://x/a.jpg" });
  });
});

describe("C — cron : relances et révélation", () => {
  it("J+5 : une relance par rôle muet (ici les deux), compteur 0 → 1 ; J+7 : compteur 1 → 2 pour le rôle encore muet", async () => {
    prismaMock.booking.findMany
      .mockResolvedValueOnce([rec({ completedAt: days(-5) })]) // passe J+5 (remindersSent 0)
      .mockResolvedValueOnce([rec({ completedAt: days(-7), ratingRemindersSent: 1, shipperRatedAt: days(-6) })]); // passe J+7
    const n = await svc().sendRatingReminders();
    expect(n).toBe(3);
    const wheres = prismaMock.booking.findMany.mock.calls.map((c) => c[0].where);
    expect(wheres[0]).toMatchObject({ status: "COMPLETED", completedAt: { lte: days(-5) }, ratingWindowEndsAt: { gt: NOW }, ratingRemindersSent: 0 });
    expect(wheres[1]).toMatchObject({ completedAt: { lte: days(-7) }, ratingRemindersSent: 1 });
    const payloads = prismaMock.outboxEvent.create.mock.calls.map((c) => c[0].data.payload.payload);
    expect(payloads.map((p) => [p.reminderNumber, p.targetRole])).toEqual([[1, "SHIPPER"], [1, "CARRIER"], [2, "CARRIER"]]);
    expect(updates()[0].where).toEqual({ id: BOOKING_ID, status: "COMPLETED", ratingRemindersSent: 0 });
    expect(updates()[0].data).toEqual({ ratingRemindersSent: 1 });
    for (const c of prismaMock.outboxEvent.create.mock.calls) expect(() => BookingDomainEventSchema.parse(c[0].data.payload)).not.toThrow();
  });

  it("révélation à 14 j : une seule note → révélée (WINDOW_ELAPSED) + réputation ; aucune note → fenêtre fermée sans événement", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      rec({ ratingWindowEndsAt: days(-1), shipperRatedAt: days(-10) }),
      { ...rec({ ratingWindowEndsAt: days(-1) }), id: "64b0000000000000000000b2" },
    ]);
    const n = await svc().revealElapsed();
    expect(n).toBe(2);
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).toMatchObject({ status: "COMPLETED", ratingWindowEndsAt: { lte: NOW } });
    expect(prismaMock.booking.findMany.mock.calls[0][0].where.OR).toEqual([{ ratingsRevealedAt: null }, { ratingsRevealedAt: { isSet: false } }]);
    expect(events()).toEqual(["booking.rating_revealed"]);
    expect(prismaMock.outboxEvent.create.mock.calls[0][0].data.payload.payload).toMatchObject({ revealedReason: "WINDOW_ELAPSED" });
    expect(prismaMock.review.updateMany).toHaveBeenCalledTimes(2);
    expect(reputationMock.recomputeBookingParties).toHaveBeenCalledTimes(1); // seulement le deal qui avait une note
  });
});

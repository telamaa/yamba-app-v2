/**
 * deal-settlement.service.spec.ts — confirmEarly / dispute / versement / cron J+4 / rappel J+3 (B4-PR1)
 * =====================================================================================================
 * Même stratégie que deal-transport.service.spec (D30) : FakePaymentProvider
 * réel (les transferts sont observés sur son état), prisma mocké (les
 * updateMany conditionnels pilotent les courses), contrat RÉEL sur chaque
 * événement outbox écrit. Sections :
 *  A. confirmEarly — COMPLETED puis transfert (D49), payout_sent, 403, machine, INV-3
 *  B. versement    — net du snapshot (D50), source_transaction (A69), compte absent → FAILED, fournisseur KO → FAILED, idempotence, course
 *  C. dispute      — DELIVERED (gel), PICKED_UP « non livré » (48 h, catégorie imposée), ticket, collision, dossier Dispute, 403
 *  D. cron         — autoComplete J+4, rejeu FAILED borné, rappel J+3 une seule fois
 */

const prismaMock = {
  booking: { findUnique: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
  trip: { updateMany: jest.fn() },
  outboxEvent: { create: jest.fn() },
  dispute: { create: jest.fn() },
  carrierPage: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { Prisma } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@packages/error-handler";
import { FakePaymentProvider, type PaymentProvider, type TransferInput } from "@packages/payments";
import { BookingDomainEventSchema } from "@packages/api-contracts";
import {
  DISPUTE_TICKET_ATTEMPTS,
  FAKE_CARRIER_ACCOUNT,
  PAYOUT_MAX_ATTEMPTS,
  generateDisputeTicket,
  makeDealSettlementService,
} from "./deal-settlement.service";
import { BookingLifecycleError } from "./booking-lifecycle";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const BOOKING_ID = "64b0000000000000000000b1";
const TRIP_ID = "64b0000000000000000000a1";
const SHIPPER_ID = "64b0000000000000000000e1";
const CARRIER_ID = "64b0000000000000000000c1";
const SHIPPER = { id: SHIPPER_ID };
const CARRIER = { id: CARRIER_ID };
const STRANGER = { id: "64b0000000000000000000f9" };

type Overrides = Partial<{
  status: string;
  payoutDueAt: Date | null;
  departureAt: Date;
  payoutStatus: string | null;
  payoutAttempts: number;
  chargeId: string | null;
  verificationReminderSentAt: Date | null;
}>;

function makeBookingRecord(o: Overrides = {}) {
  return {
    id: BOOKING_ID,
    tripId: TRIP_ID,
    shipperId: SHIPPER_ID,
    carrierId: CARRIER_ID,
    status: o.status ?? "DELIVERED",
    isDeleted: false,
    expiresAt: new Date("2026-07-10T12:00:00.000Z"),
    acceptedAt: new Date("2026-07-10T10:00:00.000Z"),
    pickedUpAt: new Date("2026-07-14T10:00:00.000Z"),
    deliveredAt: new Date("2026-07-16T10:00:00.000Z"),
    payoutDueAt: o.payoutDueAt === undefined ? hoursFromNow(48) : o.payoutDueAt,
    paymentIntentId: "pi_fake_default",
    chargeId: o.chargeId === undefined ? "ch_fake_default" : o.chargeId,
    payoutStatus: o.payoutStatus ?? null,
    payoutAttempts: o.payoutAttempts ?? 0,
    verificationReminderSentAt: o.verificationReminderSentAt ?? null,
    trip: {
      originCity: "Paris",
      originCountryCode: "FR",
      destinationCity: "Brazzaville",
      destinationCountryCode: "CG",
      departureAt: o.departureAt ?? new Date("2026-07-15T10:00:00.000Z"),
    },
    pricing: { weightKg: 2, transportCents: 2400, totalShipperCents: 2957, currencyCode: "EUR" },
    parcel: { category: "DOCUMENTS", categoryFamily: "DOCUMENTS_PAPERS" },
    pickup: { confirmedAt: new Date("2026-07-14T10:00:00.000Z"), photoUrls: ["https://ik.imagekit.io/yamba/p.jpg"], notes: null },
    trackingEvents: [],
    deliveryCodeHash: "$2b$10$hash",
    deliveryAttempts: 1,
    deliveryLockedUntil: null,
    codeRegenerations: 0,
  };
}

const DISPUTE_INPUT = {
  category: "DAMAGED" as const,
  description: "Le carton est arrivé écrasé et l'ordinateur ne s'allume plus depuis la remise du colis.",
  pledgeAccepted: true as const,
  photoUrls: ["https://ik.imagekit.io/yamba/deals/dispute/a.jpg"],
  desiredOutcome: "FULL_REFUND" as const,
};

function makeService(provider: PaymentProvider = new FakePaymentProvider()) {
  return makeDealSettlementService(provider, () => NOW);
}

function updates() {
  return prismaMock.booking.updateMany.mock.calls.map((c) => c[0]);
}
function writtenEventTypes(): string[] {
  return prismaMock.outboxEvent.create.mock.calls.map((c) => c[0].data.eventType);
}
function writtenEvent(eventType: string) {
  const call = prismaMock.outboxEvent.create.mock.calls.find((c) => c[0].data.eventType === eventType);
  return call ? (call[0].data.payload as { payload: Record<string, unknown> }) : null;
}
async function expectCode(promise: Promise<unknown>, code: string): Promise<BookingLifecycleError> {
  let caught: unknown;
  try {
    await promise;
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(BookingLifecycleError);
  expect((caught as BookingLifecycleError).code).toBe(code);
  return caught as BookingLifecycleError;
}
function p2002(target: string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.outboxEvent.create.mockResolvedValue({});
  prismaMock.dispute.create.mockResolvedValue({});
  prismaMock.booking.findMany.mockResolvedValue([]);
});

// ─────────────────────────────────────────────
// A — confirmEarly (D49, A67, INV-3)
// ─────────────────────────────────────────────

describe("A — confirmEarly : COMPLETED d'abord, transfert ensuite", () => {
  it("chemin nominal : COMPLETED (PENDING) en transaction, puis transfert Fake → SENT, deux événements dans l'ordre", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    const fake = new FakePaymentProvider();
    const result = await makeService(fake).confirmEarly(SHIPPER, BOOKING_ID);

    const [complete, sent] = updates();
    expect(complete.where).toEqual({ id: BOOKING_ID, status: "DELIVERED" });
    expect(complete.data).toMatchObject({
      status: "COMPLETED",
      completedAt: NOW,
      completedBy: "SHIPPER",
      payoutStatus: "PENDING",
      payoutAmountCents: 2400,
    });
    expect(sent.where).toEqual({ id: BOOKING_ID, status: "COMPLETED", payoutStatus: { in: ["PENDING", "FAILED"] } });
    expect(sent.data).toMatchObject({ payoutStatus: "SENT", payoutSentAt: NOW, payoutAmountCents: 2400, payoutAttempts: 1 });
    expect(sent.data.transferId).toMatch(/^tr_fake_/);

    expect(writtenEventTypes()).toEqual(["booking.completed", "booking.payout_sent"]);
    expect(writtenEvent("booking.completed")!.payload).toMatchObject({ actor: "SHIPPER", completedBy: "SHIPPER", completedAt: NOW.toISOString() });
    expect(writtenEvent("booking.payout_sent")!.payload).toMatchObject({ actor: "SYSTEM", amountCents: 2400 });
    // Chaque événement écrit passe le VRAI contrat.
    for (const c of prismaMock.outboxEvent.create.mock.calls) expect(() => BookingDomainEventSchema.parse(c[0].data.payload)).not.toThrow();

    expect(fake.transfers).toHaveLength(1);
    expect(result).toEqual({
      bookingId: BOOKING_ID,
      status: "COMPLETED",
      completedAt: NOW.toISOString(),
      payoutStatus: "SENT",
      payoutAmountCents: 2400,
      currencyCode: "EUR",
    });
  });

  it("le Voyageur ou un tiers → 403 (le deal existe), inconnu → 404, rien d'écrit", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService().confirmEarly(CARRIER, BOOKING_ID)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(makeService().confirmEarly(STRANGER, BOOKING_ID)).rejects.toBeInstanceOf(ForbiddenError);
    prismaMock.booking.findUnique.mockResolvedValue(null);
    await expect(makeService().confirmEarly(SHIPPER, BOOKING_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("depuis PICKED_UP ou COMPLETED → 409 TRANSITION_NOT_ALLOWED (INV-3 : une confirmation ne se rejoue pas)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    await expectCode(makeService().confirmEarly(SHIPPER, BOOKING_ID), "TRANSITION_NOT_ALLOWED");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "COMPLETED" }));
    await expectCode(makeService().confirmEarly(SHIPPER, BOOKING_ID), "TRANSITION_NOT_ALLOWED");
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("course : le deal n'est plus DELIVERED au moment de la transaction → 409, aucun transfert (INV-2)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    const fake = new FakePaymentProvider();
    await expectCode(makeService(fake).confirmEarly(SHIPPER, BOOKING_ID), "TRANSITION_NOT_ALLOWED");
    expect(fake.transfers).toHaveLength(0);
    expect(writtenEventTypes()).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// B — le versement (D50, A65, A69)
// ─────────────────────────────────────────────

describe("B — executePayout : le net du snapshot, rattaché à la charge, jamais deux fois", () => {
  function stripeLike(overrides: Partial<PaymentProvider> = {}): PaymentProvider & { calls: TransferInput[] } {
    const calls: TransferInput[] = [];
    return {
      name: "STRIPE",
      calls,
      authorize: jest.fn(),
      retrieve: jest.fn(),
      capture: jest.fn(),
      cancel: jest.fn(),
      refund: jest.fn(),
      async transfer(input) {
        calls.push(input);
        return { provider: "STRIPE", transferId: "tr_test_1", amountCents: input.amountCents, currencyCode: input.currencyCode };
      },
      ...overrides,
    };
  }

  it("montant = transportCents (D50), destination = compte Connect, source_transaction = chargeId (A69), clé d'idempotence = booking", async () => {
    prismaMock.carrierPage.findUnique.mockResolvedValue({ stripeAccountId: "acct_123", stripePayoutsEnabled: true });
    const provider = stripeLike();
    const outcome = await makeService(provider).executePayout(makeBookingRecord({ status: "COMPLETED", payoutStatus: "PENDING" }) as never, NOW);
    expect(outcome).toEqual({ payoutStatus: "SENT", transferId: "tr_test_1", reason: null });
    expect(provider.calls[0]).toMatchObject({
      amountCents: 2400,
      currencyCode: "EUR",
      destinationAccountId: "acct_123",
      sourceTransactionId: "ch_fake_default",
      transferGroup: BOOKING_ID,
      idempotencyKey: `payout:${BOOKING_ID}`,
      metadata: { bookingId: BOOKING_ID, tripId: TRIP_ID, carrierId: CARRIER_ID },
    });
    // Le total Expéditeur ne part JAMAIS au Voyageur.
    expect(provider.calls[0].amountCents).not.toBe(2957);
  });

  it("deal capturé avant B4 (sans chargeId) : transfert sans rattachement — comportement historique", async () => {
    prismaMock.carrierPage.findUnique.mockResolvedValue({ stripeAccountId: "acct_123", stripePayoutsEnabled: true });
    const provider = stripeLike();
    await makeService(provider).executePayout(makeBookingRecord({ status: "COMPLETED", payoutStatus: "PENDING", chargeId: null }) as never, NOW);
    expect(provider.calls[0].sourceTransactionId).toBeUndefined();
  });

  it("compte Connect absent ou virements non activés → FAILED CARRIER_ACCOUNT_NOT_READY, aucun appel fournisseur, compteur +1", async () => {
    const provider = stripeLike();
    prismaMock.carrierPage.findUnique.mockResolvedValue(null);
    let outcome = await makeService(provider).executePayout(makeBookingRecord({ status: "COMPLETED", payoutStatus: "PENDING" }) as never, NOW);
    expect(outcome).toEqual({ payoutStatus: "FAILED", transferId: null, reason: "CARRIER_ACCOUNT_NOT_READY" });
    prismaMock.carrierPage.findUnique.mockResolvedValue({ stripeAccountId: "acct_123", stripePayoutsEnabled: false });
    outcome = await makeService(provider).executePayout(makeBookingRecord({ status: "COMPLETED", payoutStatus: "PENDING" }) as never, NOW);
    expect(outcome.payoutStatus).toBe("FAILED");
    expect(provider.calls).toHaveLength(0);
    const last = updates().pop()!;
    expect(last.where).toEqual({ id: BOOKING_ID, status: "COMPLETED" });
    expect(last.data).toEqual({ payoutStatus: "FAILED", payoutFailureReason: "CARRIER_ACCOUNT_NOT_READY", payoutAttempts: { increment: 1 } });
    expect(writtenEventTypes()).toEqual([]);
  });

  it("fournisseur en erreur → FAILED PROVIDER_ERROR:<message>, pas d'événement, pas de throw", async () => {
    prismaMock.carrierPage.findUnique.mockResolvedValue({ stripeAccountId: "acct_123", stripePayoutsEnabled: true });
    const provider = stripeLike({ transfer: async () => { throw new Error("balance_insufficient"); } });
    const outcome = await makeService(provider).executePayout(makeBookingRecord({ status: "COMPLETED", payoutStatus: "PENDING" }) as never, NOW);
    expect(outcome).toEqual({ payoutStatus: "FAILED", transferId: null, reason: "PROVIDER_ERROR:balance_insufficient" });
    expect(writtenEventTypes()).toEqual([]);
  });

  it("le Fake transfère toujours vers le compte fictif, et honore la clé d'idempotence (deux appels = un transfert)", async () => {
    const fake = new FakePaymentProvider();
    const svc = makeService(fake);
    const b = makeBookingRecord({ status: "COMPLETED", payoutStatus: "FAILED", payoutAttempts: 2 }) as never;
    const a = await svc.executePayout(b, NOW);
    const c = await svc.executePayout(b, NOW);
    expect(a.transferId).toBe(c.transferId);
    expect(fake.transfers).toHaveLength(1);
    expect(prismaMock.carrierPage.findUnique).not.toHaveBeenCalled();
    expect(updates()[0].data).toMatchObject({ payoutAttempts: 3 });
    expect((fake.transfers[0] as { transferId: string }).transferId).toMatch(/^tr_fake_/);
    expect(FAKE_CARRIER_ACCOUNT).toBe("acct_fake_carrier");
  });

  it("course : un autre exécuteur a déjà écrit SENT → pas d'erreur, résultat SENT (le transfert est le même chez le fournisseur)", async () => {
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    const outcome = await makeService().executePayout(makeBookingRecord({ status: "COMPLETED", payoutStatus: "PENDING" }) as never, NOW);
    expect(outcome.payoutStatus).toBe("SENT");
  });

  it("un deal non COMPLETED ne se verse pas (INV-2)", async () => {
    await expectCode(makeService().executePayout(makeBookingRecord({ status: "DELIVERED" }) as never, NOW), "TRANSITION_NOT_ALLOWED");
    await expectCode(makeService().executePayout(makeBookingRecord({ status: "DISPUTED" }) as never, NOW), "TRANSITION_NOT_ALLOWED");
  });
});

// ─────────────────────────────────────────────
// C — dispute (D51, INV-4, INV-5)
// ─────────────────────────────────────────────

describe("C — dispute : ticket, gel, dossier", () => {
  it("DELIVERED avant J+4 : DISPUTED + FROZEN + ticket YAM-XXXX + Dispute créé DANS la transaction + booking.disputed", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    const result = await makeService().dispute(SHIPPER, BOOKING_ID, DISPUTE_INPUT);

    const [u] = updates();
    expect(u.where).toEqual({ id: BOOKING_ID, status: "DELIVERED" });
    expect(u.data).toMatchObject({ status: "DISPUTED", disputedAt: NOW, payoutStatus: "FROZEN" });
    expect(u.data.disputeTicket).toMatch(/^YAM-\d{4}$/);

    expect(prismaMock.dispute.create).toHaveBeenCalledTimes(1);
    const created = prismaMock.dispute.create.mock.calls[0][0].data;
    expect(created).toEqual({
      bookingId: BOOKING_ID,
      ticketNumber: u.data.disputeTicket,
      shipperId: SHIPPER_ID,
      carrierId: CARRIER_ID,
      category: "DAMAGED",
      description: DISPUTE_INPUT.description,
      desiredOutcome: "FULL_REFUND",
      photoUrls: DISPUTE_INPUT.photoUrls,
      pledgeAcceptedAt: NOW,
    });

    expect(writtenEventTypes()).toEqual(["booking.disputed"]);
    const payload = writtenEvent("booking.disputed")!.payload;
    expect(payload).toMatchObject({ actor: "SHIPPER", ticketNumber: u.data.disputeTicket, disputedAt: NOW.toISOString(), disputeCategory: "DAMAGED" });
    // Le dossier (description, photos) ne voyage pas dans l'événement.
    expect(JSON.stringify(payload)).not.toContain("écrasé");
    expect(result).toEqual({ bookingId: BOOKING_ID, status: "DISPUTED", ticketNumber: u.data.disputeTicket, disputedAt: NOW.toISOString() });
  });

  it("DELIVERED après J+4 → 409 (fenêtre fermée, INV-4) ; le Voyageur → 403", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ payoutDueAt: hoursFromNow(-1) }));
    const err = await expectCode(makeService().dispute(SHIPPER, BOOKING_ID, DISPUTE_INPUT), "TRANSITION_NOT_ALLOWED");
    expect(err.message).toContain("verification period has ended");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService().dispute(CARRIER, BOOKING_ID, DISPUTE_INPUT)).rejects.toBeInstanceOf(ForbiddenError);
    expect(prismaMock.dispute.create).not.toHaveBeenCalled();
  });

  it("PICKED_UP « non livré » : permis dès départ + 48 h, SANS gel (rien n'était programmé), catégorie NOT_DELIVERED imposée", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", payoutDueAt: null, departureAt: hoursFromNow(-48) }));
    await expect(makeService().dispute(SHIPPER, BOOKING_ID, DISPUTE_INPUT)).rejects.toBeInstanceOf(ValidationError);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();

    const result = await makeService().dispute(SHIPPER, BOOKING_ID, { ...DISPUTE_INPUT, category: "NOT_DELIVERED", desiredOutcome: undefined });
    const [u] = updates();
    expect(u.where).toEqual({ id: BOOKING_ID, status: "PICKED_UP" });
    expect(u.data).not.toHaveProperty("payoutStatus");
    expect(prismaMock.dispute.create.mock.calls[0][0].data).toMatchObject({ category: "NOT_DELIVERED", desiredOutcome: null });
    expect(result.status).toBe("DISPUTED");
  });

  it("PICKED_UP avant départ + 48 h → 409 avec la raison du guard", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", payoutDueAt: null, departureAt: hoursFromNow(-47) }));
    const err = await expectCode(makeService().dispute(SHIPPER, BOOKING_ID, { ...DISPUTE_INPUT, category: "NOT_DELIVERED" }), "TRANSITION_NOT_ALLOWED");
    expect(err.message).toContain("48 hours after the trip departure");
  });

  it("collision de ticket (P2002 sur ticketNumber) → nouveau tirage, transaction rejouée ; un dossier déjà présent → 409", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    prismaMock.dispute.create.mockRejectedValueOnce(p2002(["ticketNumber"])).mockResolvedValue({});
    const result = await makeService().dispute(SHIPPER, BOOKING_ID, DISPUTE_INPUT);
    expect(prismaMock.dispute.create).toHaveBeenCalledTimes(2);
    const tickets = prismaMock.dispute.create.mock.calls.map((c) => c[0].data.ticketNumber);
    expect(result.ticketNumber).toBe(tickets[1]);
    // La 2e tentative repart d'une transaction neuve : un seul événement retenu par transaction.
    expect(updates()).toHaveLength(2);

    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    prismaMock.dispute.create.mockRejectedValue(p2002(["bookingId"]));
    await expectCode(makeService().dispute(SHIPPER, BOOKING_ID, DISPUTE_INPUT), "TRANSITION_NOT_ALLOWED");
  });

  it("generateDisputeTicket : 4 chiffres, puis 6 après DISPUTE_TICKET_ATTEMPTS collisions", () => {
    for (let i = 0; i < 20; i += 1) expect(generateDisputeTicket(0)).toMatch(/^YAM-\d{4}$/);
    expect(generateDisputeTicket(DISPUTE_TICKET_ATTEMPTS)).toMatch(/^YAM-\d{6}$/);
  });
});

// ─────────────────────────────────────────────
// D — cron : J+4, rejeu, rappel J+3
// ─────────────────────────────────────────────

describe("D — cron de versement (A66/A70)", () => {
  it("autoCompleteDue : DELIVERED échus → COMPLETED (SYSTEM) puis versement ; requête bornée à l'échéance", async () => {
    prismaMock.booking.findMany.mockResolvedValue([makeBookingRecord({ payoutDueAt: hoursFromNow(-1) })]);
    const fake = new FakePaymentProvider();
    const n = await makeService(fake).autoCompleteDue();
    expect(n).toBe(1);
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).toEqual({ status: "DELIVERED", isDeleted: false, payoutDueAt: { lte: NOW } });
    expect(updates()[0].data).toMatchObject({ status: "COMPLETED", completedBy: "SYSTEM", payoutStatus: "PENDING" });
    expect(writtenEventTypes()).toEqual(["booking.completed", "booking.payout_sent"]);
    expect(writtenEvent("booking.completed")!.payload).toMatchObject({ actor: "SYSTEM", completedBy: "SYSTEM" });
    expect(fake.transfers).toHaveLength(1);
  });

  it("autoCompleteDue : un deal disputé entre-temps (transaction count 0) est sauté, les autres passent", async () => {
    prismaMock.booking.findMany.mockResolvedValue([
      makeBookingRecord({ payoutDueAt: hoursFromNow(-2) }),
      { ...makeBookingRecord({ payoutDueAt: hoursFromNow(-1) }), id: "64b0000000000000000000b2" },
    ]);
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    const n = await makeService().autoCompleteDue();
    expect(n).toBe(1);
  });

  it("retryFailedPayouts : ne rejoue que COMPLETED + FAILED sous le plafond ; compte les SENT", async () => {
    prismaMock.booking.findMany.mockResolvedValue([makeBookingRecord({ status: "COMPLETED", payoutStatus: "FAILED", payoutAttempts: 3 })]);
    const n = await makeService().retryFailedPayouts();
    expect(n).toBe(1);
    expect(prismaMock.booking.findMany.mock.calls[0][0].where).toEqual({
      status: "COMPLETED",
      isDeleted: false,
      payoutStatus: "FAILED",
      payoutAttempts: { lt: PAYOUT_MAX_ATTEMPTS },
    });
    expect(updates()[0].data).toMatchObject({ payoutStatus: "SENT", payoutAttempts: 4 });
    expect(writtenEventTypes()).toEqual(["booking.payout_sent"]);
  });

  it("sendVerificationReminders : DELIVERED à ≤ 24 h de l'échéance, jamais rappelé (null OU absent) → un événement + marquage conditionnel", async () => {
    prismaMock.booking.findMany.mockResolvedValue([makeBookingRecord({ payoutDueAt: hoursFromNow(20) })]);
    const n = await makeService().sendVerificationReminders();
    expect(n).toBe(1);
    const where = prismaMock.booking.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: "DELIVERED", isDeleted: false, payoutDueAt: { gt: NOW, lte: hoursFromNow(24) } });
    expect(where.OR).toEqual([{ verificationReminderSentAt: null }, { verificationReminderSentAt: { isSet: false } }]);
    const [u] = updates();
    expect(u.where).toMatchObject({ id: BOOKING_ID, status: "DELIVERED" });
    expect(u.where.OR).toBeDefined();
    expect(u.data).toEqual({ verificationReminderSentAt: NOW });
    expect(writtenEventTypes()).toEqual(["booking.verification_reminder"]);
    expect(writtenEvent("booking.verification_reminder")!.payload).toMatchObject({ actor: "SYSTEM", payoutDueAt: hoursFromNow(20).toISOString() });
    expect(() => BookingDomainEventSchema.parse(writtenEvent("booking.verification_reminder"))).not.toThrow();
  });

  it("sendVerificationReminders : course (déjà rappelé) → sauté sans erreur", async () => {
    prismaMock.booking.findMany.mockResolvedValue([makeBookingRecord({ payoutDueAt: hoursFromNow(20) })]);
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await makeService().sendVerificationReminders()).toBe(0);
    expect(writtenEventTypes()).toEqual([]);
  });
});

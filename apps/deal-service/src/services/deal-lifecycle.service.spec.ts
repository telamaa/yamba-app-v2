/**
 * deal-lifecycle.service.spec.ts — accept / decline / cancel / expire / webhook (B2-PR2)
 * ======================================================================================
 * Stratégie (D30 : « Stripe remplacé par un fake ») :
 * - PaymentProvider : le VRAI FakePaymentProvider (@packages/payments) —
 *   les effets argent (capture / cancel / refund) sont observés sur son
 *   état, pas sur des spies aveugles.
 * - prisma : mock virtuel (pattern outbox-relay.spec) ; $transaction
 *   exécute le callback avec le même mock — les écritures conditionnelles
 *   (updateMany.count) pilotent les scénarios de course.
 * - LE CONTRAT EST RÉEL : applyTransition parse chaque événement outbox
 *   avec le vrai BookingDomainEventSchema — un payload invalide fait
 *   échouer le test, et c'est voulu.
 *
 * Sections :
 *  A. accept  — capture D39, gate D31 (stub STRIPE), courses, refus machine
 *  B. decline — libération de l'empreinte, CAP-02, 2 événements
 *  C. cancel  — ANN-01 : PENDING intégral / ACCEPTED 100 % ou retenue 50 %
 *  D. expire  — cron : fournée, isolation des échecs
 *  E. webhook — payment_intent.canceled → SYSTEM cancel idempotent (D40)
 */

const prismaMock = {
  booking: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  trip: { updateMany: jest.fn() },
  carrierPage: { findUnique: jest.fn() },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), {
  virtual: true,
});

import { ForbiddenError, NotFoundError } from "@packages/error-handler";
import { FakePaymentProvider, type PaymentProvider } from "@packages/payments";
import { makeDealLifecycleService } from "./deal-lifecycle.service";
import { BookingLifecycleError } from "./booking-lifecycle";

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const NOW = new Date("2026-07-18T12:00:00.000Z");
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 3_600_000);

const BOOKING_ID = "64b0000000000000000000b1";
const TRIP_ID = "64b0000000000000000000a1";
const SHIPPER_ID = "64b0000000000000000000e1";
const CARRIER_ID = "64b0000000000000000000c1";

const SHIPPER = { id: SHIPPER_ID };
const CARRIER = { id: CARRIER_ID };
const STRANGER = { id: "64b0000000000000000000f9" };

type BookingOverrides = Partial<{
  status: string;
  expiresAt: Date;
  departureAt: Date;
  paymentIntentId: string | null;
  totalShipperCents: number;
}>;

function makeBookingRecord(overrides: BookingOverrides = {}) {
  return {
    id: BOOKING_ID,
    tripId: TRIP_ID,
    shipperId: SHIPPER_ID,
    carrierId: CARRIER_ID,
    status: overrides.status ?? "PENDING",
    isDeleted: false,
    expiresAt: overrides.expiresAt ?? hoursFromNow(20),
    paymentIntentId: overrides.paymentIntentId === undefined ? "pi_fake_default" : overrides.paymentIntentId,
    trip: {
      originCity: "Paris",
      originCountryCode: "FR",
      destinationCity: "Brazzaville",
      destinationCountryCode: "CG",
      departureAt: overrides.departureAt ?? hoursFromNow(96),
    },
    pricing: {
      weightKg: 2,
      transportCents: 2400,
      totalShipperCents: overrides.totalShipperCents ?? 2957,
      currencyCode: "EUR",
    },
    parcel: { category: "DOCUMENTS", categoryFamily: "DOCUMENTS_PAPERS" },
  };
}

/** Provider Fake + une autorisation vivante rattachée au booking. */
async function makeProviderWithAuth() {
  const provider = new FakePaymentProvider();
  const auth = await provider.authorize({
    amountCents: 2957,
    currencyCode: "EUR",
    description: "test",
    metadata: {},
  });
  return { provider, intentId: auth.intentId };
}

function makeService(provider: PaymentProvider) {
  return makeDealLifecycleService(provider, () => NOW);
}

/** Les événements outbox écrits (dans l'ordre), par type. */
function writtenEventTypes(): string[] {
  return prismaMock.outboxEvent.create.mock.calls.map((c) => c[0].data.eventType);
}
function writtenEventPayload(eventType: string): Record<string, unknown> {
  const call = prismaMock.outboxEvent.create.mock.calls.find((c) => c[0].data.eventType === eventType);
  return call ? (call[0].data.payload as { payload: Record<string, unknown> }).payload : {};
}

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.outboxEvent.create.mockResolvedValue({});
  prismaMock.carrierPage.findUnique.mockResolvedValue(null);
});

// ─────────────────────────────────────────────
// A — accept
// ─────────────────────────────────────────────

describe("A — accept (capture D39, gate D31)", () => {
  it("chemin nominal : capture, transition conditionnelle PENDING→ACCEPTED, outbox booking.accepted", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    const service = makeService(provider);

    const result = await service.accept(CARRIER, BOOKING_ID, { charterAccepted: true });

    // L'argent d'abord : l'empreinte est réellement CAPTURÉE chez le fournisseur.
    expect((await provider.retrieve(intentId)).status).toBe("CAPTURED");
    // La base ensuite : conditionnel sur le statut attendu.
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: "PENDING" },
      // A69 — la charge de la capture est conservée pour le `source_transaction` du versement B4.
      data: { status: "ACCEPTED", acceptedAt: NOW, capturedAt: NOW, chargeId: `ch_fake_${intentId}` },
    });
    // Pas de kg restitués à l'acceptation.
    expect(prismaMock.trip.updateMany).not.toHaveBeenCalled();
    expect(writtenEventTypes()).toEqual(["booking.accepted"]);
    expect(writtenEventPayload("booking.accepted")).toMatchObject({
      bookingId: BOOKING_ID,
      actor: "CARRIER",
      acceptedAt: NOW.toISOString(),
      totalShipperCents: 2957,
    });
    expect(result).toEqual({
      bookingId: BOOKING_ID,
      status: "ACCEPTED",
      refundAmountCents: null,
      currencyCode: "EUR",
    });
  });

  it("le gate D31 est SAUTÉ avec le Fake (dev sans clés)", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    await makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true });
    expect(prismaMock.carrierPage.findUnique).not.toHaveBeenCalled();
  });

  describe("gate D31 avec un provider réel (stub STRIPE)", () => {
    function stripeStub(): PaymentProvider {
      return {
        name: "STRIPE",
        authorize: jest.fn(),
        retrieve: jest.fn().mockResolvedValue({ status: "AUTHORIZED" }),
        capture: jest.fn().mockResolvedValue({ status: "CAPTURED" }),
        cancel: jest.fn().mockResolvedValue({ status: "CANCELED" }),
        refund: jest.fn().mockResolvedValue({ refundId: "re_1", amountCents: 2957 }),
      } as unknown as PaymentProvider;
    }

    it("profil incomplet (PROFILE) → 409 CARRIER_ONBOARDING_REQUIRED, rien capturé", async () => {
      prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
      prismaMock.carrierPage.findUnique.mockResolvedValue({
        onboardingStep: "PROFILE",
        stripeOnboardingComplete: false,
        stripeChargesEnabled: false,
      });
      const provider = stripeStub();
      await expect(makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true })).rejects.toMatchObject(
        { code: "CARRIER_ONBOARDING_REQUIRED" }
      );
      expect(provider.capture).not.toHaveBeenCalled();
    });

    it("Stripe non configuré → 409 CARRIER_ONBOARDING_REQUIRED", async () => {
      prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
      prismaMock.carrierPage.findUnique.mockResolvedValue({
        onboardingStep: "STRIPE",
        stripeOnboardingComplete: true,
        stripeChargesEnabled: false,
      });
      await expect(
        makeService(stripeStub()).accept(CARRIER, BOOKING_ID, { charterAccepted: true })
      ).rejects.toMatchObject({ code: "CARRIER_ONBOARDING_REQUIRED" });
    });

    it("gate passé → la capture a lieu", async () => {
      prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
      prismaMock.carrierPage.findUnique.mockResolvedValue({
        onboardingStep: "DONE",
        stripeOnboardingComplete: true,
        stripeChargesEnabled: true,
      });
      const provider = stripeStub();
      await makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true });
      expect(provider.capture).toHaveBeenCalledWith("pi_fake_default");
    });
  });

  it("l'Expéditeur ne peut pas accepter (403)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService(provider).accept(SHIPPER, BOOKING_ID, { charterAccepted: true })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it("un tiers non plus (403 — le deal existe, il n'y est pas partie)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService(provider).accept(STRANGER, BOOKING_ID, { charterAccepted: true })).rejects.toBeInstanceOf(
      ForbiddenError
    );
  });

  it("deal inconnu → 404", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(null);
    await expect(makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true })).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it("déjà ACCEPTED → 409 TRANSITION_NOT_ALLOWED (la machine décide)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "ACCEPTED" }));
    await expect(makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true })).rejects.toMatchObject({
      code: "TRANSITION_NOT_ALLOWED",
    });
  });

  it("PENDING périmé → refusé AVANT le cron (guard machine)", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBookingRecord({ paymentIntentId: intentId, expiresAt: hoursFromNow(-1) })
    );
    await expect(makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true })).rejects.toMatchObject({
      code: "TRANSITION_NOT_ALLOWED",
    });
    // Rien capturé : l'argent n'a pas bougé.
    expect((await provider.retrieve(intentId)).status).toBe("AUTHORIZED");
  });

  it("empreinte morte (CANCELED) → 409 PAYMENT_STATE_CONFLICT, pas de capture", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    await provider.cancel(intentId);
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    await expect(makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true })).rejects.toMatchObject({
      code: "PAYMENT_STATE_CONFLICT",
    });
  });

  it("course perdue (0 ligne) APRÈS capture → remboursement compensatoire + 409", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    const refundSpy = jest.spyOn(provider, "refund");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });

    await expect(makeService(provider).accept(CARRIER, BOOKING_ID, { charterAccepted: true })).rejects.toMatchObject({
      code: "TRANSITION_NOT_ALLOWED",
    });
    expect(refundSpy).toHaveBeenCalledWith(intentId);
  });
});

// ─────────────────────────────────────────────
// B — decline
// ─────────────────────────────────────────────

describe("B — decline (libération de l'empreinte + CAP-02)", () => {
  it("chemin nominal : cancel provider, DECLINED + raison, kg restitués, 2 événements", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));

    const result = await makeService(provider).decline(CARRIER, BOOKING_ID, { reason: "TOO_HEAVY" });

    expect((await provider.retrieve(intentId)).status).toBe("CANCELED");
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: "PENDING" },
      data: { status: "DECLINED", closedAt: NOW, closedBy: "CARRIER", declineReason: "TOO_HEAVY" },
    });
    // CAP-02 : les 2 kg du snapshot sont restitués.
    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
      where: { id: TRIP_ID, reservedKg: { gte: 2 } },
      data: { reservedKg: { decrement: 2 } },
    });
    expect(writtenEventTypes()).toEqual(["booking.declined", "booking.refund_issued"]);
    expect(writtenEventPayload("booking.declined")).toMatchObject({ reason: "TOO_HEAVY", actor: "CARRIER" });
    expect(writtenEventPayload("booking.refund_issued")).toMatchObject({ amountCents: 2957 });
    expect(result.refundAmountCents).toBe(2957);
    expect(result.status).toBe("DECLINED");
  });

  it("raison optionnelle : absente → declineReason null", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    await makeService(provider).decline(CARRIER, BOOKING_ID, {});
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ declineReason: null }) })
    );
  });

  it("seul le Voyageur peut refuser (403)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService(provider).decline(SHIPPER, BOOKING_ID, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("depuis ACCEPTED → 409 TRANSITION_NOT_ALLOWED", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "ACCEPTED" }));
    await expect(makeService(provider).decline(CARRIER, BOOKING_ID, {})).rejects.toMatchObject({
      code: "TRANSITION_NOT_ALLOWED",
    });
  });

  it("échec du cancel provider (course avec accept) : la transition part quand même — Stripe tranche, le webhook réconcilie", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    jest.spyOn(provider, "cancel").mockRejectedValue(new Error("already captured"));
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    const result = await makeService(provider).decline(CARRIER, BOOKING_ID, {});
    expect(result.status).toBe("DECLINED");
  });
});

// ─────────────────────────────────────────────
// C — cancel (Expéditeur, ANN-01)
// ─────────────────────────────────────────────

describe("C — cancel Expéditeur (ANN-01, D39)", () => {
  it("PENDING : libération intégrale de l'empreinte, wasAccepted=false", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));

    const result = await makeService(provider).cancel(SHIPPER, BOOKING_ID, { reason: "changed my mind" });

    expect((await provider.retrieve(intentId)).status).toBe("CANCELED");
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: "PENDING" },
      data: expect.objectContaining({
        status: "CANCELLED",
        closedBy: "SHIPPER",
        cancelReason: "changed my mind",
        refundAmountCents: 2957,
      }),
    });
    expect(writtenEventTypes()).toEqual(["booking.cancelled", "booking.refund_issued"]);
    expect(writtenEventPayload("booking.cancelled")).toMatchObject({
      cancelledBy: "SHIPPER",
      wasAccepted: false,
    });
    expect(result.refundAmountCents).toBe(2957);
  });

  it("ACCEPTED à plus de 48 h du départ : VRAI remboursement, 100 %", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    await provider.capture(intentId); // accepté = capturé (D39)
    const refundSpy = jest.spyOn(provider, "refund");
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBookingRecord({ status: "ACCEPTED", paymentIntentId: intentId, departureAt: hoursFromNow(96) })
    );

    const result = await makeService(provider).cancel(SHIPPER, BOOKING_ID, {});

    expect(refundSpy).toHaveBeenCalledWith(intentId, 2957);
    expect(writtenEventPayload("booking.cancelled")).toMatchObject({ wasAccepted: true });
    expect(result.refundAmountCents).toBe(2957);
  });

  it("ACCEPTED à moins de 48 h : retenue 50 % (arrondi) — la retenue reste tracée", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    await provider.capture(intentId);
    const refundSpy = jest.spyOn(provider, "refund");
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBookingRecord({ status: "ACCEPTED", paymentIntentId: intentId, departureAt: hoursFromNow(12) })
    );

    const result = await makeService(provider).cancel(SHIPPER, BOOKING_ID, {});

    expect(refundSpy).toHaveBeenCalledWith(intentId, 1479); // 2957 × 50 % arrondi
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refundAmountCents: 1479 }) })
    );
    expect(writtenEventPayload("booking.refund_issued")).toMatchObject({ amountCents: 1479 });
    expect(result.refundAmountCents).toBe(1479);
  });

  it("seul l'Expéditeur peut annuler (403)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService(provider).cancel(CARRIER, BOOKING_ID, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("après PICKED_UP → 409 (ANN-01 : seule voie, le litige)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    await expect(makeService(provider).cancel(SHIPPER, BOOKING_ID, {})).rejects.toMatchObject({
      code: "TRANSITION_NOT_ALLOWED",
    });
  });

  it("échec du remboursement provider → 409 PAYMENT_STATE_CONFLICT, AUCUNE écriture", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    await provider.capture(intentId);
    jest.spyOn(provider, "refund").mockRejectedValue(new Error("stripe down"));
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBookingRecord({ status: "ACCEPTED", paymentIntentId: intentId })
    );
    await expect(makeService(provider).cancel(SHIPPER, BOOKING_ID, {})).rejects.toMatchObject({
      code: "PAYMENT_STATE_CONFLICT",
    });
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// D — expireDueBookings (cron 24 h)
// ─────────────────────────────────────────────

describe("D — expireDueBookings (DEA-01)", () => {
  it("fournée : chaque périmé → EXPIRED, empreinte libérée, kg restitués, 2 événements", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    const second = await provider.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: {} });
    prismaMock.booking.findMany.mockResolvedValue([
      makeBookingRecord({ expiresAt: hoursFromNow(-2), paymentIntentId: intentId }),
      { ...makeBookingRecord({ expiresAt: hoursFromNow(-1), paymentIntentId: second.intentId }), id: "64b0000000000000000000b2" },
    ]);

    const expired = await makeService(provider).expireDueBookings();

    expect(expired).toBe(2);
    expect((await provider.retrieve(intentId)).status).toBe("CANCELED");
    expect((await provider.retrieve(second.intentId)).status).toBe("CANCELED");
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXPIRED", closedBy: "SYSTEM" }) })
    );
    expect(writtenEventTypes()).toEqual([
      "booking.expired",
      "booking.refund_issued",
      "booking.expired",
      "booking.refund_issued",
    ]);
  });

  it("un échec (course : plus PENDING) n'empêche pas les suivants", async () => {
    const { provider, intentId } = await makeProviderWithAuth();
    const second = await provider.authorize({ amountCents: 2957, currencyCode: "EUR", description: "t", metadata: {} });
    prismaMock.booking.findMany.mockResolvedValue([
      makeBookingRecord({ expiresAt: hoursFromNow(-2), paymentIntentId: intentId }),
      { ...makeBookingRecord({ expiresAt: hoursFromNow(-1), paymentIntentId: second.intentId }), id: "64b0000000000000000000b2" },
    ]);
    // Le premier perd sa course (0 ligne), le second passe.
    prismaMock.booking.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValue({ count: 1 });

    const expired = await makeService(provider).expireDueBookings();
    expect(expired).toBe(1);
  });

  it("rien à expirer → 0, aucune écriture", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findMany.mockResolvedValue([]);
    expect(await makeService(provider).expireDueBookings()).toBe(0);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// E — webhook D40 : cancelBookingForDeadPayment
// ─────────────────────────────────────────────

describe("E — cancelBookingForDeadPayment (webhook payment_intent.canceled, D40)", () => {
  it("PENDING → CANCELLED par SYSTEM, kg restitués, un seul événement (pas de refund : rien capturé)", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findFirst.mockResolvedValue(makeBookingRecord());

    const cancelled = await makeService(provider).cancelBookingForDeadPayment("pi_fake_default");

    expect(cancelled).toBe(true);
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: "PENDING" },
      data: expect.objectContaining({
        status: "CANCELLED",
        closedBy: "SYSTEM",
        cancelReason: "PAYMENT_AUTHORIZATION_LOST",
      }),
    });
    expect(prismaMock.trip.updateMany).toHaveBeenCalled();
    expect(writtenEventTypes()).toEqual(["booking.cancelled"]);
    expect(writtenEventPayload("booking.cancelled")).toMatchObject({
      cancelledBy: "SYSTEM",
      reason: "PAYMENT_AUTHORIZATION_LOST",
      wasAccepted: false,
    });
  });

  it("booking déjà ACCEPTED (capture gagnée) → no-op idempotent", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findFirst.mockResolvedValue(makeBookingRecord({ status: "ACCEPTED" }));
    expect(await makeService(provider).cancelBookingForDeadPayment("pi_fake_default")).toBe(false);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("intent inconnu → no-op idempotent", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findFirst.mockResolvedValue(null);
    expect(await makeService(provider).cancelBookingForDeadPayment("pi_gone")).toBe(false);
  });

  it("course : la transaction perd (0 ligne) → false, sans erreur", async () => {
    const { provider } = await makeProviderWithAuth();
    prismaMock.booking.findFirst.mockResolvedValue(makeBookingRecord());
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });
    expect(await makeService(provider).cancelBookingForDeadPayment("pi_fake_default")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Garde-fou : l'erreur 409 porte bien le code (surface front)
// ─────────────────────────────────────────────

describe("BookingLifecycleError — surface API", () => {
  it("statusCode 409, details.type='booking', code exposé", () => {
    const e = new BookingLifecycleError("TRANSITION_NOT_ALLOWED", "nope");
    expect(e.statusCode).toBe(409);
    expect(e.details).toMatchObject({ type: "booking", code: "TRANSITION_NOT_ALLOWED" });
  });
});

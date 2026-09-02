/**
 * deal-transport.service.spec.ts — pickup / refusePickup / tracking / regenerate / deliver (B3-PR1)
 * ==================================================================================================
 * Même stratégie que deal-lifecycle.service.spec (D30) : FakePaymentProvider
 * réel (l'argent est observé sur son état), prisma mocké (les updateMany
 * conditionnels pilotent les courses), CONTRAT RÉEL sur chaque événement
 * outbox écrit. Les codes sont générés par la vraie lib (bcrypt + AES) :
 * les tests relisent les données ÉCRITES pour prouver leur cohérence.
 *
 * Sections :
 *  A. pickup      — code né en transaction (hash ≠ clair, chiffré lisible), checklist figée, 403, machine
 *  B. refusePickup — remboursement INTÉGRAL réel puis transaction, CAP-02, 2 événements, sans pénalité
 *  C. tracking    — séquence stricte, doublon, saut, garde `none`, course
 *  D. regenerate  — Expéditeur seul, ≤ 5, l'ancien code meurt, compteur d'essais remis à 0
 *  E. deliver     — bon code, mauvais code (+1), verrou au 3e, verrou actif, sans hash, course
 */

const prismaMock = {
  booking: { findUnique: jest.fn(), updateMany: jest.fn() },
  trip: { updateMany: jest.fn() },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { ForbiddenError, NotFoundError } from "@packages/error-handler";
import { FakePaymentProvider, type PaymentProvider } from "@packages/payments";
import { PICKUP_CHECKLIST_ITEMS } from "@packages/api-contracts";
import { makeDealTransportService } from "./deal-transport.service";
import { BookingLifecycleError } from "./booking-lifecycle";
import { decryptDeliveryCode, hashDeliveryCode, resolveDeliveryCodeKey, verifyDeliveryCode } from "@packages/delivery-code";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const minutesFromNow = (m: number) => new Date(NOW.getTime() + m * 60_000);

const BOOKING_ID = "64b0000000000000000000b1";
const TRIP_ID = "64b0000000000000000000a1";
const SHIPPER_ID = "64b0000000000000000000e1";
const CARRIER_ID = "64b0000000000000000000c1";
const SHIPPER = { id: SHIPPER_ID };
const CARRIER = { id: CARRIER_ID };
const STRANGER = { id: "64b0000000000000000000f9" };

const PHOTO = "https://ik.imagekit.io/yamba/deals/pickup/abc.jpg";
const CHECKLIST = [...PICKUP_CHECKLIST_ITEMS];
const KEY = resolveDeliveryCodeKey({ NODE_ENV: "test" } as NodeJS.ProcessEnv);

type Overrides = Partial<{
  status: string;
  paymentIntentId: string | null;
  trackingEvents: { step: string; confirmedAt: Date }[];
  deliveryCodeHash: string | null;
  deliveryAttempts: number;
  deliveryLockedUntil: Date | null;
  codeRegenerations: number;
}>;

function makeBookingRecord(o: Overrides = {}) {
  return {
    id: BOOKING_ID,
    tripId: TRIP_ID,
    shipperId: SHIPPER_ID,
    carrierId: CARRIER_ID,
    status: o.status ?? "ACCEPTED",
    isDeleted: false,
    expiresAt: new Date("2026-07-10T12:00:00.000Z"),
    acceptedAt: new Date("2026-07-10T10:00:00.000Z"),
    pickedUpAt: null,
    paymentIntentId: o.paymentIntentId === undefined ? "pi_fake_default" : o.paymentIntentId,
    trip: { originCity: "Paris", originCountryCode: "FR", destinationCity: "Brazzaville", destinationCountryCode: "CG", departureAt: new Date("2026-07-20T10:00:00.000Z") },
    pricing: { weightKg: 2, transportCents: 2400, totalShipperCents: 2957, currencyCode: "EUR" },
    parcel: { category: "DOCUMENTS", categoryFamily: "DOCUMENTS_PAPERS" },
    pickup: null,
    trackingEvents: o.trackingEvents ?? [],
    deliveryCodeHash: o.deliveryCodeHash ?? null,
    deliveryAttempts: o.deliveryAttempts ?? 0,
    deliveryLockedUntil: o.deliveryLockedUntil ?? null,
    codeRegenerations: o.codeRegenerations ?? 0,
  };
}

/** Provider Fake + une empreinte CAPTURÉE (le deal est ACCEPTED — D39). */
async function makeProviderCaptured() {
  const provider = new FakePaymentProvider();
  const auth = await provider.authorize({ amountCents: 2957, currencyCode: "EUR", description: "test", metadata: {} });
  await provider.capture(auth.intentId);
  return { provider, intentId: auth.intentId };
}

function makeService(provider: PaymentProvider = new FakePaymentProvider()) {
  return makeDealTransportService(provider, () => NOW);
}

function lastUpdate(): { where: Record<string, unknown>; data: Record<string, unknown> } {
  const calls = prismaMock.booking.updateMany.mock.calls;
  return calls[calls.length - 1][0];
}
function writtenEventTypes(): string[] {
  return prismaMock.outboxEvent.create.mock.calls.map((c) => c[0].data.eventType);
}
function writtenEventPayload(eventType: string): Record<string, unknown> {
  const call = prismaMock.outboxEvent.create.mock.calls.find((c) => c[0].data.eventType === eventType);
  return call ? (call[0].data.payload as { payload: Record<string, unknown> }).payload : {};
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

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.trip.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.outboxEvent.create.mockResolvedValue({});
});

// ─────────────────────────────────────────────
// A — pickup
// ─────────────────────────────────────────────

describe("A — confirmPickup (D42/D43)", () => {
  it("chemin nominal : ACCEPTED→PICKED_UP conditionnel, code né en transaction (hash + AES cohérents), checklist figée, booking.picked_up", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    const result = await makeService().confirmPickup(CARRIER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO], notes: "T2E" });

    const { where, data } = lastUpdate();
    expect(where).toEqual({ id: BOOKING_ID, status: "ACCEPTED" });
    expect(data.status).toBe("PICKED_UP");
    expect(data.pickedUpAt).toEqual(NOW);
    expect(data.pickup).toEqual({ confirmedAt: NOW, photoUrls: [PHOTO], notes: "T2E", checklist: CHECKLIST });
    expect(data.codeRegenerations).toBe(0);
    expect(data.deliveryAttempts).toBe(0);
    expect(data.deliveryLockedUntil).toBeNull();

    // Les deux formes du code désignent le MÊME clair, et le clair n'est nulle part en base.
    const clear = decryptDeliveryCode(data.deliveryCodeEncrypted as string, KEY);
    expect(clear).toMatch(/^\d{6}$/);
    expect(await verifyDeliveryCode(clear!, data.deliveryCodeHash as string)).toBe(true);
    expect(JSON.stringify(data)).not.toContain(clear);

    expect(prismaMock.trip.updateMany).not.toHaveBeenCalled();
    expect(writtenEventTypes()).toEqual(["booking.picked_up"]);
    const payload = writtenEventPayload("booking.picked_up");
    expect(payload).toMatchObject({ actor: "CARRIER", pickedUpAt: NOW.toISOString(), photoCount: 1 });
    // INV-1 : le code ne voyage JAMAIS dans un événement.
    expect(JSON.stringify(payload)).not.toContain(clear);
    expect(result).toEqual({ bookingId: BOOKING_ID, status: "PICKED_UP", refundAmountCents: null, currencyCode: "EUR" });
  });

  it("notes absentes → null figé", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await makeService().confirmPickup(CARRIER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO] });
    expect((lastUpdate().data.pickup as { notes: unknown }).notes).toBeNull();
  });

  it("l'Expéditeur ou un tiers → 403 (le deal existe), inconnu → 404", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    await expect(makeService().confirmPickup(SHIPPER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO] })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(makeService().confirmPickup(STRANGER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO] })).rejects.toBeInstanceOf(ForbiddenError);
    prismaMock.booking.findUnique.mockResolvedValue(null);
    await expect(makeService().confirmPickup(CARRIER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO] })).rejects.toBeInstanceOf(NotFoundError);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("depuis PENDING (pas encore accepté) → 409 TRANSITION_NOT_ALLOWED, rien d'écrit", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PENDING" }));
    await expectCode(makeService().confirmPickup(CARRIER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO] }), "TRANSITION_NOT_ALLOWED");
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("course : un concurrent a fermé le deal (count 0) → 409, aucun événement", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord());
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });
    await expectCode(makeService().confirmPickup(CARRIER, BOOKING_ID, { checklist: CHECKLIST, photoUrls: [PHOTO] }), "TRANSITION_NOT_ALLOWED");
    expect(prismaMock.outboxEvent.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// B — refusePickup
// ─────────────────────────────────────────────

describe("B — refusePickup (A40)", () => {
  it("chemin nominal : remboursement INTÉGRAL réel AVANT la base, ACCEPTED→CANCELLED, kg restitués, 2 événements", async () => {
    const { provider, intentId } = await makeProviderCaptured();
    const refundSpy = jest.spyOn(provider, "refund");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));

    const result = await makeService(provider).refusePickup(CARRIER, BOOKING_ID, { reason: "SUSPICIOUS_CONTENT" });

    // L'argent d'abord : remboursement INTÉGRAL demandé au fournisseur sur l'intent CAPTURÉ.
    expect(refundSpy).toHaveBeenCalledWith(intentId, 2957);
    expect(refundSpy.mock.invocationCallOrder[0]).toBeLessThan(prismaMock.$transaction.mock.invocationCallOrder[0]);
    const { where, data } = lastUpdate();
    expect(where).toEqual({ id: BOOKING_ID, status: "ACCEPTED" });
    expect(data).toEqual({
      status: "CANCELLED",
      closedAt: NOW,
      closedBy: "CARRIER",
      pickupRefusalReason: "SUSPICIOUS_CONTENT",
      refundedAt: NOW,
      refundAmountCents: 2957,
    });
    expect(prismaMock.trip.updateMany).toHaveBeenCalledWith({
      where: { id: TRIP_ID, reservedKg: { gte: 2 } },
      data: { reservedKg: { decrement: 2 } },
    });
    expect(writtenEventTypes()).toEqual(["booking.pickup_refused", "booking.refund_issued"]);
    expect(writtenEventPayload("booking.pickup_refused")).toMatchObject({ actor: "CARRIER", reason: "SUSPICIOUS_CONTENT" });
    expect(writtenEventPayload("booking.refund_issued")).toMatchObject({ amountCents: 2957 });
    expect(result).toEqual({ bookingId: BOOKING_ID, status: "CANCELLED", refundAmountCents: 2957, currencyCode: "EUR" });
  });

  it("sans raison → null figé ; l'Expéditeur ne peut pas refuser un pickup (403)", async () => {
    const { provider, intentId } = await makeProviderCaptured();
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: intentId }));
    await makeService(provider).refusePickup(CARRIER, BOOKING_ID, {});
    expect(lastUpdate().data.pickupRefusalReason).toBeNull();
    await expect(makeService(provider).refusePickup(SHIPPER, BOOKING_ID, {})).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("remboursement impossible (intent inconnu) → 409 PAYMENT_STATE_CONFLICT, rien d'écrit", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ paymentIntentId: "pi_unknown" }));
    await expectCode(makeService(new FakePaymentProvider()).refusePickup(CARRIER, BOOKING_ID, {}), "PAYMENT_STATE_CONFLICT");
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("déjà PICKED_UP → 409 TRANSITION_NOT_ALLOWED (après remise, seule voie : le litige)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    await expectCode(makeService().refusePickup(CARRIER, BOOKING_ID, {}), "TRANSITION_NOT_ALLOWED");
  });
});

// ─────────────────────────────────────────────
// C — tracking
// ─────────────────────────────────────────────

describe("C — confirmTrackingStep (A39)", () => {
  const AT = { step: "AT_AIRPORT", confirmedAt: new Date("2026-07-18T08:00:00.000Z") };

  it("premier jalon : garde `none`, push, outbox booking.tracking_event, réponse = séquence complète", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    const result = await makeService().confirmTrackingStep(CARRIER, BOOKING_ID, { step: "AT_AIRPORT" });
    const { where, data } = lastUpdate();
    expect(where).toEqual({ id: BOOKING_ID, status: "PICKED_UP", trackingEvents: { none: { step: "AT_AIRPORT" } } });
    expect(data).toEqual({ trackingEvents: { push: { step: "AT_AIRPORT", confirmedAt: NOW } } });
    expect(writtenEventTypes()).toEqual(["booking.tracking_event"]);
    expect(writtenEventPayload("booking.tracking_event")).toMatchObject({ step: "AT_AIRPORT", confirmedAt: NOW.toISOString() });
    expect(result).toEqual({
      bookingId: BOOKING_ID,
      step: "AT_AIRPORT",
      confirmedAt: NOW.toISOString(),
      trackingEvents: [{ step: "AT_AIRPORT", confirmedAt: NOW.toISOString() }],
    });
  });

  it("deuxième jalon dans l'ordre : la réponse cumule", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", trackingEvents: [AT] }));
    const result = await makeService().confirmTrackingStep(CARRIER, BOOKING_ID, { step: "FLIGHT_DEPARTED" });
    expect(result.trackingEvents.map((e) => e.step)).toEqual(["AT_AIRPORT", "FLIGHT_DEPARTED"]);
  });

  it("saut (FLIGHT_ARRIVED sans DEPARTED) et doublon → 409 TRACKING_STEP_NOT_ALLOWED, rien d'écrit", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", trackingEvents: [AT] }));
    await expectCode(makeService().confirmTrackingStep(CARRIER, BOOKING_ID, { step: "FLIGHT_ARRIVED" }), "TRACKING_STEP_NOT_ALLOWED");
    await expectCode(makeService().confirmTrackingStep(CARRIER, BOOKING_ID, { step: "AT_AIRPORT" }), "TRACKING_STEP_NOT_ALLOWED");
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("hors PICKED_UP → 409 ; Expéditeur → 403", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "ACCEPTED" }));
    await expectCode(makeService().confirmTrackingStep(CARRIER, BOOKING_ID, { step: "AT_AIRPORT" }), "TRACKING_STEP_NOT_ALLOWED");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    await expect(makeService().confirmTrackingStep(SHIPPER, BOOKING_ID, { step: "AT_AIRPORT" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("course : double envoi (count 0) → 409 avec le message « déjà confirmé », aucun événement", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });
    const err = await expectCode(makeService().confirmTrackingStep(CARRIER, BOOKING_ID, { step: "AT_AIRPORT" }), "TRANSITION_NOT_ALLOWED");
    expect(err.message).toContain("already confirmed");
    expect(prismaMock.outboxEvent.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// D — regenerate
// ─────────────────────────────────────────────

describe("D — regenerateCode (Expéditeur, ≤ 5)", () => {
  it("nominal : nouveau code cohérent (hash + AES), compteur +1 par garde optimiste, essais remis à 0, outbox sans le code, réponse = le code", async () => {
    const oldHash = await hashDeliveryCode("111111");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: oldHash, codeRegenerations: 2, deliveryAttempts: 2 }));

    const result = await makeService().regenerateCode(SHIPPER, BOOKING_ID);

    const { where, data } = lastUpdate();
    expect(where).toEqual({ id: BOOKING_ID, status: "PICKED_UP", codeRegenerations: 2 });
    expect(data).toMatchObject({ codeRegenerations: 3, deliveryAttempts: 0, deliveryLockedUntil: null });
    expect(result.bookingId).toBe(BOOKING_ID);
    expect(result.deliveryCode).toMatch(/^\d{6}$/);
    expect(result.codeRegenerationsLeft).toBe(2);
    // Le clair retourné = celui écrit, l'ancien code est mort.
    expect(decryptDeliveryCode(data.deliveryCodeEncrypted as string, KEY)).toBe(result.deliveryCode);
    expect(await verifyDeliveryCode(result.deliveryCode, data.deliveryCodeHash as string)).toBe(true);
    expect(await verifyDeliveryCode("111111", data.deliveryCodeHash as string)).toBe(false);
    expect(writtenEventTypes()).toEqual(["booking.code_regenerated"]);
    const payload = writtenEventPayload("booking.code_regenerated");
    expect(payload).toMatchObject({ actor: "SHIPPER", regenerationsUsed: 3, regenerationsLeft: 2 });
    expect(JSON.stringify(payload)).not.toContain(result.deliveryCode);
  });

  it("plafond atteint (5) → 409 CODE_REGENERATION_LIMIT ; hors PICKED_UP → 409 ; Voyageur → 403", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", codeRegenerations: 5 }));
    await expectCode(makeService().regenerateCode(SHIPPER, BOOKING_ID), "CODE_REGENERATION_LIMIT");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "DELIVERED" }));
    await expectCode(makeService().regenerateCode(SHIPPER, BOOKING_ID), "CODE_REGENERATION_LIMIT");
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    await expect(makeService().regenerateCode(CARRIER, BOOKING_ID)).rejects.toBeInstanceOf(ForbiddenError);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("course : deux clics (count 0 sur la garde compteur) → 409, un seul événement possible", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP" }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });
    await expectCode(makeService().regenerateCode(SHIPPER, BOOKING_ID), "TRANSITION_NOT_ALLOWED");
    expect(prismaMock.outboxEvent.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────
// E — deliver
// ─────────────────────────────────────────────

describe("E — deliver (A38)", () => {
  let hash: string;
  beforeAll(async () => {
    hash = await hashDeliveryCode("742891");
  });

  it("bon code : PICKED_UP→DELIVERED conditionnel (statut + compteur), payoutDueAt = J+4, booking.delivered avec attemptsUsed", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: hash, deliveryAttempts: 1 }));
    const result = await makeService().deliver(CARRIER, BOOKING_ID, { code: "742891" });
    const { where, data } = lastUpdate();
    const payoutDueAt = new Date("2026-07-22T12:00:00.000Z");
    expect(where).toEqual({ id: BOOKING_ID, status: "PICKED_UP", deliveryAttempts: 1 });
    expect(data).toEqual({ status: "DELIVERED", deliveredAt: NOW, payoutDueAt, deliveryAttempts: 2 });
    expect(writtenEventTypes()).toEqual(["booking.delivered"]);
    expect(writtenEventPayload("booking.delivered")).toMatchObject({
      actor: "CARRIER",
      deliveredAt: NOW.toISOString(),
      payoutDueAt: payoutDueAt.toISOString(),
      attemptsUsed: 2,
    });
    expect(result).toEqual({ bookingId: BOOKING_ID, status: "DELIVERED", deliveredAt: NOW.toISOString(), payoutDueAt: payoutDueAt.toISOString() });
  });

  it("mauvais code (1er) : compteur +1 par écriture conditionnelle, 409 DELIVERY_CODE_INVALID attemptsLeft 2, AUCUN événement", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: hash }));
    const err = await expectCode(makeService().deliver(CARRIER, BOOKING_ID, { code: "000000" }), "DELIVERY_CODE_INVALID");
    expect(err.details).toMatchObject({ attemptsLeft: 2 });
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: "PICKED_UP", deliveryAttempts: 0 },
      data: { deliveryAttempts: 1 },
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("3e échec : verrou 15 min ET compteur remis à 0, 409 DELIVERY_LOCKED lockedUntil", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: hash, deliveryAttempts: 2 }));
    const err = await expectCode(makeService().deliver(CARRIER, BOOKING_ID, { code: "000000" }), "DELIVERY_LOCKED");
    const lockedUntil = minutesFromNow(15);
    expect(err.details).toMatchObject({ lockedUntil: lockedUntil.toISOString(), attemptsLeft: 0 });
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith({
      where: { id: BOOKING_ID, status: "PICKED_UP", deliveryAttempts: 2 },
      data: { deliveryAttempts: 0, deliveryLockedUntil: lockedUntil },
    });
  });

  it("verrou actif : refus par le guard machine AVANT toute comparaison (même avec le bon code)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: hash, deliveryLockedUntil: minutesFromNow(5) })
    );
    const err = await expectCode(makeService().deliver(CARRIER, BOOKING_ID, { code: "742891" }), "TRANSITION_NOT_ALLOWED");
    expect(err.message).toContain("locked");
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("verrou expiré : la saisie reprend (compteur à 0 depuis le verrou)", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: hash, deliveryLockedUntil: minutesFromNow(-1) })
    );
    const result = await makeService().deliver(CARRIER, BOOKING_ID, { code: "742891" });
    expect(result.status).toBe("DELIVERED");
  });

  it("PICKED_UP sans hash (enregistrement pré-B3) → 409 DELIVERY_CODE_UNAVAILABLE, rien d'écrit", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: null }));
    await expectCode(makeService().deliver(CARRIER, BOOKING_ID, { code: "742891" }), "DELIVERY_CODE_UNAVAILABLE");
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it("course sur le compteur (count 0) → 409 sans double comptage ; Expéditeur → 403 ; ACCEPTED → 409", async () => {
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "PICKED_UP", deliveryCodeHash: hash }));
    prismaMock.booking.updateMany.mockResolvedValue({ count: 0 });
    await expectCode(makeService().deliver(CARRIER, BOOKING_ID, { code: "000000" }), "TRANSITION_NOT_ALLOWED");
    await expect(makeService().deliver(SHIPPER, BOOKING_ID, { code: "742891" })).rejects.toBeInstanceOf(ForbiddenError);
    prismaMock.booking.findUnique.mockResolvedValue(makeBookingRecord({ status: "ACCEPTED", deliveryCodeHash: hash }));
    await expectCode(makeService().deliver(CARRIER, BOOKING_ID, { code: "742891" }), "TRANSITION_NOT_ALLOWED");
  });
});

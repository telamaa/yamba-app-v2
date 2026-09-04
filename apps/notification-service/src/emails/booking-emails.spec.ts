/**
 * booking-emails.spec.ts — preuves du canal email (D41/A35/A36, D30)
 * ==================================================================
 * Même doctrine que le spec du consumer :
 * - prisma & @packages/email : mocks VIRTUELS ;
 * - LE CONTRAT EST RÉEL : les fixtures passent le vrai
 *   BookingDomainEventSchema (méta-test) ;
 * - la matrice (A35) se teste comme une TABLE ; le pipeline se
 *   teste sur les claims (A36) et la frontière A13 (jamais le
 *   total Expéditeur dans un email Voyageur).
 */
import { Prisma } from "@prisma/client";

const prismaMock = {
  user: {
    findMany: jest.fn(),
  },
  emailDelivery: {
    create: jest.fn(),
    update: jest.fn(),
  },
};
jest.mock(
  "@packages/libs/prisma",
  () => ({ __esModule: true, default: prismaMock }),
  { virtual: true }
);

const emailMock = {
  isEmailConfigured: jest.fn(),
  sendTemplatedEmail: jest.fn(),
  sendTransactionalEmail: jest.fn(),
};
jest.mock("@packages/email", () => emailMock, { virtual: true });

import { BookingDomainEventSchema } from "@packages/api-contracts";
import {
  EMAIL_MATRIX,
  buildBookingEmail,
  dispatchBookingEmails,
  resolveEmailRecipients,
} from "./booking-emails";

/* ── Fixtures : événements VALIDES au contrat réel ───────────── */

const OID = {
  booking: "64b000000000000000000001",
  trip: "64b000000000000000000010",
  shipper: "64b000000000000000000020",
  carrier: "64b000000000000000000030",
};
const EVENT_ID = "6f0000000000000000000001";

function basePayload() {
  return {
    bookingId: OID.booking,
    tripId: OID.trip,
    shipperId: OID.shipper,
    carrierId: OID.carrier,
    corridor: {
      originCity: "Paris",
      originCountryCode: "FR",
      destinationCity: "Brazzaville",
      destinationCountryCode: "CG",
    },
    category: "DOCUMENTS",
    categoryFamily: null,
    weightKg: 2.5,
    transportCents: 3000,
    totalShipperCents: 3900,
    currencyCode: "EUR",
    actor: "SHIPPER" as const,
  };
}

function envelope(eventType: string, payload: Record<string, unknown>) {
  return {
    aggregateType: "booking",
    aggregateId: OID.booking,
    occurredAt: "2026-07-19T10:00:00.000Z",
    correlationId: "spec",
    schemaVersion: 1,
    eventType,
    payload,
  };
}

function requestedEvent() {
  return envelope("booking.requested", {
    ...basePayload(),
    expiresAt: "2026-07-20T10:00:00.000Z",
  });
}

function paymentAuthorizedEvent() {
  return envelope("booking.payment_authorized", {
    ...basePayload(),
    paymentIntentId: "pi_spec",
    amountCents: 3900,
  });
}

/* ── B3 (A41) ─────────────────────────────────────────────────── */

function pickedUpEvent() {
  return envelope("booking.picked_up", {
    ...basePayload(),
    actor: "CARRIER" as const,
    pickedUpAt: "2026-07-19T12:00:00.000Z",
    photoCount: 2,
  });
}

function pickupRefusedEvent(reason: string | null) {
  return envelope("booking.pickup_refused", {
    ...basePayload(),
    actor: "CARRIER" as const,
    reason,
    closedAt: "2026-07-19T12:00:00.000Z",
  });
}

function codeRegeneratedEvent() {
  return envelope("booking.code_regenerated", {
    ...basePayload(),
    regenerationsUsed: 2,
    regenerationsLeft: 3,
  });
}

function deliveredEvent() {
  return envelope("booking.delivered", {
    ...basePayload(),
    actor: "CARRIER" as const,
    deliveredAt: "2026-07-19T12:00:00.000Z",
    payoutDueAt: "2026-07-23T12:00:00.000Z",
    attemptsUsed: 1,
  });
}

/* ══ Fixtures B4 (D52) ════════════════════════════════════════ */
function completedEvent(completedBy: "SHIPPER" | "SYSTEM" = "SHIPPER") {
  return envelope("booking.completed", {
    ...basePayload(),
    actor: completedBy,
    completedAt: "2026-07-20T09:00:00.000Z",
    completedBy,
  });
}
function payoutSentEvent() {
  return envelope("booking.payout_sent", {
    ...basePayload(),
    actor: "SYSTEM" as const,
    transferId: "tr_test_1",
    amountCents: 3000,
  });
}
function disputedEvent(disputeCategory: string | null = "DAMAGED") {
  return envelope("booking.disputed", {
    ...basePayload(),
    actor: "SHIPPER" as const,
    ticketNumber: "YAM-2041",
    disputedAt: "2026-07-20T09:00:00.000Z",
    ...(disputeCategory ? { disputeCategory } : {}),
  });
}
function verificationReminderEvent() {
  return envelope("booking.verification_reminder", {
    ...basePayload(),
    actor: "SYSTEM" as const,
    payoutDueAt: "2026-07-23T12:00:00.000Z",
  });
}

function cancelledEvent(wasAccepted: boolean) {
  return envelope("booking.cancelled", {
    ...basePayload(),
    cancelledBy: "SHIPPER" as const,
    reason: null,
    wasAccepted,
    closedAt: "2026-07-19T12:00:00.000Z",
  });
}

function declinedEvent(reason: string | null) {
  return envelope("booking.declined", {
    ...basePayload(),
    actor: "CARRIER" as const,
    reason,
    closedAt: "2026-07-19T12:00:00.000Z",
  });
}

function parse(event: unknown) {
  return BookingDomainEventSchema.parse(event);
}

function buildLogger() {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return logger as unknown as import("pino").Logger & typeof logger;
}

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    code: "P2002",
    clientVersion: "6.19.3",
  });
}

const CARRIER_USER = {
  id: OID.carrier,
  email: "carrier@spec.test",
  firstName: "Awa",
  preferredLocale: "en",
};
const SHIPPER_USER = {
  id: OID.shipper,
  email: "shipper@spec.test",
  firstName: "Naomi",
  preferredLocale: "fr",
};

beforeEach(() => {
  jest.clearAllMocks();
  emailMock.isEmailConfigured.mockReturnValue(true);
  emailMock.sendTemplatedEmail.mockResolvedValue(undefined);
  prismaMock.user.findMany.mockResolvedValue([CARRIER_USER, SHIPPER_USER]);
  prismaMock.emailDelivery.create.mockResolvedValue({});
  prismaMock.emailDelivery.update.mockResolvedValue({});
});

/* ── Matrice A35 ─────────────────────────────────────────────── */

describe("matrice email (A35)", () => {
  it("méta-test : les fixtures passent le VRAI contrat", () => {
    expect(() => parse(requestedEvent())).not.toThrow();
    expect(() => parse(paymentAuthorizedEvent())).not.toThrow();
    expect(() => parse(cancelledEvent(true))).not.toThrow();
    expect(() => parse(declinedEvent("TIMING"))).not.toThrow();
  });

  it("la matrice couvre les 18 événements du contrat (17 + verification_reminder B4/A70)", () => {
    expect(Object.keys(EMAIL_MATRIX)).toHaveLength(20);
  });

  it("requested → CARRIER seul ; payment_authorized → SHIPPER seul (email-only)", () => {
    expect(resolveEmailRecipients(parse(requestedEvent()))).toEqual([
      { userId: OID.carrier, role: "CARRIER" },
    ]);
    expect(resolveEmailRecipients(parse(paymentAuthorizedEvent()))).toEqual([
      { userId: OID.shipper, role: "SHIPPER" },
    ]);
  });

  it("cancelled : SHIPPER toujours, CARRIER seulement si wasAccepted", () => {
    expect(resolveEmailRecipients(parse(cancelledEvent(false)))).toEqual([
      { userId: OID.shipper, role: "SHIPPER" },
    ]);
    expect(resolveEmailRecipients(parse(cancelledEvent(true)))).toEqual([
      { userId: OID.shipper, role: "SHIPPER" },
      { userId: OID.carrier, role: "CARRIER" },
    ]);
  });

  it("B3 (A41) : picked_up / pickup_refused / code_regenerated / delivered → SHIPPER seul", () => {
    for (const ev of [pickedUpEvent(), pickupRefusedEvent(null), codeRegeneratedEvent(), deliveredEvent()]) {
      expect(resolveEmailRecipients(parse(ev))).toEqual([{ userId: OID.shipper, role: "SHIPPER" }]);
    }
  });

  it("B3 : les 4 builders portent leurs données, sans jamais un code à 6 chiffres", () => {
    const picked = buildBookingEmail(parse(pickedUpEvent()), "SHIPPER", "Naomi")!;
    expect(picked.template).toBe("booking/booking-picked-up-shipper");
    expect(picked.data).toMatchObject({ photoCount: 2 });
    const refused = buildBookingEmail(parse(pickupRefusedEvent("OVERWEIGHT")), "SHIPPER", "Naomi")!;
    expect(refused.data).toMatchObject({ reason: "Le colis dépasse le poids déclaré", total: expect.stringContaining("39") });
    expect(buildBookingEmail(parse(pickupRefusedEvent("UNKNOWN")), "SHIPPER", "Naomi")!.data).toMatchObject({ reason: null });
    const regen = buildBookingEmail(parse(codeRegeneratedEvent()), "SHIPPER", "Naomi")!;
    expect(regen.data).toMatchObject({ regenerationsLeft: 3 });
    const delivered = buildBookingEmail(parse(deliveredEvent()), "SHIPPER", "Naomi")!;
    expect(delivered.data).toMatchObject({ transport: expect.stringContaining("30") });
    for (const built of [picked, refused, regen, delivered]) {
      expect(JSON.stringify(built)).not.toMatch(/(?<![#0-9A-Za-z])\d{6}(?![0-9A-Za-z])/);
    }
  });

  it("B5 : rating_reminder → le rôle CIBLE seul, J+5 puis « dernier rappel » ; completed porte le bouton « Noter »", () => {
    const rem = (n: 1 | 2, targetRole: "SHIPPER" | "CARRIER") =>
      parse(envelope("booking.rating_reminder", { ...basePayload(), actor: "SYSTEM" as const, reminderNumber: n, targetRole }));
    expect(resolveEmailRecipients(rem(1, "CARRIER"))).toEqual([{ userId: OID.carrier, role: "CARRIER" }]);
    expect(resolveEmailRecipients(rem(2, "SHIPPER"))).toEqual([{ userId: OID.shipper, role: "SHIPPER" }]);
    const first = buildBookingEmail(rem(1, "CARRIER"), "CARRIER", "Thomas", { locale: "fr", counterpartFirstName: "Naomi" })!;
    expect(first.subject).toBe("Pense à noter Naomi");
    expect(first.content!.cta!.url).toMatch(/\/carrier\/deals\/.*\/rate$/);
    const last = buildBookingEmail(rem(2, "SHIPPER"), "SHIPPER", "Naomi", { locale: "en" })!;
    expect(last.subject).toContain("Last reminder");
    expect(last.content!.cta!.url).toMatch(/\/bookings\/.*\/rate$/);
    const completed = buildBookingEmail(parse(completedEvent()), "SHIPPER", "Naomi", { locale: "fr", counterpartFirstName: "Thomas" })!;
    expect(completed.content!.cta!.label).toBe("Noter Thomas");
    expect(completed.content!.cta!.url).toMatch(/\/rate$/);
  });

  it("tracking_event : aucun email pour AT_AIRPORT / FLIGHT_DEPARTED (anti-spam) ; l'ATTERRISSAGE écrit à l'Expéditeur (décision 03/09, 4A)", () => {
    const step = (s: string) =>
      parse(envelope("booking.tracking_event", { ...basePayload(), actor: "CARRIER" as const, step: s, confirmedAt: "2026-07-19T12:00:00.000Z" }));
    expect(resolveEmailRecipients(step("AT_AIRPORT"))).toEqual([]);
    expect(resolveEmailRecipients(step("FLIGHT_DEPARTED"))).toEqual([]);
    expect(resolveEmailRecipients(step("FLIGHT_ARRIVED"))).toEqual([{ userId: OID.shipper, role: "SHIPPER" }]);
    const built = buildBookingEmail(step("FLIGHT_ARRIVED"), "SHIPPER", "Naomi", { locale: "fr", counterpartFirstName: "Thomas" })!;
    expect(built.template).toBe("settlement/flight-arrived-shipper");
    expect(built.subject).toContain("Thomas a atterri");
    expect(built.content!.paragraphs.join(" ")).toContain("code de livraison");
    expect(buildBookingEmail(step("AT_AIRPORT"), "SHIPPER", "Naomi")).toBeNull();
  });

  it("toute règle non-null a un builder (aucune clé ne rend null une fois routée)", () => {
    for (const [eventType, rule] of Object.entries(EMAIL_MATRIX)) {
      if (rule === null) continue;
      // Les 11 clés actives (7 B2 + 4 B3) sont toutes constructibles pour leur rôle.
      const role = rule === "CARRIER" ? "CARRIER" : "SHIPPER";
      const fixtures: Record<string, unknown> = {
        "booking.requested": requestedEvent(),
        "booking.payment_authorized": paymentAuthorizedEvent(),
        "booking.accepted": envelope("booking.accepted", {
          ...basePayload(),
          actor: "CARRIER" as const,
          acceptedAt: "2026-07-19T12:00:00.000Z",
        }),
        "booking.declined": declinedEvent(null),
        "booking.expired": envelope("booking.expired", {
          ...basePayload(),
          actor: "SYSTEM" as const,
          closedAt: "2026-07-20T10:00:00.000Z",
        }),
        "booking.cancelled": cancelledEvent(true),
        "booking.refund_issued": envelope("booking.refund_issued", {
          ...basePayload(),
          actor: "SYSTEM" as const,
          amountCents: 3900,
          refundedAt: "2026-07-19T12:00:00.000Z",
        }),
        // B3 (A41)
        "booking.picked_up": pickedUpEvent(),
        "booking.pickup_refused": pickupRefusedEvent("OVERWEIGHT"),
        "booking.code_regenerated": codeRegeneratedEvent(),
        "booking.delivered": deliveredEvent(),
        // B4 (D52)
        "booking.completed": completedEvent(),
        "booking.payout_sent": payoutSentEvent(),
        "booking.disputed": disputedEvent(),
        "booking.verification_reminder": verificationReminderEvent(),
        // B5 : rappel de notation au rôle cible
        "booking.rating_reminder": envelope("booking.rating_reminder", { ...basePayload(), actor: "SYSTEM" as const, reminderNumber: 1, targetRole: "CARRIER" }),
        // C-PR2 (D55) : décision de médiation aux deux parties
        "booking.dispute_resolved": envelope("booking.dispute_resolved", {
          ...basePayload(),
          actor: "ADMIN" as const,
          kind: "DISPUTE",
          ticketNumber: "YAM-2041",
          outcome: "PARTIAL_REFUND",
          refundCents: 1500,
          carrierPayoutCents: 1500,
          reason: "Le colis est arrivé avec un coin écrasé, sans perte de contenu : remboursement partiel équitable.",
          finalStatus: "COMPLETED",
          resolvedAt: "2026-07-21T10:00:00.000Z",
        }),
        // 4A : la règle n'est non-null que pour l'atterrissage
        "booking.tracking_event": envelope("booking.tracking_event", { ...basePayload(), actor: "CARRIER" as const, step: "FLIGHT_ARRIVED", confirmedAt: "2026-07-19T12:00:00.000Z" }),
      };
      const built = buildBookingEmail(parse(fixtures[eventType]), role, "Test");
      expect(built).not.toBeNull();
      expect(built!.template).toMatch(/^(booking|settlement)\//);
    }
  });
});

/* ── Contenus : frontière A13, raisons, montants ─────────────── */

describe("contenus construits", () => {
  it("A13 : l'email Voyageur montre son NET (transportCents), jamais le total Expéditeur", () => {
    const built = buildBookingEmail(parse(requestedEvent()), "CARRIER", "Awa")!;
    const serialized = JSON.stringify(built);
    expect(built.data.earnings).toContain("30");
    expect(serialized).not.toContain("39"); // 3900 = total shipper
  });

  it("le reçu Expéditeur porte le montant AUTORISÉ de l'événement", () => {
    const built = buildBookingEmail(
      parse(paymentAuthorizedEvent()),
      "SHIPPER",
      "Naomi"
    )!;
    expect(built.template).toBe("booking/payment-authorized-shipper");
    expect(built.data.amount).toContain("39");
  });

  it("declined : la raison contrat est traduite, une raison inconnue devient null", () => {
    const withReason = buildBookingEmail(
      parse(declinedEvent("TIMING")),
      "SHIPPER",
      "Naomi"
    )!;
    expect(withReason.data.reason).toBeTruthy();
    const unknown = buildBookingEmail(
      parse(declinedEvent("SOMETHING_ELSE")),
      "SHIPPER",
      "Naomi"
    )!;
    expect(unknown.data.reason).toBeNull();
  });

  it("cancelled : gabarit distinct par rôle", () => {
    const event = parse(cancelledEvent(true));
    expect(buildBookingEmail(event, "SHIPPER", "N")!.template).toBe(
      "booking/booking-cancelled-shipper"
    );
    expect(buildBookingEmail(event, "CARRIER", "A")!.template).toBe(
      "booking/booking-cancelled-carrier"
    );
  });
});

/* ── Pipeline d'envoi (A36) ──────────────────────────────────── */

describe("B4 (D52) — completed / payout_sent / disputed / verification_reminder", () => {
  it("routage : completed → SHIPPER seul ; payout_sent → CARRIER seul ; disputed → LES DEUX ; reminder → SHIPPER", () => {
    expect(resolveEmailRecipients(parse(completedEvent()))).toEqual([{ userId: OID.shipper, role: "SHIPPER" }]);
    expect(resolveEmailRecipients(parse(payoutSentEvent()))).toEqual([{ userId: OID.carrier, role: "CARRIER" }]);
    expect(resolveEmailRecipients(parse(disputedEvent()))).toEqual([
      { userId: OID.shipper, role: "SHIPPER" },
      { userId: OID.carrier, role: "CARRIER" },
    ]);
    expect(resolveEmailRecipients(parse(verificationReminderEvent()))).toEqual([{ userId: OID.shipper, role: "SHIPPER" }]);
  });

  it("les 4 builders rendent un CONTENU D44 (gabarit partagé), en fr ET en en, sans gabarit EJS", () => {
    for (const locale of ["fr", "en"]) {
      const completed = buildBookingEmail(parse(completedEvent()), "SHIPPER", "Naomi", { locale, counterpartFirstName: "Thomas" })!;
      expect(completed.template).toBe("settlement/completed-shipper");
      expect(completed.content).toBeDefined();
      expect(completed.content!.greeting).toContain("Naomi");
      expect(completed.content!.paragraphs.join(" ")).toContain("Thomas");
      // B5 (décision 4A) : le bouton « Noter » est de retour dans l'email de fin de transaction.
      expect(completed.content!.cta!.label).toMatch(/noter|rate/i);
      const reminder = buildBookingEmail(parse(verificationReminderEvent()), "SHIPPER", "Naomi", { locale })!;
      expect(reminder.template).toBe("settlement/verification-reminder-shipper");
      expect(reminder.content!.paragraphs.join(" ")).toMatch(/23/); // l'échéance formatée
    }
  });

  it("completed : le texte distingue confirmation anticipée et libération automatique (J+4)", () => {
    const early = buildBookingEmail(parse(completedEvent("SHIPPER")), "SHIPPER", "Naomi", { locale: "fr" })!;
    const auto = buildBookingEmail(parse(completedEvent("SYSTEM")), "SHIPPER", "Naomi", { locale: "fr" })!;
    expect(early.content!.paragraphs[0]).toContain("Tu as confirmé");
    expect(auto.content!.paragraphs[0]).toContain("automatiquement");
  });

  it("D50/A82 : payout_sent LATE_CANCELLATION → variante « compensation » ; refund_issued partiel → la retenue revient au Voyageur", () => {
    const late = parse(envelope("booking.payout_sent", { ...basePayload(), actor: "SYSTEM" as const, transferId: "tr_1", amountCents: 1200, reason: "LATE_CANCELLATION" }));
    const built = buildBookingEmail(late, "CARRIER", "Thomas", { locale: "fr", counterpartFirstName: "Naomi" })!;
    expect(built.subject).toContain("compensation");
    expect(built.content!.paragraphs[0]).toContain("annulé");
    const normal = buildBookingEmail(parse(payoutSentEvent()), "CARRIER", "Thomas", { locale: "fr" })!;
    expect(normal.subject).not.toContain("compensation");

    const partial = parse(envelope("booking.refund_issued", { ...basePayload(), actor: "SHIPPER" as const, amountCents: 1950, refundedAt: "2026-07-19T12:00:00.000Z" }));
    expect(buildBookingEmail(partial, "SHIPPER", "Naomi", { locale: "fr" })!.data.retainedForCarrier).toEqual(expect.stringContaining("19"));
    const full = parse(envelope("booking.refund_issued", { ...basePayload(), actor: "SYSTEM" as const, amountCents: 3900, refundedAt: "2026-07-19T12:00:00.000Z" }));
    expect(buildBookingEmail(full, "SHIPPER", "Naomi", { locale: "fr" })!.data.retainedForCarrier).toBeNull();
  });

  it("payout_sent : le Voyageur lit le MONTANT DE L'ÉVÉNEMENT et une copie honnête (2 à 7 jours) — jamais le total Expéditeur", () => {
    const built = buildBookingEmail(parse(payoutSentEvent()), "CARRIER", "Thomas", { locale: "fr" })!;
    expect(built.template).toBe("settlement/payout-sent-carrier");
    expect(built.subject).toContain("30");
    expect(built.content!.paragraphs.join(" ")).toContain("2 à 7 jours");
    expect(JSON.stringify(built)).not.toContain("39");
  });

  it("disputed : accusé à l'Expéditeur (ticket, gel, 48 h) ; information calme au Voyageur avec la CATÉGORIE, jamais le dossier", () => {
    const shipper = buildBookingEmail(parse(disputedEvent("DAMAGED")), "SHIPPER", "Naomi", { locale: "fr", counterpartFirstName: "Thomas" })!;
    expect(shipper.template).toBe("settlement/disputed-shipper");
    expect(shipper.subject).toContain("YAM-2041");
    expect(shipper.content!.paragraphs.join(" ")).toMatch(/gelé/);
    expect(shipper.content!.paragraphs.join(" ")).toContain("48 h");

    const carrier = buildBookingEmail(parse(disputedEvent("DAMAGED")), "CARRIER", "Thomas", { locale: "en", counterpartFirstName: "Naomi" })!;
    expect(carrier.template).toBe("settlement/disputed-carrier");
    expect(carrier.content!.paragraphs[0]).toContain("damaged parcel");
    expect(carrier.content!.paragraphs.join(" ")).toContain("on hold");
    expect(carrier.content!.paragraphs.join(" ")).not.toMatch(/faute|fault|guilty/i);

    // Événement antérieur à B4 (sans catégorie) : la phrase reste correcte.
    const legacy = buildBookingEmail(parse(disputedEvent(null)), "CARRIER", "Thomas", { locale: "fr" })!;
    expect(legacy.content!.paragraphs[0]).not.toContain("motif");
  });

  it("dispatch : un email D44 part par sendTransactionalEmail dans la langue du destinataire, claim et SENT identiques", async () => {
    await dispatchBookingEmails(EVENT_ID, parse(payoutSentEvent()), buildLogger());
    expect(emailMock.sendTemplatedEmail).not.toHaveBeenCalled();
    expect(emailMock.sendTransactionalEmail).toHaveBeenCalledTimes(1);
    const sent = emailMock.sendTransactionalEmail.mock.calls[0][0];
    expect(sent.to).toBe(CARRIER_USER.email);
    expect(sent.locale).toBe("en");
    expect(sent.content.title).toBe("Your payment is on its way");
    expect(prismaMock.emailDelivery.create).toHaveBeenCalledWith({
      data: { eventId: EVENT_ID, userId: OID.carrier, template: "settlement/payout-sent-carrier" },
    });
    expect(prismaMock.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "SENT" }) })
    );
  });

  it("dispatch disputed : DEUX envois, un contenu par rôle, chacun dans SA langue", async () => {
    await dispatchBookingEmails(EVENT_ID, parse(disputedEvent()), buildLogger());
    expect(emailMock.sendTransactionalEmail).toHaveBeenCalledTimes(2);
    const [toShipper, toCarrier] = emailMock.sendTransactionalEmail.mock.calls.map((c) => c[0]);
    expect(toShipper.to).toBe(SHIPPER_USER.email);
    expect(toShipper.locale).toBe("fr");
    expect(toCarrier.to).toBe(CARRIER_USER.email);
    expect(toCarrier.locale).toBe("en");
    expect(toShipper.content.title).not.toBe(toCarrier.content.title);
  });
});

describe("dispatch (A36 — claim-first, best-effort)", () => {
  it("nominal : claim PENDING → envoi → SENT, destinataire et gabarit exacts", async () => {
    await dispatchBookingEmails(EVENT_ID, parse(requestedEvent()), buildLogger());

    expect(prismaMock.emailDelivery.create).toHaveBeenCalledWith({
      data: {
        eventId: EVENT_ID,
        userId: OID.carrier,
        template: "booking/booking-requested-carrier",
      },
    });
    expect(emailMock.sendTemplatedEmail).toHaveBeenCalledTimes(1);
    const sent = emailMock.sendTemplatedEmail.mock.calls[0][0];
    expect(sent.to).toBe(CARRIER_USER.email);
    expect(sent.template).toBe("booking/booking-requested-carrier");
    expect(prismaMock.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_userId: { eventId: EVENT_ID, userId: OID.carrier } },
        data: expect.objectContaining({ status: "SENT" }),
      })
    );
  });

  it("SMTP non configuré : skip total, AUCUN claim ni accès base", async () => {
    emailMock.isEmailConfigured.mockReturnValue(false);
    const logger = buildLogger();

    await dispatchBookingEmails(EVENT_ID, parse(requestedEvent()), logger);

    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
    expect(prismaMock.emailDelivery.create).not.toHaveBeenCalled();
    expect(emailMock.sendTemplatedEmail).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalled();
  });

  it("règle null (tracking_event) : return immédiat, pas même isEmailConfigured", async () => {
    const event = parse(
      envelope("booking.tracking_event", {
        ...basePayload(),
        actor: "CARRIER" as const,
        step: "AT_AIRPORT",
        confirmedAt: "2026-07-19T12:00:00.000Z",
      })
    );

    await dispatchBookingEmails(EVENT_ID, event, buildLogger());

    expect(emailMock.isEmailConfigured).not.toHaveBeenCalled();
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("claim déjà posé (P2002) : jamais de renvoi (at-most-once)", async () => {
    prismaMock.emailDelivery.create.mockRejectedValue(p2002());

    await dispatchBookingEmails(EVENT_ID, parse(requestedEvent()), buildLogger());

    expect(emailMock.sendTemplatedEmail).not.toHaveBeenCalled();
    expect(prismaMock.emailDelivery.update).not.toHaveBeenCalled();
  });

  it("user effacé (RGPD) : envoi sauté et tracé, pas de claim", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);
    const logger = buildLogger();

    await dispatchBookingEmails(EVENT_ID, parse(requestedEvent()), logger);

    expect(prismaMock.emailDelivery.create).not.toHaveBeenCalled();
    expect(emailMock.sendTemplatedEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("échec d'ENVOI : FAILED + lastError tracés, PAS de throw (best-effort)", async () => {
    emailMock.sendTemplatedEmail.mockRejectedValue(new Error("smtp down"));
    const logger = buildLogger();

    await expect(
      dispatchBookingEmails(EVENT_ID, parse(requestedEvent()), logger)
    ).resolves.toBeUndefined();

    expect(prismaMock.emailDelivery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          lastError: "smtp down",
        }),
      })
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it("claim en erreur TRANSITOIRE (Mongo down) : throw → re-livraison amont", async () => {
    prismaMock.emailDelivery.create.mockRejectedValue(
      new Error("connection refused")
    );

    await expect(
      dispatchBookingEmails(EVENT_ID, parse(requestedEvent()), buildLogger())
    ).rejects.toThrow("connection refused");

    expect(emailMock.sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("cancelled wasAccepted : DEUX envois, un gabarit par rôle", async () => {
    await dispatchBookingEmails(
      EVENT_ID,
      parse(cancelledEvent(true)),
      buildLogger()
    );

    expect(emailMock.sendTemplatedEmail).toHaveBeenCalledTimes(2);
    const templates = emailMock.sendTemplatedEmail.mock.calls.map(
      (c: unknown[]) => (c[0] as { template: string }).template
    );
    expect(templates).toEqual([
      "booking/booking-cancelled-shipper",
      "booking/booking-cancelled-carrier",
    ]);
  });
});

/* ── D44/D45 — locale du destinataire, prénom de la contrepartie ── */

describe("D44/D45 — locale du destinataire et prénom de la contrepartie", () => {
  it("buildBookingEmail : la locale demandée pilote le sujet et l'URL, repli fr", () => {
    const event = parse(deliveredEvent());
    const en = buildBookingEmail(event, "SHIPPER", "Naomi", { locale: "en-US" })!;
    expect(en.subject).toMatch(/^Your parcel/);
    expect(en.data.locale).toBe("en");
    expect(String(en.data.ctaUrl)).toContain("/en/bookings/");
    const fallback = buildBookingEmail(event, "SHIPPER", "Naomi", { locale: "de" })!;
    expect(fallback.data.locale).toBe("fr");
    const legacy = buildBookingEmail(event, "SHIPPER", "Naomi")!;
    expect(legacy.data.locale).toBe("fr");
    expect(legacy.data.counterpartFirstName).toBeNull();
  });

  it("dispatch : l'email du Voyageur part dans SA langue (en) avec le prénom de l'Expéditrice", async () => {
    const logger = buildLogger();
    await dispatchBookingEmails("evt-d44", parse(requestedEvent()), logger);
    expect(emailMock.sendTemplatedEmail).toHaveBeenCalledTimes(1);
    const sent = emailMock.sendTemplatedEmail.mock.calls[0][0];
    expect(sent.to).toBe(CARRIER_USER.email);
    expect(sent.subject).toMatch(/^New transport request/);
    expect(sent.data.locale).toBe("en");
    expect(sent.data.counterpartFirstName).toBe("Naomi");
    // Les DEUX parties sont chargées, même quand une seule reçoit l'email.
    const where = prismaMock.user.findMany.mock.calls[0][0].where.id.in as string[];
    expect(where).toEqual(expect.arrayContaining([OID.carrier, OID.shipper]));
  });

  it("dispatch : contrepartie effacée → prénom null, l'email part quand même", async () => {
    const logger = buildLogger();
    prismaMock.user.findMany.mockResolvedValue([CARRIER_USER]);
    await dispatchBookingEmails("evt-d45", parse(requestedEvent()), logger);
    expect(emailMock.sendTemplatedEmail).toHaveBeenCalledTimes(1);
    expect(emailMock.sendTemplatedEmail.mock.calls[0][0].data.counterpartFirstName).toBeNull();
  });
});

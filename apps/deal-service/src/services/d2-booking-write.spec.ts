/**
 * d2-booking-write.spec.ts — D2 exécutable sur l'écrivain de l'argent (axe proposé en fin d'A195)
 * ================================================================================================
 * `applyBookingTransition` est le passage OBLIGÉ de toute transition d'un deal : c'est lui qui écrit le
 * statut, rend les kilos au trajet, laisse les écritures annexes (`within`, par exemple le dossier de
 * litige) et pose les événements outbox. Tout le service en dépend — d'où l'intérêt de verrouiller sa
 * propriété structurelle plutôt que de la re-vérifier geste par geste :
 *
 *   « aucun changement d'état sans événement outbox dans la MÊME transaction » (D2).
 *
 * Le piège, identifié en A195 : un mock qui fait `$transaction: (fn) => fn(prismaMock)` rend le dedans
 * et le dehors INDISCERNABLES — une écriture sortie de la transaction ne casse alors aucun test. Ici le
 * client de transaction est un client à part, et chaque appel est journalisé avec sa provenance.
 */
type Appel = { cible: string; transaction: number | null };

const appels: Appel[] = [];
let transactionCourante: number | null = null;
let transactionsOuvertes = 0;

const tracer = (cible: string, retour: unknown) =>
  jest.fn(async () => {
    appels.push({ cible, transaction: transactionCourante });
    return retour;
  });

const prismaMock: Record<string, unknown> = {
  booking: { updateMany: tracer("booking.updateMany", { count: 1 }), findUnique: tracer("booking.findUnique", null) },
  trip: { updateMany: tracer("trip.updateMany", { count: 1 }) },
  dispute: { create: tracer("dispute.create", { id: "d1" }) },
  outboxEvent: { create: tracer("outboxEvent.create", {}) },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const precedente = transactionCourante;
    transactionCourante = ++transactionsOuvertes;
    try {
      return await fn(prismaMock);
    } finally {
      transactionCourante = precedente;
    }
  }),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { applyBookingTransition } from "./booking-write";

const BOOKING = "64b00000000000000000b001";
const TRIP = "64b00000000000000000c001";
const T0 = new Date("2026-09-17T08:00:00.000Z");

/** Un instantané de prix minimal, suffisant pour que la reprise de kilos ait un poids à rendre. */
const pricing = { weightKg: 4, totalCents: 4000, currency: "EUR" } as never;

/** Une charge d'événement VALIDE au contrat : l'écrivain la valide avant d'écrire (A24). */
function evenement(eventType: string) {
  return {
    eventType,
    payload: {
      bookingId: BOOKING,
      tripId: TRIP,
      shipperId: "64b0000000000000000000a1",
      carrierId: "64b0000000000000000000b1",
      corridor: { originCity: "Paris", originCountryCode: "FR", destinationCity: "Brazzaville", destinationCountryCode: "CG" },
      category: "CLOTHES",
      categoryFamily: "GENERAL",
      weightKg: 4,
      transportCents: 3600,
      totalShipperCents: 4000,
      currencyCode: "EUR",
      actor: "SHIPPER",
      cancelledBy: "SHIPPER",
      reason: null,
      wasAccepted: true,
      closedAt: T0.toISOString(),
    },
  } as never;
}

beforeEach(() => {
  appels.length = 0;
  transactionCourante = null;
  transactionsOuvertes = 0;
  jest.clearAllMocks();
});

describe("D2, exécutable — l'écrivain commun des deals", () => {
  it("statut, reprise des kilos, écritures annexes et événements : TOUT dans la même et unique transaction", async () => {
    await applyBookingTransition({
      booking: { id: BOOKING, tripId: TRIP, pricing },
      from: "ACCEPTED" as never,
      data: { status: "CANCELLED", cancelledAt: T0 },
      releaseKg: true,
      within: async (tx) => {
        await (tx as unknown as { dispute: { create: () => Promise<unknown> } }).dispute.create();
      },
      events: [evenement("booking.cancelled")],
      now: T0,
    });

    expect(transactionsOuvertes).toBe(1);
    const transaction = appels.find((a) => a.cible === "booking.updateMany")?.transaction;
    expect(transaction).not.toBeNull();
    for (const cible of ["trip.updateMany", "dispute.create", "outboxEvent.create"]) {
      expect({ cible, transaction: appels.find((a) => a.cible === cible)?.transaction }).toEqual({ cible, transaction });
    }
  });

  it("plusieurs événements pour une transition : tous dans la transaction de l'écriture d'état", async () => {
    await applyBookingTransition({
      booking: { id: BOOKING, tripId: TRIP, pricing },
      from: "ACCEPTED" as never,
      data: { status: "CANCELLED" },
      releaseKg: false,
      events: [evenement("booking.cancelled"), { eventType: "booking.refund_issued", payload: { ...(evenement("booking.cancelled") as { payload: Record<string, unknown> }).payload, amountCents: 4000, refundedAt: T0.toISOString() } } as never],
      now: T0,
    });

    const evenements = appels.filter((a) => a.cible === "outboxEvent.create");
    expect(evenements).toHaveLength(2);
    expect(new Set(evenements.map((e) => e.transaction))).toEqual(new Set([1]));
  });

  it("la transition refusée n'écrit AUCUN événement : pas d'état, pas d'événement", async () => {
    (prismaMock.booking as Record<string, jest.Mock>).updateMany.mockImplementationOnce(async () => {
      appels.push({ cible: "booking.updateMany", transaction: transactionCourante });
      return { count: 0 }; // la condition ne matche plus : un autre acteur est passé
    });

    await expect(
      applyBookingTransition({
        booking: { id: BOOKING, tripId: TRIP, pricing },
        from: "ACCEPTED" as never,
        data: { status: "CANCELLED" },
        releaseKg: true,
        events: [evenement("booking.cancelled")],
        now: T0,
      })
    ).rejects.toMatchObject({ code: "TRANSITION_NOT_ALLOWED" });

    expect(appels.filter((a) => a.cible === "outboxEvent.create")).toHaveLength(0);
    expect(appels.filter((a) => a.cible === "trip.updateMany")).toHaveLength(0); // ni les kilos rendus
  });

  it("l'écriture d'état est CONDITIONNÉE au statut de départ (le verrou optimiste de la machine)", async () => {
    await applyBookingTransition({
      booking: { id: BOOKING, tripId: TRIP, pricing },
      from: "ACCEPTED" as never,
      where: { payoutStatus: "PENDING" },
      data: { status: "CANCELLED" },
      releaseKg: false,
      events: [evenement("booking.cancelled")],
      now: T0,
    });

    expect((prismaMock.booking as Record<string, jest.Mock>).updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: BOOKING, status: "ACCEPTED", payoutStatus: "PENDING" } })
    );
  });

  it("conflit d'écriture : la transaction ENTIÈRE est rejouée, pas seulement l'événement", async () => {
    (prismaMock.$transaction as jest.Mock).mockImplementationOnce(async () => {
      throw Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });
    });

    await applyBookingTransition({
      booking: { id: BOOKING, tripId: TRIP, pricing },
      from: "ACCEPTED" as never,
      data: { status: "CANCELLED" },
      releaseKg: false,
      events: [evenement("booking.cancelled")],
      now: T0,
    });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    expect(appels.filter((a) => a.cible === "outboxEvent.create")).toHaveLength(1); // un seul événement écrit
  });
});

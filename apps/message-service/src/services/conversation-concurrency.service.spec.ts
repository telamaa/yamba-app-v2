/**
 * conversation-concurrency.service.spec.ts — A195 : deux mains sur le même fil (passe concurrence MEMBRE)
 * =======================================================================================================
 * Suite directe d'A192, côté membre. Quatre gestes du fil lisaient un document puis en écrivaient un autre,
 * sans condition et sans transaction commune :
 *
 *  - ouvrir le fil : l'Expéditeur et le Voyageur cliquent à la même seconde → deux `create`, `bookingId` est
 *    UNIQUE → le second prenait un 500 ;
 *  - proposer un rendez-vous : deux propositions simultanées → DEUX rendez-vous PROPOSED du même type, et
 *    personne pour s'en apercevoir (les deux transactions écrivaient chacune son document, elles ne se
 *    voyaient pas). La conversation — touchée par le message d'annonce — est le document partagé qui rend
 *    le conflit VISIBLE : MongoDB rejette la perdante (P2034), le rejeu repart d'une lecture fraîche ;
 *  - révéler le numéro : double clic → collision sur la paire (fil, destinataire), 500 ;
 *  - marquer lu : deux clients du même membre → le plus lent ramenait le marqueur EN ARRIÈRE.
 *
 * Aucune horloge, aucun hasard : les courses sont jouées en faisant échouer la transaction la première fois.
 */
const prismaMock = {
  conversation: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
  booking: { findFirst: jest.fn() },
  user: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
  meetup: { findMany: jest.fn(), findFirst: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  message: { create: jest.fn(), findMany: jest.fn(), findUniqueOrThrow: jest.fn() },
  phoneReveal: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() },
  outboxEvent: { create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

import { makeConversationService } from "./conversation.service";

const T0 = new Date("2026-09-16T08:00:00.000Z");
const DEPART = new Date("2026-09-16T09:00:00.000Z");
const CONV = "64b00000000000000000c001";
const BOOKING = "64b00000000000000000b001";
const SHIPPER = "64b0000000000000000000a1";
const CARRIER = "64b0000000000000000000b1";

const settings = { get: async () => ({ "messaging.writeDaysAfterEnd": 14, "messaging.phoneRevealLeadHours": 2 }) } as never;
const service = makeConversationService(() => T0, settings);

const collision = () => Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
const conflitEcriture = () => Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });

/** Le fil tel que la base le rend, et le deal engagé qui l'autorise. */
function filOuvert(conversation: Record<string, unknown> | null = { id: CONV, bookingId: BOOKING, shipperLastReadAt: null, carrierLastReadAt: null }) {
  prismaMock.conversation.findUnique.mockResolvedValue(conversation);
  prismaMock.booking.findFirst.mockResolvedValue({
    id: BOOKING,
    status: "ACCEPTED",
    shipperId: SHIPPER,
    carrierId: CARRIER,
    acceptedAt: T0,
    completedAt: null,
    closedAt: null,
    deliveryCodeHash: null,
    trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: DEPART },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Par défaut la transaction s'exécute pour de bon, sur le même mock (aucune seconde base à tenir à jour).
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
  prismaMock.message.create.mockResolvedValue({ id: "64b00000000000000000dd01" });
  prismaMock.conversation.update.mockResolvedValue({});
  prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.outboxEvent.create.mockResolvedValue({});
  prismaMock.meetup.updateMany.mockResolvedValue({ count: 0 });
});

describe("A195 — ouvrir le fil à deux", () => {
  it("les deux parties ouvrent en même temps : l'une crée, l'autre relit — jamais un 500", async () => {
    filOuvert(null); // par identifiant de deal : aucun fil encore…
    // …mais celui de l'autre partie existe déjà quand on le relit par son identifiant.
    prismaMock.conversation.findUnique.mockImplementation(async ({ where }: { where: { id?: string; bookingId?: string } }) =>
      where.id ? { id: CONV, bookingId: BOOKING, shipperLastReadAt: null, carrierLastReadAt: null } : null
    );
    prismaMock.conversation.create.mockRejectedValue(collision());
    prismaMock.conversation.findUniqueOrThrow.mockResolvedValue({ id: CONV, bookingId: BOOKING, shipperLastReadAt: null, carrierLastReadAt: null });
    prismaMock.meetup.findMany.mockResolvedValue([]);
    prismaMock.message.findMany.mockResolvedValue([]);
    prismaMock.phoneReveal.findUnique.mockResolvedValue(null);
    prismaMock.user.findUnique.mockResolvedValue({ id: CARRIER, isDeleted: false, firstName: "Thomas", phoneE164: null, avatar: null });

    const fil = await service.threadByDeal(SHIPPER, BOOKING);

    expect(fil.conversation.id).toBe(CONV);
    expect(prismaMock.conversation.findUniqueOrThrow).toHaveBeenCalledTimes(1); // le fil de l'autre, relu
  });

  it("une collision qui n'est PAS un doublon remonte intacte (on ne rattrape pas ce qu'on ne comprend pas)", async () => {
    filOuvert(null);
    prismaMock.conversation.create.mockRejectedValue(new Error("la base est tombee"));
    await expect(service.threadByDeal(SHIPPER, BOOKING)).rejects.toThrow("la base est tombee");
    expect(prismaMock.conversation.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("A195 — proposer un rendez-vous", () => {
  const proposition = { kind: "PICKUP" as const, placeLabel: "Gare de Lyon", startAt: "2026-09-16T08:30:00.000Z", endAt: "2026-09-16T08:45:00.000Z" };

  it("annulation, création, message et événement tiennent dans UNE transaction (D2)", async () => {
    filOuvert();
    prismaMock.meetup.create.mockResolvedValue({ id: "64b00000000000000000ee01", conversationId: CONV, kind: "PICKUP", status: "PROPOSED", proposedByRole: "SHIPPER", proposedById: SHIPPER, placeLabel: "Gare de Lyon", placeDetails: null, startAt: new Date(proposition.startAt), endAt: new Date(proposition.endAt), acceptedAt: null, cancelledAt: null, createdAt: T0 });

    await service.proposeMeetup(SHIPPER, CONV, proposition);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1); // UNE seule, pas trois
    expect(prismaMock.meetup.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.meetup.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it("deux propositions simultanées : la perdante est rejouée et annule celle de la gagnante — une seule ouverte", async () => {
    filOuvert();
    prismaMock.meetup.create.mockResolvedValue({ id: "64b00000000000000000ee02", conversationId: CONV, kind: "PICKUP", status: "PROPOSED", proposedByRole: "CARRIER", proposedById: CARRIER, placeLabel: "Gare de Lyon", placeDetails: null, startAt: new Date(proposition.startAt), endAt: new Date(proposition.endAt), acceptedAt: null, cancelledAt: null, createdAt: T0 });
    // Premier essai : l'autre partie a écrit pendant ce temps, la base rejette tout le lot.
    prismaMock.$transaction.mockImplementationOnce(async () => {
      throw conflitEcriture();
    });

    const rdv = await service.proposeMeetup(CARRIER, CONV, proposition);

    expect(rdv.id).toBe("64b00000000000000000ee02");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2); // rejouée
    expect(prismaMock.meetup.create).toHaveBeenCalledTimes(1); // et une seule proposition écrite
  });
});

describe("A195 — révéler le numéro", () => {
  beforeEach(() => {
    filOuvert();
    prismaMock.meetup.findMany.mockResolvedValue([{ id: "64b00000000000000000ee01", kind: "PICKUP", status: "ACCEPTED", startAt: new Date("2026-09-16T08:30:00.000Z"), endAt: DEPART, placeLabel: "Gare de Lyon", conversationId: CONV }]);
    prismaMock.user.findUniqueOrThrow.mockResolvedValue({ firstName: "Thomas", phoneE164: "+33612345678" });
  });

  it("la trace, le message système et l'événement tiennent dans UNE transaction (D2)", async () => {
    prismaMock.phoneReveal.findUnique.mockResolvedValue(null);
    prismaMock.phoneReveal.create.mockResolvedValue({});

    const r = await service.revealPhone(SHIPPER, CONV);

    expect(r.phoneE164).toBe("+33612345678");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it("double clic : la seconde révélation relit la trace de la première et rend le même numéro, pas un 500", async () => {
    prismaMock.phoneReveal.findUnique.mockResolvedValue(null); // les deux ont lu « pas encore révélé »
    prismaMock.phoneReveal.create.mockRejectedValue(collision());
    prismaMock.phoneReveal.findUniqueOrThrow.mockResolvedValue({ revealedAt: T0 });

    const r = await service.revealPhone(SHIPPER, CONV);

    expect(r).toEqual({ phoneE164: "+33612345678", firstName: "Thomas", revealedAt: T0.toISOString() });
    expect(prismaMock.outboxEvent.create).not.toHaveBeenCalled(); // un seul événement : celui de la gagnante
  });
});

describe("A195 — marquer lu", () => {
  it("le marqueur n'avance que : l'écriture est conditionnée à un marqueur plus ancien (ou absent)", async () => {
    filOuvert();
    await service.markRead(SHIPPER, CONV);

    const { where, data } = prismaMock.conversation.updateMany.mock.calls[0][0];
    expect(where.id).toBe(CONV);
    expect(data).toEqual({ shipperLastReadAt: T0 });
    // Pitfall Mongo : un marqueur ABSENT n'est vu par aucun filtre → les trois cas sont couverts.
    expect(where.OR).toEqual([{ shipperLastReadAt: null }, { shipperLastReadAt: { isSet: false } }, { shipperLastReadAt: { lt: T0 } }]);
    expect(prismaMock.conversation.update).not.toHaveBeenCalled(); // plus d'écriture inconditionnelle
  });

  it("le Voyageur marque le SIEN (les deux marqueurs ne se marchent pas dessus)", async () => {
    filOuvert();
    await service.markRead(CARRIER, CONV);
    expect(prismaMock.conversation.updateMany.mock.calls[0][0].data).toEqual({ carrierLastReadAt: T0 });
  });
});

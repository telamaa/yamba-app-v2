/**
 * conversation-retention-concurrency.spec.ts — A195 : la purge n'efface que ce qu'elle a vraiment lu
 * ===================================================================================================
 * La purge nocturne lit les fils silencieux depuis plus d'un an, puis les efface. Entre les deux, un fil
 * peut redevenir ACTIF : un membre poste un message, propose un rendez-vous, marque lu. Sans condition,
 * le fil partait quand même — avec le message tout neuf. C'est la seule perte de données SÈCHE de la
 * passe : rien ne la rattrape après coup, aucun journal ne la montre.
 *
 * La suppression du fil est donc conditionnée à l'état LU (`updatedAt`, que toute écriture du fil fait
 * bouger) et passe D'ABORD : si elle n'écrit rien, on n'efface NI messages, NI rendez-vous, NI traces.
 */
const prismaMock = {
  conversation: { findMany: jest.fn(), deleteMany: jest.fn() },
  booking: { findMany: jest.fn() },
  message: { deleteMany: jest.fn() },
  meetup: { deleteMany: jest.fn() },
  phoneReveal: { deleteMany: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { makeConversationRetentionService } from "./conversation-retention.service";

const MAINTENANT = new Date("2026-09-16T03:00:00.000Z");
const VIEUX = new Date("2025-01-01T00:00:00.000Z"); // dernière écriture du fil, telle que la purge l'a LUE
const CONV = "64b00000000000000000c001";
const BOOKING = "64b00000000000000000b001";

const settings = { get: async () => ({ "messaging.retentionDays": 365 }) } as never;
const service = makeConversationRetentionService(() => MAINTENANT, settings);

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
  prismaMock.conversation.findMany.mockResolvedValue([{ id: CONV, bookingId: BOOKING, updatedAt: VIEUX }]);
  prismaMock.booking.findMany.mockResolvedValue([{ id: BOOKING, status: "COMPLETED", completedAt: VIEUX, closedAt: null }]);
  for (const m of [prismaMock.message, prismaMock.meetup, prismaMock.phoneReveal]) m.deleteMany.mockResolvedValue({ count: 0 });
});

describe("A195 — purge conditionnée à l'état lu", () => {
  it("fil toujours silencieux : il part, avec ses messages, ses rendez-vous et ses traces", async () => {
    prismaMock.conversation.deleteMany.mockResolvedValue({ count: 1 });

    const bilan = await service.purgeOnce();

    expect(bilan).toEqual({ examined: 1, purged: 1 });
    expect(prismaMock.conversation.deleteMany).toHaveBeenCalledWith({ where: { id: CONV, updatedAt: VIEUX } });
    expect(prismaMock.message.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.meetup.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.phoneReveal.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("un membre a écrit entre la lecture et la purge : RIEN n'est effacé, et le bilan le dit", async () => {
    prismaMock.conversation.deleteMany.mockResolvedValue({ count: 0 }); // `updatedAt` a bougé : la condition ne matche plus

    const bilan = await service.purgeOnce();

    expect(bilan).toEqual({ examined: 1, purged: 0 });
    expect(prismaMock.message.deleteMany).not.toHaveBeenCalled(); // le message tout neuf est encore là
    expect(prismaMock.meetup.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.phoneReveal.deleteMany).not.toHaveBeenCalled();
  });

  it("conflit d'écriture : le passage est rejoué, pas abandonné", async () => {
    prismaMock.conversation.deleteMany.mockResolvedValue({ count: 1 });
    prismaMock.$transaction.mockImplementationOnce(async () => {
      throw Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });
    });

    const bilan = await service.purgeOnce();

    expect(bilan).toEqual({ examined: 1, purged: 1 });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });
});

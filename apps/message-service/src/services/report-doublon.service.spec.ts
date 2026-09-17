/**
 * report-doublon.service.spec.ts — A198 (g) : signaler deux fois ne fait pas deux dossiers
 * =========================================================================================
 * Signaler lisait « ai-je déjà signalé ? » puis créait. Deux clics simultanés passaient tous deux la lecture
 * et créaient DEUX dossiers dans la file de modération.
 *
 * Le remède évident — un index unique (cible, signalant) — serait FAUX : re-signaler un message dont le dossier
 * a été CLOS est légitime. On rend donc le conflit DÉTECTABLE, comme en A195 : la création se fait dans une
 * transaction qui écrit aussi le MESSAGE visé (document froid, qu'aucun autre geste n'écrit en continu). Deux
 * transactions se disputent alors ce document, MongoDB en rejette une, et le rejeu relit — et refuse.
 */
const prismaMock = {
  conversation: { findUnique: jest.fn() },
  booking: { findFirst: jest.fn() },
  message: { findFirst: jest.fn(), updateMany: jest.fn() },
  report: { findFirst: jest.fn(), create: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { makeConversationService } = require("./conversation.service") as typeof import("./conversation.service");

const T0 = new Date("2026-09-17T08:00:00.000Z");
const CONV = "64b00000000000000000c001";
const BOOKING = "64b00000000000000000b001";
const SHIPPER = "64b0000000000000000000a1";
const CARRIER = "64b0000000000000000000b1";
const MESSAGE = "64b00000000000000000dd01";

const settings = { get: async () => ({ "messaging.writeDaysAfterEnd": 14, "messaging.phoneRevealLeadHours": 2 }) } as never;
const service = makeConversationService(() => T0, settings);
const conflit = () => Object.assign(new Error("Transaction failed due to a write conflict or a deadlock."), { code: "P2034" });

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
  prismaMock.conversation.findUnique.mockResolvedValue({ id: CONV, bookingId: BOOKING, shipperLastReadAt: null, carrierLastReadAt: null });
  prismaMock.booking.findFirst.mockResolvedValue({ id: BOOKING, status: "ACCEPTED", shipperId: SHIPPER, carrierId: CARRIER, acceptedAt: T0, completedAt: null, closedAt: null, deliveryCodeHash: null, trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: T0 } });
  // Le message signalé est celui de l'AUTRE partie (on ne signale pas le sien).
  prismaMock.message.findFirst.mockResolvedValue({ id: MESSAGE, kind: "TEXT", authorRole: "CARRIER", flaggedContact: false });
  prismaMock.message.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.report.findFirst.mockResolvedValue(null);
  prismaMock.report.create.mockResolvedValue({ id: "64b00000000000000000ff01", createdAt: T0 });
});

const signaler = () => service.reportMessage(SHIPPER, CONV, MESSAGE, { reason: "OFF_PLATFORM" } as never);

describe("A198 (g) — un signalement, un dossier", () => {
  it("le dossier est créé dans une transaction qui écrit AUSSI le message visé (conflit matérialisé)", async () => {
    const r = await signaler();

    expect(r.reportId).toBe("64b00000000000000000ff01");
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.message.updateMany).toHaveBeenCalledWith({ where: { id: MESSAGE }, data: { flaggedContact: false } });
    expect(prismaMock.report.create).toHaveBeenCalledTimes(1);
  });

  it("l'écriture du message REMET SA VALEUR : signaler ne modifie pas le message", async () => {
    prismaMock.message.findFirst.mockResolvedValue({ id: MESSAGE, kind: "TEXT", authorRole: "CARRIER", flaggedContact: true });

    await signaler();

    expect(prismaMock.message.updateMany).toHaveBeenCalledWith({ where: { id: MESSAGE }, data: { flaggedContact: true } });
  });

  it("double clic : la perdante est rejouée, relit le dossier de l'autre et refuse — un seul dossier", async () => {
    prismaMock.$transaction.mockImplementationOnce(async () => {
      throw conflit(); // l'autre requête a écrit le message pendant ce temps
    });
    // La lecture d'AVANT la transaction n'a rien vu (c'est tout le problème) ; celle de la transaction rejouée,
    // elle, voit le dossier que la gagnante vient d'écrire.
    prismaMock.report.findFirst.mockResolvedValueOnce(null).mockResolvedValue({ id: "64b00000000000000000ff00" });

    await expect(signaler()).rejects.toMatchObject({ statusCode: 409, details: { code: "ALREADY_REPORTED" } });

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2); // rejouée
    expect(prismaMock.report.create).not.toHaveBeenCalled(); // et AUCUN second dossier
  });

  it("déjà signalé (cas tranquille, hors course) : 409, aucune écriture", async () => {
    prismaMock.report.findFirst.mockResolvedValue({ id: "64b00000000000000000ff00" });

    await expect(signaler()).rejects.toMatchObject({ statusCode: 409, details: { code: "ALREADY_REPORTED" } });
    expect(prismaMock.report.create).not.toHaveBeenCalled();
    expect(prismaMock.message.updateMany).not.toHaveBeenCalled(); // le refus est rendu AVANT la transaction
  });

  it("signaler son PROPRE message reste refusé (la garde métier n'a pas bougé)", async () => {
    prismaMock.message.findFirst.mockResolvedValue({ id: MESSAGE, kind: "TEXT", authorRole: "SHIPPER", flaggedContact: false });

    await expect(signaler()).rejects.toMatchObject({ details: { code: "OWN_MESSAGE" } });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

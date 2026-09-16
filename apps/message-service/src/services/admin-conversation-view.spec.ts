/**
 * admin-conversation-view.spec.ts — lecture d'un fil au back-office (recette 02-ADMIN § 5.18)
 * ============================================================================================
 * Trois promesses de la page : aucun numéro (même TAPÉ par un membre), une ouverture = une ligne de journal (A168), et un
 * lien de dossier qui ne mène jamais à « jamais passé en médiation ».
 */
const prismaMock = {
  conversation: { findUnique: jest.fn() },
  booking: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  message: { findMany: jest.fn() },
  meetup: { findMany: jest.fn() },
  phoneReveal: { findMany: jest.fn() },
  report: { findMany: jest.fn() },
  adminAction: { create: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });

import { recordAdminRead, readCoalesceKey } from "@packages/admin-audit";
import { makeAdminConversationService } from "./admin-conversation.service";

const LE = new Date("2026-09-14T10:00:00.000Z");
const ACTOR = { id: "64b00000000000000000ad01", ip: null, userAgent: null };
const BOOKING = "64b00000000000000000b001";
const CONV = "64b00000000000000000c001";

function fil(booking: Record<string, unknown> = {}) {
  prismaMock.conversation.findUnique.mockResolvedValue({ id: CONV, bookingId: BOOKING, shipperId: "s1", carrierId: "c1", lastMessageAt: LE });
  prismaMock.booking.findUnique.mockResolvedValue({ status: "ACCEPTED", disputedAt: null, retentionDisposition: null, retentionDecidedAt: null, trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: LE }, ...booking });
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => ({ id: where.id, firstName: where.id === "s1" ? "Pauline" : "Thomas", lastName: "X" }));
  prismaMock.message.findMany.mockResolvedValue([
    { id: "m1", conversationId: CONV, kind: "TEXT", authorId: "c1", authorRole: "CARRIER", body: "Appelle-moi au 06 12 34 56 78 ou thomas.perso@exemple.fr", photoUrls: [], systemKey: null, systemData: null, flaggedContact: true, createdAt: LE },
    { id: "m2", conversationId: CONV, kind: "SYSTEM", authorId: null, authorRole: "SYSTEM", body: "phone.revealed", photoUrls: [], systemKey: "phone.revealed", systemData: { role: "SHIPPER" }, flaggedContact: false, createdAt: LE },
  ]);
  prismaMock.meetup.findMany.mockResolvedValue([]);
  prismaMock.phoneReveal.findMany.mockResolvedValue([]);
  prismaMock.report.findMany.mockResolvedValue([{ id: "r1", targetId: "m1", reason: "OFF_PLATFORM", details: "il m'a donné le +33 6 11 22 33 44", status: "OPEN", reporterUserId: "s1", createdAt: LE }]);
}

/** Un Redis en mémoire : SET NX EX. */
function memoire() {
  const cles = new Set<string>();
  return { cles, async set(key: string) { if (cles.has(key)) return null; cles.add(key); return "OK"; } };
}

beforeEach(() => jest.clearAllMocks());

describe("viewByDeal — aucun numéro, même tapé (recette § 5.18)", () => {
  it("masque numéro et adresse d'un message TEXT et des précisions d'un signalement ; laisse la trace et le badge ; les messages système intacts", async () => {
    fil();
    const out = await makeAdminConversationService().viewByDeal(ACTOR, BOOKING);
    expect(out.messages[0]).toMatchObject({ body: "Appelle-moi au [numéro masqué] ou [adresse masquée]", flaggedContact: true });
    expect(out.messages[0].reports[0].details).toBe("il m'a donné le [numéro masqué]");
    expect(out.messages[1].body).toBe("phone.revealed");
    expect(JSON.stringify(out)).not.toMatch(/\d{2} \d{2} \d{2} \d{2}|exemple\.fr/);
  });

  it("mediationFile : faux sans litige ni retenue ; vrai pour un litige ouvert, une retenue à arbitrer ou arbitrée", async () => {
    fil();
    expect((await makeAdminConversationService().viewByDeal(ACTOR, BOOKING)).mediationFile).toBe(false);
    for (const b of [{ disputedAt: LE }, { retentionDisposition: "HELD_FOR_MEDIATION" }, { retentionDisposition: "CARRIER", retentionDecidedAt: LE }]) {
      fil(b);
      expect((await makeAdminConversationService().viewByDeal(ACTOR, BOOKING)).mediationFile).toBe(true);
    }
  });
});

describe("A168 — une ouverture, une ligne", () => {
  it("deux lectures du même fil dans la fenêtre → UNE ligne CONVERSATION_VIEWED ; un autre admin → sa propre ligne", async () => {
    fil();
    const redis = memoire();
    const svc = makeAdminConversationService(redis);
    await svc.viewByDeal(ACTOR, BOOKING);
    await svc.viewByDeal(ACTOR, BOOKING);
    expect(prismaMock.adminAction.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.adminAction.create.mock.calls[0][0].data).toMatchObject({ action: "CONVERSATION_VIEWED", targetType: "CONVERSATION", targetId: CONV, after: { bookingId: BOOKING, messages: 2 } });
    await svc.viewByDeal({ ...ACTOR, id: "64b00000000000000000ad02" }, BOOKING);
    expect(prismaMock.adminAction.create).toHaveBeenCalledTimes(2);
  });

  it("recordAdminRead : Redis en panne → la ligne est écrite (un doublon plutôt qu'une lecture perdue) ; sans coalesceur → toujours écrite", async () => {
    const input = { adminUserId: "a", action: "USER_VIEWED" as const, targetType: "USER" as const, targetId: "u" };
    const enPanne = { set: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) };
    await expect(recordAdminRead(prismaMock, enPanne, input)).resolves.toBe(true);
    await expect(recordAdminRead(prismaMock, undefined, input)).resolves.toBe(true);
    expect(prismaMock.adminAction.create).toHaveBeenCalledTimes(2);
    const redis = memoire();
    await expect(recordAdminRead(prismaMock, redis, input)).resolves.toBe(true);
    await expect(recordAdminRead(prismaMock, redis, input)).resolves.toBe(false);
    expect([...redis.cles]).toEqual([readCoalesceKey(input)]);
    expect(readCoalesceKey(input)).toBe("yamba:audit:read:a:USER_VIEWED:USER:u");
  });
});

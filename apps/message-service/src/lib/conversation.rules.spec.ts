import { conversationAccess, conversationExists, counterpartIdOf, roleOf } from "./conversation.rules";

const NOW = new Date("2026-09-04T10:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("conversation.rules (chantier F, D61 2A)", () => {
  it("le fil naît à l'acceptation : avant, ni lecture ni écriture", () => {
    for (const status of ["PENDING", "DECLINED", "EXPIRED"]) {
      expect(conversationExists({ status })).toBe(false);
      expect(conversationAccess({ status }, NOW)).toMatchObject({ canRead: false, canWrite: false, reason: "NOT_ACCEPTED_YET" });
    }
  });
  it("pendant le deal : lecture et écriture", () => {
    for (const status of ["ACCEPTED", "PICKED_UP", "DELIVERED"]) {
      expect(conversationAccess({ status }, NOW)).toEqual({ canRead: true, canWrite: true, reason: null, writeClosesAt: null });
    }
  });
  it("litige ouvert : lecture seule, les échanges passent par la médiation (D55)", () => {
    expect(conversationAccess({ status: "DISPUTED" }, NOW)).toMatchObject({ canRead: true, canWrite: false, reason: "DISPUTE_OPEN" });
  });
  it("après la fin : écriture 14 jours, puis lecture seule ; la date de fermeture est servie", () => {
    const justEnded = conversationAccess({ status: "COMPLETED", completedAt: days(-2) }, NOW);
    expect(justEnded).toMatchObject({ canRead: true, canWrite: true, reason: null });
    expect(justEnded.writeClosesAt).toBe(days(12).toISOString());
    const old = conversationAccess({ status: "CANCELLED", closedAt: days(-20) }, NOW);
    expect(old).toMatchObject({ canRead: true, canWrite: false, reason: "WRITE_WINDOW_OVER" });
    expect(conversationAccess({ status: "COMPLETED" }, NOW)).toMatchObject({ canWrite: false, reason: "DEAL_CLOSED" });
  });
  it("rôle et contrepartie : un tiers n'a pas de rôle", () => {
    const parties = { shipperId: "s1", carrierId: "c1" };
    expect(roleOf("s1", parties)).toBe("SHIPPER");
    expect(roleOf("c1", parties)).toBe("CARRIER");
    expect(roleOf("x", parties)).toBeNull();
    expect(counterpartIdOf("SHIPPER", parties)).toBe("c1");
    expect(counterpartIdOf("CARRIER", parties)).toBe("s1");
  });
});

describe("conversationAccess — paramètre messaging.writeDaysAfterEnd (D62)", () => {
  it("7 jours ferme un fil que 14 jours laissait ouvert", () => {
    const b = { status: "COMPLETED", completedAt: days(-10) };
    expect(conversationAccess(b, NOW).canWrite).toBe(true);
    expect(conversationAccess(b, NOW, 7)).toMatchObject({ canWrite: false, reason: "WRITE_WINDOW_OVER" });
    expect(conversationAccess(b, NOW, 30).canWrite).toBe(true);
  });
});

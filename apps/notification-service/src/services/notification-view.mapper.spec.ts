/**
 * notification-view.mapper.spec.ts — la whitelist prouvée (D30, PR4bis)
 * =====================================================================
 * Pattern makeLeakyBooking (PR3) : on fabrique un record TROP riche
 * (plomberie interne + champ inventé) et on prouve que la vue n'expose
 * QUE les champs listés. Contrat RÉEL (api-contracts, préset jest).
 */
import { toNotificationView } from "./notification-view.mapper";

const NOW = new Date("2026-07-26T10:00:00.000Z");

function makeLeakyRecord() {
  return {
    id: "6f0000000000000000000001",
    userId: "64b000000000000000000020",
    type: "booking.requested",
    bookingId: "64b000000000000000000001",
    payload: { bookingId: "64b000000000000000000001", weightKg: 2.5 },
    eventId: "6f00000000000000000000aa",
    readAt: null,
    createdAt: NOW,
    secretInternal: "NE-DOIT-JAMAIS-SORTIR",
  } as unknown as Parameters<typeof toNotificationView>[0];
}

describe("toNotificationView — whitelist A13", () => {
  it("n'expose QUE les 6 champs du contrat (userId/eventId/inconnus exclus)", () => {
    const view = toNotificationView(makeLeakyRecord());
    expect(Object.keys(view).sort()).toEqual([
      "bookingId",
      "createdAt",
      "id",
      "payload",
      "readAt",
      "type",
    ]);
  });

  it("sérialise createdAt en ISO et readAt null reste null", () => {
    const view = toNotificationView(makeLeakyRecord());
    expect(view.createdAt).toBe("2026-07-26T10:00:00.000Z");
    expect(view.readAt).toBeNull();
  });

  it("readAt Date → ISO", () => {
    const record = { ...makeLeakyRecord(), readAt: NOW };
    const view = toNotificationView(record);
    expect(view.readAt).toBe("2026-07-26T10:00:00.000Z");
  });

  it("type hors contrat = rejet strict (le mapper est un garde, pas un tuyau)", () => {
    const record = { ...makeLeakyRecord(), type: "booking.hacked" };
    expect(() => toNotificationView(record)).toThrow();
  });
});

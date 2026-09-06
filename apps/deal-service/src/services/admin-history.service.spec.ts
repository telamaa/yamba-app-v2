/** admin-history.service.spec.ts — fusion pure des quatre sources (C-PR6a, D59 5A) */
import { HISTORY_PAYLOAD_WHITELIST, mergeDealHistory, whitelistPayload } from "./admin-history.service";

const d = (s: string) => new Date(s);
describe("admin-history (D59 5A)", () => {
  it("whitelistPayload : ne laisse passer que les clés connues, jamais un code, une photo ou une adresse", () => {
    const out = whitelistPayload({ payload: { actor: "CARRIER", amountCents: 2000, deliveryCode: "742891", photoUrls: ["x"], recipient: { phone: "+33" }, step: "AIRPORT" } });
    expect(out).toEqual({ actor: "CARRIER", amountCents: 2000, step: "AIRPORT" });
    expect(HISTORY_PAYLOAD_WHITELIST).not.toContain("deliveryCode");
    expect(whitelistPayload(null)).toEqual({});
    expect(whitelistPayload({ reason: "x", ignored: 1 })).toEqual({ reason: "x" });
  });
  it("mergeDealHistory : quatre sources triées, état de relais (publié / en attente / parqué), rôles et noms", () => {
    const events = mergeDealHistory(
      {
        outbox: [
          { id: "e1", eventType: "booking.requested", payload: { payload: { actor: "SHIPPER" } }, occurredAt: d("2026-09-01T10:00:00Z"), publishedAt: d("2026-09-01T10:00:01Z"), attempts: 1, lastError: null },
          { id: "e2", eventType: "booking.accepted", payload: { payload: { actor: "CARRIER", deliveryCode: "1" } }, occurredAt: d("2026-09-02T10:00:00Z"), publishedAt: null, attempts: 10, lastError: "broker down" },
          { id: "e3", eventType: "booking.picked_up", payload: {}, occurredAt: d("2026-09-03T10:00:00Z"), publishedAt: null, attempts: 2, lastError: null },
        ],
        adminActions: [{ action: "DEAL_MONEY_VIEWED", adminUserId: "adm", createdAt: d("2026-09-02T12:00:00Z"), after: null }],
        notifications: [{ type: "booking.accepted", userId: "ship", createdAt: d("2026-09-02T10:00:02Z"), readAt: null }],
        emails: [{ template: "booking/accepted-shipper", userId: "ship", status: "SENT", sentAt: d("2026-09-02T10:00:05Z"), claimedAt: d("2026-09-02T10:00:03Z"), lastError: null }],
      },
      (id) => (id === "ship" ? "SHIPPER" : id === "car" ? "CARRIER" : null),
      (id) => (id === "adm" ? "Sami D." : id)
    );
    expect(events.map((e) => `${e.source}:${e.type}`)).toEqual(["OUTBOX:booking.requested", "OUTBOX:booking.accepted", "NOTIFICATION:booking.accepted", "EMAIL:booking/accepted-shipper", "ADMIN:DEAL_MONEY_VIEWED", "OUTBOX:booking.picked_up"]);
    expect(events[0].relay).toEqual({ publishedAt: "2026-09-01T10:00:01.000Z", attempts: 1, parked: false, lastError: null });
    expect(events[1]).toMatchObject({ status: "PARKED", actor: "CARRIER", summary: { actor: "CARRIER" }, relay: { parked: true, attempts: 10, lastError: "broker down" } });
    expect(events[2]).toMatchObject({ recipient: "SHIPPER", status: "UNREAD" });
    expect(events[3]).toMatchObject({ recipient: "SHIPPER", status: "SENT" });
    expect(events[4].actor).toBe("Sami D.");
    expect(events[5].status).toBe("PENDING");
  });
});

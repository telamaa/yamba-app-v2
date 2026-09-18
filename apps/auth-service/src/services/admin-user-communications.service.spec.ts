/** admin-user-communications.service.spec.ts — fiche membre : ses communications (D79). */
import { makeAdminUserCommunicationsService, type UserCommunicationsDb } from "./admin-user-communications.service";

const NOW = new Date("2026-09-18T20:00:00.000Z");
const UID = "6a5c1d3b8faeca66b436c0e6";

type FakeState = {
  user: { id: string } | null;
  notifications: Array<{ type: string; bookingId: string | null; createdAt: Date; readAt: Date | null }>;
  emails: Array<{ eventId: string; template: string; status: string; claimedAt: Date; sentAt: Date | null; lastError: string | null }>;
  outbox: Array<{ id: string; aggregateType: string; aggregateId: string }>;
  counts: { notifications: number; unread: number; emails: number; failed: number };
};

function fakeDb(state: FakeState) {
  const wheres: Array<{ model: string; where: Record<string, unknown> }> = [];
  let outboxQueries = 0;
  const db: UserCommunicationsDb = {
    user: { async findUnique() { return state.user; } },
    notification: {
      async findMany() { return state.notifications; },
      async count({ where }) {
        wheres.push({ model: "notification", where });
        return "OR" in where ? state.counts.unread : state.counts.notifications;
      },
    },
    emailDelivery: {
      async findMany() { return state.emails; },
      async count({ where }) {
        wheres.push({ model: "emailDelivery", where });
        return "status" in where ? state.counts.failed : state.counts.emails;
      },
    },
    outboxEvent: {
      async findMany({ where }) {
        outboxQueries += 1;
        return state.outbox.filter((o) => where.id.in.includes(o.id));
      },
    },
  };
  return { db, wheres, getOutboxQueries: () => outboxQueries };
}

describe("admin-user-communications.service — getCommunications (D79)", () => {
  it("404 USER_NOT_FOUND quand le compte n'existe pas", async () => {
    const f = fakeDb({ user: null, notifications: [], emails: [], outbox: [], counts: { notifications: 0, unread: 0, emails: 0, failed: 0 } });
    const svc = makeAdminUserCommunicationsService(f.db, () => NOW);
    await expect(svc.getCommunications(UID)).rejects.toMatchObject({ statusCode: 404, details: { code: "USER_NOT_FOUND" } });
  });

  it("sert types et statuts en ISO, relie l'email à son deal via l'outbox, null pour un événement non-deal", async () => {
    const f = fakeDb({
      user: { id: UID },
      notifications: [
        { type: "booking.requested", bookingId: "6aad8bbeb0c7211a396ca014", createdAt: new Date("2026-09-18T19:06:38.854Z"), readAt: null },
        { type: "booking.rating_reminder", bookingId: "6a97090dc356f11ec8493ac5", createdAt: new Date("2026-09-09T01:33:27.023Z"), readAt: new Date("2026-09-10T08:00:00.000Z") },
      ],
      emails: [
        { eventId: "evt-booking", template: "booking/booking-requested-carrier", status: "SENT", claimedAt: new Date("2026-09-18T19:06:38.900Z"), sentAt: new Date("2026-09-18T19:06:38.961Z"), lastError: null },
        { eventId: "evt-autre", template: "messaging/meetup-proposed", status: "FAILED", claimedAt: new Date("2026-09-17T10:00:00.000Z"), sentAt: null, lastError: null },
      ],
      outbox: [
        { id: "evt-booking", aggregateType: "booking", aggregateId: "6aad8bbeb0c7211a396ca014" },
        { id: "evt-autre", aggregateType: "conversation", aggregateId: "conv-1" },
      ],
      counts: { notifications: 2, unread: 1, emails: 2, failed: 1 },
    });
    const svc = makeAdminUserCommunicationsService(f.db, () => NOW);
    const r = await svc.getCommunications(UID);
    expect(r.userId).toBe(UID);
    expect(r.notifications).toEqual([
      { type: "booking.requested", bookingId: "6aad8bbeb0c7211a396ca014", createdAt: "2026-09-18T19:06:38.854Z", readAt: null },
      { type: "booking.rating_reminder", bookingId: "6a97090dc356f11ec8493ac5", createdAt: "2026-09-09T01:33:27.023Z", readAt: "2026-09-10T08:00:00.000Z" },
    ]);
    expect(r.emails[0]).toEqual({ template: "booking/booking-requested-carrier", status: "SENT", bookingId: "6aad8bbeb0c7211a396ca014", claimedAt: "2026-09-18T19:06:38.900Z", sentAt: "2026-09-18T19:06:38.961Z", lastError: null });
    expect(r.emails[1].bookingId).toBeNull(); // aggregat non-booking : jamais inventé
    expect(r.counts).toEqual({ notifications: 2, unreadNotifications: 1, emails: 2, failedEmails: 1 });
    expect(r.generatedAt).toBe(NOW.toISOString());
  });

  it("expurge l'erreur d'envoi (adresse masquée) et la tronque à 200 caractères", async () => {
    const longError = `550 5.1.1 <marc.carrier@seed.yamba.dev>: mailbox unavailable ${"x".repeat(300)}`;
    const f = fakeDb({
      user: { id: UID },
      notifications: [],
      emails: [{ eventId: "e1", template: "booking/payment-authorized-shipper", status: "FAILED", claimedAt: NOW, sentAt: null, lastError: longError }],
      outbox: [],
      counts: { notifications: 0, unread: 0, emails: 1, failed: 1 },
    });
    const svc = makeAdminUserCommunicationsService(f.db, () => NOW);
    const r = await svc.getCommunications(UID);
    expect(r.emails[0].lastError).toContain("[adresse masquée]");
    expect(r.emails[0].lastError).not.toContain("marc.carrier@seed.yamba.dev");
    expect((r.emails[0].lastError as string).length).toBeLessThanOrEqual(220); // 200 + le masque
  });

  it("compte les non-lues avec le OR isSet (piège Mongo : un readAt ABSENT échappe à `readAt: null`)", async () => {
    const f = fakeDb({ user: { id: UID }, notifications: [], emails: [], outbox: [], counts: { notifications: 5, unread: 3, emails: 0, failed: 0 } });
    const svc = makeAdminUserCommunicationsService(f.db, () => NOW);
    const r = await svc.getCommunications(UID);
    expect(r.counts.unreadNotifications).toBe(3);
    const unreadWhere = f.wheres.find((w) => w.model === "notification" && "OR" in w.where);
    expect(unreadWhere?.where.OR).toEqual([{ readAt: null }, { readAt: { isSet: false } }]);
    // Zéro email : l'outbox n'est pas interrogée.
    expect(f.getOutboxQueries()).toBe(0);
  });

  it("compte les emails en échec sur les trois statuts FAILED / BOUNCED / COMPLAINED", async () => {
    const f = fakeDb({ user: { id: UID }, notifications: [], emails: [], outbox: [], counts: { notifications: 0, unread: 0, emails: 9, failed: 2 } });
    const svc = makeAdminUserCommunicationsService(f.db, () => NOW);
    await svc.getCommunications(UID);
    const failedWhere = f.wheres.find((w) => w.model === "emailDelivery" && "status" in w.where);
    expect(failedWhere?.where.status).toEqual({ in: ["FAILED", "BOUNCED", "COMPLAINED"] });
  });
});

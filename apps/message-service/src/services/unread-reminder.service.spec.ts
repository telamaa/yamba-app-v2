/** unread-reminder.service.spec.ts — D63 8A : la préférence « ne plus me relancer par email » et le compte effacé coupent l'envoi. */
const prismaMock = {
  conversation: { findMany: jest.fn(), updateMany: jest.fn() },
  user: { findUnique: jest.fn() },
  booking: { findUnique: jest.fn() },
};
jest.mock("@packages/libs/prisma", () => ({ __esModule: true, default: prismaMock }), { virtual: true });
jest.mock("@packages/libs/settings/default", () => ({ platformSettings: () => ({ get: async () => ({ "messaging.reminderDelayMinutes": 15, "messaging.reminderMinIntervalMinutes": 60 }) }) }), { virtual: true });

import { makeUnreadReminderService } from "./unread-reminder.service";

const now = new Date("2026-09-05T12:00:00.000Z");
const min = (n: number) => new Date(now.getTime() - n * 60_000);
const conversation = { id: "c1", bookingId: "b1", shipperId: "s1", carrierId: "k1", lastMessageAt: min(20), lastMessageAuthorRole: "CARRIER", shipperLastReadAt: null, carrierLastReadAt: null, shipperRemindedAt: null, carrierRemindedAt: null };

function setup(recipient: Record<string, unknown>) {
  jest.clearAllMocks();
  prismaMock.conversation.findMany.mockResolvedValue([conversation]);
  prismaMock.conversation.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === "s1" ? recipient : { firstName: "Thomas" }));
  prismaMock.booking.findUnique.mockResolvedValue({ trip: { originCity: "Paris", destinationCity: "Dakar" } });
  const send = jest.fn().mockResolvedValue(undefined);
  return { send, svc: makeUnreadReminderService({ send, clock: () => now }) };
}

describe("unread-reminder.service — qui ne reçoit pas l'email", () => {
  it("destinataire qui a désactivé la relance (messagingReminderEmails=false) : verrou posé, aucun email", async () => {
    const { send, svc } = setup({ email: "s@x.com", firstName: "Pauline", preferredLocale: "fr", isDeleted: false, messagingReminderEmails: false });
    const r = await svc.runOnce(now);
    expect(send).not.toHaveBeenCalled();
    expect(prismaMock.conversation.updateMany).toHaveBeenCalledTimes(1); // le verrou évite une nouvelle tentative dans l'heure
    // ANO-CRON-04 — l'intention d'origine reste : ce n'est PAS une erreur. Mais ce n'est pas non
    // plus une relance envoyée : le battement annonçait « 1 relance(s) » pour zéro email. Les
    // trois issues sont désormais distinctes, et `skipped` dit exactement ce qui s'est passé.
    expect(r.sent).toBe(0);
    expect(r.skipped).toBe(1);
    expect(r.failed).toBe(0);
  });
  it("compte effacé (isDeleted) : aucun email, et compté comme ignoré", async () => {
    const { send, svc } = setup({ email: "erased+s1@anonymised.invalid", firstName: "Membre", preferredLocale: "fr", isDeleted: true, messagingReminderEmails: true });
    const r = await svc.runOnce(now);
    expect(send).not.toHaveBeenCalled();
    expect(r).toMatchObject({ sent: 0, skipped: 1, failed: 0 });
  });
  it("destinataire normal : un email dans sa langue, compté comme envoyé", async () => {
    const { send, svc } = setup({ email: "s@x.com", firstName: "Pauline", preferredLocale: "en", isDeleted: false, messagingReminderEmails: true });
    const r = await svc.runOnce(now);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "s@x.com", locale: "en" });
    expect(r).toMatchObject({ sent: 1, skipped: 0, failed: 0 });
  });
});

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
    expect(r.sent).toBe(1); // remind() a « réussi » sans envoyer : pas une erreur
  });
  it("compte effacé (isDeleted) : aucun email", async () => {
    const { send, svc } = setup({ email: "erased+s1@anonymised.invalid", firstName: "Membre", preferredLocale: "fr", isDeleted: true, messagingReminderEmails: true });
    await svc.runOnce(now);
    expect(send).not.toHaveBeenCalled();
  });
  it("destinataire normal : un email dans sa langue", async () => {
    const { send, svc } = setup({ email: "s@x.com", firstName: "Pauline", preferredLocale: "en", isDeleted: false, messagingReminderEmails: true });
    await svc.runOnce(now);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "s@x.com", locale: "en" });
  });
});

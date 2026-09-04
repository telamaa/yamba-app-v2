import { unreadReminderDue } from "./unread-reminder.rules";

const now = new Date("2026-09-04T12:00:00.000Z");
const min = (n: number) => new Date(now.getTime() - n * 60_000);

const base = {
  lastMessageAt: min(20),
  lastMessageAuthorRole: "CARRIER",
  recipientRole: "SHIPPER" as const,
  recipientLastReadAt: min(60),
  recipientRemindedAt: null,
};

describe("unreadReminderDue (D61 6A)", () => {
  it("relance l'autre partie après 15 minutes sans lecture", () => {
    expect(unreadReminderDue(base, now)).toEqual({ due: true, reason: null });
  });

  it("ne relance jamais l'auteur du dernier message, ni pour un message système", () => {
    expect(unreadReminderDue({ ...base, lastMessageAuthorRole: "SHIPPER" }, now).reason).toBe("NOT_FROM_COUNTERPART");
    expect(unreadReminderDue({ ...base, lastMessageAuthorRole: "SYSTEM" }, now).reason).toBe("NOT_FROM_COUNTERPART");
    expect(unreadReminderDue({ ...base, lastMessageAt: null }, now).reason).toBe("NO_MESSAGE");
  });

  it("attend 15 minutes : un message de 10 minutes n'est pas encore relancé", () => {
    expect(unreadReminderDue({ ...base, lastMessageAt: min(10) }, now).reason).toBe("TOO_RECENT");
    expect(unreadReminderDue({ ...base, lastMessageAt: min(15) }, now).due).toBe(true);
  });

  it("ne relance pas un message déjà lu (lecture postérieure ou égale au message)", () => {
    expect(unreadReminderDue({ ...base, recipientLastReadAt: min(20) }, now).reason).toBe("ALREADY_READ");
    expect(unreadReminderDue({ ...base, recipientLastReadAt: min(5) }, now).reason).toBe("ALREADY_READ");
    expect(unreadReminderDue({ ...base, recipientLastReadAt: null }, now).due).toBe(true);
  });

  it("une relance postérieure au dernier message a fait son travail : pas de seconde relance", () => {
    expect(unreadReminderDue({ ...base, recipientRemindedAt: min(18) }, now).reason).toBe("ALREADY_REMINDED");
  });

  it("au plus une relance par heure : un nouveau message 30 minutes après une relance attend", () => {
    // Relance à -50 min, nouveau message à -20 min (non lu) : due après -50 + 60 = +10 min seulement.
    expect(unreadReminderDue({ ...base, recipientRemindedAt: min(50) }, now).reason).toBe("RATE_LIMITED");
    expect(unreadReminderDue({ ...base, recipientRemindedAt: min(61) }, now).due).toBe(true);
  });
});

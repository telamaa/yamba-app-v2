/** recipient-redaction.rules.spec.ts — D63 5A : le destinataire s'efface 30 j après la fin, jamais avant, jamais deux fois. */
import { isRecipientRedactable, REDACTED_RECIPIENT } from "./recipient-redaction.rules";

const now = new Date("2026-09-05T03:40:00.000Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("isRecipientRedactable", () => {
  it("deal terminé depuis 31 j → oui ; depuis 29 j → non ; déjà effacé → non", () => {
    expect(isRecipientRedactable({ status: "COMPLETED", completedAt: days(31), closedAt: null, recipientRedactedAt: null }, now)).toBe(true);
    expect(isRecipientRedactable({ status: "COMPLETED", completedAt: days(29), closedAt: null, recipientRedactedAt: null }, now)).toBe(false);
    expect(isRecipientRedactable({ status: "COMPLETED", completedAt: days(31), closedAt: null, recipientRedactedAt: days(1) }, now)).toBe(false);
  });
  it("un deal vivant ou en litige n'est jamais effacé, même très ancien", () => {
    for (const status of ["ACCEPTED", "PICKED_UP", "DELIVERED", "DISPUTED", "PENDING"]) {
      expect(isRecipientRedactable({ status, completedAt: null, closedAt: days(400), recipientRedactedAt: null }, now)).toBe(false);
    }
  });
  it("annulé / refusé / expiré : la date de clôture fait foi ; sans date → non", () => {
    expect(isRecipientRedactable({ status: "CANCELLED", completedAt: null, closedAt: days(31), recipientRedactedAt: null }, now)).toBe(true);
    expect(isRecipientRedactable({ status: "DECLINED", completedAt: null, closedAt: null, recipientRedactedAt: null }, now)).toBe(false);
  });
  it("le délai vient du paramètre privacy.recipientRetentionDays (D62) : 7 j efface ce que 30 j gardait", () => {
    const b = { status: "COMPLETED", completedAt: days(10), closedAt: null, recipientRedactedAt: null };
    expect(isRecipientRedactable(b, now)).toBe(false);
    expect(isRecipientRedactable(b, now, 7)).toBe(true);
  });
  it("le snapshot effacé ne porte ni nom ni email, et un numéro invalide non ambigu", () => {
    expect(REDACTED_RECIPIENT).toEqual({ firstName: "—", lastName: "—", phoneE164: "+00000000000", email: null });
  });
});

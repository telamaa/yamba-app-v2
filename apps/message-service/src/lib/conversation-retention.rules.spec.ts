import { isPurgeable, retentionAnchor } from "./conversation-retention.rules";

const now = new Date("2026-09-04T03:30:00.000Z");
const days = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("conversation retention (D61 8A)", () => {
  it("purge un deal terminé dont le fil est silencieux depuis plus d'un an", () => {
    expect(isPurgeable({ bookingStatus: "COMPLETED", bookingEndedAt: days(400), conversationUpdatedAt: days(380) }, now)).toBe(true);
    expect(isPurgeable({ bookingStatus: "CANCELLED", bookingEndedAt: days(366), conversationUpdatedAt: days(366) }, now)).toBe(true);
  });

  it("l'ancre est la plus tardive de la fin du deal et de la dernière activité", () => {
    expect(retentionAnchor({ bookingStatus: "COMPLETED", bookingEndedAt: days(400), conversationUpdatedAt: days(100) })).toEqual(days(100));
    expect(retentionAnchor({ bookingStatus: "COMPLETED", bookingEndedAt: null, conversationUpdatedAt: days(100) })).toEqual(days(100));
    // Un fil relu il y a 100 jours n'est pas purgé, même si le deal est fini depuis 400 jours.
    expect(isPurgeable({ bookingStatus: "COMPLETED", bookingEndedAt: days(400), conversationUpdatedAt: days(100) }, now)).toBe(false);
  });

  it("ne purge jamais un deal vivant ou en litige, quel que soit l'âge", () => {
    expect(isPurgeable({ bookingStatus: "DISPUTED", bookingEndedAt: null, conversationUpdatedAt: days(800) }, now)).toBe(false);
    expect(isPurgeable({ bookingStatus: "ACCEPTED", bookingEndedAt: null, conversationUpdatedAt: days(800) }, now)).toBe(false);
  });

  it("un an moins un jour : pas encore", () => {
    expect(isPurgeable({ bookingStatus: "COMPLETED", bookingEndedAt: days(364), conversationUpdatedAt: days(364) }, now)).toBe(false);
  });
});

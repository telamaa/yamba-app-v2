/** tracking-link.rules.spec.ts — règles pures de la page destinataire (D69). */
import { canIssueTrackingLink, isTrackingVisible, publicMilestones } from "./tracking-link.rules";

const d = (s: string) => new Date(s);
describe("tracking-link rules (D69)", () => {
  it("canIssueTrackingLink : dès l'acceptation, jamais avant, plus après une fin sans livraison", () => {
    expect(canIssueTrackingLink("PENDING")).toBe(false);
    expect(canIssueTrackingLink("ACCEPTED")).toBe(true);
    expect(canIssueTrackingLink("PICKED_UP")).toBe(true);
    expect(canIssueTrackingLink("COMPLETED")).toBe(true);
    expect(canIssueTrackingLink("CANCELLED")).toBe(false);
    expect(canIssueTrackingLink("EXPIRED")).toBe(false);
  });
  it("isTrackingVisible : un seul interrupteur — effacement du tiers, suppression, révocation", () => {
    expect(isTrackingVisible({ isDeleted: false, recipientRedactedAt: null, revokedAt: null })).toBe(true);
    expect(isTrackingVisible({ isDeleted: false, recipientRedactedAt: d("2026-10-05T00:00:00Z"), revokedAt: null })).toBe(false);
    expect(isTrackingVisible({ isDeleted: true, recipientRedactedAt: null, revokedAt: null })).toBe(false);
    expect(isTrackingVisible({ isDeleted: false, recipientRedactedAt: null, revokedAt: d("2026-09-06T00:00:00Z") })).toBe(false);
  });
  it("publicMilestones : accepté → récupéré → en route → arrivé → livré, dans l'ordre des dates", () => {
    const steps = publicMilestones({
      status: "DELIVERED",
      acceptedAt: d("2026-09-01T10:00:00Z"),
      pickedUpAt: d("2026-09-03T08:00:00Z"),
      deliveredAt: d("2026-09-04T18:00:00Z"),
      trackingEvents: [
        { step: "AT_AIRPORT", confirmedAt: d("2026-09-03T12:00:00Z") },
        { step: "FLIGHT_DEPARTED", confirmedAt: d("2026-09-03T14:00:00Z") },
        { step: "FLIGHT_ARRIVED", confirmedAt: d("2026-09-04T06:00:00Z") },
      ],
    });
    expect(steps.map((s) => s.key)).toEqual(["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "DELIVERED"]);
    expect(steps[2].at.toISOString()).toBe("2026-09-03T14:00:00.000Z");
  });
  it("publicMilestones : une annulation après acceptation se lit « clôturé »", () => {
    const steps = publicMilestones({ status: "CANCELLED", acceptedAt: d("2026-09-01T10:00:00Z"), pickedUpAt: null, deliveredAt: null, cancelledAt: d("2026-09-02T10:00:00Z"), trackingEvents: [] });
    expect(steps.map((s) => s.key)).toEqual(["ACCEPTED", "CLOSED"]);
  });
});

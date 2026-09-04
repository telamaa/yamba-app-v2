import { isTicketExpired, notHiddenFilter, ticketReviewOutcome } from "./admin-trips.rules";

describe("admin-trips.rules (C-PR4, D57)", () => {
  it("ticketReviewOutcome : VERIFY → les deux statuts VERIFIED, sans motif", () => {
    expect(ticketReviewOutcome("VERIFY")).toEqual({ documentStatus: "VERIFIED", tripTicketStatus: "VERIFIED", rejectionReason: null });
  });
  it("ticketReviewOutcome : REJECT exige un motif fermé et le propage", () => {
    expect(ticketReviewOutcome("REJECT", "DATES_MISMATCH")).toEqual({ documentStatus: "REJECTED", tripTicketStatus: "REJECTED", rejectionReason: "DATES_MISMATCH" });
    expect(() => ticketReviewOutcome("REJECT")).toThrow(/needs a reason/);
  });
  it("isTicketExpired : trajet parti → expiré ; à venir ou sans date → non", () => {
    const now = new Date("2026-09-04T10:00:00Z");
    expect(isTicketExpired({ departureAt: new Date("2026-09-03T10:00:00Z") }, now)).toBe(true);
    expect(isTicketExpired({ departureAt: new Date("2026-09-05T10:00:00Z") }, now)).toBe(false);
    expect(isTicketExpired({ departureAt: null }, now)).toBe(false);
  });
  it("notHiddenFilter : null OU absent (jamais `null` seul — pitfall Mongo)", () => {
    expect(notHiddenFilter()).toEqual({ OR: [{ hiddenByAdminAt: null }, { hiddenByAdminAt: { isSet: false } }] });
  });
});

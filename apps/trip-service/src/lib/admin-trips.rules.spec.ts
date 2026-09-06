import { AdminTripsQuerySchema, TicketQueueQuerySchema } from "@packages/api-contracts";
import { buildTicketsWhere, buildTripsOrderBy, buildTripsWhere, isTicketExpired, notHiddenFilter, ticketReviewOutcome } from "./admin-trips.rules";

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
  describe("C-PR7a (D60 2A) — filtres serveur purs", () => {
    it("buildTripsWhere : statut, masqués / non masqués (absent OU null), période, villes, identifiant, texte combiné", () => {
      const q = AdminTripsQuerySchema.parse({ status: "PUBLISHED", hidden: "0", from: "2026-09-01T00:00:00Z", to: "2026-10-01T00:00:00Z", originCity: "paris", q: "brazza" });
      const w = buildTripsWhere(q) as Record<string, unknown>;
      expect(w).toMatchObject({ isDeleted: false, status: "PUBLISHED", departureAt: { gte: new Date("2026-09-01T00:00:00Z"), lt: new Date("2026-10-01T00:00:00Z") }, originCity: { contains: "paris", mode: "insensitive" } });
      expect(w.AND).toHaveLength(2); // non masqué (OR) + texte (OR)
      expect(buildTripsWhere(AdminTripsQuerySchema.parse({ q: "64b0000000000000000000a1" }))).toMatchObject({ id: "64b0000000000000000000a1" });
      expect(buildTripsWhere(AdminTripsQuerySchema.parse({ hidden: "1" }))).toMatchObject({ hiddenByAdminAt: { not: null } });
      expect(buildTripsOrderBy(AdminTripsQuerySchema.parse({ sort: "publishedAt", dir: "asc" }))).toEqual([{ publishedAt: "asc" }, { id: "asc" }]);
    });
    it("buildTicketsWhere : période de dépôt, « plus vieux que N jours », villes via la relation", () => {
      const now = new Date("2026-09-04T10:00:00Z");
      const w = buildTicketsWhere(TicketQueueQuerySchema.parse({ olderThanDays: "3", destinationCity: "Kinshasa" }), now) as { createdAt: { lt: Date }; trip: unknown };
      expect(w.createdAt.lt.toISOString()).toBe("2026-09-01T10:00:00.000Z");
      expect(w.trip).toEqual({ is: { destinationCity: { contains: "Kinshasa", mode: "insensitive" } } });
      expect(buildTicketsWhere(TicketQueueQuerySchema.parse({}), now)).toEqual({ type: "TICKET_PROOF", status: "PENDING" });
    });
  });
});

import { AdminTripsQuerySchema, TicketQueueQuerySchema } from "@packages/api-contracts";
import { TICKETS_CSV_COLUMNS, buildTicketsWhere, departedTicketsWhere, buildTripsOrderBy, buildTripsWhere, effectiveTicketStatus, fileExtensionOf, isTicketExpired, notHiddenFilter, ticketReviewOutcome } from "./admin-trips.rules";

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
      expect(w.trip).toMatchObject({ is: { destinationCity: { contains: "Kinshasa", mode: "insensitive" } } });
      expect(buildTicketsWhere(TicketQueueQuerySchema.parse({}), now)).toMatchObject({ type: "TICKET_PROOF", status: "PENDING" });
    });
  });

  describe("ANO-ADM-15 — un terme saisi est cherché à la lettre, jamais comme une regex", () => {
    it("buildTripsWhere et buildTicketsWhere échappent le terme, les villes et les villes de la relation", () => {
      const w = buildTripsWhere(AdminTripsQuerySchema.parse({ q: "Brazza(ville)", originCity: "P.ris", destinationCity: "a+b" })) as Record<string, unknown>;
      expect(w.OR).toEqual([{ originCity: { contains: "Brazza\\(ville\\)", mode: "insensitive" } }, { destinationCity: { contains: "Brazza\\(ville\\)", mode: "insensitive" } }]);
      expect(w.originCity).toEqual({ contains: "P\\.ris", mode: "insensitive" });
      expect(w.destinationCity).toEqual({ contains: "a\\+b", mode: "insensitive" });
      const t = buildTicketsWhere(TicketQueueQuerySchema.parse({ originCity: "(" }), new Date()) as { trip: unknown };
      expect(t.trip).toMatchObject({ is: { originCity: { contains: "\\(", mode: "insensitive" } } });
    });
  });

  describe("ANO-ADM-16 — « billet à vérifier » ne désigne qu'un trajet pas encore parti", () => {
    const now = new Date("2026-09-14T10:00:00Z");
    it("ticketPending=1 borne le départ à maintenant, sans écraser une borne plus tardive ni la borne haute", () => {
      expect(buildTripsWhere(AdminTripsQuerySchema.parse({ ticketPending: "1" }), now)).toMatchObject({ ticketVerificationStatus: "PENDING", departureAt: { gte: now } });
      const plusTard = buildTripsWhere(AdminTripsQuerySchema.parse({ ticketPending: "1", from: "2026-10-01T00:00:00Z", to: "2026-11-01T00:00:00Z" }), now);
      expect(plusTard).toMatchObject({ departureAt: { gte: new Date("2026-10-01T00:00:00Z"), lt: new Date("2026-11-01T00:00:00Z") } });
      const plusTot = buildTripsWhere(AdminTripsQuerySchema.parse({ ticketPending: "1", from: "2026-01-01T00:00:00Z" }), now);
      expect(plusTot).toMatchObject({ departureAt: { gte: now } });
      expect(buildTripsWhere(AdminTripsQuerySchema.parse({}), now)).not.toHaveProperty("departureAt");
    });
    it("effectiveTicketStatus : PENDING d'un trajet parti → EXPIRED ; le reste inchangé", () => {
      expect(effectiveTicketStatus({ ticketVerificationStatus: "PENDING", departureAt: new Date("2026-06-26T08:00:00Z") }, now)).toBe("EXPIRED");
      expect(effectiveTicketStatus({ ticketVerificationStatus: "PENDING", departureAt: new Date("2026-09-23T08:00:00Z") }, now)).toBe("PENDING");
      expect(effectiveTicketStatus({ ticketVerificationStatus: "VERIFIED", departureAt: new Date("2026-06-26T08:00:00Z") }, now)).toBe("VERIFIED");
      expect(effectiveTicketStatus({ ticketVerificationStatus: "PENDING", departureAt: null }, now)).toBe("PENDING");
    });
  });

  describe("ANO-ADM-12 (A156) — l'export des billets ne porte aucun texte libre du membre", () => {
    it("la colonne originalName n'existe plus ; fileExtension la remplace", () => {
      expect(TICKETS_CSV_COLUMNS).not.toContain("originalName");
      expect(TICKETS_CSV_COLUMNS).toContain("fileExtension");
    });
    it("fileExtensionOf ne rend QUE l'extension (mesuré : « sfr-facture-0752426937-0.pdf »)", () => {
      expect(fileExtensionOf("sfr-facture-0752426937-0.pdf")).toBe("pdf");
      expect(fileExtensionOf("Capture d’écran 2026-04-28 à 14.19.05.PNG")).toBe("png");
      expect(fileExtensionOf("billet")).toBe("");
      expect(fileExtensionOf("nom.0612345678")).toBe(""); // une « extension » de 10 chiffres n'est pas une extension
      expect(fileExtensionOf(null)).toBe("");
    });
  });

  describe("ANO-ADM-20 — la file et l'export ne proposent que des billets décidables", () => {
    it("buildTicketsWhere : trajet vivant, non supprimé, à venir ou sans date (null OU absent)", () => {
      const now = new Date("2026-09-14T10:00:00Z");
      const w = buildTicketsWhere(TicketQueueQuerySchema.parse({}), now) as { trip: { is: Record<string, unknown> } };
      expect(w.trip.is).toEqual({
        isDeleted: false,
        status: { in: ["DRAFT", "PUBLISHED", "PAUSED"] },
        OR: [{ departureAt: { gte: now } }, { departureAt: null }, { departureAt: { isSet: false } }],
      });
    });
    it("departedTicketsWhere : supprimé OU parti, avec la borne basse qui écarte les dates nulles", () => {
      const now = new Date("2026-09-14T10:00:00Z");
      expect(departedTicketsWhere(now)).toEqual({ type: "TICKET_PROOF", status: "PENDING", trip: { is: { OR: [{ isDeleted: true }, { departureAt: { gt: new Date(0), lt: now } }] } } });
    });
  });
});

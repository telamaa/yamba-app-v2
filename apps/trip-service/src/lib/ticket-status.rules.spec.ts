import { changedTicketFacts, ticketNotReviewableReason, tripTicketStatusFromDocuments } from "./ticket-status.rules";

const billet = (status: string) => ({ type: "TICKET_PROOF", status });

describe("ticket-status.rules (recette 02-ADMIN § 5.8)", () => {
  describe("ANO-ADM-19 — le statut du trajet est la synthèse de ses billets", () => {
    it("un billet vérifié suffit, même à côté d'un rejet ou d'une attente", () => {
      expect(tripTicketStatusFromDocuments([billet("VERIFIED"), billet("REJECTED")])).toBe("VERIFIED");
      expect(tripTicketStatusFromDocuments([billet("REJECTED"), billet("PENDING"), billet("VERIFIED")])).toBe("VERIFIED");
    });
    it("sans vérifié : une attente (ou un expiré) prime sur un rejet ; un rejet seul ; rien → non soumis", () => {
      expect(tripTicketStatusFromDocuments([billet("REJECTED"), billet("PENDING")])).toBe("PENDING");
      expect(tripTicketStatusFromDocuments([billet("EXPIRED")])).toBe("PENDING");
      expect(tripTicketStatusFromDocuments([billet("REJECTED")])).toBe("REJECTED");
      expect(tripTicketStatusFromDocuments([])).toBe("NOT_SUBMITTED");
    });
    it("les autres documents ne comptent pas", () => {
      expect(tripTicketStatusFromDocuments([{ type: "IDENTITY_PROOF", status: "VERIFIED" }, { type: "OTHER", status: "PENDING" }])).toBe("NOT_SUBMITTED");
    });
  });

  describe("ANO-ADM-21 (A158) — les faits vérifiés", () => {
    const avant = { departureAt: new Date("2026-10-01T08:00:00Z"), originCity: "Bruxelles", destinationCity: "Kinshasa" };
    it("date ou ville réellement changée → nommée", () => {
      expect(changedTicketFacts(avant, { departureAt: "2026-10-02T08:00:00Z" })).toEqual(["departureAt"]);
      expect(changedTicketFacts(avant, { destinationCity: "Lubumbashi", originCity: "Bruxelles" })).toEqual(["destinationCity"]);
    });
    it("même instant, même ville (casse, espaces), champ absent ou autre champ → rien", () => {
      expect(changedTicketFacts(avant, { departureAt: new Date("2026-10-01T08:00:00.000Z"), originCity: "  bruxelles ", pricePerKgCents: 1200 })).toEqual([]);
      expect(changedTicketFacts(avant, { departureAt: undefined })).toEqual([]);
    });
    it("une date posée sur un trajet qui n'en avait pas est un changement", () => {
      expect(changedTicketFacts({ ...avant, departureAt: null }, { departureAt: "2026-10-01T08:00:00Z" })).toEqual(["departureAt"]);
    });
  });

  describe("un billet ne se décide que sur un trajet à venir et vivant", () => {
    const now = new Date("2026-09-14T10:00:00Z");
    it("brouillon, publié, en pause, à venir ou sans date → décidable", () => {
      for (const status of ["DRAFT", "PUBLISHED", "PAUSED"]) expect(ticketNotReviewableReason({ status, isDeleted: false, departureAt: new Date("2026-09-20T00:00:00Z") }, now)).toBeNull();
      expect(ticketNotReviewableReason({ status: "DRAFT", isDeleted: false, departureAt: null }, now)).toBeNull();
    });
    it("parti → TICKET_TRIP_DEPARTED ; annulé, terminé, archivé, supprimé → TICKET_TRIP_CLOSED", () => {
      expect(ticketNotReviewableReason({ status: "PUBLISHED", isDeleted: false, departureAt: new Date("2026-09-13T00:00:00Z") }, now)).toBe("TICKET_TRIP_DEPARTED");
      for (const status of ["CANCELLED", "COMPLETED", "ARCHIVED"]) expect(ticketNotReviewableReason({ status, isDeleted: false, departureAt: new Date("2026-09-20T00:00:00Z") }, now)).toBe("TICKET_TRIP_CLOSED");
      expect(ticketNotReviewableReason({ status: "PUBLISHED", isDeleted: true, departureAt: new Date("2026-09-20T00:00:00Z") }, now)).toBe("TICKET_TRIP_CLOSED");
    });
  });
});

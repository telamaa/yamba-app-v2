/**
 * admin-dispute.service.spec.ts — mapper pur de la file « à arbitrer » (C-PR1, D54)
 */
import { AdminDisputeFileSchema, ArbitrationQueueItemSchema } from "@packages/api-contracts";
import {
  arbitrationKindOf,
  toDisputeFile,
  toQueueItem,
  type AdminBookingRecord,
  type AdminDisputeRecord,
  type AdminPartyRecord,
} from "./admin-dispute.service";

const D = (s: string) => new Date(s);

function booking(over: Partial<AdminBookingRecord> = {}): AdminBookingRecord {
  return {
    id: "64b000000000000000000001",
    status: "DISPUTED",
    shipperId: "64b000000000000000000010",
    carrierId: "64b000000000000000000020",
    trip: { originCity: "Paris", destinationCity: "Brazzaville", departureAt: D("2026-09-01T10:00:00Z"), transportMode: "PLANE" },
    pricing: { weightKg: 3, transportCents: 4500, commissionCents: 600, premiumCents: 0, totalShipperCents: 5100, currencyCode: "EUR" },
    parcel: { category: "CLOTHES", description: "Vêtements", declaredValueCents: 12000, photoUrls: ["https://ik/p1.jpg"] },
    recipient: { firstName: "Ines", lastName: "M" },
    requestedAt: D("2026-08-20T10:00:00Z"),
    acceptedAt: D("2026-08-21T10:00:00Z"),
    pickedUpAt: D("2026-09-01T08:00:00Z"),
    deliveredAt: D("2026-09-02T18:00:00Z"),
    disputedAt: D("2026-09-03T09:00:00Z"),
    closedAt: null,
    closedBy: null,
    cancelReason: null,
    capturedAt: D("2026-09-01T08:00:01Z"),
    refundedAt: null,
    refundAmountCents: null,
    payoutStatus: "FROZEN",
    payoutAmountCents: null,
    retentionCents: null,
    retentionDisposition: null,
    disputeTicket: "YAM-4821",
    pickup: { confirmedAt: D("2026-09-01T08:00:00Z"), photoUrls: ["https://ik/pick.jpg"], checklist: ["OPENED", "MATCHES"], notes: null },
    trackingEvents: [{ step: "AT_AIRPORT", confirmedAt: D("2026-09-01T12:00:00Z") }],
    deliveryPhotoUrls: ["https://ik/deliv.jpg"],
    ...over,
  };
}

const dispute: AdminDisputeRecord = {
  ticketNumber: "YAM-4821",
  category: "DAMAGED",
  description: "Le colis est arrivé écrasé, le contenu est abîmé sur toute la face avant.",
  desiredOutcome: "PARTIAL_REFUND",
  photoUrls: ["https://ik/d1.jpg"],
  pledgeAcceptedAt: D("2026-09-03T09:00:00Z"),
  status: "OPEN",
  createdAt: D("2026-09-03T09:00:00Z"),
};

function party(id: string, over: Partial<AdminPartyRecord> = {}): AdminPartyRecord {
  return {
    id,
    firstName: "Awa",
    lastName: "Diop",
    email: "awa@example.com",
    shipperRatingsAvg: 4.5,
    shipperRatingsCount: 2,
    shipperCompletedDealsCount: 3,
    shipperLateCancellationsCount: 0,
    carrierPage: null,
    ...over,
  };
}

describe("admin-dispute.service — mapper pur (C-PR1)", () => {
  it("arbitrationKindOf : DISPUTED → DISPUTE, CANCELLED + HELD_FOR_MEDIATION → RETENTION, sinon null", () => {
    expect(arbitrationKindOf({ status: "DISPUTED", retentionDisposition: null })).toBe("DISPUTE");
    expect(arbitrationKindOf({ status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION" })).toBe("RETENTION");
    expect(arbitrationKindOf({ status: "CANCELLED", retentionDisposition: "CARRIER" })).toBeNull();
    expect(arbitrationKindOf({ status: "COMPLETED", retentionDisposition: null })).toBeNull();
  });

  it("toQueueItem : litige → ticket, catégorie, total payé, ouvert à disputedAt (contrat validé)", () => {
    const item = toQueueItem(booking(), dispute, { shipperFirstName: "Awa", carrierFirstName: "Malik" });
    expect(ArbitrationQueueItemSchema.parse(item)).toEqual(item);
    expect(item).toMatchObject({ kind: "DISPUTE", ticketNumber: "YAM-4821", category: "DAMAGED", amountCents: 5100, openedAt: "2026-09-03T09:00:00.000Z" });
  });

  it("toQueueItem : retenue → pas de ticket, montant = retentionCents, ouvert à closedAt", () => {
    const b = booking({ status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", retentionCents: 2550, closedAt: D("2026-09-02T00:00:00Z"), disputedAt: null, disputeTicket: null, payoutStatus: null });
    const item = toQueueItem(b, null, { shipperFirstName: "Awa", carrierFirstName: "Malik" });
    expect(ArbitrationQueueItemSchema.parse(item)).toEqual(item);
    expect(item).toMatchObject({ kind: "RETENTION", ticketNumber: null, category: null, amountCents: 2550, openedAt: "2026-09-02T00:00:00.000Z" });
  });

  it("toQueueItem : version reçue → décidable maintenant ; sinon décidable à ouverture + 72 h", () => {
    const silent = toQueueItem(booking(), { ...dispute, carrierRespondedAt: null }, { shipperFirstName: "a", carrierFirstName: "b" });
    expect(silent).toMatchObject({ carrierResponded: false, decidableAt: "2026-09-06T09:00:00.000Z" });
    const answered = toQueueItem(booking(), { ...dispute, carrierRespondedAt: D("2026-09-03T15:00:00Z") }, { shipperFirstName: "a", carrierFirstName: "b" });
    expect(answered).toMatchObject({ carrierResponded: true, decidableAt: "2026-09-03T09:00:00.000Z" });
  });

  it("toDisputeFile : canDecide suit la réponse ou l'échéance ; la version du Voyageur et la décision sont servies", () => {
    const shipper = party("64b000000000000000000010");
    const carrier = party("64b000000000000000000020");
    const early = toDisputeFile(booking(), dispute, shipper, carrier, D("2026-09-04T09:00:00Z"));
    expect(early).toMatchObject({ canDecide: false, decidableAt: "2026-09-06T09:00:00.000Z", proposedAmounts: { rejectedCarrierPayoutCents: 4500, fullRefundCents: 5100 } });
    const late = toDisputeFile(booking(), dispute, shipper, carrier, D("2026-09-06T09:00:00Z"));
    expect(late?.canDecide).toBe(true);
    const answered = toDisputeFile(
      booking(),
      { ...dispute, status: "CARRIER_RESPONDED", carrierStatement: "Le colis était intact à la remise, voici la photo prise devant le destinataire lui-même.", carrierStatementPhotoUrls: ["https://ik/c1.jpg"], carrierRespondedAt: D("2026-09-03T15:00:00Z") },
      shipper,
      carrier,
      D("2026-09-03T16:00:00Z")
    );
    expect(AdminDisputeFileSchema.parse(answered)).toEqual(answered);
    expect(answered).toMatchObject({ canDecide: true, dispute: { carrierStatement: { photoUrls: ["https://ik/c1.jpg"] } } });
    const decided = toDisputeFile(
      booking({ status: "COMPLETED" }),
      { ...dispute, status: "RESOLVED", resolutionOutcome: "PARTIAL_REFUND", resolutionRefundCents: 2000, resolutionCarrierPayoutCents: 2500, resolutionReason: "x".repeat(50), resolvedAt: D("2026-09-05T09:00:00Z") },
      shipper,
      carrier
    );
    expect(decided).toBeNull(); // COMPLETED : plus dans la file
  });

  it("toDisputeFile : retenue → montants proposés calculés serveur (prorata A79 ou retenue entière)", () => {
    const b = booking({ status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", retentionCents: 2550, closedAt: D("2026-09-02T00:00:00Z"), disputedAt: null, disputeTicket: null, payoutStatus: null });
    const file = toDisputeFile(b, null, party("64b000000000000000000010"), party("64b000000000000000000020"));
    expect(file).toMatchObject({ canDecide: true, proposedAmounts: { compensateCarrierCents: 2250, restituteShipperCents: 2550 } });
  });

  it("toQueueItem : un deal hors arbitrage → null", () => {
    expect(toQueueItem(booking({ status: "COMPLETED" }), null, { shipperFirstName: "a", carrierFirstName: "b" })).toBeNull();
  });

  it("toDisputeFile : dossier complet validé par le contrat, faits du Voyageur lus sur CarrierPage, jamais de code de livraison", () => {
    const shipper = party("64b000000000000000000010");
    const carrier = party("64b000000000000000000020", {
      firstName: "Malik",
      carrierPage: { ratingsAvg: 4.9, ratingsCount: 12, completedDealsCount: 15, lateCancellationsCount: 0 },
    });
    const file = toDisputeFile(booking(), dispute, shipper, carrier);
    expect(file).not.toBeNull();
    expect(AdminDisputeFileSchema.parse(file)).toEqual(file);
    expect(file!.carrier).toMatchObject({ completedDealsCount: 15, ratingsAvg: 4.9, ratingsCount: 12 });
    expect(file!.shipper).toMatchObject({ completedDealsCount: 3, ratingsAvg: 4.5 });
    expect(file!.dispute).toMatchObject({ ticketNumber: "YAM-4821", desiredOutcome: "PARTIAL_REFUND", photoUrls: ["https://ik/d1.jpg"] });
    expect(file!.pickup?.checklist).toEqual(["OPENED", "MATCHES"]);
    expect(file!.money).toMatchObject({ totalShipperCents: 5100, transportCents: 4500, payoutStatus: "FROZEN" });
    expect(JSON.stringify(file)).not.toMatch(/deliveryCode/i);
  });

  it("toDisputeFile : retenue → dispute null, retentionDisposition servie", () => {
    const b = booking({ status: "CANCELLED", retentionDisposition: "HELD_FOR_MEDIATION", retentionCents: 2550, closedAt: D("2026-09-02T00:00:00Z"), closedBy: "SHIPPER", disputedAt: null, disputeTicket: null, payoutStatus: null, pickup: null, deliveredAt: null, pickedUpAt: null, capturedAt: null });
    const file = toDisputeFile(b, null, party("64b000000000000000000010"), party("64b000000000000000000020"));
    expect(AdminDisputeFileSchema.parse(file)).toEqual(file);
    expect(file).toMatchObject({ kind: "RETENTION", dispute: null, pickup: null, money: { retentionCents: 2550, retentionDisposition: "HELD_FOR_MEDIATION" } });
  });
});

/**
 * booking-transport.contract.spec.ts — les contrats d'écriture B3 (D3)
 * ====================================================================
 * Ce que le serveur ACCEPTE et REFUSE à la porte : checklist 5/5,
 * photos 1..5 (URLs), raisons de refus, jalon, code à 6 chiffres.
 */
import {
  ConfirmPickupRequestSchema,
  ConfirmTrackingStepRequestSchema,
  DeliverDealRequestSchema,
  PICKUP_CHECKLIST_ITEMS,
  RefusePickupRequestSchema,
  BOOKING_LIFECYCLE_ERROR_CODES,
} from "@packages/api-contracts";

const ALL = [...PICKUP_CHECKLIST_ITEMS];
const PHOTO = "https://ik.imagekit.io/yamba/deals/pickup/abc.jpg";

describe("ConfirmPickupRequest", () => {
  it("accepte 5/5 + 1 photo (+ notes optionnelles, trim)", () => {
    const r = ConfirmPickupRequestSchema.safeParse({ checklist: ALL, photoUrls: [PHOTO], notes: "  Remis au T2E  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe("Remis au T2E");
  });

  it("refuse une checklist partielle (4/5) — CNF-04", () => {
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: ALL.slice(0, 4), photoUrls: [PHOTO] }).success).toBe(false);
  });

  it("accepte l'ordre libre et les doublons tant que les 5 sont présents", () => {
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: [...ALL].reverse().concat("WEIGHT_OK"), photoUrls: [PHOTO] }).success).toBe(true);
  });

  it("refuse un item inconnu", () => {
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: [...ALL, "LOOKS_FINE"], photoUrls: [PHOTO] }).success).toBe(false);
  });

  it("photos : 0 refusé, 5 accepté, 6 refusé, non-URL refusé", () => {
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: ALL, photoUrls: [] }).success).toBe(false);
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: ALL, photoUrls: Array(5).fill(PHOTO) }).success).toBe(true);
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: ALL, photoUrls: Array(6).fill(PHOTO) }).success).toBe(false);
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: ALL, photoUrls: ["not-a-url"] }).success).toBe(false);
  });

  it("notes : 500 max", () => {
    expect(ConfirmPickupRequestSchema.safeParse({ checklist: ALL, photoUrls: [PHOTO], notes: "x".repeat(501) }).success).toBe(false);
  });
});

describe("RefusePickupRequest", () => {
  it("raison optionnelle parmi 5, inconnue refusée", () => {
    expect(RefusePickupRequestSchema.safeParse({}).success).toBe(true);
    expect(RefusePickupRequestSchema.safeParse({ reason: null }).success).toBe(true);
    expect(RefusePickupRequestSchema.safeParse({ reason: "SUSPICIOUS_CONTENT" }).success).toBe(true);
    expect(RefusePickupRequestSchema.safeParse({ reason: "DONT_LIKE_IT" }).success).toBe(false);
  });
});

describe("ConfirmTrackingStepRequest / DeliverDealRequest", () => {
  it("jalon parmi les 3, inconnu refusé", () => {
    expect(ConfirmTrackingStepRequestSchema.safeParse({ step: "AT_AIRPORT" }).success).toBe(true);
    expect(ConfirmTrackingStepRequestSchema.safeParse({ step: "DELIVERED" }).success).toBe(false);
  });

  it("code : exactement 6 chiffres", () => {
    expect(DeliverDealRequestSchema.safeParse({ code: "742891" }).success).toBe(true);
    expect(DeliverDealRequestSchema.safeParse({ code: "74289" }).success).toBe(false);
    expect(DeliverDealRequestSchema.safeParse({ code: "742 891" }).success).toBe(false);
    expect(DeliverDealRequestSchema.safeParse({ code: 742891 }).success).toBe(false);
  });
});

describe("codes 409 (source unique)", () => {
  it("les 5 codes transport sont dans BOOKING_LIFECYCLE_ERROR_CODES", () => {
    for (const c of ["DELIVERY_CODE_INVALID", "DELIVERY_LOCKED", "DELIVERY_CODE_UNAVAILABLE", "TRACKING_STEP_NOT_ALLOWED", "CODE_REGENERATION_LIMIT"]) {
      expect(BOOKING_LIFECYCLE_ERROR_CODES).toContain(c);
    }
  });
});

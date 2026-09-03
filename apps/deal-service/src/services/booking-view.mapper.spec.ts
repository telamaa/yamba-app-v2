import {
  toShipperBookingView,
  toCarrierBookingView,
  toBookingView,
  type BookingRecord,
  type CounterpartRecord,
} from "./booking-view.mapper";

/**
 * booking-view.mapper.spec.ts — la frontière de sécurité, prouvée (D30)
 * =====================================================================
 * Emplacement : apps/deal-service/src/services/booking-view.mapper.spec.ts
 *
 * Le test cardinal (V3) : on INJECTE volontairement des champs secrets
 * (deliveryCodeHash, deliveryCode en clair) dans le record d'entrée —
 * comme le ferait un document Prisma complet — et on prouve qu'AUCUN ne
 * traverse la vue Carrier. C'est la preuve que le mapper est une liste
 * blanche (résistante au spread), pas un filtre par soustraction.
 *
 * Aucun mock Prisma : le mapper est pur (types structurels), on le
 * teste à nu comme les state machines.
 */

/* ══ Fixtures ═════════════════════════════════════════════════ */

const FUTURE = new Date("2027-01-01T00:00:00.000Z");
const T0 = new Date("2026-07-01T10:00:00.000Z");

const SECRET_HASH = "$2b$10$SECRETHASHSECRETHASHSECRETHASH";
const SECRET_CODE = "482913";

function makeBooking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    id: "665f1c2ab3d4e5f6a7b8c9d0",
    tripId: "665f1c2ab3d4e5f6a7b8c9d1",
    shipperId: "665f1c2ab3d4e5f6a7b8c9d2",
    carrierId: "665f1c2ab3d4e5f6a7b8c9d3",
    status: "ACCEPTED",
    isDeleted: false,
    trip: {
      originCity: "Paris",
      originCountryCode: "FR",
      originTimezone: "Europe/Paris",
      destinationCity: "Brazzaville",
      destinationCountryCode: "CG",
      destinationTimezone: "Africa/Brazzaville",
      departureAt: new Date("2026-08-02T14:00:00.000Z"),
      transportMode: "PLANE",
    },
    pricing: {
      pricingModel: "PER_CATEGORY",
      weightKg: 5,
      categoryPriceCents: 2500,
      pricePerKgCents: null,
      sizeClass: null,
      transportCents: 2500,
      commissionPct: 0.15,
      commissionCents: 500,
      protectionProvider: null,
      protectionTier: null,
      premiumCents: 0,
      totalShipperCents: 3000,
      currencyCode: "EUR",
    },
    parcel: {
      category: "DOCUMENTS",
      categoryFamily: null,
      description: "Dossier administratif",
      declaredValueCents: 10000,
      photoUrls: ["https://r2.example/p1.jpg"],
    },
    recipient: {
      firstName: "Clarisse",
      lastName: "Mabiala",
      phoneE164: "+242061234567",
      email: "clarisse@example.com",
    },
    pickup: null,
    trackingEvents: [],
    requestedAt: T0,
    expiresAt: FUTURE,
    acceptedAt: T0,
    pickedUpAt: null,
    deliveredAt: null,
    payoutDueAt: null,
    completedAt: null,
    closedAt: null,
    closedBy: null,
    declineReason: null,
    codeRegenerations: 0,
    deliveryAttempts: 0,
    deliveryLockedUntil: null,
    disputeTicket: null,
    disputedAt: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  };
}

/** Record "à la Prisma" : AVEC les secrets, comme en base. */
const SECRET_ENCRYPTED = "v1.aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbb.cccccccc";

function makeLeakyBooking(overrides: Partial<BookingRecord> = {}): BookingRecord {
  return {
    ...makeBooking(overrides),
    deliveryCodeHash: SECRET_HASH,
    deliveryCodeEncrypted: SECRET_ENCRYPTED,
    deliveryCode: SECRET_CODE,
  } as unknown as BookingRecord;
}

const SHIPPER: CounterpartRecord = {
  id: "665f1c2ab3d4e5f6a7b8c9d2",
  firstName: "Aminata",
  lastName: "Diallo",
  avatarUrl: "https://r2.example/aminata.jpg",
};

const CARRIER: CounterpartRecord = {
  id: "665f1c2ab3d4e5f6a7b8c9d3",
  firstName: "Thomas",
  lastName: "Nkounkou",
  avatarUrl: null,
};

/* ══ V3 — LE test : rien de secret ne traverse ════════════════ */

describe("frontière carrier — liste blanche résistante au spread (A13)", () => {
  it("le hash et le code injectés dans le record ne traversent JAMAIS la vue Carrier", () => {
    const view = toCarrierBookingView(makeLeakyBooking({ status: "PICKED_UP", pickedUpAt: T0, codeRegenerations: 2 }), SHIPPER);
    const json = JSON.stringify(view);
    expect(json).not.toContain(SECRET_HASH);
    expect(json).not.toContain(SECRET_CODE);
    expect(json).not.toContain(SECRET_ENCRYPTED);
    expect(view).not.toHaveProperty("deliveryCode");
    expect(view).not.toHaveProperty("deliveryCodeEncrypted");
    expect(view).not.toHaveProperty("deliveryCodeHash");
    expect(view).not.toHaveProperty("codeRegenerationsLeft");
    expect(view).not.toHaveProperty("codeRegenerations");
  });

  it("ni le hash ni le chiffré ne traversent la vue Shipper ; sans paramètre, deliveryCode = null (listes)", () => {
    const view = toShipperBookingView(makeLeakyBooking(), CARRIER);
    const json = JSON.stringify(view);
    expect(json).not.toContain(SECRET_HASH);
    expect(json).not.toContain(SECRET_ENCRYPTED);
    expect(view.deliveryCode).toBeNull();
    expect(view).not.toHaveProperty("deliveryCodeEncrypted");
  });

  it("D43 : le code en clair n'apparaît que s'il est PASSÉ par l'appelant (GET /deals/:id, Shipper) — le mapper ne déchiffre rien", () => {
    const view = toShipperBookingView(makeLeakyBooking({ status: "PICKED_UP", pickedUpAt: T0 }), CARRIER, T0, "742891");
    expect(view.deliveryCode).toBe("742891");
    expect(JSON.stringify(view)).not.toContain(SECRET_ENCRYPTED);
    // Le paramètre est ignoré par la vue Carrier (elle ne l'accepte même pas).
    const carrierView = toCarrierBookingView(makeLeakyBooking({ status: "PICKED_UP", pickedUpAt: T0 }), SHIPPER);
    expect(JSON.stringify(carrierView)).not.toContain("742891");
  });

  it("B3 : la checklist du pickup est exposée (vide sur un enregistrement antérieur) et pickupRefusalReason suit les jalons", () => {
    const withChecklist = toShipperBookingView(
      makeBooking({
        status: "PICKED_UP",
        pickedUpAt: T0,
        pickup: { confirmedAt: T0, photoUrls: ["https://ik.imagekit.io/yamba/p.jpg"], notes: null, checklist: ["CONTENT_MATCHES"] },
      }),
      CARRIER
    );
    expect(withChecklist.pickup?.checklist).toEqual(["CONTENT_MATCHES"]);
    const legacy = toCarrierBookingView(
      makeBooking({ status: "PICKED_UP", pickedUpAt: T0, pickup: { confirmedAt: T0, photoUrls: [], notes: null } }),
      SHIPPER
    );
    expect(legacy.pickup?.checklist).toEqual([]);
    const refused = toShipperBookingView(makeBooking({ status: "CANCELLED", pickupRefusalReason: "OVERWEIGHT" }), CARRIER);
    expect(refused.pickupRefusalReason).toBe("OVERWEIGHT");
    expect(toShipperBookingView(makeBooking(), CARRIER).pickupRefusalReason).toBeNull();
  });

  it("B4/A72 : disputeOpensAt = départ + 48 h en PICKED_UP seulement (servi, jamais calculé par le front)", () => {
    const inTransit = toShipperBookingView(makeLeakyBooking({ status: "PICKED_UP", pickedUpAt: T0 }), CARRIER, T0);
    const departure = makeBooking().trip.departureAt.getTime();
    expect(inTransit.disputeOpensAt).toBe(new Date(departure + 48 * 3_600_000).toISOString());
    expect(toShipperBookingView(makeBooking(), CARRIER).disputeOpensAt).toBeNull();
    expect(toShipperBookingView(makeBooking({ status: "DELIVERED" }), CARRIER).disputeOpensAt).toBeNull();
  });

  it("la vue Carrier n'expose ni commission ni total Expéditeur", () => {
    const view = toCarrierBookingView(makeBooking(), SHIPPER);
    expect(view.pricing).not.toHaveProperty("commissionPct");
    expect(view.pricing).not.toHaveProperty("commissionCents");
    expect(view.pricing).not.toHaveProperty("totalShipperCents");
    expect(view.pricing).not.toHaveProperty("premiumCents");
    expect(view.pricing.transportCents).toBe(2500);
  });
});

/* ══ Compteurs dérivés (le serveur est seul juge) ═════════════ */

describe("compteurs dérivés", () => {
  it("codeRegenerationsLeft = MAX(5) − utilisées, côté Shipper", () => {
    const view = toShipperBookingView(makeBooking({ codeRegenerations: 2 }), CARRIER);
    expect(view.codeRegenerationsLeft).toBe(3);
  });

  it("codeRegenerationsLeft est clampé à 0 (jamais négatif)", () => {
    const view = toShipperBookingView(makeBooking({ codeRegenerations: 9 }), CARRIER);
    expect(view.codeRegenerationsLeft).toBe(0);
  });

  it("deliveryAttemptsLeft = MAX(3) − tentatives, côté Carrier, avec lock exposé", () => {
    const lock = new Date("2026-07-01T10:15:00.000Z");
    const view = toCarrierBookingView(
      makeBooking({ deliveryAttempts: 2, deliveryLockedUntil: lock }),
      SHIPPER
    );
    expect(view.deliveryAttemptsLeft).toBe(1);
    expect(view.deliveryLockedUntil).toBe(lock.toISOString());
  });

  it("le Shipper ne voit pas les compteurs de livraison du Carrier", () => {
    const view = toShipperBookingView(makeBooking({ deliveryAttempts: 2 }), CARRIER);
    expect(view).not.toHaveProperty("deliveryAttemptsLeft");
    expect(view).not.toHaveProperty("deliveryLockedUntil");
  });
});

/* ══ allowedActions = machine, par rôle ═══════════════════════ */

describe("allowedActions — le front reflète, ne décide jamais", () => {
  it("PENDING : Shipper [cancel], Carrier [accept, decline]", () => {
    const pending = makeBooking({ status: "PENDING", acceptedAt: null });
    expect(toShipperBookingView(pending, CARRIER).allowedActions).toEqual(["cancel"]);
    expect(toCarrierBookingView(pending, SHIPPER).allowedActions.sort()).toEqual(["accept", "decline"]);
  });

  it("DELIVERED (fenêtre J+4 ouverte) : Shipper [confirmEarly, dispute], Carrier []", () => {
    const delivered = makeBooking({
      status: "DELIVERED",
      pickedUpAt: T0,
      deliveredAt: T0,
      payoutDueAt: FUTURE,
    });
    expect(toShipperBookingView(delivered, CARRIER).allowedActions.sort()).toEqual(["confirmEarly", "dispute"]);
    expect(toCarrierBookingView(delivered, SHIPPER).allowedActions).toEqual([]);
  });
});

/* ══ cancellationPreview — ANN-01 servie, jamais recalculée front ═ */

describe("cancellationPreview — le serveur annonce le remboursement (ANN-01/D39)", () => {
  // Départ fixture : 2026-08-02T14:00Z → seuil 100 % = 2026-07-31T14:00Z.
  const WELL_BEFORE = new Date("2026-07-20T10:00:00.000Z"); // ≥ 48 h avant
  const LATE = new Date("2026-08-01T10:00:00.000Z"); // < 48 h avant

  it("PENDING : libération intégrale — refund = total, retenue 0", () => {
    const pending = makeBooking({ status: "PENDING", acceptedAt: null });
    const view = toShipperBookingView(pending, CARRIER, LATE); // même tardif : l'empreinte n'est pas capturée
    expect(view.cancellationPreview).toEqual({
      refundCents: 3000,
      retentionCents: 0,
      retentionPct: 50,
      fullRefundUntil: "2026-07-31T14:00:00.000Z",
      currencyCode: "EUR",
    });
  });

  it("ACCEPTED à J-2 ou plus : 100 %", () => {
    const view = toShipperBookingView(makeBooking(), CARRIER, WELL_BEFORE);
    expect(view.cancellationPreview?.refundCents).toBe(3000);
    expect(view.cancellationPreview?.retentionCents).toBe(0);
  });

  it("ACCEPTED sous 48 h : retenue 50 %", () => {
    const view = toShipperBookingView(makeBooking(), CARRIER, LATE);
    expect(view.cancellationPreview?.refundCents).toBe(1500);
    expect(view.cancellationPreview?.retentionCents).toBe(1500);
  });

  it("null dès que cancel n'est plus permis (PICKED_UP), et jamais côté Carrier", () => {
    const picked = makeBooking({ status: "PICKED_UP", pickedUpAt: T0 });
    expect(toShipperBookingView(picked, CARRIER, WELL_BEFORE).cancellationPreview).toBeNull();
    const carrierView = toCarrierBookingView(makeBooking(), SHIPPER) as unknown as Record<string, unknown>;
    expect("cancellationPreview" in carrierView).toBe(false);
  });
});

/* ══ Sérialisation & privacy ══════════════════════════════════ */

describe("sérialisation et privacy", () => {
  it("les Date deviennent des ISO strings, les jalons absents restent null", () => {
    const view = toShipperBookingView(makeBooking(), CARRIER);
    expect(view.requestedAt).toBe(T0.toISOString());
    expect(view.acceptedAt).toBe(T0.toISOString());
    expect(view.pickedUpAt).toBeNull();
    expect(view.trip.departureAt).toBe("2026-08-02T14:00:00.000Z");
  });

  it("contrepartie : initiale du nom seulement (privacy PublicTripper)", () => {
    const view = toShipperBookingView(makeBooking(), CARRIER);
    expect(view.carrier).toEqual({
      id: CARRIER.id,
      firstName: "Thomas",
      lastInitial: "N",
      avatarUrl: null,
      publicSlug: null,
    });
    expect(JSON.stringify(view.carrier)).not.toContain("Nkounkou");
  });

  it("A45 : le slug public traverse (lien « Voir profil »), null quand absent", () => {
    const withSlug = toCarrierBookingView(makeBooking(), { ...SHIPPER, publicSlug: "aminata-d" });
    expect(withSlug.shipper.publicSlug).toBe("aminata-d");
    expect(toCarrierBookingView(makeBooking(), SHIPPER).shipper.publicSlug).toBeNull();
  });

  it("contrepartie sans nom : lastInitial = '' (jamais undefined)", () => {
    const view = toShipperBookingView(makeBooking(), { ...CARRIER, lastName: null });
    expect(view.carrier.lastInitial).toBe("");
  });

  it("le destinataire est visible côté Carrier (nécessaire à la livraison)", () => {
    const view = toCarrierBookingView(makeBooking(), SHIPPER);
    expect(view.recipient.phoneE164).toBe("+242061234567");
  });
});

/* ══ Dispatch par rôle ════════════════════════════════════════ */

describe("toBookingView — dispatch", () => {
  it("SHIPPER → vue Shipper (deliveryCode présent), CARRIER → vue Carrier (absent)", () => {
    const b = makeBooking();
    expect(toBookingView(b, "SHIPPER", CARRIER)).toHaveProperty("deliveryCode");
    expect(toBookingView(b, "CARRIER", SHIPPER)).not.toHaveProperty("deliveryCode");
  });
});

import { CreatePaymentIntentRequestSchema, CreatePaymentIntentResponseSchema } from "@packages/api-contracts";

/**
 * ANO-API-12 (recette API 08/09/2026, fiche API-DEAL-02, bloquante) — le plafond
 * `DECLARED_VALUE` (CNF-06 / D71) ne pouvait pas se déclencher à l'autorisation : le service
 * passait `declaredValueCents: 0` en dur. Le refus ne tombait qu'à la création du deal, une
 * fois la carte de l'Expéditeur DÉJÀ pré-autorisée — précisément ce que le commentaire du
 * code (« avant d'autoriser l'argent ») cherchait à éviter.
 *
 * Le contrat doit donc accepter la valeur déclarée, sans la rendre obligatoire : un client
 * qui ne l'envoie pas garde le comportement d'avant.
 */
const base = {
  tripId: "665f1c2ab3d4e5f6a7b8c9d0",
  expectedTotalCents: 2834,
  product: "PARCEL",
  family: "CLOTHES_TEXTILE",
  sizeClass: "M",
  weightKg: 2,
  protection: "BASIC",
};

describe("CreatePaymentIntentRequest — la valeur déclarée voyage dès l'autorisation", () => {
  it("l'accepte quand le client l'envoie", () => {
    const r = CreatePaymentIntentRequestSchema.safeParse({ ...base, declaredValueCents: 500000 });
    expect(r.success).toBe(true);
    expect(r.success && r.data.declaredValueCents).toBe(500000);
  });

  it("reste FACULTATIVE : un client qui ne l'envoie pas n'est pas cassé", () => {
    const r = CreatePaymentIntentRequestSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.success && r.data.declaredValueCents).toBeUndefined();
  });

  it("refuse une valeur négative ou au-delà du plafond absolu de 50 000 €", () => {
    expect(CreatePaymentIntentRequestSchema.safeParse({ ...base, declaredValueCents: -1 }).success).toBe(false);
    expect(CreatePaymentIntentRequestSchema.safeParse({ ...base, declaredValueCents: 50_000_01 }).success).toBe(false);
  });

  it("accepte zéro (aucune valeur déclarée n'est un cas légitime)", () => {
    expect(CreatePaymentIntentRequestSchema.safeParse({ ...base, declaredValueCents: 0 }).success).toBe(true);
  });
});

/**
 * D83 — la réponse PORTE les moyens de paiement que l'empreinte accepte.
 * =======================================================================
 * L'écran de paiement du mobile n'affiche que l'intersection de cette liste et
 * de ce qu'il sait conduire (D83 4A). Deux propriétés du contrat comptent donc
 * autant que la liste elle-même :
 *
 *   • le DÉFAUT est une liste vide, jamais `undefined` : un client n'a pas à
 *     écrire un garde-fou pour un champ que le contrat promet ;
 *   • le champ est RÉTRO-COMPATIBLE : une réponse produite avant D83 (sans le
 *     champ) reste valide, et rend une liste vide — soit « aucun moyen à
 *     proposer », ce qui est exactement le comportement prudent.
 */
const reponse = {
  provider: "STRIPE",
  paymentIntentId: "pi_3ABC",
  clientSecret: "pi_3ABC_secret_xyz",
  amountCents: 1105,
  currencyCode: "EUR",
  // Instantané de prix COMPLET : le contrat exige le modèle, la commission en
  // pourcentage et le total — un devis à moitié rempli n'existe pas côté serveur.
  quote: {
    pricingModel: "PER_KG",
    product: "PARCEL",
    weightKg: 2,
    billableWeightKg: 2.3,
    sizeClass: "S",
    pricePerKgCents: 350,
    transportCents: 805,
    commissionPct: 12,
    commissionCents: 300,
    premiumCents: 0,
    totalShipperCents: 1105,
    currencyCode: "EUR",
    protectionTier: "BASIC",
  },
};

describe("CreatePaymentIntentResponse — les moyens de paiement servis (D83)", () => {
  it("accepte la liste résolue par le fournisseur", () => {
    const r = CreatePaymentIntentResponseSchema.safeParse({
      ...reponse,
      paymentMethodTypes: ["card", "paypal"],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.paymentMethodTypes).toEqual(["card", "paypal"]);
  });

  it("RÉTRO-COMPATIBLE : une réponse sans le champ reste valide et rend une liste VIDE", () => {
    const r = CreatePaymentIntentResponseSchema.safeParse(reponse);
    expect(r.success).toBe(true);
    expect(r.success && r.data.paymentMethodTypes).toEqual([]);
  });

  it("le fournisseur FAKE n'en annonce aucun, et c'est une liste explicite", () => {
    const r = CreatePaymentIntentResponseSchema.safeParse({
      ...reponse,
      provider: "FAKE",
      clientSecret: null,
      paymentMethodTypes: [],
    });
    expect(r.success).toBe(true);
    expect(r.success && r.data.paymentMethodTypes).toEqual([]);
  });

  it("refuse autre chose qu'une liste de chaînes — un moyen n'est jamais un objet", () => {
    expect(
      CreatePaymentIntentResponseSchema.safeParse({ ...reponse, paymentMethodTypes: "card" }).success
    ).toBe(false);
    expect(
      CreatePaymentIntentResponseSchema.safeParse({ ...reponse, paymentMethodTypes: [{ type: "card" }] }).success
    ).toBe(false);
  });
});

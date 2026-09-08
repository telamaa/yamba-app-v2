import { CreatePaymentIntentRequestSchema } from "@packages/api-contracts";

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

/** trust.service.spec.ts — 409 NEW_ACCOUNT_CAP à la réservation (D71 2A). */
import { makeTrustService } from "./trust.service";
import type { TrustDb } from "@packages/libs/trust";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const settings = { get: async () => ({ "trust.newAccountDays": 30, "trust.newAccount.maxDeclaredValueCents": 20_000, "trust.newAccount.maxWeightKg": 8, "trust.newAccount.maxShipmentsPerMonth": 2 }) } as never;
function db(createdAt: Date, month: number): TrustDb {
  return {
    user: { findUnique: async () => ({ createdAt, carrierPage: null }) },
    trip: { findMany: async () => [] },
    booking: { count: async (args) => ((args.where as { createdAt: { gte: Date } }).createdAt.gte.getTime() === NOW.getTime() - 86_400_000 ? 0 : month) },
    report: { count: async () => 0 },
  };
}

describe("trust.service (D71 2A)", () => {
  it("compte neuf dans les limites → rien ; au-delà → 409 NEW_ACCOUNT_CAP typé avec le plafond lu dans les paramètres", async () => {
    const svc = makeTrustService({ db: db(new Date("2026-09-01T00:00:00.000Z"), 1), settings, clock: () => NOW });
    await expect(svc.assertWithinCaps("u1", { declaredValueCents: 15_000, weightKg: 5 })).resolves.toBeUndefined();
    await expect(svc.assertWithinCaps("u1", { declaredValueCents: 25_000, weightKg: 5 })).rejects.toMatchObject({ statusCode: 409, details: { type: "booking", code: "NEW_ACCOUNT_CAP", cap: "DECLARED_VALUE", limit: 20_000, value: 25_000 } });
    await expect(svc.assertWithinCaps("u1", { declaredValueCents: 0, weightKg: 9 })).rejects.toMatchObject({ details: { cap: "WEIGHT", limit: 8 } });
  });
  it("le deuxième envoi du mois passe, le troisième est refusé (plafond 2) ; un compte ancien n'a pas de plafond", async () => {
    await expect(makeTrustService({ db: db(new Date("2026-09-01T00:00:00.000Z"), 2), settings, clock: () => NOW }).assertWithinCaps("u1", { declaredValueCents: 0, weightKg: null })).rejects.toMatchObject({ details: { cap: "SHIPMENTS_PER_MONTH", limit: 2, value: 2 } });
    await expect(makeTrustService({ db: db(new Date("2025-01-01T00:00:00.000Z"), 40), settings, clock: () => NOW }).assertWithinCaps("u1", { declaredValueCents: 400_000, weightKg: 25 })).resolves.toBeUndefined();
  });
});

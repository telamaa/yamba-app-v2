/** trust.rules.spec.ts — le TrustScore interne (D71, REP-04) : règle pure, plafonds, chargement des signaux. */
import { TRUST_PARAMS, checkCaps, computeTrustScore, loadTrustSignals, trustParamsFromSettings, type TrustDb, type TrustSignals } from "@packages/libs/trust";

const base: TrustSignals = { accountAgeDays: 200, disputesLost: 0, lateCancellations: 0, completedDeals: 0, ratingsAvg: 0, ratingsCount: 0, reportsOpen: 0, reportsUpheld: 0, bookingsLast24h: 0, bookingsThisMonth: 0 };

describe("computeTrustScore (D71 1A)", () => {
  it("compte ancien sans signal → STANDARD, score 0, aucun plafond", () => {
    expect(computeTrustScore(base)).toMatchObject({ score: 0, level: "STANDARD", caps: null, capsReason: null, factors: [] });
  });
  it("compte neuf (< 30 j, < 3 deals) → NEW avec les plafonds du compte neuf ; 3 deals terminés le sortent du statut neuf", () => {
    const a = computeTrustScore({ ...base, accountAgeDays: 10 });
    expect(a).toMatchObject({ level: "NEW", capsReason: "NEW_ACCOUNT", caps: { maxDeclaredValueCents: 30_000, maxWeightKg: 10, maxShipmentsPerMonth: 5 } });
    expect(computeTrustScore({ ...base, accountAgeDays: 10, completedDeals: 3 }).level).toBe("STANDARD");
  });
  it("les issues coûteuses pèsent, plafonnées : litiges perdus, annulations, signalements ; les bons deals allègent", () => {
    const risky = computeTrustScore({ ...base, disputesLost: 3, lateCancellations: 4, reportsUpheld: 1 });
    expect(risky.score).toBe(60 + 30 + 15 > 100 ? 100 : 60 + 30 + 15);
    expect(risky.level).toBe("HIGH_RISK");
    expect(risky.capsReason).toBe("HIGH_RISK");
    const watched = computeTrustScore({ ...base, disputesLost: 1, reportsOpen: 1 });
    expect(watched).toMatchObject({ score: 33, level: "WATCH", caps: null });
    const redeemed = computeTrustScore({ ...base, disputesLost: 1, reportsOpen: 1, completedDeals: 5, ratingsAvg: 4.8, ratingsCount: 4 });
    expect(redeemed).toMatchObject({ score: 3, level: "STANDARD" });
    expect(redeemed.factors.map((f) => f.key)).toEqual(["disputesLost", "reportsOpen", "completedDeals", "goodRatings"]);
  });
  it("vélocité : 3 demandes en 24 h ne comptent que pour un compte neuf ; un compte de moins de 7 jours porte un malus", () => {
    expect(computeTrustScore({ ...base, accountAgeDays: 5, bookingsLast24h: 3 }).score).toBe(30);
    expect(computeTrustScore({ ...base, accountAgeDays: 100, bookingsLast24h: 3 }).score).toBe(0);
  });
  it("les paramètres viennent du catalogue D62, les constantes restent le défaut", () => {
    expect(trustParamsFromSettings({})).toEqual(TRUST_PARAMS);
    const p = trustParamsFromSettings({ "trust.newAccountDays": 60, "trust.newAccount.maxWeightKg": 5 });
    expect(p).toEqual({ ...TRUST_PARAMS, newAccountDays: 60, maxWeightKg: 5 });
    expect(computeTrustScore({ ...base, accountAgeDays: 45 }, p).level).toBe("NEW");
  });
});

describe("checkCaps (CNF-06)", () => {
  const capped = computeTrustScore({ ...base, accountAgeDays: 3 });
  it("dans les limites → null ; envois du mois d'abord, puis valeur déclarée, puis poids", () => {
    expect(checkCaps(capped, { declaredValueCents: 10_000, weightKg: 8, bookingsThisMonth: 2 })).toBeNull();
    expect(checkCaps(capped, { declaredValueCents: 10_000, weightKg: 8, bookingsThisMonth: 5 })).toEqual({ cap: "SHIPMENTS_PER_MONTH", limit: 5, value: 5 });
    expect(checkCaps(capped, { declaredValueCents: 45_000, weightKg: 8, bookingsThisMonth: 0 })).toEqual({ cap: "DECLARED_VALUE", limit: 30_000, value: 45_000 });
    expect(checkCaps(capped, { declaredValueCents: 1_000, weightKg: 12, bookingsThisMonth: 0 })).toEqual({ cap: "WEIGHT", limit: 10, value: 12 });
    expect(checkCaps(capped, { declaredValueCents: 1_000, weightKg: null, bookingsThisMonth: 0 })).toBeNull();
  });
  it("sans plafond (compte STANDARD) → jamais de refus", () => {
    expect(checkCaps(computeTrustScore(base), { declaredValueCents: 400_000, weightKg: 25, bookingsThisMonth: 40 })).toBeNull();
  });
});

describe("loadTrustSignals (D71 1A) — faits dénormalisés + comptages, sur un faux Prisma", () => {
  const NOW = new Date("2026-09-05T12:00:00.000Z");
  function db(user: Record<string, unknown> | null, counts: { last24h: number; month: number; open: number; upheld: number }, tripIds: string[] = []): TrustDb & { calls: Record<string, unknown>[] } {
    const calls: Record<string, unknown>[] = [];
    return {
      calls,
      user: { findUnique: async () => user },
      trip: { findMany: async () => tripIds.map((id) => ({ id })) },
      booking: { count: async (args) => { calls.push(args); const w = (args.where as { createdAt: { gte: Date } }).createdAt.gte; return w.getTime() === NOW.getTime() - 86_400_000 ? counts.last24h : counts.month; } },
      report: { count: async (args) => { calls.push(args); return (args.where as { status: string }).status === "OPEN" ? counts.open : counts.upheld; } },
    };
  }
  it("additionne les deux rôles, cible USER + trajets pour les signalements, borne du mois civil en UTC", async () => {
    const user = { createdAt: new Date("2026-08-26T00:00:00.000Z"), shipperDisputesLostCount: 1, shipperLateCancellationsCount: 0, shipperCompletedDealsCount: 2, shipperRatingsAvg: 5, shipperRatingsCount: 1, carrierPage: { disputesLostCount: 1, lateCancellationsCount: 2, completedDealsCount: 4, ratingsAvg: 4, ratingsCount: 3 } };
    const fake = db(user, { last24h: 1, month: 3, open: 2, upheld: 1 }, ["t1", "t2"]);
    const s = await loadTrustSignals(fake, "u1", NOW);
    expect(s).toEqual({ accountAgeDays: 10, disputesLost: 2, lateCancellations: 2, completedDeals: 6, ratingsAvg: 4.3, ratingsCount: 4, reportsOpen: 2, reportsUpheld: 1, bookingsLast24h: 1, bookingsThisMonth: 3 });
    const monthArg = fake.calls.find((c) => (c.where as { createdAt?: { gte: Date } }).createdAt?.gte.getTime() === Date.UTC(2026, 8, 1));
    expect(monthArg).toBeDefined();
    const reportArg = fake.calls.find((c) => (c.where as { status?: string }).status === "OPEN") as { where: { OR: unknown[] } };
    expect(reportArg.where.OR).toEqual([{ targetType: "USER", targetId: "u1" }, { targetType: "TRIP", targetId: { in: ["t1", "t2"] } }]);
  });
  it("membre inconnu → null ; sans page Voyageur, les compteurs absents valent 0", async () => {
    expect(await loadTrustSignals(db(null, { last24h: 0, month: 0, open: 0, upheld: 0 }), "x", NOW)).toBeNull();
    const s = await loadTrustSignals(db({ createdAt: NOW, carrierPage: null }, { last24h: 0, month: 0, open: 0, upheld: 0 }), "u", NOW);
    expect(s).toMatchObject({ accountAgeDays: 0, disputesLost: 0, completedDeals: 0, ratingsAvg: 0, ratingsCount: 0 });
  });
});

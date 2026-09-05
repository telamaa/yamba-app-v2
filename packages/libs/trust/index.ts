/**
 * @packages/libs/trust — le TrustScore INTERNE (D71, met en œuvre D29 ② et REP-04)
 * ==================================================================================
 * Invisible des membres. Calculé SUR LECTURE à partir de faits déjà dénormalisés (litiges perdus,
 * annulations tardives, deals terminés, avis) et de deux comptages (signalements reçus, vélocité).
 * Zéro dépendance : les signaux sont chargés par `load.ts` (Prisma injecté), la règle est pure.
 *
 * Usages exclusifs (REP-04) : plafonds progressifs CNF-06 (compte neuf ou à risque), priorité de
 * la file de revue, aide à la décision admin (fiche membre). JAMAIS une sanction automatique.
 * Signaux exclus (REP-05) : fréquence de connexion, volume brut de trajets.
 */
export type TrustSignals = {
  accountAgeDays: number;
  disputesLost: number;
  lateCancellations: number;
  completedDeals: number;
  ratingsAvg: number;
  ratingsCount: number;
  /** Signalements OUVERTS visant le membre ou ses trajets. */
  reportsOpen: number;
  /** Signalements TRAITÉS (retenus par le support) visant le membre ou ses trajets. */
  reportsUpheld: number;
  /** Demandes de réservation créées dans les dernières 24 h. */
  bookingsLast24h: number;
  /** Demandes de réservation créées depuis le début du mois civil. */
  bookingsThisMonth: number;
};

export type TrustLevel = "NEW" | "STANDARD" | "WATCH" | "HIGH_RISK";
export type TrustFactor = { key: string; points: number; detail: string };
export type TrustCaps = { maxDeclaredValueCents: number; maxWeightKg: number; maxShipmentsPerMonth: number };
export type TrustAssessment = { score: number; level: TrustLevel; factors: TrustFactor[]; caps: TrustCaps | null; capsReason: "NEW_ACCOUNT" | "HIGH_RISK" | null };

/** Paramètres (catalogue D62, groupe `trust`) — les constantes restent les valeurs par défaut. */
export type TrustParams = { newAccountDays: number; maxDeclaredValueCents: number; maxWeightKg: number; maxShipmentsPerMonth: number };
export const TRUST_PARAMS: TrustParams = { newAccountDays: 30, maxDeclaredValueCents: 30_000, maxWeightKg: 10, maxShipmentsPerMonth: 5 };
export function trustParamsFromSettings(v: Record<string, number>): TrustParams {
  return {
    newAccountDays: v["trust.newAccountDays"] ?? TRUST_PARAMS.newAccountDays,
    maxDeclaredValueCents: v["trust.newAccount.maxDeclaredValueCents"] ?? TRUST_PARAMS.maxDeclaredValueCents,
    maxWeightKg: v["trust.newAccount.maxWeightKg"] ?? TRUST_PARAMS.maxWeightKg,
    maxShipmentsPerMonth: v["trust.newAccount.maxShipmentsPerMonth"] ?? TRUST_PARAMS.maxShipmentsPerMonth,
  };
}

/** Pondérations (🚪↔ D71) : des issues coûteuses à falsifier, jamais la présence. */
export const TRUST_WEIGHTS = {
  disputeLost: { points: 25, cap: 60 },
  lateCancellation: { points: 10, cap: 30 },
  reportOpen: { points: 8, cap: 24 },
  reportUpheld: { points: 15, cap: 45 },
  velocityNewAccount: { threshold: 3, points: 20 },
  veryNewAccount: { days: 7, points: 10 },
  completedDeal: { points: -4, cap: -40 },
  goodRatings: { minCount: 3, minAvg: 4.5, points: -10 },
  watchFrom: 30,
  highRiskFrom: 60,
  newAccountMaxDeals: 3,
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Pur : signaux → score 0..100 (plus haut = plus risqué), niveau, facteurs lisibles, plafonds. */
export function computeTrustScore(s: TrustSignals, params: TrustParams = TRUST_PARAMS): TrustAssessment {
  const W = TRUST_WEIGHTS;
  const factors: TrustFactor[] = [];
  const add = (key: string, points: number, detail: string) => { if (points !== 0) factors.push({ key, points, detail }); };
  add("disputesLost", clamp(s.disputesLost * W.disputeLost.points, 0, W.disputeLost.cap), `${s.disputesLost} litige(s) perdu(s) en médiation`);
  add("lateCancellations", clamp(s.lateCancellations * W.lateCancellation.points, 0, W.lateCancellation.cap), `${s.lateCancellations} annulation(s) tardive(s)`);
  add("reportsOpen", clamp(s.reportsOpen * W.reportOpen.points, 0, W.reportOpen.cap), `${s.reportsOpen} signalement(s) ouvert(s)`);
  add("reportsUpheld", clamp(s.reportsUpheld * W.reportUpheld.points, 0, W.reportUpheld.cap), `${s.reportsUpheld} signalement(s) retenu(s) par le support`);
  const isNew = s.accountAgeDays < params.newAccountDays;
  if (isNew && s.bookingsLast24h >= W.velocityNewAccount.threshold) add("velocity", W.velocityNewAccount.points, `${s.bookingsLast24h} demandes en 24 h sur un compte de ${s.accountAgeDays} j`);
  if (s.accountAgeDays < W.veryNewAccount.days) add("veryNewAccount", W.veryNewAccount.points, `compte créé il y a ${s.accountAgeDays} j`);
  add("completedDeals", clamp(s.completedDeals * W.completedDeal.points, W.completedDeal.cap, 0), `${s.completedDeals} deal(s) terminé(s)`);
  if (s.ratingsCount >= W.goodRatings.minCount && s.ratingsAvg >= W.goodRatings.minAvg) add("goodRatings", W.goodRatings.points, `${s.ratingsAvg.toFixed(1)} sur ${s.ratingsCount} avis`);
  const score = clamp(factors.reduce((a, f) => a + f.points, 0), 0, 100);
  const level: TrustLevel = score >= W.highRiskFrom ? "HIGH_RISK" : isNew && s.completedDeals < W.newAccountMaxDeals ? "NEW" : score >= W.watchFrom ? "WATCH" : "STANDARD";
  const capsReason = level === "HIGH_RISK" ? "HIGH_RISK" : level === "NEW" ? "NEW_ACCOUNT" : null;
  const caps = capsReason ? { maxDeclaredValueCents: params.maxDeclaredValueCents, maxWeightKg: params.maxWeightKg, maxShipmentsPerMonth: params.maxShipmentsPerMonth } : null;
  return { score, level, factors, caps, capsReason };
}

export type CapViolation = { cap: "DECLARED_VALUE" | "WEIGHT" | "SHIPMENTS_PER_MONTH"; limit: number; value: number };
/** Pur : la demande dépasse-t-elle un plafond (CNF-06) ? `null` sans plafond ou dans les limites. */
export function checkCaps(a: TrustAssessment, request: { declaredValueCents: number; weightKg: number | null; bookingsThisMonth: number }): CapViolation | null {
  if (!a.caps) return null;
  if (request.bookingsThisMonth >= a.caps.maxShipmentsPerMonth) return { cap: "SHIPMENTS_PER_MONTH", limit: a.caps.maxShipmentsPerMonth, value: request.bookingsThisMonth };
  if (request.declaredValueCents > a.caps.maxDeclaredValueCents) return { cap: "DECLARED_VALUE", limit: a.caps.maxDeclaredValueCents, value: request.declaredValueCents };
  if (request.weightKg !== null && request.weightKg > a.caps.maxWeightKg) return { cap: "WEIGHT", limit: a.caps.maxWeightKg, value: request.weightKg };
  return null;
}
export * from "./load";

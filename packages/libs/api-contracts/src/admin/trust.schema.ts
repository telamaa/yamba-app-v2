/**
 * trust.schema.ts — le TrustScore interne tel que l'admin le lit (D71, REP-04). Jamais servi à un membre.
 */
import { z } from "zod";

export const TrustLevelSchema = z.enum(["NEW", "STANDARD", "WATCH", "HIGH_RISK"]).meta({ id: "TrustLevel" });
export type TrustLevel = z.infer<typeof TrustLevelSchema>;
export const TrustAssessmentSchema = z
  .object({
    score: z.number().int().min(0).max(100).meta({ description: "0 = no risk signal, 100 = maximum; higher is riskier" }),
    level: TrustLevelSchema,
    factors: z.array(z.object({ key: z.string(), points: z.number().int(), detail: z.string() })),
    caps: z.object({ maxDeclaredValueCents: z.number().int(), maxWeightKg: z.number(), maxShipmentsPerMonth: z.number().int() }).nullable(),
    capsReason: z.enum(["NEW_ACCOUNT", "HIGH_RISK"]).nullable(),
    signals: z.object({ accountAgeDays: z.number().int(), disputesLost: z.number().int(), lateCancellations: z.number().int(), completedDeals: z.number().int(), ratingsAvg: z.number(), ratingsCount: z.number().int(), reportsOpen: z.number().int(), reportsUpheld: z.number().int(), bookingsLast24h: z.number().int(), bookingsThisMonth: z.number().int() }),
  })
  .meta({ id: "TrustAssessment", description: "Internal risk score (D29 ②, REP-04): decision support and progressive caps only — never an automatic sanction, never shown to members" });
export type TrustAssessment = z.infer<typeof TrustAssessmentSchema>;

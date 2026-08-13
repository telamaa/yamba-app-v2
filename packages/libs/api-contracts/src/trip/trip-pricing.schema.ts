/**
 * trip-pricing.schema.ts — moteur PER_KG du Trip (D13/D14, A28 — PR socle)
 * ==========================================================================
 * Les 8 familles de risque (CAT-02 v1.2) + la condition par famille du
 * NOUVEAU moteur, et les champs plats du Trip (€/kg, forfaits bagages).
 * Coexistence gravée : l'ancien moteur (CategoryCondition forfaitaire)
 * reste servi tel quel jusqu'à la PR cleanup post-refonte.
 * Ces schémas génèrent l'OAS (D3, registre commun A22) ET valident à
 * l'exécution côté trip-service (une seule source de vérité).
 */
import { z } from "zod";

/** D14 — la famille répond à « qu'est-ce que c'est ? » (risque,
 *  conformité, protection) — plus jamais au prix. Liste FIGÉE CAT-02. */
export const ParcelFamilySchema = z
  .enum([
    "DOCUMENTS_PAPERS",
    "CLOTHES_TEXTILE",
    "FOOD_DRY_SEALED",
    "ELECTRONICS_DEVICES",
    "COSMETICS_CARE",
    "PARTS_TOOLS",
    "TOYS_CHILDCARE",
    "MISC_ACCESSORIES",
  ])
  .meta({
    id: "ParcelFamily",
    description: "D14/CAT-02 — the 8 risk families (conformity/risk/protection, never price)",
  });
export type ParcelFamily = z.infer<typeof ParcelFamilySchema>;

export const FamilyConditionModeSchema = z
  .enum(["ACCEPT", "SURCHARGE", "REFUSE"])
  .meta({
    id: "FamilyConditionMode",
    description: "Carrier stance on a family: accept, surcharge (%), or refuse",
  });
export type FamilyConditionMode = z.infer<typeof FamilyConditionModeSchema>;

export const TripFamilyConditionSchema = z
  .object({
    familyKey: ParcelFamilySchema,
    mode: FamilyConditionModeSchema,
    surchargePct: z.number().int().min(1).max(100).nullish().meta({
      description: "Required when mode=SURCHARGE (e.g. electronics +20%)",
    }),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "SURCHARGE" && value.surchargePct == null) {
      ctx.addIssue({
        code: "custom",
        path: ["surchargePct"],
        message: "surchargePct is required when mode is SURCHARGE.",
      });
    }
  })
  .meta({
    id: "TripFamilyCondition",
    description: "NEW engine family condition (D14) — coexists with legacy CategoryCondition until cleanup",
  });
export type TripFamilyCondition = z.infer<typeof TripFamilyConditionSchema>;

/** Champs plats PER_KG du Trip — UNE source, étalée (...) dans les
 *  surfaces read/create/public pour interdire toute dérive. */
export const tripPerKgPricingFields = {
  pricePerKgCents: z.number().int().positive().nullish().meta({
    description: "D13 — carrier's single price per kg, in cents. Null = legacy PER_CATEGORY trip",
  }),
  checkedBag23PriceCents: z.number().int().positive().nullish().meta({
    description: "PRC-04 — full 23kg checked bag flat rate (consumes 23kg of capacity). Null = not offered",
  }),
  cabinBag12PriceCents: z.number().int().positive().nullish().meta({
    description: "PRC-04 — full 12kg cabin bag flat rate. Null = not offered",
  }),
  capacityKg: z.number().positive().nullish().meta({
    description: "CAP-01/D19 — carrier declared capacity in kg (immutable after publication). Required alongside pricePerKgCents to publish PER_KG (gate A28)",
  }),
  familyConditions: z.array(TripFamilyConditionSchema).nullish().meta({
    description: "D14 — per-family stance (NEW engine). Null/empty = all families accepted",
  }),
};

/**
 * booking-transport.schema.ts — contrats d'ÉCRITURE du transport (B3-PR1)
 * ========================================================================
 * Cinq endpoints, tous adossés à la booking-state-machine (transitions)
 * ou à ses opérations gardées (jalons de tracking, régénération) :
 *   - POST /deals/:id/pickup          — Voyageur : checklist 5/5 + 1..5 photos
 *     (URLs ImageKit — D42) + notes ; ACCEPTED → PICKED_UP ; le serveur
 *     GÉNÈRE le code (bcrypt + AES — D43) et le révèle à l'Expéditeur.
 *   - POST /deals/:id/pickup/refuse   — Voyageur : raison parmi 5 (A40) ;
 *     ACCEPTED → CANCELLED, remboursement INTÉGRAL, kg restitués, sans pénalité.
 *   - POST /deals/:id/events          — Voyageur : jalon optionnel, séquence
 *     stricte (A39) ; pas de transition, outbox `booking.tracking_event`.
 *   - POST /deals/:id/code/regenerate — Expéditeur : nouveau code (≤ 5),
 *     l'ancien est invalidé ; le nouveau code est dans la RÉPONSE (et dans
 *     la vue Shipper), jamais ailleurs.
 *   - POST /deals/:id/deliver         — Voyageur : code à 6 chiffres ;
 *     PICKED_UP → DELIVERED (bcrypt), 3 essais / verrou 15 min (A38).
 *
 * Le code de livraison n'apparaît que dans RegenerateCodeResponse et
 * dans ShipperBookingView.deliveryCode — jamais dans une vue Carrier,
 * un événement ou un email (INV-1).
 */

import { z } from "zod";
import { ObjectIdSchema } from "../common";
import { BookingStatusSchema, TrackingStepSchema } from "./booking.enums";
import { BookingTrackingEventSchema } from "./booking.schema";

/* ══ Pickup ═══════════════════════════════════════════════════ */

/** É4a — les 5 points d'inspection obligatoires (CNF-04). */
export const PICKUP_CHECKLIST_ITEMS = [
  "CONTENT_MATCHES", // « j'ai vu le contenu ouvert, il correspond à la déclaration »
  "WEIGHT_OK",
  "NO_FORBIDDEN",
  "PACKAGING_OK",
  "ITEMS_IDENTIFIED",
] as const;

export const PickupChecklistItemSchema = z.enum(PICKUP_CHECKLIST_ITEMS).meta({
  id: "PickupChecklistItem",
  description: "One of the 5 mandatory inspection items (spec É4a, CNF-04)",
});
export type PickupChecklistItem = z.infer<typeof PickupChecklistItemSchema>;

export const PICKUP_PHOTOS_MIN = 1;
export const PICKUP_PHOTOS_MAX = 5;

export const ConfirmPickupRequestSchema = z
  .object({
    checklist: z
      .array(PickupChecklistItemSchema)
      .refine(
        (items) => PICKUP_CHECKLIST_ITEMS.every((id) => items.includes(id)),
        { message: "All 5 checklist items must be confirmed." }
      )
      .meta({ description: "Must contain ALL 5 items — the server refuses a partial inspection (CNF-04)" }),
    photoUrls: z
      .array(z.string().url())
      .min(PICKUP_PHOTOS_MIN)
      .max(PICKUP_PHOTOS_MAX)
      .meta({ description: "1 to 5 photo URLs already uploaded to ImageKit by the browser (D42)" }),
    notes: z.string().trim().max(500).nullish(),
  })
  .meta({ id: "ConfirmPickupRequest" });
export type ConfirmPickupRequest = z.infer<typeof ConfirmPickupRequestSchema>;

/** É4a — les 5 raisons de refus au pickup (A40, sans pénalité — CNF-07). */
export const PickupRefusalReasonSchema = z
  .enum(["CONTENT_MISMATCH", "SUSPICIOUS_CONTENT", "OVERWEIGHT", "BAD_PACKAGING", "OTHER"])
  .meta({
    id: "PickupRefusalReason",
    description: "The 5 optional refusal reasons offered to the carrier at pickup (spec É4a)",
  });
export type PickupRefusalReason = z.infer<typeof PickupRefusalReasonSchema>;

export const RefusePickupRequestSchema = z
  .object({
    reason: PickupRefusalReasonSchema.nullish().meta({ description: "Optional — one of 5 (spec É4a)" }),
  })
  .meta({ id: "RefusePickupRequest" });
export type RefusePickupRequest = z.infer<typeof RefusePickupRequestSchema>;

/* ══ Jalons de tracking (A+B) ═════════════════════════════════ */

export const ConfirmTrackingStepRequestSchema = z
  .object({
    step: TrackingStepSchema,
  })
  .meta({ id: "ConfirmTrackingStepRequest" });
export type ConfirmTrackingStepRequest = z.infer<typeof ConfirmTrackingStepRequestSchema>;

export const TrackingStepResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    step: TrackingStepSchema,
    confirmedAt: z.iso.datetime(),
    trackingEvents: z.array(BookingTrackingEventSchema).meta({ description: "Full sequence after this confirmation" }),
  })
  .meta({ id: "TrackingStepResponse" });
export type TrackingStepResponse = z.infer<typeof TrackingStepResponseSchema>;

/* ══ Code de livraison ════════════════════════════════════════ */

export const DeliveryCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "The delivery code is 6 digits.")
  .meta({ id: "DeliveryCode", description: "6 decimal digits (100000–999999)" });

export const RegenerateCodeResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    deliveryCode: DeliveryCodeSchema.meta({
      description: "The NEW code — the only write-path surface where it appears (shipper only). The previous code is invalid.",
    }),
    codeRegenerationsLeft: z.number().int(),
  })
  .meta({ id: "RegenerateCodeResponse" });
export type RegenerateCodeResponse = z.infer<typeof RegenerateCodeResponseSchema>;

export const DeliverDealRequestSchema = z
  .object({
    code: DeliveryCodeSchema.meta({ description: "Code given by the recipient — compared with bcrypt server-side" }),
  })
  .meta({ id: "DeliverDealRequest" });
export type DeliverDealRequest = z.infer<typeof DeliverDealRequestSchema>;

export const DeliverDealResponseSchema = z
  .object({
    bookingId: ObjectIdSchema,
    status: BookingStatusSchema.meta({ description: "DELIVERED" }),
    deliveredAt: z.iso.datetime(),
    payoutDueAt: z.iso.datetime().meta({ description: "deliveredAt + 4 days — end of the shipper verification window (B4 payout)" }),
  })
  .meta({ id: "DeliverDealResponse" });
export type DeliverDealResponse = z.infer<typeof DeliverDealResponseSchema>;

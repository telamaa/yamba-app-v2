/**
 * tracking-link.schema.ts — page destinataire (D69)
 * ==================================================
 * Un lien de suivi sans compte, créé par l'Expéditeur, lu par le destinataire. Le contenu public
 * est MINIMAL : jamais l'adresse, un numéro, le code de livraison, des photos ou des montants.
 */
import { z } from "zod";

export const TrackingLinkResponseSchema = z
  .object({
    token: z.string(),
    /** Chemin public côté front : `/track/{token}` (l'hôte est celui du front). */
    path: z.string(),
    recipientFirstName: z.string(),
    /** Le numéro que l'Expéditeur a saisi lui-même à la réservation (son propre input). */
    recipientPhoneE164: z.string().nullable(),
  })
  .meta({ id: "TrackingLinkResponse" });
export type TrackingLinkResponse = z.infer<typeof TrackingLinkResponseSchema>;

export const TRACKING_MILESTONES = ["ACCEPTED", "PICKED_UP", "IN_TRANSIT", "ARRIVED", "DELIVERED", "CLOSED"] as const;
export const TrackingMilestoneSchema = z.enum(TRACKING_MILESTONES).meta({ id: "TrackingMilestone" });
export type TrackingMilestone = z.infer<typeof TrackingMilestoneSchema>;

export const PublicTrackingResponseSchema = z
  .object({
    milestone: TrackingMilestoneSchema,
    /** Jalons atteints, dans l'ordre, avec leur date. */
    steps: z.array(z.object({ key: TrackingMilestoneSchema, at: z.string().datetime() })),
    recipientFirstName: z.string(),
    shipperFirstName: z.string(),
    carrier: z.object({ firstName: z.string(), lastInitial: z.string() }),
    corridor: z.object({ originCity: z.string(), destinationCity: z.string() }),
    departureAt: z.string().datetime().nullable(),
    arrivalAt: z.string().datetime().nullable(),
  })
  .meta({ id: "PublicTrackingResponse", description: "D69 — recipient tracking page: minimal content, no address, no phone, no delivery code" });
export type PublicTrackingResponse = z.infer<typeof PublicTrackingResponseSchema>;

/**
 * admin-pilotage.schema.ts — pilotage côté admin (C-PR6a, D59)
 * =============================================================
 * Courbes et corridors calculés serveur depuis les modèles (1A, 2A), chronologie complète
 * d'un deal (5A). Rien n'est estimé : chaque point est un comptage de champs datés.
 */
import { z } from "zod";
import { ObjectIdSchema } from "../common";

export const PilotageGranularitySchema = z.enum(["week", "month"]).meta({ id: "PilotageGranularity", description: "Semaines ISO (lundi, UTC) ou mois UTC" });
export type PilotageGranularity = z.infer<typeof PilotageGranularitySchema>;

export const PilotageSeriesPointSchema = z
  .object({
    period: z.string().describe("YYYY-MM (mois) ou YYYY-Www (semaine ISO)"),
    periodStart: z.string().datetime(),
    signups: z.number().int(),
    tripsPublished: z.number().int(),
    requests: z.number().int(),
    accepted: z.number().int(),
    delivered: z.number().int(),
    completed: z.number().int(),
    cancelled: z.number().int(),
    disputes: z.number().int(),
    volume: z.array(z.object({ currencyCode: z.string(), capturedCents: z.number().int() })).describe("Encaissé (capture) par devise"),
  })
  .meta({ id: "PilotageSeriesPoint" });
export type PilotageSeriesPoint = z.infer<typeof PilotageSeriesPointSchema>;

export const PilotageSeriesResponseSchema = z
  .object({
    granularity: PilotageGranularitySchema,
    from: z.string().datetime(),
    to: z.string().datetime(),
    points: z.array(PilotageSeriesPointSchema).describe("Du plus ancien au plus récent, périodes vides incluses"),
    totals: z.object({ users: z.number().int(), carriersReady: z.number().int().describe("Comptes Stripe avec virements activés"), tripsPublishedOpen: z.number().int() }),
    generatedAt: z.string().datetime(),
    cached: z.boolean(),
  })
  .meta({ id: "PilotageSeriesResponse" });
export type PilotageSeriesResponse = z.infer<typeof PilotageSeriesResponseSchema>;

export const CorridorStatSchema = z
  .object({
    key: z.string().describe("ville>ville normalisées"),
    originCity: z.string(),
    originCountryCode: z.string().nullable(),
    destinationCity: z.string(),
    destinationCountryCode: z.string().nullable(),
    tripsPublished: z.number().int(),
    requests: z.number().int(),
    accepted: z.number().int(),
    acceptanceRatePct: z.number().nullable(),
    avgPricePerKgCents: z.number().int().nullable(),
    currencyCode: z.string().nullable(),
    disputes: z.number().int(),
    views: z.number().int().describe("Vues des pages de trajets du corridor sur la période (Redis)"),
    searches: z.number().int().describe("Recherches sur ce corridor (Redis)"),
    searchesNoResult: z.number().int().describe("Recherches sans aucun trajet (Redis) — demande sans offre"),
  })
  .meta({ id: "CorridorStat" });
export type CorridorStat = z.infer<typeof CorridorStatSchema>;
export const CorridorsResponseSchema = z
  .object({ periodDays: z.number().int(), from: z.string().datetime(), items: z.array(CorridorStatSchema), generatedAt: z.string().datetime(), cached: z.boolean() })
  .meta({ id: "CorridorsResponse" });
export type CorridorsResponse = z.infer<typeof CorridorsResponseSchema>;

export const DealHistorySourceSchema = z.enum(["OUTBOX", "ADMIN", "NOTIFICATION", "EMAIL"]).meta({ id: "DealHistorySource" });
export const DealHistoryEventSchema = z
  .object({
    at: z.string().datetime(),
    source: DealHistorySourceSchema,
    type: z.string().describe("eventType outbox, action admin, type de notification ou template d'email"),
    actor: z.string().nullable().describe("SHIPPER / CARRIER / SYSTEM / ADMIN, ou le nom court de l'admin"),
    recipient: z.string().nullable().describe("Notification / email : SHIPPER ou CARRIER"),
    summary: z.record(z.string(), z.unknown()).describe("Sous-ensemble WHITELISTÉ du payload — jamais un code, un secret ou une photo"),
    relay: z.object({ publishedAt: z.string().datetime().nullable(), attempts: z.number().int(), parked: z.boolean(), lastError: z.string().nullable() }).nullable().describe("Outbox seulement"),
    status: z.string().nullable().describe("Email : PENDING / SENT / FAILED · notification : lue ou non"),
  })
  .meta({ id: "DealHistoryEvent" });
export type DealHistoryEvent = z.infer<typeof DealHistoryEventSchema>;
export const DealHistoryResponseSchema = z
  .object({ bookingId: ObjectIdSchema, events: z.array(DealHistoryEventSchema), counts: z.object({ outbox: z.number().int(), admin: z.number().int(), notifications: z.number().int(), emails: z.number().int(), parked: z.number().int() }), generatedAt: z.string().datetime() })
  .meta({ id: "DealHistoryResponse", description: "Tout ce qui est arrivé à ce deal (D59 5A), lecture seule, consultation journalisée" });
export type DealHistoryResponse = z.infer<typeof DealHistoryResponseSchema>;

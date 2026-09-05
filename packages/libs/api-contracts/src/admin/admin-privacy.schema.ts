/**
 * admin-privacy.schema.ts — droits sur les données (C-PR8b, D63)
 * ==============================================================
 * Côté membre : sudo par code email, export JSON, effacement. Côté admin (PRIVACY) : registre des
 * demandes, effacement à la demande. Les motifs de refus d'un effacement sont une liste FERMÉE :
 * le front les traduit, le serveur ne rédige pas.
 */
import { z } from "zod";

export const ERASURE_CONFIRMATION_WORD = "SUPPRIMER";
export const ERASURE_REASON_MIN_LENGTH = 20;
export const DATA_EXPORT_MIN_INTERVAL_HOURS = 24;

export const ERASURE_BLOCKERS = ["ACTIVE_DEAL", "PENDING_REQUEST", "PAYOUT_PENDING", "RETENTION_HELD", "PUBLISHED_TRIP", "ADMIN_ACCOUNT"] as const;
export const ErasureBlockerSchema = z.enum(ERASURE_BLOCKERS).meta({ id: "ErasureBlocker", description: "Why an account cannot be erased yet (D63 3A) — closed list, translated by the client" });
export type ErasureBlocker = z.infer<typeof ErasureBlockerSchema>;

export const ErasureBlockedResponseSchema = z
  .object({ code: z.literal("ERASURE_BLOCKED"), blockers: z.array(ErasureBlockerSchema), counts: z.record(z.string(), z.number().int()) })
  .meta({ id: "ErasureBlockedResponse" });
export type ErasureBlockedResponse = z.infer<typeof ErasureBlockedResponseSchema>;

/** D65 : les gestes sensibles passent par la fenêtre sudo (`POST /auth/me/sudo/verify`), plus de code dans le corps. */
export const EraseMyAccountRequestSchema = z
  .object({ confirmation: z.literal(ERASURE_CONFIRMATION_WORD) })
  .meta({ id: "EraseMyAccountRequest" });
export type EraseMyAccountRequest = z.infer<typeof EraseMyAccountRequestSchema>;

export const UpdateMyPreferencesRequestSchema = z
  .object({ messagingReminderEmails: z.boolean().optional() })
  .meta({ id: "UpdateMyPreferencesRequest", description: "Member preferences (D63 8A)" });
export type UpdateMyPreferencesRequest = z.infer<typeof UpdateMyPreferencesRequestSchema>;

export const AdminEraseUserRequestSchema = z
  .object({ reason: z.string().trim().min(ERASURE_REASON_MIN_LENGTH).max(500) })
  .meta({ id: "AdminEraseUserRequest", description: "Erasure on behalf of a member (request received by email) — PRIVACY or SUPER_ADMIN, journaled" });
export type AdminEraseUserRequest = z.infer<typeof AdminEraseUserRequestSchema>;

export const DataRequestItemSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    userLabel: z.string().meta({ description: "First name + initial, or « Membre supprimé »" }),
    type: z.enum(["EXPORT", "ERASURE"]),
    channel: z.enum(["MEMBER", "ADMIN"]),
    status: z.enum(["DONE", "REFUSED"]),
    refusalReasons: z.array(z.string()),
    requestedByAdmin: z.string().nullable(),
    reason: z.string().nullable(),
    requestedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
  })
  .meta({ id: "DataRequestItem" });
export type DataRequestItem = z.infer<typeof DataRequestItemSchema>;
export const DataRequestsResponseSchema = z.object({ items: z.array(DataRequestItemSchema), nextCursor: z.string().nullable() }).meta({ id: "DataRequestsResponse" });
export type DataRequestsResponse = z.infer<typeof DataRequestsResponseSchema>;

/** Ce que le fichier d'export contient — décrit en OpenAPI, produit par l'auth-service (D63 2A). */
export const DataExportSchema = z
  .object({
    exportedAt: z.string().datetime(),
    format: z.literal("yamba-data-export/1"),
    profile: z.record(z.string(), z.unknown()),
    preferences: z.record(z.string(), z.unknown()),
    addresses: z.array(z.record(z.string(), z.unknown())),
    consents: z.array(z.record(z.string(), z.unknown())),
    carrierProfile: z.record(z.string(), z.unknown()).nullable(),
    trips: z.array(z.record(z.string(), z.unknown())),
    bookings: z.array(z.record(z.string(), z.unknown())),
    reviewsGiven: z.array(z.record(z.string(), z.unknown())),
    reviewsReceived: z.array(z.record(z.string(), z.unknown())),
    messages: z.array(z.record(z.string(), z.unknown())),
    meetups: z.array(z.record(z.string(), z.unknown())),
    phoneReveals: z.array(z.record(z.string(), z.unknown())),
    savedRoutes: z.array(z.record(z.string(), z.unknown())),
    favorites: z.array(z.record(z.string(), z.unknown())),
    following: z.array(z.record(z.string(), z.unknown())),
    notifications: z.array(z.record(z.string(), z.unknown())),
    reportsMade: z.array(z.record(z.string(), z.unknown())),
    dataRequests: z.array(z.record(z.string(), z.unknown())),
  })
  .meta({ id: "DataExport", description: "What belongs to the member (D63 2A): never the counterpart's contact details, the delivery code, reports targeting the member, internal notes or mediation files" });
export type DataExport = z.infer<typeof DataExportSchema>;

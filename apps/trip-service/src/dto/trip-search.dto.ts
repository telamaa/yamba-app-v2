import { z } from "zod";

// ─── Enums acceptés ──────────────────────────────────

export const TRANSPORT_MODES = ["all", "plane", "train", "car"] as const;

export const SORT_OPTIONS = ["earliest", "lowestPrice", "bestRated"] as const;

export const PARCEL_CATEGORIES = [
  "clothes",
  "shoes",
  "fashion-accessories",
  "other-accessories",
  "books",
  "documents",
  "small-toys",
  "phone",
  "computer",
  "other-electronics",
  "checked-bag-23kg",
  "cabin-bag-12kg",
] as const;

export const DEPARTURE_BUCKETS = [
  "earlyMorning",
  "morning",
  "afternoon",
  "evening",
] as const;

export const LOCALES = ["fr", "en"] as const;

// ─── Helpers de transformation ───────────────────────

/**
 * Boolean depuis query string : "true"|"false" → boolean.
 * Tout ce qui n'est pas "true" devient false (sécurité).
 */
const boolFromQuery = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

/**
 * CSV → array<enum>. Filtre silencieusement les valeurs invalides
 * pour éviter qu'un client mal codé fasse planter la search.
 */
const csvOf = <T extends readonly [string, ...string[]]>(allowed: T) =>
  z
    .string()
    .optional()
    .transform((raw) => {
      if (!raw) return [] as T[number][];
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is T[number] => allowed.includes(s as T[number]));
    });

/**
 * ISO date string → Date. Refuse si format invalide.
 */
const isoDate = z
  .string()
  .optional()
  .transform((s) => (s ? new Date(s) : undefined))
  .refine((d) => d === undefined || !Number.isNaN(d.getTime()), {
    message: "Invalid date format (expected ISO 8601)",
  });

// ─── Schema : GET /trips/search ──────────────────────

export const searchTripsQuerySchema = z.object({
  mode: z.enum(TRANSPORT_MODES).optional().default("all"),
  from: z.string().trim().min(1).max(100).optional(),
  to: z.string().trim().min(1).max(100).optional(),
  dateFrom: isoDate,
  dateTo: isoDate,
  sort: z.enum(SORT_OPTIONS).optional().default("earliest"),

  // Soft toggles (n'affectent pas les counts de facets de leur propre catégorie)
  superTripper: boolFromQuery,
  profileVerified: boolFromQuery,
  instantBooking: boolFromQuery,
  verifiedTicket: boolFromQuery,

  // Multi-select via CSV
  categories: csvOf(PARCEL_CATEGORIES),
  departureBuckets: csvOf(DEPARTURE_BUCKETS),

  // Pagination cursor-based
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),

  // Formatage côté serveur (dates locale-aware)
  locale: z.enum(LOCALES).optional().default("fr"),
});

export type SearchTripsQuery = z.infer<typeof searchTripsQuerySchema>;

// ─── Schema : GET /trips/search/facets ───────────────

/**
 * Note : pas de superTripper/profileVerified/instantBooking/verifiedTicket
 * dans les facets — c'est précisément ce qu'on veut COMPTER, donc ils doivent
 * rester non-filtrés dans le baseWhere des facets.
 */
export const searchFacetsQuerySchema = z.object({
  mode: z.enum(TRANSPORT_MODES).optional().default("all"),
  from: z.string().trim().min(1).max(100).optional(),
  to: z.string().trim().min(1).max(100).optional(),
  dateFrom: isoDate,
  dateTo: isoDate,
  categories: csvOf(PARCEL_CATEGORIES),
  departureBuckets: csvOf(DEPARTURE_BUCKETS),
  locale: z.enum(LOCALES).optional().default("fr"),
});

export type SearchFacetsQuery = z.infer<typeof searchFacetsQuerySchema>;

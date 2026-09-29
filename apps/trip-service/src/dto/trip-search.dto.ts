import { z } from "zod";

// ─── Enums acceptés ──────────────────────────────────

export const TRANSPORT_MODES = ["all", "plane", "train", "car"] as const;

// D80 — `relevance` est le DÉFAUT du contrat : le flux d'atterrissage localisé (anneaux de
// proximité à l'ancrage + score qualité), et pertinence = qualité seule quand `from` est saisi.
// Le front ne décide pas : un client qui n'envoie rien reçoit la pertinence.
export const SORT_OPTIONS = ["relevance", "earliest", "lowestPrice", "bestRated"] as const;

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

/** D14 — familles de risque (miroir ParcelFamily Prisma) */
export const PARCEL_FAMILIES = [
  "DOCUMENTS_PAPERS",
  "CLOTHES_TEXTILE",
  "FOOD_DRY_SEALED",
  "ELECTRONICS_DEVICES",
  "COSMETICS_CARE",
  "PARTS_TOOLS",
  "TOYS_CHILDCARE",
  "MISC_ACCESSORIES",
] as const;
export type ParcelFamily = (typeof PARCEL_FAMILIES)[number];

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
  // ANO-API-11 bis / ANO-API-10 (recette API 08/09/2026) — un mode inconnu est IGNORÉ,
  // comme le sont déjà les catégories et les tranches horaires inconnues (`csvOf`). Un
  // z.enum strict faisait répondre 400 à un lien partagé ou à une ancienne version de
  // l'application portant un mode retiré du catalogue : une recherche dégrade, elle ne
  // casse pas.
  mode: z.enum(TRANSPORT_MODES).optional().default("all").catch("all"),
  from: z.string().trim().min(1).max(100).optional(),
  to: z.string().trim().min(1).max(100).optional(),
  dateFrom: isoDate,
  dateTo: isoDate,
  // D80 — défaut `relevance` ; un tri inconnu DÉGRADE sur le défaut (même doctrine que `mode`,
  // ANO-API-10 : un lien partagé portant un tri retiré du catalogue ne casse pas la recherche).
  sort: z.enum(SORT_OPTIONS).optional().default("relevance").catch("relevance"),

  // D80 1A — l'ancrage envoyé par le client (adresse du membre, geste « Autour de moi »,
  // dernière recherche mémorisée côté client). Les DEUX coordonnées ou rien : une moitié
  // d'ancrage est ignorée par le contrôleur (dégrade, ne casse pas). Jamais journalisé.
  nearLat: z.coerce.number().min(-90).max(90).optional().catch(undefined),
  nearLng: z.coerce.number().min(-180).max(180).optional().catch(undefined),
  // Le pays de l'ancrage (ISO 3166-1 alpha-2) : sans lui, un trajet SANS coordonnées ne peut
  // jamais ringuer COUNTRY/REGION face à un ancrage `near` (mesuré sur le seed le 29/09).
  nearCountry: z
    .string()
    .regex(/^[a-zA-Z]{2}$/)
    .transform((s) => s.toUpperCase())
    .optional()
    .catch(undefined),

  // Soft toggles (n'affectent pas les counts de facets de leur propre catégorie)
  superTripper: boolFromQuery,
  profileVerified: boolFromQuery,
  instantBooking: boolFromQuery,
  verifiedTicket: boolFromQuery,

  // Multi-select via CSV
  categories: csvOf(PARCEL_CATEGORIES),
  // D33 — filtre famille : exclut les trajets qui REFUSENT une des familles
  families: csvOf(PARCEL_FAMILIES),
  // D33 V2 — poids du colis de l'Expéditeur (kg) : prix par carte, tri et
  // exclusion des trajets sans assez de capacité
  weightKg: z.coerce.number().min(0.5).max(30).optional(),
  departureBuckets: csvOf(DEPARTURE_BUCKETS),

  // Pagination cursor-based — le curseur est l'id du dernier trip de la page.
  // ANO-API-01 (recette API 08/09/2026) : sans contrainte de format, un curseur
  // non hexadécimal (« null » renvoyé tel quel par un client, cas le plus courant)
  // atteignait Prisma et remontait en 500 P2023 « Malformed ObjectID ». Le format
  // est donc validé ici, comme `limit` juste en dessous : le refus est un 400.
  // Une chaîne VIDE vaut « pas de curseur » : un client qui envoie toujours le
  // paramètre (`?cursor=`) demande la première page, il ne se trompe pas.
  // Deux formes : l'id du dernier trip de la page (tri indexé), OU le curseur-offset `o:<n>`
  // des tris calculés en mémoire (D33 prix-au-poids, D80 pertinence). ANO-API-24 (mesuré le
  // 29/09/2026) : la regex ne connaissait QUE la forme 24-hex — le `nextCursor` `o:<n>` rendu
  // par le tri prix-au-poids était refusé 400 au retour, la page 2 de ce tri était inatteignable.
  cursor: z
    .string()
    .regex(/^([0-9a-fA-F]{24}|o:\d{1,6})$/, "Curseur invalide (ObjectId 24 hex ou offset o:<n>)")
    .optional()
    .or(z.literal("").transform(() => undefined)),
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
  // ANO-API-11 bis / ANO-API-10 (recette API 08/09/2026) — un mode inconnu est IGNORÉ,
  // comme le sont déjà les catégories et les tranches horaires inconnues (`csvOf`). Un
  // z.enum strict faisait répondre 400 à un lien partagé ou à une ancienne version de
  // l'application portant un mode retiré du catalogue : une recherche dégrade, elle ne
  // casse pas.
  mode: z.enum(TRANSPORT_MODES).optional().default("all").catch("all"),
  from: z.string().trim().min(1).max(100).optional(),
  to: z.string().trim().min(1).max(100).optional(),
  dateFrom: isoDate,
  dateTo: isoDate,
  categories: csvOf(PARCEL_CATEGORIES),
  families: csvOf(PARCEL_FAMILIES),
  weightKg: z.coerce.number().min(0.5).max(30).optional(),
  departureBuckets: csvOf(DEPARTURE_BUCKETS),
  locale: z.enum(LOCALES).optional().default("fr"),
});

export type SearchFacetsQuery = z.infer<typeof searchFacetsQuerySchema>;

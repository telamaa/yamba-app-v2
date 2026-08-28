import { z } from "zod";
import { ObjectIdSchema } from "../common";

/**
 * @packages/api-contracts — trip search schemas
 * =============================================
 * Recherche publique : GET /trips/search + GET /trips/search/facets.
 * Miroirs de dto/trip-search.dto.ts (query) et lib/trip-mappers.ts
 * (YambaTripResultDto) côté trip-service.
 *
 * ⚠️ Les valeurs sont en convention UI (kebab-case / camelCase),
 * PAS les enums Prisma : la conversion se fait dans trip-mappers.ts.
 */

/* ══ Enums UI ═════════════════════════════════════════════════ */

export const UiTransportModeSchema = z
  .enum(["plane", "train", "car"])
  .meta({ id: "UiTransportMode", description: "Mode de transport en convention UI (≠ enum Prisma)" });
export type UiTransportMode = z.infer<typeof UiTransportModeSchema>;

export const TransportModeFilterSchema = z
  .enum(["all", "plane", "train", "car"])
  .meta({ id: "TransportModeFilter", description: "Filtre mode de la recherche (all = tous)" });

export const SortOptionSchema = z
  .enum(["earliest", "lowestPrice", "bestRated"])
  .meta({
    id: "SortOption",
    description: "Tri des résultats. lowestPrice trie sur comparablePriceCents (D33 : colis de référence 2 kg) et exclut les trips sans valeur.",
  });

export const UiParcelCategorySchema = z
  .enum([
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
  ])
  .meta({ id: "UiParcelCategory", description: "Catégorie colis en convention UI (kebab-case)" });

export const DepartureBucketSchema = z
  .enum(["earlyMorning", "morning", "afternoon", "evening"])
  .meta({
    id: "DepartureBucket",
    description:
      "Tranche horaire de départ (heure locale) : earlyMorning 04-08h59 · morning 09-11h59 · afternoon 12-17h59 · evening 18h-03h59",
  });

export const SearchLocaleSchema = z
  .enum(["fr", "en"])
  .meta({ id: "SearchLocale", description: "Locale de formatage serveur des dates (défaut fr)" });

/* ══ Résultat de recherche (YambaTripResultDto) ═══════════════ */

export const YambaTripResultSchema = z
  .object({
    id: ObjectIdSchema,
    fromCity: z.string(),
    fromCityCode: z.string().optional(),
    fromCountry: z.string().optional(),
    toCity: z.string(),
    toCityCode: z.string().optional(),
    toCountry: z.string().optional(),
    travelDate: z.string().meta({ example: "12 juin 2026", description: "Formaté serveur selon locale" }),
    departureTime: z.string().meta({ example: "08:00" }),
    arrivalTime: z.string().meta({ example: "14:30" }),
    nextDay: z.boolean().optional().meta({ description: "Arrivée le lendemain (absent si false)" }),
    durationMinutes: z.number().int().optional(),
    stopovers: z.number().int().optional(),
    stopoverCity: z.string().optional().meta({ description: "Présent uniquement si exactement 1 escale" }),
    minPrice: z.number().meta({ description: "En unités (euros), PAS en centimes — déjà divisé par 100. 0 pour un trip PER_KG (voir pricePerKg)" }),
    pricePerKg: z.number().nullish().meta({ description: "D13 — moteur PER_KG : prix au kilo en unités (euros). Null = trip legacy PER_CATEGORY" }),
    remainingKg: z.number().nullish().meta({ description: "CAP-02 — capacityKg − reservedKg, dérivé. Null si legacy" }),
    weightKg: z.number().optional().meta({ description: "D33 V2 — écho du poids saisi par l'Expéditeur (kg) ; absent sinon" }),
    transportForWeight: z.number().nullish().meta({ description: "D33 V2 — transport (net Voyageur) pour ce poids, en euros. Null = aucun moteur" }),
    totalForWeight: z.number().nullish().meta({ description: "D33 V2 — total Expéditeur (transport + service D16) pour ce poids, en euros" }),
    familyConditions: z
      .array(
        z.object({
          familyKey: z.string(),
          mode: z.enum(["SURCHARGE", "REFUSE"]),
          surchargePct: z.number().int().nullish(),
        })
      )
      .optional()
      .meta({ description: "D14 — positions ≠ ACCEPT du Voyageur (compact). Absent/vide = tout accepté" }),
    pricesByCategory: z.record(z.string(), z.number()).meta({
      description: "Clés = UiParcelCategory, valeurs en unités (euros)",
    }),
    currency: z.string().meta({ example: "€", description: "Symbole, pas le code ISO" }),
    transportMode: UiTransportModeSchema,
    allowedCategories: z.array(UiParcelCategorySchema),
    remainingSlots: z.number().int().optional().meta({ description: "Absent si capacité illimitée (maxSlots null)" }),
    superTripper: z.boolean(),
    profileVerified: z.boolean(),
    instantBooking: z.boolean(),
    verifiedTicket: z.boolean(),
    rating: z.number().optional().meta({ description: "Absent si ratingsCount = 0 (jamais de 0,0)" }),
    reviewCount: z.number().int().optional(),
    travelerFirstName: z.string().optional(),
    travelerLastName: z.string().optional().meta({ description: "Initiale uniquement (privacy)" }),
    travelerAvatarUrl: z.string().optional(),
  })
  .meta({ id: "YambaTripResult", description: "Carte résultat de recherche (DTO UI)" });
export type YambaTripResult = z.infer<typeof YambaTripResultSchema>;

/* ══ Réponses ═════════════════════════════════════════════════ */

/** GET /trips/search — 200. ⚠️ Pas de champ `success` (fidèle au réel). */
export const SearchTripsResponseSchema = z
  .object({
    trips: z.array(YambaTripResultSchema),
    nextCursor: z.string().nullable().meta({
      description: "id du dernier trip de la page — null si dernière page (pagination cursor-based)",
    }),
    totalCount: z.number().int(),
  })
  .meta({ id: "SearchTripsResponse" });

/** GET /trips/search/facets — 200. ⚠️ Pas de champ `success` (fidèle au réel). */
export const SearchFacetsResponseSchema = z
  .object({
    totalCount: z.number().int().meta({ description: "Count avec le filtre mode appliqué" }),
    modeCount: z.object({
      all: z.number().int(),
      plane: z.number().int(),
      train: z.number().int(),
      car: z.number().int(),
    }).meta({ description: "Counts par mode, calculés SANS le filtre mode courant" }),
    superTripperCount: z.number().int(),
    profileVerifiedCount: z.number().int(),
    instantBookingCount: z.number().int(),
    verifiedTicketCount: z.number().int(),
    familyCounts: z
      .record(z.string(), z.number().int())
      .optional()
      .meta({ description: "D33 — par ParcelFamily : trips qui NE refusent PAS la famille (base sans filtre famille)" }),
  })
  .meta({ id: "SearchFacetsResponse" });

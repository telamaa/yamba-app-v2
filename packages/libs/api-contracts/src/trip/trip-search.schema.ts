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
  .enum(["relevance", "earliest", "lowestPrice", "bestRated"])
  .meta({
    id: "SortOption",
    description:
      "Tri des résultats — DÉFAUT : relevance (D80, flux d'atterrissage localisé : anneaux de proximité à l'ancrage + score qualité ; qualité seule quand `from` est saisi). lowestPrice trie sur comparablePriceCents (D33 : colis de référence 2 kg). Un tri inconnu dégrade sur relevance.",
  });

export const ProximityRingSchema = z
  .enum(["SAME_CITY", "NEARBY", "REGION", "COUNTRY", "ELSEWHERE"])
  .meta({
    id: "ProximityRing",
    description:
      "D80 — anneau de proximité du départ du trajet à l'ancrage de l'utilisateur : SAME_CITY < 25 km · NEARBY < 100 km · REGION < 300 km même pays · COUNTRY même pays · ELSEWHERE. Les fronts en font les en-têtes de sections.",
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
    fromCountry: z.string().optional().meta({ description: "Texte affichable, FIGÉ dans la locale du créateur du trajet — préférer fromCountryCode côté client (Intl.DisplayNames)" }),
    fromCountryCode: z.string().optional().meta({ example: "BE", description: "ISO 3166-1 alpha-2 — le client en dérive le nom localisé (Intl.DisplayNames)" }),
    toCity: z.string(),
    toCityCode: z.string().optional(),
    toCountry: z.string().optional().meta({ description: "Texte affichable, FIGÉ dans la locale du créateur du trajet — préférer toCountryCode côté client (Intl.DisplayNames)" }),
    toCountryCode: z.string().optional().meta({ example: "CD", description: "ISO 3166-1 alpha-2 — le client en dérive le nom localisé (Intl.DisplayNames)" }),
    travelDate: z.string().meta({ example: "12 juin 2026", description: "Formaté serveur selon locale" }),
    departureAt: z.string().datetime().optional().meta({ description: "Instant de départ (ISO 8601) — ANO-WEB-30 : permet au client de savoir qu'un trajet est passé (badge « Trajet passé » des favoris) sans interpréter la date formatée" }),
    departureTime: z.string().meta({ example: "08:00" }),
    arrivalTime: z.string().optional().meta({ example: "14:30", description: "Absent quand le trajet n'a pas d'heure d'arrivée : le front n'affiche alors rien" }),
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
    isFavorite: z.boolean().optional().meta({ description: "D46 — true si l'utilisateur connecté a mis ce trajet en favori (absent/false pour un visiteur)" }),
    viewsCount: z.number().int().optional().meta({ description: "D5 / C-PR6 — vues de la page publique, dédoublonnées par visiteur et par jour (Redis) ; absent si Redis indisponible" }),
    ring: ProximityRingSchema.nullish().meta({ description: "D80 — présent sur le tri relevance AVEC ancrage ; null/absent sinon (le front ne rend alors aucune section)" }),
  })
  .meta({ id: "YambaTripResult", description: "Carte résultat de recherche (DTO UI)" });
export type YambaTripResult = z.infer<typeof YambaTripResultSchema>;

/* ══ Réponses ═════════════════════════════════════════════════ */

/** GET /trips/search — 200. ⚠️ Pas de champ `success` (fidèle au réel). */
export const SearchTripsResponseSchema = z
  .object({
    trips: z.array(YambaTripResultSchema),
    nextCursor: z.string().nullable().meta({
      description:
        "null si dernière page. Deux formes : id du dernier trip de la page (tris indexés), ou offset `o:<n>` (tris calculés en mémoire : relevance D80, lowestPrice+weightKg D33) — à renvoyer tel quel dans `cursor`",
    }),
    totalCount: z.number().int().meta({
      description: "Sur les tris calculés en mémoire, borné à la fenêtre de calcul (200) — le count exact vit dans /trips/search/facets",
    }),
    anchor: z
      .object({
        source: z.enum(["query", "ip"]).meta({ description: "query = position envoyée par le client · ip = résolue hors-ligne par le serveur" }),
        city: z.string().nullable().meta({ description: "Ville approximative — présente seulement quand la source est ip (le client connaît déjà son libellé sinon)" }),
        countryCode: z.string().nullable().meta({ description: "ISO 3166-1 alpha-2, null si inconnu" }),
      })
      .nullish()
      .meta({
        description:
          "D80 — l'ancrage du classement (chip « Autour de : X » côté front). Présent sur le tri relevance ; null = flux découverte (aucun ancrage résolu) ; jamais l'IP ni des coordonnées",
      }),
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

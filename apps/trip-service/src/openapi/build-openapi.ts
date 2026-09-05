import { z } from "zod";
// ⚠️ Import à effet de bord : enregistre tous les schémas .meta({ id })
// du module dans z.globalRegistry. Sans cette ligne, components = {}.
import "@packages/api-contracts";

/**
 * Construit le document OpenAPI 3.1 de trip-service.
 * ==================================================
 * OAS 3.1 = JSON Schema draft 2020-12 : la sortie native de
 * z.toJSONSchema est donc directement embarquable, sans conversion.
 *
 * Lot A ✅ : components.schemas complet + paths minimal.
 * Lot B ✅ : surface trips + uploads, enveloppes alignées sur le RÉEL.
 * Lot C ✅ : securitySchemes (cookie access_token + bearer JWT, miroir
 *   d'isAuthenticated), 401 sur les routes authentifiées, retrait
 *   swagger-autogen (main.ts), job CI generate + diff.
 *
 * ⚠️ Sémantique d'erreurs actuelle (fidèle au réel) : le controller lève
 * ValidationError (→ 400) pour TOUT, y compris "Trip not found." et
 * l'ownership. Seul GET /trips/{id}/public renvoie un vrai 404, au
 * format spécial PublicNotFound (hors error-middleware). Les 401 du
 * middleware isAuthenticated sont au format { message } (4ᵉ format).
 * PR future fix/error-semantics pour unifier.
 */

/* ══ Helpers de construction ══════════════════════════════════ */

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });

const jsonResponse = (schemaId: string, description: string) => ({
  description,
  content: { "application/json": { schema: ref(schemaId) } },
});

const jsonBody = (schemaId: string) => ({
  required: true,
  content: { "application/json": { schema: ref(schemaId) } },
});

/** 400 = ValidationError via error-middleware (format ErrorResponse). */
const response400 = jsonResponse(
  "ErrorResponse",
  "Requête invalide, trip introuvable, non-propriétaire, ou transition refusée par la state machine (ValidationError — voir note sémantique)"
);

/** 401 = middleware isAuthenticated (format { message }, hors error-middleware). */
const response401 = jsonResponse(
  "UnauthorizedResponse",
  "Token absent, invalide, expiré, ou compte introuvable (middleware isAuthenticated)"
);

/** 500 non géré — champ `error`, pas `message`. */
const response500 = jsonResponse("UnhandledError", "Erreur serveur non gérée");

/** Cookie OU bearer (sémantique OR d'OpenAPI) — miroir d'extractToken. */
const authSecurity = [{ cookieAuth: [] }, { bearerAuth: [] }];

/* ── Admin (C-PR4, D57) — session admin séparée (cookie admin_access_token, amr totp) ── */
const adminSecurity = [{ adminCookieAuth: [] }];
const response403 = jsonResponse("ErrorResponse", "Profil admin sans la permission requise, ou conflit d'intérêts (son propre trajet)");
const response404 = jsonResponse("ErrorResponse", "Trajet ou document introuvable (ou supprimé)");
const documentIdPathParam = {
  name: "documentId",
  in: "path",
  required: true,
  schema: { type: "string", pattern: "^[a-f0-9]{24}$" },
  description: "Identifiant du TripDocument (ObjectId)",
};

const idPathParam = {
  name: "id",
  in: "path",
  required: true,
  schema: ref("ObjectId"),
  description: "Identifiant du trip",
};

/* ── Paramètres de la recherche publique (dto/trip-search.dto.ts) ── */

const boolQueryParam = (name: string, description: string) => ({
  name,
  in: "query",
  required: false,
  schema: { type: "string", enum: ["true", "false"] },
  description: `${description} — booléen en query string : tout sauf "true" vaut false`,
});

const searchBaseParams = [
  {
    name: "mode",
    in: "query",
    required: false,
    schema: ref("TransportModeFilter"),
    description: "Filtre mode de transport (défaut : all)",
  },
  {
    name: "from",
    in: "query",
    required: false,
    schema: { type: "string", minLength: 1, maxLength: 100 },
    description: "Ville ou pays d'origine (match partiel, insensible à la casse)",
  },
  {
    name: "to",
    in: "query",
    required: false,
    schema: { type: "string", minLength: 1, maxLength: 100 },
    description: "Ville ou pays de destination (match partiel, insensible à la casse)",
  },
  {
    name: "dateFrom",
    in: "query",
    required: false,
    schema: { type: "string", format: "date-time" },
    description:
      "Borne basse ISO 8601. Ignorée si dans le passé : la recherche ne renvoie jamais de trips déjà partis (borne effective = max(now, dateFrom))",
  },
  {
    name: "dateTo",
    in: "query",
    required: false,
    schema: { type: "string", format: "date-time" },
    description: "Borne haute ISO 8601 sur la date de départ",
  },
  {
    name: "categories",
    in: "query",
    required: false,
    schema: { type: "string" },
    description:
      "CSV de UiParcelCategory (ex: \"clothes,shoes,documents\"). Sémantique hasSome : au moins une catégorie acceptée doit matcher. Les valeurs invalides sont filtrées silencieusement",
  },
  {
    name: "departureBuckets",
    in: "query",
    required: false,
    schema: { type: "string" },
    description:
      "CSV de DepartureBucket (ex: \"morning,evening\"). OR des tranches horaires (heure locale de départ). Valeurs invalides filtrées silencieusement",
  },
  {
    name: "locale",
    in: "query",
    required: false,
    schema: ref("SearchLocale"),
    description: "Locale de formatage serveur des dates (défaut : fr)",
  },
];

const searchTripsParams = [
  ...searchBaseParams,
  {
    name: "sort",
    in: "query",
    required: false,
    schema: ref("SortOption"),
    description:
      "Tri (défaut : earliest). lowestPrice exclut les trips sans minPriceCents",
  },
  boolQueryParam("superTripper", "Uniquement les Super Trippers"),
  boolQueryParam("profileVerified", "Uniquement les profils vérifiés"),
  boolQueryParam("instantBooking", "Uniquement les trips à réservation instantanée"),
  boolQueryParam("verifiedTicket", "Uniquement les billets vérifiés"),
  {
    name: "cursor",
    in: "query",
    required: false,
    schema: { type: "string" },
    description: "Curseur de pagination : le nextCursor de la page précédente",
  },
  {
    name: "limit",
    in: "query",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
    description: "Taille de page",
  },
];

/* ── Fabrique des 7 endpoints de transition (enveloppe identique) ── */

const TRANSITIONS: Array<{ action: string; summary: string; detail: string }> = [
  { action: "publish", summary: "Publier un brouillon", detail: "DRAFT → PUBLISHED. Gates : onboarding carrier, Stripe (charges enabled), champs requis (mode, villes, départ futur, ≥1 catégorie), ≥1 pickup + ≥1 delivery location." },
  { action: "unpublish", summary: "Repasser en brouillon", detail: "PUBLISHED/PAUSED → DRAFT. Interdit avec réservations actives (guard prêt pour le chantier Booking). Décrémente les stats carrier." },
  { action: "pause", summary: "Mettre en pause", detail: "PUBLISHED → PAUSED. Le trip reste dans le pool public." },
  { action: "resume", summary: "Reprendre", detail: "PAUSED → PUBLISHED. Date de départ non passée requise." },
  { action: "cancel", summary: "Annuler", detail: "→ CANCELLED (cancelledAt posé). Décrémente les stats carrier, y compris depuis PAUSED." },
  { action: "restore", summary: "Restaurer en brouillon", detail: "CANCELLED → DRAFT (cancelledAt effacé). Date de départ non passée requise." },
  { action: "archive", summary: "Archiver", detail: "COMPLETED/CANCELLED → ARCHIVED (one-way, pas de désarchivage MVP)." },
];

function transitionPath(action: string, summary: string, detail: string) {
  return {
    post: {
      tags: ["trips-lifecycle"],
      summary,
      description: `${detail} Transition refusée → 400 avec le message machine de canPerform. Auth requise (owner uniquement).`,
      operationId: `${action}Trip`,
      security: authSecurity,
      parameters: [idPathParam],
      responses: {
        "200": jsonResponse("ActionResponse", `Transition ${action} effectuée`),
        "400": response400,
        "401": response401,
        "500": response500,
      },
    },
  };
}

/* ══ Document ═════════════════════════════════════════════════ */

export function buildOpenApiDocument() {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    target: "draft-2020-12",
  });

  // Nettoyage : $id/$schema en tête de chaque composant sont légaux en
  // OAS 3.1 mais font du bruit dans les générateurs de clients.
  const components: Record<string, unknown> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    const { $id, $schema, ...rest } = schema as Record<string, unknown>;
    components[id] = rest;
  }

  const transitionPaths: Record<string, unknown> = {};
  for (const t of TRANSITIONS) {
    transitionPaths[`/trips/{id}/${t.action}`] = transitionPath(t.action, t.summary, t.detail);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Yamba — Trip Service API",
      version: "0.3.0",
      description:
        "Contrats générés depuis @packages/api-contracts (Zod v4, source de vérité unique — D3). " +
        "Les clients consomment l'API via le gateway (:8080, préfixe /api) ; " +
        "ce service écoute en direct sur :6002. " +
        "Authentification : cookie access_token OU header Authorization: Bearer (le cookie est prioritaire).",
    },
    servers: [
      { url: "http://localhost:8080/api", description: "API Gateway (dev)" },
      { url: "http://localhost:6002", description: "trip-service direct (debug)" },
    ],
    tags: [
      { name: "trips-search", description: "Recherche publique (aucune auth)" },
      { name: "trips-public", description: "Vue publique d'un trip (aucune auth)" },
      { name: "trips", description: "CRUD owner (auth requise)" },
      { name: "trips-lifecycle", description: "Transitions de la state machine (auth requise, owner)" },
      { name: "trips-documents", description: "Justificatifs du trip (auth requise, owner)" },
      { name: "uploads", description: "Upload direct navigateur → ImageKit (auth requise)" },
      { name: "admin", description: "Back-office (chantier C, D57) — session ADMIN avec TOTP, permission par profil" },
    ],
    paths: {
      /* ── Meta ─────────────────────────────────────────────── */
      "/openapi.json": {
        get: {
          summary: "Ce document OpenAPI 3.1",
          operationId: "getOpenApiDocument",
          responses: {
            "200": {
              description: "Document OpenAPI 3.1 (généré depuis Zod)",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },

      /* ── Paramètres de prix (C-PR8a, D62 7A) ─────────────── */
      "/trips/pricing/params": {
        get: {
          tags: ["trips-search"],
          summary: "Paramètres de prix de la plateforme (public)",
          description:
            "Commission, planchers, coefficients de taille, Garantie étendue, kilo de référence : " +
            "les valeurs en vigueur, réglées par l'admin (D62). Le wizard calcule le devis avec le moteur unique (D34) et ces valeurs ; " +
            "le serveur refait le calcul à la création. `version` change à chaque modification.",
          operationId: "getPricingParams",
          responses: {
            "200": jsonResponse("PricingParamsResponse", "Paramètres de prix en vigueur"),
          },
        },
      },

      /* ── Recherche publique ───────────────────────────────── */
      "/trips/search": {
        get: {
          tags: ["trips-search"],
          summary: "Rechercher des trips publiés",
          description:
            "Recherche publique paginée (cursor-based). Hard filters non-négociables : " +
            "status=PUBLISHED et départ futur. Les trips malformés sont exclus silencieusement du mapping. " +
            "⚠️ Enveloppe SANS champ success (fidèle au réel).",
          operationId: "searchTrips",
          parameters: searchTripsParams,
          responses: {
            "200": jsonResponse("SearchTripsResponse", "Page de résultats + nextCursor + totalCount"),
            "400": response400,
            "500": response500,
          },
        },
      },
      "/trips/search/facets": {
        get: {
          tags: ["trips-search"],
          summary: "Counts pour les filtres de recherche",
          description:
            "9 counts en parallèle. Les counts par mode sont calculés SANS le filtre mode courant ; " +
            "les counts des soft toggles AVEC. Mêmes hard filters que la recherche. " +
            "⚠️ Enveloppe SANS champ success (fidèle au réel).",
          operationId: "searchTripsFacets",
          parameters: searchBaseParams,
          responses: {
            "200": jsonResponse("SearchFacetsResponse", "Counts par mode et par toggle"),
            "400": response400,
            "500": response500,
          },
        },
      },

      /* ── Vue publique ─────────────────────────────────────── */
      /* ── Favoris (D46) ───────────────────────────────────── */
      "/trips/favorites": {
        get: {
          tags: ["trips-favorites"],
          summary: "Mes trajets favoris",
          description:
            "Cartes de recherche (YambaTripResult, isFavorite = true) des trajets mis en favori, " +
            "du plus récent au plus ancien ; les trajets passés restent listés. Auth requise.",
          operationId: "listMyFavoriteTrips",
          security: authSecurity,
          parameters: [
            { name: "locale", in: "query", required: false, schema: ref("SearchLocale"), description: "Locale des libellés (sinon x-locale, sinon fr)" },
          ],
          responses: {
            "200": jsonResponse("FavoriteTripsResponse", "Liste { trips, totalCount }"),
            "401": response401,
            "500": response500,
          },
        },
      },
      "/trips/{id}/favorite": {
        post: {
          tags: ["trips-favorites"],
          summary: "Mettre un trajet en favori (idempotent)",
          description:
            "Signet privé : jamais notifié au Voyageur. 404 si le trajet n'existe pas (jamais 403 : ne pas révéler), " +
            "403 OWN_TRIP sur son propre trajet, 409 TRIP_NOT_FAVORITABLE si le trajet n'est pas PUBLISHED. " +
            "Rejouer l'action renvoie le même état.",
          operationId: "addTripFavorite",
          security: authSecurity,
          parameters: [idPathParam],
          responses: {
            "200": jsonResponse("TripFavoriteState", "{ tripId, isFavorite: true }"),
            "400": response400,
            "401": response401,
            "403": jsonResponse("ErrorResponse", "OWN_TRIP — details.type = favorite"),
            "404": jsonResponse("ErrorResponse", "Trajet introuvable ou supprimé"),
            "409": jsonResponse("ErrorResponse", "TRIP_NOT_FAVORITABLE — trajet non publié"),
            "500": response500,
          },
        },
        delete: {
          tags: ["trips-favorites"],
          summary: "Retirer un trajet des favoris (idempotent)",
          description: "Toujours possible, même sur un trajet passé. 404 si le trajet n'existe pas.",
          operationId: "removeTripFavorite",
          security: authSecurity,
          parameters: [idPathParam],
          responses: {
            "200": jsonResponse("TripFavoriteState", "{ tripId, isFavorite: false }"),
            "400": response400,
            "401": response401,
            "404": jsonResponse("ErrorResponse", "Trajet introuvable ou supprimé"),
            "500": response500,
          },
        },
      },

      "/trips/{id}/public": {
        get: {
          tags: ["trips-public"],
          summary: "Vue publique d'un trip publié",
          description:
            "DTO structuré (origin/destination/dates/tripper imbriqués), filtré privacy " +
            "(initiale du nom). 404 si inexistant, soft-deleted ou non-PUBLISHED — " +
            "au format PublicNotFound (renvoyé hors error-middleware). " +
            "400 (ErrorResponse) si l'id n'est pas un ObjectId valide.",
          operationId: "getPublicTrip",
          parameters: [idPathParam],
          responses: {
            "200": jsonResponse("PublicTripResponse", "Vue publique du trip"),
            "400": response400,
            "404": jsonResponse("PublicNotFound", "Trip inexistant, supprimé ou non publié"),
            "500": response500,
          },
        },
      },

      /* ── CRUD owner ───────────────────────────────────────── */
      "/trips": {
        post: {
          tags: ["trips"],
          summary: "Créer un trip (brouillon ou publication directe)",
          description:
            "publish=true crée directement en PUBLISHED si les gates onboarding/Stripe passent " +
            "(sinon 400). Un brouillon peut être incomplet (villes, dates nullish). " +
            "minPriceCents et departureHourLocal sont recalculés côté serveur. Auth requise.",
          operationId: "createTrip",
          security: authSecurity,
          requestBody: jsonBody("CreateTripBody"),
          responses: {
            "201": jsonResponse("TripMutationResponse", "Trip créé (avec documents, sans allowedActions)"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },
      "/trips/my": {
        get: {
          tags: ["trips"],
          summary: "Mes trips",
          description:
            "Tous les trips de l'utilisateur (hors soft-deleted), triés par createdAt desc. " +
            "Chaque trip embarque allowedActions (state machine) et un select partiel des " +
            "documents {id, type, status, url}. Auth requise.",
          operationId: "getMyTrips",
          security: authSecurity,
          parameters: [
            {
              name: "status",
              in: "query",
              required: false,
              schema: ref("TripStatus"),
              description: "Filtrer par statut (insensible à la casse : toUpperCase() serveur)",
            },
          ],
          responses: {
            "200": jsonResponse("TripsListResponse", "Liste { success, trips, count }"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },
      "/trips/{id}": {
        get: {
          tags: ["trips"],
          summary: "Détail owner d'un trip",
          description:
            "Vue complète (documents, user, carrierPage) + allowedActions IMBRIQUÉ dans trip. " +
            "Ownership requis : le trip d'autrui renvoie 400 \"Unauthorized.\" (voir note sémantique). Auth requise.",
          operationId: "getTrip",
          security: authSecurity,
          parameters: [idPathParam],
          responses: {
            "200": jsonResponse("TripResponse", "{ success, trip: { ...trip, allowedActions } }"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
        put: {
          tags: ["trips"],
          summary: "Modifier un trip",
          description:
            "Body partiel (seuls les champs envoyés sont écrits). publish=true sur un DRAFT " +
            "déclenche les gates de publication (onboarding, Stripe, locations). " +
            "Édition refusée par la machine (COMPLETED/ARCHIVED/CANCELLED…) → 400. Auth requise.",
          operationId: "updateTrip",
          security: authSecurity,
          parameters: [idPathParam],
          requestBody: jsonBody("UpdateTripBody"),
          responses: {
            "200": jsonResponse("TripMutationResponse", "Trip mis à jour (sans allowedActions)"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
        delete: {
          tags: ["trips"],
          summary: "Supprimer (brouillon) ou annuler (alias)",
          description:
            "?hard=true → soft delete d'un brouillon (isDeleted, invisible partout). " +
            "Sans ?hard → alias backward-compat de cancel. Auth requise.",
          operationId: "deleteTrip",
          security: authSecurity,
          parameters: [
            idPathParam,
            {
              name: "hard",
              in: "query",
              required: false,
              schema: { type: "string", enum: ["true", "false"] },
              description: "true = soft delete du brouillon · absent = alias de cancel",
            },
          ],
          responses: {
            "200": jsonResponse("ActionResponse", "\"Draft deleted.\" ou \"Trip cancelled.\""),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },

      /* ── Transitions state machine (7 endpoints) ──────────── */
      ...transitionPaths,

      /* ── Documents ────────────────────────────────────────── */
      "/trips/{id}/documents": {
        post: {
          tags: ["trips-documents"],
          summary: "Ajouter des justificatifs",
          description:
            "Déduplication par fileId (les doublons sont ignorés ; si aucun nouveau → 200 " +
            "\"No new documents to add.\"). Limites serveur : siteConfig.maxDocsPerTrip (défaut 5), " +
            "maxDocSizeMb (défaut 5 Mo). Un TICKET_PROOF fait passer ticketVerificationStatus " +
            "NOT_SUBMITTED → PENDING. Auth requise (owner).",
          operationId: "addTripDocuments",
          security: authSecurity,
          parameters: [idPathParam],
          requestBody: jsonBody("AddDocumentsBody"),
          responses: {
            "201": jsonResponse("TripMutationResponse", "Documents ajoutés — trip complet renvoyé"),
            "200": jsonResponse("TripMutationResponse", "Aucun nouveau document (tous dédupliqués)"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },
      "/trips/{id}/documents/{documentId}": {
        delete: {
          tags: ["trips-documents"],
          summary: "Supprimer un justificatif",
          description:
            "Supprime le document (et le fichier ImageKit, best-effort). Si c'était le dernier " +
            "TICKET_PROOF, ticketVerificationStatus repasse à NOT_SUBMITTED. Auth requise (owner).",
          operationId: "removeTripDocument",
          security: authSecurity,
          parameters: [
            idPathParam,
            {
              name: "documentId",
              in: "path",
              required: true,
              schema: ref("ObjectId"),
              description: "Identifiant du document",
            },
          ],
          responses: {
            "200": jsonResponse("ActionResponse", "Document supprimé"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },

      /* ── Uploads ImageKit ─────────────────────────────────── */
      "/uploads/imagekit-auth": {
        get: {
          tags: ["uploads"],
          summary: "Paramètres d'authentification ImageKit",
          description:
            "Pour l'upload direct navigateur → ImageKit (token/expire/signature, ~30 min). " +
            "publicKey et urlEndpoint absents si l'env n'est pas configuré. Auth requise.",
          operationId: "getImageKitAuthParams",
          security: authSecurity,
          responses: {
            "200": jsonResponse("ImageKitAuthResponse", "Paramètres d'upload"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },
      "/uploads/imagekit/{fileId}": {
        delete: {
          tags: ["uploads"],
          summary: "Supprimer un fichier ImageKit",
          description:
            "Idempotent : un fichier déjà supprimé renvoie 200 \"File was already deleted.\". Auth requise.",
          operationId: "deleteImageKitFile",
          security: authSecurity,
          parameters: [
            {
              name: "fileId",
              in: "path",
              required: true,
              schema: { type: "string", minLength: 1 },
              description: "Identifiant ImageKit du fichier",
            },
          ],
          responses: {
            "200": jsonResponse("ActionResponse", "Fichier supprimé (ou déjà absent)"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
        },
      },

      /* ── Admin (C-PR4, D57) ───────────────────────────────── */
      "/admin/trips": {
        get: {
          tags: ["admin"],
          summary: "Trajets — liste filtrable (D57 5A)",
          description:
            "Permission trips.read. Filtres : q (ville ou ObjectId), status, hidden=1 (masqués par Yamba), ticketPending=1, carrierId, from (ISO). " +
            "100 plus récents par départ, avec le nombre de réservations actives par trajet.",
          operationId: "adminListTrips",
          security: adminSecurity,
          parameters: [
            { name: "q", in: "query", schema: { type: "string" }, description: "Ville (origine / destination) ou identifiant du trajet" },
            { name: "status", in: "query", schema: ref("TripStatus") },
            boolQueryParam("hidden", "1 = masqués par Yamba seulement"),
            boolQueryParam("ticketPending", "1 = billet en attente de vérification"),
            { name: "carrierId", in: "query", schema: { type: "string", pattern: "^[a-f0-9]{24}$" }, description: "Trajets d'un Voyageur" },
            { name: "from", in: "query", schema: { type: "string", format: "date-time" }, description: "Départ à partir de" },
          ],
          responses: { "200": jsonResponse("AdminTripsResponse", "Liste"), "401": response401, "403": response403, "500": response500 },
        },
      },
      "/admin/trips/{id}": {
        get: {
          tags: ["admin"],
          summary: "Fiche trajet admin (D57 4A) — Voyageur, réservations, documents, journal",
          description: "Permission trips.read. La consultation est journalisée (AdminAction TRIP_VIEWED). Jamais de code de livraison.",
          operationId: "adminGetTripFile",
          security: adminSecurity,
          parameters: [idPathParam],
          responses: { "200": jsonResponse("AdminTripFile", "Fiche"), "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/trips/{id}/hide/propose": {
        post: {
          tags: ["admin"],
          summary: "Proposer un masquage (D57 6A) — SUPPORT",
          description: "Permission trips.hide.propose. Motif ≥ 20 caractères. Aucun effet sur la visibilité ; journal TRIP_HIDE_PROPOSED.",
          operationId: "adminProposeHideTrip",
          security: adminSecurity,
          parameters: [idPathParam],
          requestBody: jsonBody("HideTripRequest"),
          responses: { "200": jsonResponse("ActionResponse", "Proposition enregistrée"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/trips/{id}/hide": {
        post: {
          tags: ["admin"],
          summary: "Masquer un trajet (D57 3A) — MEDIATOR / SUPER_ADMIN",
          description:
            "Permission trips.hide.apply. Pose Trip.hiddenByAdminAt + motif (≥ 20) dans la même transaction que le journal TRIP_HIDDEN ; " +
            "invisible en recherche, page publique 404, non réservable ; réservations en cours préservées ; email au Voyageur. Yamba n'annule jamais un trajet.",
          operationId: "adminHideTrip",
          security: adminSecurity,
          parameters: [idPathParam],
          requestBody: jsonBody("HideTripRequest"),
          responses: { "200": jsonResponse("ActionResponse", "Trajet masqué"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
        delete: {
          tags: ["admin"],
          summary: "Rétablir un trajet masqué (D57 3A)",
          description: "Permission trips.hide.apply. Motif ≥ 20 caractères, journal TRIP_UNHIDDEN, email au Voyageur.",
          operationId: "adminUnhideTrip",
          security: adminSecurity,
          parameters: [idPathParam],
          requestBody: jsonBody("HideTripRequest"),
          responses: { "200": jsonResponse("ActionResponse", "Trajet rétabli"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/tickets": {
        get: {
          tags: ["admin"],
          summary: "File « billets à vérifier » (D57 1A) — trajets à venir, plus anciens d'abord",
          description:
            "Permission tickets.review. Documents TICKET_PROOF en PENDING. Les billets de trajets déjà partis passent EXPIRED à la lecture (8A) — " +
            "expiredNow les compte.",
          operationId: "adminListTicketQueue",
          security: adminSecurity,
          responses: { "200": jsonResponse("TicketQueueResponse", "File"), "401": response401, "403": response403, "500": response500 },
        },
      },
      "/admin/tickets/{documentId}": {
        get: {
          tags: ["admin"],
          summary: "Ouvrir un billet (D57 7A) — consultation journalisée",
          description: "Permission tickets.review. Renvoie l'URL ImageKit du document ; chaque ouverture écrit un AdminAction DOCUMENT_VIEWED.",
          operationId: "adminViewTicket",
          security: adminSecurity,
          parameters: [documentIdPathParam],
          responses: { "200": { description: "Document", content: { "application/json": { schema: { type: "object" } } } }, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/tickets/{documentId}/review": {
        post: {
          tags: ["admin"],
          summary: "Valider ou rejeter un billet (D57 1A) — motif fermé au rejet",
          description:
            "Permission tickets.review. decision VERIFY | REJECT (+ reason ILLEGIBLE | DATES_MISMATCH | NAME_MISMATCH | SUSPICIOUS). " +
            "Document et Trip.ticketVerificationStatus mis à jour dans la même transaction que le journal ; email au Voyageur ; un billet rejeté peut être redéposé. " +
            "Un billet déjà traité → 400 ; son propre billet → 403.",
          operationId: "adminReviewTicket",
          security: adminSecurity,
          parameters: [documentIdPathParam],
          requestBody: jsonBody("ReviewTicketRequest"),
          responses: { "200": jsonResponse("ActionResponse", "Décision enregistrée"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
    },
    components: {
      schemas: components,
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "access_token",
          description: "JWT d'accès en cookie — prioritaire sur le bearer (extractToken)",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Fallback : Authorization: Bearer <access_token>",
        },
        adminCookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "admin_access_token",
          description: "Session admin (D54) — JWT adm:true, amr [pwd, totp] ; jamais le cookie access_token",
        },
      },
    },
  };
}

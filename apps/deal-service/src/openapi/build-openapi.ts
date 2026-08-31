import { z } from "zod";
// ⚠️ Import à effet de bord : enregistre tous les schémas .meta({ id })
// du module dans z.globalRegistry. Sans cette ligne, components = {}.
import "@packages/api-contracts";

/**
 * Construit le document OpenAPI 3.1 du deal-service.
 * ==================================================
 * Emplacement : apps/deal-service/src/openapi/build-openapi.ts
 * Pattern répliqué de apps/trip-service/src/openapi/build-openapi.ts
 * (D3 : les mêmes objets Zod valident les requêtes ET génèrent la spec).
 *
 * A21 — sémantique d'erreurs propre dès le jour 1 : 404 NotFoundError,
 * 403 ForbiddenError, 400 réservé à la validation (format ErrorResponse
 * commun de l'error-middleware). Pas de dette héritée du trip-service.
 *
 * A22 — registre commun assumé : components embarque l'ensemble des
 * schémas de la plateforme (un seul espace de noms).
 *
 * Convention : surfaces publiques en ANGLAIS dès la naissance.
 */

/* ══ Helpers de construction ══════════════════════════════════ */

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });

const jsonResponse = (schemaId: string, description: string) => ({
  description,
  content: { "application/json": { schema: ref(schemaId) } },
});

/** 400 = ValidationError via error-middleware (malformed request only — A21). */
const response400 = jsonResponse(
  "ErrorResponse",
  "Malformed request: invalid ObjectId or unknown status value (ValidationError)"
);

/** 401 = isAuthenticated middleware (format { message }, outside error-middleware). */
const response401 = jsonResponse(
  "UnauthorizedResponse",
  "Token missing, invalid, expired, or account not found (isAuthenticated middleware)"
);

/** 403 = ForbiddenError — authenticated but not a party / not the owner. */
const response403 = jsonResponse(
  "ErrorResponse",
  "Authenticated caller is not a party to this deal, or does not own the trip (ForbiddenError)"
);

/** 404 = NotFoundError — resource missing or soft-deleted. */
const response404 = jsonResponse(
  "ErrorResponse",
  "Deal or trip not found (NotFoundError)"
);

/** 500 unhandled — `error` field, not `message`. */
const response409 = jsonResponse(
  "ErrorResponse",
  "Business conflict — details.code ∈ QUOTE_DIVERGENCE | CAPACITY_EXCEEDED | FAMILY_REFUSED | " +
    "TRIP_NOT_BOOKABLE | OWN_TRIP | PAYMENT_NOT_AUTHORIZED | PAYMENT_MISMATCH | PAYMENT_ALREADY_USED"
);
const response500 = jsonResponse("UnhandledError", "Unhandled server error");

/** 409 des transitions (B2-PR2) — codes du cycle de vie. */
const response409Lifecycle = jsonResponse(
  "ErrorResponse",
  "Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (the state machine refused: status, role or " +
    "guard — details carry its reason) | CARRIER_ONBOARDING_REQUIRED (D31 gate: profile or Stripe onboarding " +
    "incomplete) | PAYMENT_STATE_CONFLICT (the provider-side payment state forbids the operation)"
);

/** Cookie OR bearer (OpenAPI OR semantics) — mirror of extractToken. */
const authSecurity = [{ cookieAuth: [] }, { bearerAuth: [] }];

const dealIdPathParam = {
  name: "id",
  in: "path",
  required: true,
  schema: ref("ObjectId"),
  description: "Deal (booking) identifier",
};

const statusQueryParam = {
  name: "status",
  in: "query",
  required: false,
  schema: ref("BookingStatus"),
  description: "Filter by booking status (exact match)",
};

/* ══ Document ═════════════════════════════════════════════════ */

const createBookingOperation = {
    tags: ["deals"],
    summary: "Create a deal request (PENDING) — step 2 (D37)",
    description:
      "Re-validates everything server-side (trip bookable, quote identical — D17, payment authorized " +
      "and matching), then in ONE Mongo transaction: conditional reservedKg increment (CAP-01), Booking " +
      "with 5 frozen snapshots, and 2 outbox events (booking.requested, booking.payment_authorized). " +
      "The carrier is notified by the relay; the 24h acceptance window starts (DEA-01).",
    operationId: "createBooking",
    security: authSecurity,
    requestBody: {
      required: true,
      content: { "application/json": { schema: ref("CreateBookingRequest") } },
    },
    responses: {
      "201": jsonResponse("CreateBookingResponse", "Deal created (PENDING)"),
      "400": response400,
      "401": response401,
      "404": response404,
      "409": response409,
      "500": response500,
    },
};

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

  return {
    openapi: "3.1.0",
    info: {
      title: "Yamba — Deal Service API",
      version: "0.1.0",
      description:
        "Transactional core: deal (Booking) lifecycle. " +
        "Contracts generated from @packages/api-contracts (Zod v4, single source of truth — D3). " +
        "Clients consume the API through the gateway (:8080, /api prefix); " +
        "this service listens directly on :6003. " +
        "Authentication: access_token cookie OR Authorization: Bearer header (cookie wins). " +
        "PR3 scope: read-only endpoints — write transitions land in B2/B3.",
    },
    servers: [
      { url: "http://localhost:8080/api", description: "API Gateway (dev)" },
      { url: "http://localhost:6003", description: "deal-service direct (debug)" },
    ],
    tags: [
      { name: "system", description: "Health & meta" },
      { name: "deals", description: "Deal read views, role-based (auth required)" },
      { name: "me", description: "Authenticated user's own resources" },
    ],
    paths: {
      /* ── Meta ─────────────────────────────────────────────── */
      "/openapi.json": {
        get: {
          tags: ["system"],
          summary: "This OpenAPI 3.1 document",
          operationId: "getOpenApiDocument",
          responses: {
            "200": {
              description: "OpenAPI 3.1 document (generated from Zod)",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/health": {
        get: {
          tags: ["system"],
          summary: "Health check",
          operationId: "getHealth",
          responses: {
            "200": {
              description: "Service is up (no DB dependency)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string" },
                      service: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      /* ── Deals (lecture par rôle) ─────────────────────────── */
      "/deals": {
        get: {
          tags: ["deals"],
          summary: "Deals of one of my trips (carrier view)",
          description:
            "Returns the deals attached to a trip OWNED by the caller (A12: ownership " +
            "checked by direct read-only Trip lookup). Carrier view: no delivery code, " +
            "no code hash, no shipper totals — earnings only.",
          operationId: "listTripDeals",
          security: authSecurity,
          parameters: [
            {
              name: "tripId",
              in: "query",
              required: true,
              schema: ref("ObjectId"),
              description: "Trip whose deals are requested — must belong to the caller",
            },
            statusQueryParam,
          ],
          responses: {
            "200": jsonResponse("TripDealsResponse", "Deals of the trip (CarrierBookingView[])"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "500": response500,
          },
        },
        post: createBookingOperation,
      },
      "/deals/payment-intents": {
        post: {
          tags: ["deals"],
          summary: "Authorize the shipper's payment for a quote (step 1 of a request — D37)",
          description:
            "The server recomputes the quote with the single pricing engine (@packages/pricing, D34) and " +
            "authorizes the total with the PaymentProvider (D11, manual capture — captured at acceptance, D31). " +
            "Nothing is persisted: an abandoned intent simply expires. 409 with details.code when the total " +
            "the shipper saw differs (QUOTE_DIVERGENCE), the family is refused, or the trip is not bookable.",
          operationId: "createPaymentIntent",
          security: authSecurity,
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("CreatePaymentIntentRequest") } },
          },
          responses: {
            "201": jsonResponse("CreatePaymentIntentResponse", "Authorization created (clientSecret null for FAKE)"),
            "400": response400,
            "401": response401,
            "404": response404,
            "409": response409,
            "500": response500,
          },
        },
      },
      "/deals/{id}/accept": {
        post: {
          tags: ["deals"],
          summary: "Accept a deal request (carrier) — capture at acceptance (D39)",
          description:
            "Carrier only, charter checkbox required. The D31 gate (completed profile + Stripe onboarding) is " +
            "enforced HERE — no longer at trip publication. The shipper's authorization is CAPTURED (money moves " +
            "now — an authorization expires in ~7 days, capturing at D-1 would break early acceptances), then in " +
            "ONE Mongo transaction: conditional PENDING→ACCEPTED, acceptedAt/capturedAt, outbox booking.accepted.",
          operationId: "acceptDeal",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("AcceptDealRequest") } },
          },
          responses: {
            "200": jsonResponse("DealTransitionResponse", "Deal accepted (refundAmountCents null)"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Lifecycle,
            "500": response500,
          },
        },
      },
      "/deals/{id}/decline": {
        post: {
          tags: ["deals"],
          summary: "Decline a deal request (carrier)",
          description:
            "Carrier only, optional reason among 5 (spec É2). The authorization is released (never captured), " +
            "then in ONE Mongo transaction: conditional PENDING→DECLINED, reserved kg released (CAP-02), outbox " +
            "booking.declined + booking.refund_issued (full amount).",
          operationId: "declineDeal",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: false,
            content: { "application/json": { schema: ref("DeclineDealRequest") } },
          },
          responses: {
            "200": jsonResponse("DealTransitionResponse", "Deal declined, full amount returned to the shipper"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Lifecycle,
            "500": response500,
          },
        },
      },
      "/deals/{id}/cancel": {
        post: {
          tags: ["deals"],
          summary: "Cancel a deal (shipper) — ANN-01 policy",
          description:
            "Shipper only. PENDING: the authorization is released in full. ACCEPTED (payment captured — D39): a " +
            "real refund per ANN-01 — 100% until 48h before departure, then a 50% retention " +
            "(CANCEL_LATE_RETENTION_PCT, owed to the carrier — paid out with the B4 payout infrastructure). " +
            "After PICKED_UP cancellation is impossible (dispute is the only path). One Mongo transaction: " +
            "conditional transition, kg released (CAP-02), outbox booking.cancelled + booking.refund_issued.",
          operationId: "cancelDeal",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: false,
            content: { "application/json": { schema: ref("CancelDealRequest") } },
          },
          responses: {
            "200": jsonResponse("DealTransitionResponse", "Deal cancelled, refundAmountCents per ANN-01"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Lifecycle,
            "500": response500,
          },
        },
      },
      "/deals/{id}": {
        get: {
          tags: ["deals"],
          summary: "One deal, role-based view",
          description:
            "The DTO shape depends on the authenticated caller's role in the deal: " +
            "ShipperBookingView (full pricing, delivery code surface) or CarrierBookingView " +
            "(earnings only — the delivery code NEVER appears in any carrier payload). " +
            "allowedActions = getAllowedActions(booking, role): the frontend reflects, never decides.",
          operationId: "getDeal",
          security: authSecurity,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: ref("ObjectId"),
              description: "Deal (booking) identifier",
            },
          ],
          responses: {
            "200": jsonResponse("DealResponse", "The deal, shaped by viewerRole"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "500": response500,
          },
        },
      },

      /* ── Mes envois ───────────────────────────────────────── */
      "/me/bookings": {
        get: {
          tags: ["me"],
          summary: "My shipments (shipper view)",
          description:
            "All deals where the caller is the shipper, newest first ('Mes envois').",
          operationId: "listMyBookings",
          security: authSecurity,
          parameters: [statusQueryParam],
          responses: {
            "200": jsonResponse("MyBookingsResponse", "My shipments (ShipperBookingView[])"),
            "400": response400,
            "401": response401,
            "500": response500,
          },
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
          description: "Access JWT in cookie — takes precedence over bearer (extractToken)",
        },
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Fallback: Authorization: Bearer <access_token>",
        },
      },
    },
  };
}

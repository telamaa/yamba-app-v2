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

/** 409 du transport (B3-PR1) — codes A38/A39 + machine. */
const response409Transport = jsonResponse(
  "ErrorResponse",
  "Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused, or a concurrent write won) | " +
    "PAYMENT_STATE_CONFLICT (refund impossible) | DELIVERY_CODE_INVALID (details.attemptsLeft) | DELIVERY_LOCKED " +
    "(details.lockedUntil — 3 failures, 15 min) | DELIVERY_CODE_UNAVAILABLE (pre-B3 record without a code) | " +
    "TRACKING_STEP_NOT_ALLOWED (strict sequence, duplicate or wrong status) | CODE_REGENERATION_LIMIT (5 reached, or not in transit)"
);

/** 409 du règlement (B4-PR1) — machine + courses. */
const response409Settlement = jsonResponse(
  "ErrorResponse",
  "Business conflict — details.code ∈ TRANSITION_NOT_ALLOWED (state machine refused: not DELIVERED, verification " +
    "window over, parcel in transit for less than 48h after departure, or a concurrent write won — details carry its reason)"
);

/** Cookie OR bearer (OpenAPI OR semantics) — mirror of extractToken. */
const authSecurity = [{ cookieAuth: [] }, { bearerAuth: [] }];
/* C-PR5 (D58) — session admin séparée (cookie admin_access_token, amr totp) */
const adminSecurity = [{ adminCookieAuth: [] }];
const queueKindQueryParam = {
  name: "kind",
  in: "query",
  required: false,
  schema: ref("FinanceQueueKind"),
  description: "FAILED (défaut) · REVERSED · HELD",
};

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
        "Write surface: request (B2-PR1), lifecycle (B2-PR2), transport (B3-PR1).",
    },
    servers: [
      { url: "http://localhost:8080/api", description: "API Gateway (dev)" },
      { url: "http://localhost:6003", description: "deal-service direct (debug)" },
    ],
    tags: [
      { name: "system", description: "Health & meta" },
      { name: "deals", description: "Deal read views, role-based (auth required)" },
      { name: "me", description: "Authenticated user's own resources" },
      { name: "admin", description: "Back-office (chantier C, D54) — ADMIN session with TOTP only" },
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
      /* ── Transport (B3-PR1 — D42/D43, A38–A41) ──────────── */
      "/deals/{id}/pickup": {
        post: {
          tags: ["deals"],
          summary: "Confirm the parcel pickup (carrier) — generates the delivery code",
          description:
            "Carrier only. Requires ALL 5 inspection items (CNF-04) and 1 to 5 photo URLs already uploaded to " +
            "ImageKit by the browser (D42 — no bytes go through this API). ACCEPTED→PICKED_UP in ONE Mongo " +
            "transaction with the server-generated 6-digit delivery code stored twice (bcrypt for validation, " +
            "AES-256-GCM for shipper re-display — D43), the frozen checklist and photos, outbox booking.picked_up. " +
            "The code is revealed to the SHIPPER on GET /deals/:id only — never in this response, never to the carrier.",
          operationId: "confirmPickup",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("ConfirmPickupRequest") } },
          },
          responses: {
            "200": jsonResponse("DealTransitionResponse", "Parcel picked up (status PICKED_UP, refundAmountCents null)"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Transport,
            "500": response500,
          },
        },
      },
      "/deals/{id}/pickup/refuse": {
        post: {
          tags: ["deals"],
          summary: "Refuse the parcel at pickup (carrier) — full refund, no penalty",
          description:
            "Carrier only, optional reason among 5 (A40). The captured payment is REFUNDED in full at the provider " +
            "(money first), then ACCEPTED→CANCELLED (closedBy CARRIER, pickupRefusalReason), reserved kg released " +
            "(CAP-02), outbox booking.pickup_refused + booking.refund_issued. No reputation penalty (CNF-07).",
          operationId: "refusePickup",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: false,
            content: { "application/json": { schema: ref("RefusePickupRequest") } },
          },
          responses: {
            "200": jsonResponse("DealTransitionResponse", "Deal cancelled, full amount returned to the shipper"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Transport,
            "500": response500,
          },
        },
      },
      "/deals/{id}/events": {
        post: {
          tags: ["deals"],
          summary: "Confirm an optional tracking milestone (carrier)",
          description:
            "Carrier only, while PICKED_UP. Strict sequence AT_AIRPORT → FLIGHT_DEPARTED → FLIGHT_ARRIVED, no skip, " +
            "no duplicate (409 TRACKING_STEP_NOT_ALLOWED). No status transition: the milestone is pushed in ONE " +
            "transaction guarded by its absence, outbox booking.tracking_event (shipper in-app only, no email). " +
            "The 5-second undo is client-side (A39): call this endpoint AFTER the undo window — there is no server undo.",
          operationId: "confirmTrackingStep",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("ConfirmTrackingStepRequest") } },
          },
          responses: {
            "200": jsonResponse("TrackingStepResponse", "Milestone confirmed — full sequence returned"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Transport,
            "500": response500,
          },
        },
      },
      "/deals/{id}/code/regenerate": {
        post: {
          tags: ["deals"],
          summary: "Regenerate the delivery code (shipper) — max 5",
          description:
            "Shipper only, while PICKED_UP, at most MAX_CODE_REGENERATIONS (5). A new code replaces the previous one " +
            "(old hash invalid immediately), delivery attempts and lock are reset, outbox booking.code_regenerated " +
            "(count only — the code never travels in events or emails). The NEW code is returned here and on " +
            "GET /deals/:id (shipper view). Optimistic guard on the regeneration counter (two clicks = one regeneration).",
          operationId: "regenerateDeliveryCode",
          security: authSecurity,
          parameters: [dealIdPathParam],
          responses: {
            "200": jsonResponse("RegenerateCodeResponse", "New 6-digit code and remaining regenerations"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Transport,
            "500": response500,
          },
        },
      },
      "/deals/{id}/deliver": {
        post: {
          tags: ["deals"],
          summary: "Validate the delivery code (carrier) — PICKED_UP → DELIVERED",
          description:
            "Carrier only. The 6-digit code given by the recipient is compared with bcrypt server-side. Wrong code: " +
            "attempts +1 (conditional write on the counter read — A38) → 409 DELIVERY_CODE_INVALID with attemptsLeft; " +
            "3rd failure → 15-minute lock AND counter reset → 409 DELIVERY_LOCKED with lockedUntil; an active lock is " +
            "refused by the state machine before any comparison. Valid code: PICKED_UP→DELIVERED in ONE transaction, " +
            "payoutDueAt = deliveredAt + 4 days (shipper verification window, B4), outbox booking.delivered.",
          operationId: "deliverDeal",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("DeliverDealRequest") } },
          },
          responses: {
            "200": jsonResponse("DeliverDealResponse", "Delivered — verification window started"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Transport,
            "500": response500,
          },
        },
      },
      "/deals/{id}/confirm": {
        post: {
          tags: ["deals"],
          summary: "Confirm the delivery early (shipper) — DELIVERED → COMPLETED, payout released (INV-3: final)",
          description:
            "Shipper only, while DELIVERED. ONE conditional transaction: COMPLETED, completedBy=SHIPPER, payoutStatus=PENDING, " +
            "outbox booking.completed (D49). Then the carrier payout is executed INLINE (A67): PaymentProvider.transfer of " +
            "pricing.transportCents (carrier net, D50) to the carrier's Connect account, idempotency key = booking id, " +
            "source_transaction = capture charge (A69). Success → payoutStatus SENT + outbox booking.payout_sent; provider " +
            "refusal → FAILED (retried by the payout cron every 5 min, up to 10 attempts). Irreversible: the right to " +
            "dispute is gone.",
          operationId: "confirmDeal",
          security: authSecurity,
          parameters: [dealIdPathParam],
          responses: {
            "200": jsonResponse("ConfirmDealResponse", "Completed — payoutStatus tells whether the transfer went through"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Settlement,
            "500": response500,
          },
        },
      },
      "/deals/{id}/dispute": {
        post: {
          tags: ["deals"],
          summary: "Open a dispute (shipper) — DELIVERED (before D+4) or PICKED_UP (not delivered, 48h after departure) → DISPUTED",
          description:
            "Shipper only. From DELIVERED before payoutDueAt (INV-4), or from PICKED_UP once the trip departure is 48h past " +
            "(category MUST be NOT_DELIVERED — 400 otherwise). Body: category, description ≥ 50 chars, pledgeAccepted=true, " +
            "up to 5 ImageKit photo URLs (D42), optional desiredOutcome. ONE transaction: DISPUTED, ticket YAM-XXXX " +
            "(CSPRNG, unique — redrawn on collision), payoutStatus=FROZEN when a payout was scheduled (INV-5), Dispute " +
            "document created (D51), outbox booking.disputed. Terminal in v1 — resolution belongs to the admin (chantier C).",
          operationId: "disputeDeal",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: {
            required: true,
            content: { "application/json": { schema: ref("DisputeDealRequest") } },
          },
          responses: {
            "200": jsonResponse("DisputeDealResponse", "Dispute opened — payout frozen, ticket issued"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Settlement,
            "500": response500,
          },
        },
      },
      "/deals/{id}/tracking-link": {
        post: {
          tags: ["deals"],
          summary: "Recipient tracking link (D69) — shipper only, one per deal, created on demand",
          description:
            "Returns the public tracking token and path (/track/{token}) plus the recipient contact the shipper entered. " +
            "403 for the carrier, 409 TRACKING_NOT_AVAILABLE before acceptance or after a closure without delivery.",
          operationId: "issueTrackingLink",
          security: authSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("TrackingLinkResponse", "Tracking link"), "401": response401, "403": response403, "404": response404, "409": response409, "500": response500 },
        },
      },
      "/track/{token}": {
        get: {
          tags: ["deals"],
          summary: "Recipient tracking page (D69) — public, minimal content",
          description:
            "No session. Milestones (accepted → picked up → in transit → arrived → delivered, or closed), first names, corridor and dates. " +
            "Never an address, a phone number, the delivery code, photos or amounts. 404 once the recipient snapshot is redacted (D63 5A), " +
            "the link revoked or the deal deleted.",
          operationId: "getPublicTracking",
          parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": jsonResponse("PublicTrackingResponse", "Tracking view"), "400": response400, "404": response404, "500": response500 },
        },
      },
      "/deals/{id}/rating": {
        get: {
          tags: ["deals"],
          summary: "Rating context (B5, D53) — who I rate, my rating, whether the other rated, reveal",
          description:
            "Either party. Double-blind: counterpartRating is null until both rated or the 14-day window elapsed. " +
            "canRate is the state machine verdict (COMPLETED, window open, not rated yet by this role).",
          operationId: "getDealRatingContext",
          security: authSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("RatingContextResponse", "Rating context"), "401": response401, "403": response403, "404": response404, "500": response500 },
        },
        post: {
          tags: ["deals"],
          summary: "Rate the other party (B5, D53) — once per role, COMPLETED, within 14 days",
          description:
            "ONE transaction: Review (revealedAt null) + booking mark (optimistic lock on updatedAt). If the counterpart had " +
            "already rated, both reviews are revealed now and outbox booking.rating_revealed (BOTH_RATED) is written; " +
            "otherwise the cron reveals at the end of the window (WINDOW_ELAPSED). Only revealed reviews feed the public " +
            "reputation (D29①). Criteria outside the rated role are dropped.",
          operationId: "submitDealRating",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("SubmitRatingRequest") } } },
          responses: {
            "201": jsonResponse("SubmitRatingResponse", "Rating recorded"),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
            "409": response409Settlement,
            "500": response500,
          },
        },
      },
      "/admin/disputes": {
        get: {
          tags: ["admin"],
          summary: "Arbitration queue (chantier C, D54) — open disputes + retentions held for mediation",
          description:
            "ADMIN session only (admin_access_token cookie carrying amr totp). One queue, two kinds: DISPUTE (DISPUTED + " +
            "Dispute OPEN) and RETENTION (CANCELLED after departure without pickup, retentionDisposition HELD_FOR_MEDIATION, A81). " +
            "Oldest first.",
          operationId: "adminListArbitrationQueue",
          security: authSecurity,
          responses: { "200": jsonResponse("ArbitrationQueueResponse", "Queue"), "401": response401, "403": response403, "500": response500 },
        },
      },
      "/admin/disputes/{id}": {
        get: {
          tags: ["admin"],
          summary: "Mediation file (chantier C, D54) — both parties' evidence, money state, never the delivery code",
          description:
            "ADMIN session only. Declaration photos, pickup checklist + photos, tracking events, delivery photos, dispute file " +
            "(description, photos, desired outcome), money snapshot and payout/refund state. Reading a file is journaled " +
            "(AdminAction DISPUTE_VIEWED). 404 when the deal is not awaiting arbitration.",
          operationId: "adminGetDisputeFile",
          security: authSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("AdminDisputeFile", "File"), "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/deals/{id}/dispute/statement": {
        post: {
          tags: ["deals"],
          summary: "Carrier's statement on an open dispute (C-PR2, D55) — once, ≥ 50 chars, ≤ 5 photos",
          description:
            "Carrier only, status DISPUTED, dispute OPEN. Writes the statement + outbox booking.dispute_carrier_responded in one " +
            "transaction. The admin may decide as soon as the statement is in, or 72h after the dispute was filed.",
          operationId: "submitCarrierDisputeStatement",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("CarrierDisputeStatementRequest") } } },
          responses: { "201": jsonResponse("CarrierDisputeStatementResponse", "Statement recorded"), "400": response400, "401": response401, "403": response403, "404": response404, "409": response409Settlement, "500": response500 },
        },
      },
      "/admin/disputes/{id}/resolve": {
        post: {
          tags: ["admin"],
          summary: "Decide a dispute (C-PR2, D55) — REJECTED / PARTIAL_REFUND / FULL_REFUND, reason ≥ 50 chars, irreversible",
          description:
            "ADMIN session only. Refund FIRST (provider), then ONE transaction: DISPUTED → COMPLETED (rejected/partial) or → CANCELLED (full), " +
            "dispute resolution, internal 'disputes lost' counter, AdminAction DISPUTE_RESOLVED, outbox booking.dispute_resolved. " +
            "Then the carrier transfer through the payout executor (D49, retried by the cron on failure). 409 while the carrier still has time to answer.",
          operationId: "adminResolveDispute",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("AdminResolveDisputeRequest") } } },
          responses: { "200": jsonResponse("AdminResolutionResponse", "Decided"), "400": response400, "401": response401, "403": response403, "404": response404, "409": response409Settlement, "500": response500 },
        },
      },
      "/admin/disputes/{id}/retention": {
        post: {
          tags: ["admin"],
          summary: "Arbitrate a held retention (C-PR2, D55 3A) — COMPENSATE_CARRIER (pro-rata A79) or RESTITUTE_SHIPPER",
          description: "ADMIN session only. CANCELLED + retentionDisposition HELD_FOR_MEDIATION. Amounts are server-computed. Journaled (RETENTION_ARBITRATED).",
          operationId: "adminResolveRetention",
          security: authSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("AdminResolveRetentionRequest") } } },
          responses: { "200": jsonResponse("AdminResolutionResponse", "Arbitrated"), "400": response400, "401": response401, "403": response403, "404": response404, "409": response409Settlement, "500": response500 },
        },
      },
      "/me/wallet": {
        get: {
          tags: ["me"],
          summary: "Finances — carrier payouts and shipper payments, totals computed server-side (A83)",
          description:
            "Both roles of the caller in one payload. Carrier: UPCOMING (delivered, verification running) · PENDING · BLOCKED " +
            "(Stripe account not ready) · FROZEN (dispute) · SENT · HELD (late cancellation after departure). Shipper: AUTHORIZED · " +
            "HELD · RELEASED · RELEASED_NO_CHARGE · REFUNDED · PARTIALLY_REFUNDED. Amounts are integer cents; the frontend never recomputes.",
          operationId: "getMyWallet",
          security: authSecurity,
          responses: {
            "200": jsonResponse("WalletResponse", "Wallet for both roles"),
            "401": response401,
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

      /* ── Mes deals reçus (A44) ────────────────────────────── */
      "/me/deals": {
        get: {
          tags: ["me"],
          summary: "My received deals (carrier view, all my trips)",
          description:
            "All deals where the caller is the carrier, across all trips, newest first. CarrierBookingView " +
            "(earnings only, no delivery code). One read for the trips list, the dashboard inbox and the sidebar badge.",
          operationId: "listMyDeals",
          security: authSecurity,
          parameters: [statusQueryParam],
          responses: {
            "200": jsonResponse("MyDealsResponse", "My received deals (CarrierBookingView[])"),
            "400": response400,
            "401": response401,
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
      /* ── Admin finances (C-PR5a, D58) ────────────────────────── */
      "/admin/finances/queue": {
        get: {
          tags: ["admin"],
          summary: "Exception queues (D58 2A) — failed payouts, reversed transfers, retentions held",
          description:
            "Permission finances.read. FAILED = payoutStatus FAILED on COMPLETED / CANCELLED deals (reason kind, attempts, next retry — A111); " +
            "REVERSED = transfer.reversed not yet resolved by an admin; HELD = retention HELD_FOR_MEDIATION. Amounts come from the booking, never recomputed.",
          operationId: "adminListFinanceQueue",
          security: adminSecurity,
          parameters: [queueKindQueryParam],
          responses: { "200": jsonResponse("FinanceQueueResponse", "Queue"), "400": response400, "401": response401, "403": response403, "500": response500 },
        },
      },
      "/admin/deals/{id}/money": {
        get: {
          tags: ["admin"],
          summary: "Money file of any deal (D58 4A) — snapshot, payment, payout, retention, timeline, journal",
          description: "Permission finances.read. Provider identifiers in clear (finance needs them). Reading is journaled (AdminAction DEAL_MONEY_VIEWED). allowedActions reflects state AND conflict of interest.",
          operationId: "adminGetDealMoneyFile",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("AdminDealMoneyFile", "File"), "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/deals/{id}/money/reconcile": {
        post: {
          tags: ["admin"],
          summary: "Reconcile with the payment provider (D58 4A, A112) — read-only, journaled",
          description:
            "Permission finances.read. Calls PaymentProvider.inspect (intent, refunds, transfer) and lists divergences with the database " +
            "(REFUND_NOT_RECORDED = a refund left the provider without a database write, D39). Never modifies the deal. Journal DEAL_RECONCILED.",
          operationId: "adminReconcileDeal",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("PaymentReconciliation", "Reconciliation"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/deals/{id}/payout/retry": {
        post: {
          tags: ["admin"],
          summary: "Retry a payout now (D58 3A) — same executor, idempotent",
          description: "Permission payouts.retry. Deal COMPLETED or CANCELLED with payoutStatus FAILED or PENDING; 403 when the admin is a party. Runs the unique payout executor (A65) without waiting for the retry schedule. Journal PAYOUT_RETRIED.",
          operationId: "adminRetryPayout",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("RetryPayoutResponse", "Outcome"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/deals/{id}/payout/reversal": {
        post: {
          tags: ["admin"],
          summary: "Resolve a reversed transfer (D58 3A) — RESENT or WRITTEN_OFF, reason ≥ 20",
          description:
            "Permission payouts.resolve. Only on payoutStatus REVERSED not yet resolved (optimistic guard). RESENT: PENDING + a NEW idempotency key, then the executor sends a new transfer; " +
            "WRITTEN_OFF: closed, nothing is sent. Resolution + journal PAYOUT_REVERSAL_RESOLVED in one transaction.",
          operationId: "adminResolvePayoutReversal",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("ResolveReversalRequest") } } },
          responses: { "200": jsonResponse("ResolveReversalResponse", "Outcome"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      /* ── Admin finances (C-PR5b, D58) ────────────────────────── */
      "/admin/finances/report": {
        get: {
          tags: ["admin"],
          summary: "Monthly finance report per currency (D58 5A) — computed from bookings, no ledger",
          description:
            "Permission finances.read. months = 1..24 (default 12, UTC months). Each money fact counts in ITS month: capture → capturedAt, refund → refundedAt, " +
            "payout → payoutSentAt, revenue (commission + premium of COMPLETED deals) → completedAt, retention → closedAt. snapshot = today's liabilities " +
            "(pending / frozen payouts, open reversals, retentions held, proposed refunds). Provider fees are not stored: reconcile with the Stripe export.",
          operationId: "adminGetFinanceReport",
          security: adminSecurity,
          parameters: [{ name: "months", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 24, default: 12 } }],
          responses: { "200": jsonResponse("FinanceReport", "Report"), "400": response400, "401": response401, "403": response403, "500": response500 },
        },
      },
      "/admin/finances/export": {
        get: {
          tags: ["admin"],
          summary: "CSV export per deal (D58 5A) — journaled, FINANCE only",
          description:
            "Permission finances.export. from / to ISO date-times, at most 366 days. One line per deal with a money fact in the period: frozen amounts, refund (+ refundId), " +
            "payout (+ transferId), retention, dates, dispute ticket, paymentIntentId, chargeId. Formula-looking cells are neutralised. Journal FINANCE_EXPORTED (period, row count).",
          operationId: "adminExportFinanceCsv",
          security: adminSecurity,
          parameters: [
            { name: "from", in: "query", required: true, schema: { type: "string", format: "date-time" } },
            { name: "to", in: "query", required: true, schema: { type: "string", format: "date-time" } },
          ],
          responses: {
            "200": { description: "CSV (UTF-8 with BOM), Content-Disposition attachment, X-Row-Count", content: { "text/csv": { schema: { type: "string" } } } },
            "400": response400, "401": response401, "403": response403, "500": response500,
          },
        },
      },
      "/admin/deals/{id}/refund/propose": {
        post: {
          tags: ["admin"],
          summary: "Propose a commercial refund (D58 3A-c) — FINANCE / SUPPORT",
          description: "Permission refunds.manual.propose. Closed deal (COMPLETED / CANCELLED) with a captured payment; amount ≤ total paid − already refunded; reason ≥ 50. No money moves. Journal REFUND_MANUAL_PROPOSED. 403 when the admin is a party.",
          operationId: "adminProposeManualRefund",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("ManualRefundRequest") } } },
          responses: { "200": { description: "Proposed", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, proposedAt: { type: "string", format: "date-time" } }, required: ["ok", "proposedAt"] } } } }, "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/admin/deals/{id}/refund": {
        post: {
          tags: ["admin"],
          summary: "Apply a commercial refund (D58 3A-c) — SUPER_ADMIN only, money first",
          description:
            "Permission refunds.manual.apply (SUPER_ADMIN). Same bounds as the proposal. D39: provider.refund FIRST, then ONE conditional transaction (optimistic lock on the refunded total — " +
            "two admins never refund twice): refundAmountCents cumulated, refundId, manual refund fields, proposal cleared, outbox booking.refund_issued (actor ADMIN → the shipper receives the " +
            "standard refund email), journal REFUND_MANUAL_APPLIED. The carrier's payout is untouched: Yamba bears the gesture. A refund issued without a database write shows up in the reconciliation.",
          operationId: "adminApplyManualRefund",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          requestBody: { required: true, content: { "application/json": { schema: ref("ManualRefundRequest") } } },
          responses: { "200": jsonResponse("ManualRefundResponse", "Refunded"), "400": response400, "401": response401, "403": response403, "404": response404, "409": response409, "500": response500 },
        },
      },
      /* ── Admin alerts (C-PR6b, D59 3A / 4A) ─────────────────── */
      "/admin/alerts": {
        get: {
          tags: ["admin"],
          summary: "Threshold alerts (D59 3A / 4A) — computed on read, no state",
          description:
            "Permission kpi.read. Rules with versioned thresholds: failed payouts > 48h, decidable disputes undecided > 72h, retentions held > 7d, open reversals > 48h, " +
            "parked outbox events, relay lag > 15 min, failed emails (24h), no trip published for 7d, acceptance rate < 30% over 7d (≥ 5 requests). " +
            "The hourly cron emails support once per rule and per day (Redis dedup); this endpoint always recomputes.",
          operationId: "adminListOpsAlerts",
          security: adminSecurity,
          responses: { "200": jsonResponse("OpsAlertsResponse", "Alerts"), "401": response401, "403": response403, "500": response500 },
        },
      },
      /* ── Admin history (C-PR6a, D59 5A) ─────────────────────── */
      "/admin/deals/{id}/history": {
        get: {
          tags: ["admin"],
          summary: "Everything that happened to this deal (D59 5A) — outbox, admin journal, notifications, emails",
          description:
            "Permission deals.history.read (MEDIATOR, SUPPORT, FINANCE). Read-only merge of the outbox (with relay state: published / pending / parked), the admin journal, in-app notifications " +
            "and email deliveries, sorted by time. Outbox payloads are reduced to a whitelist — never a delivery code, a photo or an address. Reading is journaled (DEAL_HISTORY_VIEWED).",
          operationId: "adminGetDealHistory",
          security: adminSecurity,
          parameters: [dealIdPathParam],
          responses: { "200": jsonResponse("DealHistoryResponse", "History"), "401": response401, "403": response403, "404": response404, "500": response500 },
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
        adminCookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "admin_access_token",
          description: "Admin session (D54) — JWT adm:true, amr [pwd, totp]; never the access_token cookie",
        },
      },
    },
  };
}

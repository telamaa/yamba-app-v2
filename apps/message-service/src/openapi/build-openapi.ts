import { z } from "zod";
// Import à effet de bord : enregistre tous les schémas .meta({ id }) dans z.globalRegistry.
import "@packages/api-contracts";

/**
 * build-openapi.ts — document OAS 3.1 du message-service (chantier F, D61)
 * ========================================================================
 * Même pattern que les autres services : registre commun, chemins écrits à la main,
 * sémantique d'erreurs documentée au réel (403 quand l'appelant n'est pas partie au deal,
 * jamais un 404 : le deal existe).
 */
const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const jsonResponse = (schemaId: string, description: string) => ({
  description,
  content: { "application/json": { schema: ref(schemaId) } },
});
const jsonBody = (schemaId: string) => ({ required: true, content: { "application/json": { schema: ref(schemaId) } } });

const authSecurity = [{ cookieAuth: [] }, { bearerAuth: [] }];
const response400 = jsonResponse("ErrorResponse", "Invalid request: empty message, bad slot, delivery code in the body (ValidationError)");
const response401 = jsonResponse("UnauthorizedResponse", "Missing or invalid token (isAuthenticated middleware)");
const response403 = jsonResponse("ErrorResponse", "Authenticated but not a party to this deal, or the deal has no conversation yet (ForbiddenError)");
const response404 = jsonResponse("ErrorResponse", "Conversation, deal or meeting not found (NotFoundError)");
const response500 = jsonResponse("UnhandledError", "Unhandled server error");

const conversationIdParam = { name: "id", in: "path", required: true, schema: ref("ObjectId"), description: "Conversation id" };

export function buildOpenApiDocument() {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    target: "draft-2020-12",
  });
  const components: Record<string, unknown> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    const { $id, $schema, ...rest } = schema as Record<string, unknown>;
    components[id] = rest;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Yamba Message Service API",
      version: "1.0.0",
      description:
        "Coordination between shipper and carrier (chantier F, D61). One conversation per deal, opened at acceptance. " +
        "The MEETING is an object (proposed / accepted), not a thread of messages; the thread carries the rest. " +
        "The delivery code never travels (D43): a message containing it is refused. Contact details are detected and flagged, never blocked. " +
        "The counterpart's phone number opens at most 2 hours before the pickup meeting, and every reveal is recorded.",
    },
    servers: [
      { url: "http://localhost:8080/api", description: "API Gateway (dev)" },
      { url: "http://localhost:6005", description: "message-service direct (debug)" },
    ],
    tags: [{ name: "messages", description: "Conversation, meetings and phone reveal (auth required, parties only)" }],
    paths: {
      "/messages/conversations": {
        get: {
          tags: ["messages"],
          summary: "My conversations, most active first",
          description: "Unread count per conversation, next meeting (accepted one first, otherwise the latest proposal) and write access.",
          operationId: "listConversations",
          security: authSecurity,
          responses: { "200": jsonResponse("ConversationListResponse", "Conversations"), "401": response401, "500": response500 },
        },
      },
      "/messages/conversations/by-deal/{bookingId}": {
        get: {
          tags: ["messages"],
          summary: "The thread of a deal, created on first access (D61 2A)",
          description: "The conversation exists from ACCEPTED onwards. Before that: 403 — the request already carries a message.",
          operationId: "getConversationByDeal",
          security: authSecurity,
          parameters: [{ name: "bookingId", in: "path", required: true, schema: ref("ObjectId") }],
          responses: { "200": jsonResponse("ConversationThreadResponse", "Thread"), "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/conversations/{id}": {
        get: {
          tags: ["messages"],
          summary: "The thread, oldest to newest, paginated backwards",
          description: "`cursor` loads OLDER messages. Includes meetings and the phone state (revealed, opensAt).",
          operationId: "getConversationThread",
          security: authSecurity,
          parameters: [conversationIdParam, { name: "cursor", in: "query", required: false, schema: ref("ObjectId"), description: "Oldest message already loaded" }],
          responses: { "200": jsonResponse("ConversationThreadResponse", "Thread"), "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/conversations/{id}/messages": {
        post: {
          tags: ["messages"],
          summary: "Post a message (D61 3A / 4A / 5A)",
          description:
            "Text up to 2000 chars plus up to 5 photos. REFUSED (400 DELIVERY_CODE_IN_MESSAGE) when a six-digit group matches the deal's delivery code hash (D43). " +
            "Contact details (email, phone) are detected and flagged on the message, never blocked. Read-only while a dispute is open and 14 days after the deal ends. " +
            "One transaction: message + conversation timestamp + outbox event (D2).",
          operationId: "postMessage",
          security: authSecurity,
          parameters: [conversationIdParam],
          requestBody: jsonBody("PostMessageRequest"),
          responses: { "201": jsonResponse("Message", "Posted"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/conversations/{id}/read": {
        post: {
          tags: ["messages"],
          summary: "Mark the thread as read",
          operationId: "markConversationRead",
          security: authSecurity,
          parameters: [conversationIdParam],
          responses: { "200": { description: "Read", content: { "application/json": { schema: { type: "object", properties: { readAt: { type: "string", format: "date-time" } }, required: ["readAt"] } } } }, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/conversations/{id}/meetups": {
        post: {
          tags: ["messages"],
          summary: "Propose a meeting (D61 1A) — the meeting is an object, not a conversation",
          description: "Place and slot: at least 30 minutes ahead, at most 90 days, window up to 12 hours. A new proposal of the same kind replaces the open one (counter-proposal).",
          operationId: "proposeMeetup",
          security: authSecurity,
          parameters: [conversationIdParam],
          requestBody: jsonBody("ProposeMeetupRequest"),
          responses: { "201": jsonResponse("Meetup", "Proposed"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/conversations/{id}/meetups/{meetupId}/accept": {
        post: {
          tags: ["messages"],
          summary: "Accept a meeting — the other party only",
          description: "Optimistic guard on PROPOSED: a concurrent change answers 400 rather than overwriting.",
          operationId: "acceptMeetup",
          security: authSecurity,
          parameters: [conversationIdParam, { name: "meetupId", in: "path", required: true, schema: ref("ObjectId") }],
          responses: { "200": jsonResponse("Meetup", "Accepted"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/conversations/{id}/phone": {
        post: {
          tags: ["messages"],
          summary: "Reveal the counterpart's phone number (D61 4A)",
          description:
            "Opens at most 2 hours before the accepted PICKUP meeting, otherwise before the trip departure. Recorded once per reader (PhoneReveal) and written in the thread as a system message. " +
            "Rather than letting both parties trade numbers in the thread, the platform opens it late and keeps the trace.",
          operationId: "revealCounterpartPhone",
          security: authSecurity,
          parameters: [conversationIdParam],
          responses: { "200": jsonResponse("RevealPhoneResponse", "Revealed"), "400": response400, "401": response401, "403": response403, "404": response404, "500": response500 },
        },
      },
      "/messages/quick-replies": {
        get: {
          tags: ["messages"],
          summary: "Quick replies in the reader's language (D61 2A)",
          description: "Same keys in every locale; the client sends the text as an ordinary message.",
          operationId: "listQuickReplies",
          security: authSecurity,
          responses: { "200": jsonResponse("QuickRepliesResponse", "Quick replies"), "401": response401, "500": response500 },
        },
      },
    },
    components: {
      schemas: components,
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: "access_token", description: "Access JWT in cookie — takes precedence over bearer" },
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Fallback: Authorization: Bearer <access_token>" },
      },
    },
  };
}

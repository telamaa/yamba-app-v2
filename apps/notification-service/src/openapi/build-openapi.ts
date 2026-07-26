import { z } from "zod";
// ⚠️ Import à effet de bord : enregistre tous les schémas .meta({ id })
import "@packages/api-contracts";

/**
 * build-openapi.ts — document OAS 3.1 du notification-service (PR4bis)
 * =====================================================================
 * Pattern deal-service : registre commun A22 (96 schémas), paths
 * main-crafted, sémantique d'erreurs A21 documentée au réel.
 */

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const jsonResponse = (schemaId: string, description: string) => ({
  description,
  content: { "application/json": { schema: ref(schemaId) } },
});

const authSecurity = [{ cookieAuth: [] }, { bearerAuth: [] }];

const response400 = jsonResponse(
  "ErrorResponse",
  "Malformed notification id (ValidationError)"
);
const response401 = jsonResponse(
  "UnauthorizedResponse",
  "Missing or invalid token (isAuthenticated middleware)"
);
const response403 = jsonResponse(
  "ErrorResponse",
  "Authenticated but not the recipient (ForbiddenError — A21)"
);
const response404 = jsonResponse(
  "ErrorResponse",
  "Notification not found (NotFoundError)"
);
const response500 = jsonResponse("UnhandledError", "Unhandled server error");

const idPathParam = {
  name: "id",
  in: "path",
  required: true,
  schema: ref("ObjectId"),
  description: "Notification id",
};

export function buildOpenApiDocument() {
  const { schemas } = z.toJSONSchema(z.globalRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    target: "draft-2020-12",
  });
  // Nettoyage : $id/$schema légaux en OAS 3.1 mais bruyants.
  const components: Record<string, unknown> = {};
  for (const [id, schema] of Object.entries(schemas)) {
    const { $id, $schema, ...rest } = schema as Record<string, unknown>;
    components[id] = rest;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Yamba Notification Service API",
      version: "0.1.0",
      description:
        "In-app notification inbox — materialized from booking-events (D2, A25/A27). Whitelist DTOs (A13).",
    },
    paths: {
      "/me/notifications": {
        get: {
          summary: "My notifications (latest first) with unread count",
          operationId: "listMyNotifications",
          security: authSecurity,
          responses: {
            "200": jsonResponse(
              "MyNotificationsResponse",
              "Latest 50 notifications + unreadCount"
            ),
            "401": response401,
            "500": response500,
          },
        },
      },
      "/me/notifications/{id}/read": {
        patch: {
          summary: "Mark one notification as read (idempotent)",
          operationId: "markNotificationRead",
          security: authSecurity,
          parameters: [idPathParam],
          responses: {
            "200": jsonResponse(
              "MarkNotificationReadResponse",
              "The updated notification"
            ),
            "400": response400,
            "401": response401,
            "403": response403,
            "404": response404,
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
          description:
            "Access JWT in cookie — takes precedence over bearer (extractToken)",
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

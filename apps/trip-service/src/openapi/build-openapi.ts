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
 * Lot A : components.schemas complet + paths minimal (self-description).
 * Lot B : surface trips (routes, réponses, erreurs machine 400/403/404).
 * Lot C : uploads + securitySchemes + retrait swagger-autogen.
 */
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
      title: "Yamba — Trip Service API",
      version: "0.1.0",
      description:
        "Contrats générés depuis @packages/api-contracts (Zod v4, source de vérité unique — D3). " +
        "Les clients consomment l'API via le gateway (:8080, préfixe /api) ; " +
        "ce service écoute en direct sur :6002.",
    },
    servers: [
      { url: "http://localhost:8080/api", description: "API Gateway (dev)" },
      { url: "http://localhost:6002", description: "trip-service direct (debug)" },
    ],
    paths: {
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
    },
    components: { schemas: components },
  };
}

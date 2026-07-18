/**
 * deal-service — main.ts
 * ======================
 * Cœur transactionnel de Yamba (chantier B1+). Port 6003 (D1).
 *
 * PR1 (squelette) : boot SANS Prisma, SANS secret, SANS DB — un service
 * qui exige un .env pour démarrer est un service qu'on ne peut ni
 * smoke-tester ni CI-ser (leçon getImageKit, PR #69).
 *
 * Template service (registre B1) : pino + correlation ID dès la
 * naissance — chaque requête porte un id traçable de bout en bout,
 * qui suivra les événements outbox → Kafka (PR4).
 *
 * /openapi.json est un document 3.1 minimal écrit à la main ; la PR3
 * le remplacera par buildOpenApiDocument() généré depuis les schémas
 * Zod de @packages/api-contracts (pattern trip-service, D3).
 */
import express from "express";
import cors from "cors";
import cookieParser = require("cookie-parser");
import { randomUUID } from "crypto";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { errorMiddleware } from "@packages/error-handler/error-middleware";

const logger = pino({
  name: "deal-service",
  level: process.env.LOG_LEVEL || "info",
});

const app = express();

// Correlation ID : réutilise l'en-tête entrant (propagation gateway →
// services), sinon en génère un. Renvoyé au client pour le support.
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers["x-correlation-id"];
      const id = typeof incoming === "string" && incoming ? incoming : randomUUID();
      res.setHeader("x-correlation-id", id);
      return id;
    },
  })
);

app.use(
  cors({
    origin: ["http://localhost:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send({ message: "Hello Deal API" });
});

// Health check — utilisé par le gateway et les smoke tests CI.
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "deal-service" });
});

// OpenAPI 3.1 minimal (main-crafted) — remplacé en PR3 par la
// génération Zod → OAS depuis @packages/api-contracts.
const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Yamba — Deal Service API",
    version: "0.0.1",
    description:
      "Transactional core: deal (Booking) lifecycle. " +
      "Skeleton (PR1) — business endpoints land in PR3.",
  },
  servers: [
    { url: "http://localhost:8080/api", description: "Through the API gateway" },
    { url: "http://localhost:6003", description: "Direct (dev)" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          "200": {
            description: "Service is up",
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
  },
};
app.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});

// Visionneuse Scalar (CDN, zéro dépendance npm) — pattern PR #69 :
// lit le document vivant ci-dessus, incapable de mentir.
app.get("/docs", (req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <title>Yamba — Deal Service API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

app.use(errorMiddleware);

const port = process.env.PORT || 6003;
const server = app.listen(port, () => {
  logger.info(`Deal service running at http://localhost:${port}`);
  logger.info(`OpenAPI 3.1 at http://localhost:${port}/openapi.json`);
  logger.info(`API docs at http://localhost:${port}/docs`);
});
server.on("error", (err) => {
  logger.error({ err }, "Server error");
});

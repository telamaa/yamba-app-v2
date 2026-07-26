/**
 * notification-service — main.ts
 * ==============================
 * Boîte aux lettres de Yamba (chantier B1-PR4bis). Port 6004 (A16).
 *
 * Lot 4b : le consumer booking-events démarre APRÈS le listen —
 * miroir du câblage relay (deal-service, A24) :
 * - boot SANS secret ni broker : si Redpanda est absent, l'API vit,
 *   et le consumer retente sa connexion toutes les 5 s (timer unref) ;
 * - NOTIFICATION_CONSUMER_ENABLED=false désigne une instance API
 *   pure (scaling horizontal) — le groupId protège de toute façon :
 *   plusieurs instances du même groupe se PARTAGENT les partitions ;
 * - arrêt propre SIGTERM/SIGINT gardé : consumer déconnecté (offsets
 *   commités), serveur fermé, ceinture 5 s.
 * pino + correlation ID dès la naissance ; le handler trace le
 * correlationId PORTÉ PAR LES ÉVÉNEMENTS (gateway → outbox → Kafka).
 */
import express from "express";
import cors from "cors";
import cookieParser = require("cookie-parser");
import { randomUUID } from "crypto";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import {
  CONSUMER_GROUPS,
  KafkaEventConsumer,
  TOPICS,
} from "@packages/messaging";
import { handleBookingEventMessage } from "./consumer/booking-events.consumer";
import { buildOpenApiDocument } from "./openapi/build-openapi";
import notificationRouter from "./routes/notification.routes";

const logger = pino({
  name: "notification-service",
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
      const id =
        typeof incoming === "string" && incoming ? incoming : randomUUID();
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
  res.send({ message: "Hello Notification API" });
});

// Health check — utilisé par le gateway et les smoke tests CI.
// Volontairement AVANT les routes authentifiées et sans dépendance DB.
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "notification-service" });
});

// OpenAPI 3.1 GÉNÉRÉ depuis les schémas Zod (D3) — pattern deal.
const openApiDocument = buildOpenApiDocument();
app.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});

// Visionneuse Scalar (CDN, zéro dépendance npm) : lit le document
// vivant ci-dessus, incapable de mentir.
app.get("/docs", (req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <title>Yamba — Notification Service API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

// Routes métier — avant l'error-middleware.
app.use(notificationRouter);

app.use(errorMiddleware);

const port = Number(process.env.NOTIFICATION_SERVICE_PORT ?? 6004);
const server = app.listen(port, () => {
  logger.info(`notification-service listening on :${port}`);
});

server.on("error", (err) => {
  logger.error(err, "server error");
});

// ── Consumer booking-events (PR4bis, A25) ───────────────────────────
const consumerEnabled = process.env.NOTIFICATION_CONSUMER_ENABLED !== "false";
const consumerLogger = logger.child({ module: "booking-events-consumer" });

const consumer = new KafkaEventConsumer({
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim()),
  clientId: "notification-service",
  groupId: CONSUMER_GROUPS.NOTIFICATION_SERVICE,
});

let consumerRunning = false;
let retryTimer: NodeJS.Timeout | null = null;

const CONSUMER_RETRY_MS = 5_000;

async function startConsumer(): Promise<void> {
  try {
    await consumer.connect();
    await consumer.subscribe(TOPICS.BOOKING_EVENTS);
    await consumer.run((message) =>
      handleBookingEventMessage(message, consumerLogger)
    );
    consumerRunning = true;
    consumerLogger.info(
      { topic: TOPICS.BOOKING_EVENTS, groupId: CONSUMER_GROUPS.NOTIFICATION_SERVICE },
      "Consumer running"
    );
  } catch (err) {
    consumerLogger.error(
      { err, nextRetryMs: CONSUMER_RETRY_MS },
      "Consumer start failed — retrying"
    );
    retryTimer = setTimeout(() => {
      void startConsumer();
    }, CONSUMER_RETRY_MS);
    retryTimer.unref(); // le serveur HTTP porte la vie du process (§6.4)
  }
}

if (consumerEnabled) {
  void startConsumer();
} else {
  logger.info("Consumer disabled (NOTIFICATION_CONSUMER_ENABLED=false)");
}

// ── Arrêt propre — gardé contre les SIGINT répétés (leçon PR4) ──────
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  // Ceinture : sortie garantie même si une déconnexion traîne.
  const belt = setTimeout(() => process.exit(0), 5_000);
  belt.unref();
  if (retryTimer) clearTimeout(retryTimer);
  if (consumerRunning || consumerEnabled) {
    try {
      await consumer.disconnect();
      logger.info("Consumer disconnected");
    } catch (err) {
      logger.error({ err }, "Consumer disconnect failed");
    }
  }
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

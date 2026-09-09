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
import { initSentry } from "@packages/error-handler";
// C-PR3 (D56 7A) — Sentry : inerte sans SENTRY_DSN ; 5xx tagués du service et de l'identifiant de corrélation.
initSentry("notification-service");
import express from "express";
import { healthHandler, mongoCheck, redisCheck } from "@packages/libs/health";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
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
import { handleMessagingEventMessage } from "./consumer/messaging-events.consumer";
import { superviseConsumer, type SupervisedConsumer } from "./consumer/supervisor";
import { buildOpenApiDocument } from "./openapi/build-openapi";
import notificationRouter from "./routes/notification.routes";
import { makeRetentionService, startRetentionCron } from "./cron/retention.cron";

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
// D35 3A — le corps brut est conservé pour vérifier la signature du webhook email.
app.use(express.json({ limit: "10mb", verify: (req, _res, buf) => { (req as express.Request & { rawBody?: string }).rawBody = buf.toString("utf8"); } }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send({ message: "Hello Notification API" });
});

// Health check — utilisé par le gateway et les smoke tests CI.
// Volontairement AVANT les routes authentifiées et sans dépendance DB.
// ANO-CRON-08 — les deux consommateurs sont déclarés ici pour que `/health` puisse dire la
// vérité à leur sujet : un consommateur activé mais à l'arrêt rend le service `degraded`.
const consumerEnabled = process.env.NOTIFICATION_CONSUMER_ENABLED !== "false";
let bookingSupervisor: SupervisedConsumer | null = null;
let messagingSupervisor: SupervisedConsumer | null = null;

/**
 * Délai laissé aux consommateurs pour rejoindre leur groupe avant de compter comme tombés.
 * Rejoindre prend une dizaine de secondes après un arrêt (le courtier attend l'expiration de
 * la session du membre précédent) : sans ce délai de grâce, chaque démarrage passerait par une
 * fenêtre `degraded` et ferait clignoter la sonde publique.
 */
const CONSUMER_STARTUP_GRACE_MS = 90_000;
const bootedAt = Date.now();

/** Vérification `consumers` : jette (donc `degraded`) dès qu'un consommateur attendu est mort. */
const consumersCheck = async (): Promise<void> => {
  if (!consumerEnabled) return;
  const enPanne = (s: SupervisedConsumer | null): boolean => {
    if (s?.running()) return false;
    // Pas encore démarré ET dans le délai de grâce : on ne crie pas, on attend.
    if (!s?.everRan() && Date.now() - bootedAt < CONSUMER_STARTUP_GRACE_MS) return false;
    return true;
  };
  const morts: string[] = [];
  if (enPanne(bookingSupervisor)) morts.push(TOPICS.BOOKING_EVENTS);
  if (enPanne(messagingSupervisor)) morts.push(TOPICS.MESSAGING_EVENTS);
  if (morts.length > 0) throw new Error(`consumer(s) not running: ${morts.join(", ")}`);
};

app.get("/health", healthHandler("notification-service", { mongo: mongoCheck(prisma), redis: redisCheck(redis), consumers: consumersCheck })); // D64 3A, ANO-CRON-08

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
let retentionCron: import("node-cron").ScheduledTask | null = null;
const server = app.listen(port, () => {
  logger.info(`notification-service listening on :${port}`);
  // C-PR8c (D64 6A) — purge nocturne : notifications, traces d'emails, registre consommé
  if (process.env.RETENTION_CRON_ENABLED !== "false") retentionCron = startRetentionCron(makeRetentionService(), logger.child({ module: "retention-cron" }));
});

server.on("error", (err) => {
  logger.error(err, "server error");
});

// ── Consumers booking-events (PR4bis, A25) et messaging-events (F-PR2, D61 6A) ──────
// Groupes et sujets SÉPARÉS : un incident sur le chat ne bloque jamais les événements
// d'argent, et chaque flux garde ses propres offsets.
//
// La supervision (ANO-CRON-08) est la même pour les deux : démarrage réessayé, plantage
// définitif rattrapé avec retrait exponentiel, état exposé à `/health`.
const consumerLogger = logger.child({ module: "booking-events-consumer" });
const messagingLogger = logger.child({ module: "messaging-events-consumer" });

const consumer = new KafkaEventConsumer({
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
    .split(",")
    .map((broker) => broker.trim()),
  clientId: "notification-service",
  groupId: CONSUMER_GROUPS.NOTIFICATION_SERVICE,
});

const messagingConsumer = new KafkaEventConsumer({
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(",").map((broker) => broker.trim()),
  clientId: "notification-service-messaging",
  groupId: CONSUMER_GROUPS.MESSAGING_NOTIFICATIONS,
});

bookingSupervisor = superviseConsumer({
  consumer,
  topic: TOPICS.BOOKING_EVENTS,
  groupId: CONSUMER_GROUPS.NOTIFICATION_SERVICE,
  handler: (message) => handleBookingEventMessage(message, consumerLogger),
  logger: consumerLogger,
});

messagingSupervisor = superviseConsumer({
  consumer: messagingConsumer,
  topic: TOPICS.MESSAGING_EVENTS,
  groupId: CONSUMER_GROUPS.MESSAGING_NOTIFICATIONS,
  handler: (message) => handleMessagingEventMessage(message, messagingLogger),
  logger: messagingLogger,
});

if (consumerEnabled) {
  void bookingSupervisor.start();
  void messagingSupervisor.start();
} else {
  logger.info("Consumer disabled (NOTIFICATION_CONSUMER_ENABLED=false)");
}

// ── Arrêt propre — gardé contre les SIGINT répétés (leçon PR4) ──────
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  retentionCron?.stop();
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  // Ceinture : sortie garantie même si une déconnexion traîne.
  const belt = setTimeout(() => process.exit(0), 5_000);
  belt.unref();
  if (consumerEnabled) {
    try {
      await messagingConsumer.disconnect();
      messagingLogger.info("Messaging consumer disconnected");
    } catch (err) {
      messagingLogger.error({ err }, "Messaging consumer disconnect failed");
    }
  }
  if (consumerEnabled) {
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

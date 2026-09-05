/**
 * deal-service — main.ts
 * ======================
 * Cœur transactionnel de Yamba (chantier B1+). Port 6003 (D1).
 *
 * PR1 (squelette) : boot SANS secret ni connexion DB obligatoire — un
 * service qui exige un .env pour démarrer est un service qu'on ne peut
 * ni smoke-tester ni CI-ser (leçon getImageKit, PR #69). Le client
 * Prisma est importé par les controllers mais sa connexion est LAZY :
 * /health et /docs restent vivants sans base.
 *
 * PR3 : l'OAS main-crafted est remplacé par buildOpenApiDocument()
 * (généré depuis @packages/api-contracts — D3, pattern trip-service)
 * et les routes de lecture sont montées (deal.routes.ts).
 *
 * PR4 : l'outbox relay (D2) démarre après le listen — connexion broker
 * LAZY (l'API vit même sans Redpanda), bail d'exclusivité, arrêt
 * propre SIGTERM/SIGINT. OUTBOX_RELAY_ENABLED=false désigne une
 * instance API pure (scaling horizontal).
 *
 * Template service (registre B1) : pino + correlation ID dès la
 * naissance — chaque requête porte un id traçable de bout en bout,
 * qui suit les événements outbox → Kafka (relay PR4).
 */
import { initSentry } from "@packages/error-handler";
// C-PR3 (D56 7A) — Sentry : inerte sans SENTRY_DSN ; 5xx tagués du service et de l'identifiant de corrélation.
initSentry("deal-service");
import express from "express";
import cors from "cors";
import cookieParser = require("cookie-parser");
import { randomUUID } from "crypto";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import { KafkaEventPublisher } from "@packages/messaging";
import { buildOpenApiDocument } from "./openapi/build-openapi";
import dealRouter, { dealLifecycleService, dealRatingService, dealSettlementService, opsAlertsService } from "./routes/deal.routes";
import redis from "@packages/libs/redis";
import prisma from "@packages/libs/prisma";
import { healthHandler, mongoCheck, redisCheck } from "@packages/libs/health";
import { startOpsAlertsCron } from "./cron/ops-alerts.cron";
import { startRecipientRedactionCron } from "./cron/recipient-redaction.cron";
import { startOutboxRetentionCron } from "./cron/outbox-retention.cron";
import { makeRecipientRedactionService } from "./services/recipient-redaction.service";
import { makeStripeWebhookHandler } from "./controllers/stripe-webhook.controller";
import { startBookingExpiryCron } from "./cron/expire-bookings.cron";
import { startBookingPayoutCron } from "./cron/payout-bookings.cron";
import { startOpsDigestCron } from "./cron/ops-digest.cron";
import { startRatingCron } from "./cron/rating.cron";
import { OutboxRelay } from "./relay/outbox-relay";

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
// ── Webhook Stripe (D40) — AVANT express.json : la signature porte sur
// les octets BRUTS du corps (un JSON re-sérialisé la casse — même raison
// pour laquelle on n'y passe jamais par le gateway).
app.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  makeStripeWebhookHandler(dealLifecycleService, logger.child({ module: "stripe-webhook" }), dealSettlementService)
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send({ message: "Hello Deal API" });
});

// Health check — utilisé par le gateway et les smoke tests CI.
// Volontairement AVANT les routes authentifiées et sans dépendance DB.
// D64 3A — santé uniforme : Mongo + Redis, 2 s chacun, toujours 200 (le corps dit « ok » ou « degraded »).
app.get("/health", healthHandler("deal-service", { mongo: mongoCheck(prisma), redis: redisCheck(redis) }));

// OpenAPI 3.1 GÉNÉRÉ depuis les schémas Zod (D3) — construit une fois
// au boot : le document ne peut pas diverger des contrats importés.
const openApiDocument = buildOpenApiDocument();
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

// Routes métier (lecture seule en PR3) — avant l'error-middleware.
app.use(dealRouter);

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

// ── Outbox relay (PR4, D2) ──────────────────────────────────────────
// Le producteur du pattern outbox. Désactivable par env pour des
// instances API pures — le bail (relay-lease) protège de toute façon
// contre la double publication si plusieurs relays tournent.
const relayEnabled = process.env.OUTBOX_RELAY_ENABLED !== "false";
let relay: OutboxRelay | null = null;

if (relayEnabled) {
  const publisher = new KafkaEventPublisher({
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092")
      .split(",")
      .map((broker) => broker.trim()),
    clientId: "deal-service",
  });
  relay = new OutboxRelay({
    publisher,
    logger: logger.child({ module: "outbox-relay" }),
  });
  relay.start();
} else {
  logger.info("Outbox relay disabled (OUTBOX_RELAY_ENABLED=false)");
}

// ── Cron expiration 24 h (DEA-01, B2-PR2) ───────────────────────────
// Matérialise les PENDING périmés (la machine les traite déjà comme
// EXPIRED via son guard — le cron libère l'argent et les kg).
const expiryCronEnabled = process.env.BOOKING_EXPIRY_CRON_ENABLED !== "false";
const expiryCron = expiryCronEnabled
  ? startBookingExpiryCron(dealLifecycleService, logger.child({ module: "expire-bookings-cron" }))
  : null;
if (!expiryCronEnabled) {
  logger.info("Booking expiry cron disabled (BOOKING_EXPIRY_CRON_ENABLED=false)");
}

// ── Cron versement J+4 + rejeu + rappel J+3 (B4, A66/A70) ───────────
const payoutCronEnabled = process.env.BOOKING_PAYOUT_CRON_ENABLED !== "false";
const payoutCron = payoutCronEnabled
  ? startBookingPayoutCron(dealSettlementService, logger.child({ module: "payout-bookings-cron" }))
  : null;
if (!payoutCronEnabled) {
  logger.info("Booking payout cron disabled (BOOKING_PAYOUT_CRON_ENABLED=false)");
}

// ── Récapitulatif quotidien support (A88) ─────────────────────────────
const opsDigestEnabled = process.env.OPS_DIGEST_CRON_ENABLED !== "false";
const opsDigestCron = opsDigestEnabled
  ? startOpsDigestCron(dealSettlementService, logger.child({ module: "ops-digest-cron" }))
  : null;
if (!opsDigestEnabled) {
  logger.info("Ops digest cron disabled (OPS_DIGEST_CRON_ENABLED=false)");
}

// ── Alertes de seuil horaires (C-PR6b, D59 3A) — dédoublonnées par Redis, un email par règle et par jour ──
const opsAlertsEnabled = process.env.OPS_ALERTS_CRON_ENABLED !== "false";
const opsAlertsCron = opsAlertsEnabled ? startOpsAlertsCron(opsAlertsService, redis, logger.child({ module: "ops-alerts-cron" })) : null;
if (!opsAlertsEnabled) {
  logger.info("Ops alerts cron disabled (OPS_ALERTS_CRON_ENABLED=false)");
}

// ── C-PR8b (D63 5A) — le tiers destinataire s'efface N jours après la fin du deal ──
const recipientRedactionEnabled = process.env.RECIPIENT_REDACTION_CRON_ENABLED !== "false";
const recipientRedactionCron = recipientRedactionEnabled ? startRecipientRedactionCron(makeRecipientRedactionService(), logger.child({ module: "recipient-redaction-cron" })) : null;
if (!recipientRedactionEnabled) logger.info("Recipient redaction cron disabled (RECIPIENT_REDACTION_CRON_ENABLED=false)");

// ── C-PR8c (D64 6A) — purge des événements `booking` publiés depuis retention.outboxPublishedDays ──
const outboxRetentionEnabled = process.env.OUTBOX_RETENTION_CRON_ENABLED !== "false";
const outboxRetentionCron = outboxRetentionEnabled ? startOutboxRetentionCron("booking", "deal-service", logger.child({ module: "outbox-retention-cron" })) : null;
if (!outboxRetentionEnabled) logger.info("Outbox retention cron disabled (OUTBOX_RETENTION_CRON_ENABLED=false)");

// ── Cron notation : relances J+5/J+7, révélation à 14 j (B5, D53) ─────
const ratingCronEnabled = process.env.RATING_CRON_ENABLED !== "false";
const ratingCron = ratingCronEnabled ? startRatingCron(dealRatingService, logger.child({ module: "rating-cron" })) : null;
if (!ratingCronEnabled) {
  logger.info("Rating cron disabled (RATING_CRON_ENABLED=false)");
}

// Arrêt propre : batch en vol terminé, bail libéré, producer déconnecté,
// serveur HTTP fermé. La ceinture setTimeout garantit la sortie même si
// une déconnexion traîne (5 s max). Le garde évite qu'un SIGINT répété
// (utilisateur impatient — observé au smoke PR4, arrêt lent broker down)
// ne relance N arrêts concurrents.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down deal-service");
  void (async () => {
    if (expiryCron) {
      expiryCron.stop();
    }
    if (payoutCron) {
      payoutCron.stop();
    }
    if (opsDigestCron) {
      opsDigestCron.stop();
    }
    if (opsAlertsCron) {
      opsAlertsCron.stop();
    }
    if (ratingCron) {
      ratingCron.stop();
    }
    if (recipientRedactionCron) {
      recipientRedactionCron.stop();
    }
    if (outboxRetentionCron) {
      outboxRetentionCron.stop();
    }
    if (relay) {
      await relay.stop().catch((err) => logger.error({ err }, "Relay stop failed"));
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5_000).unref();
  })();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

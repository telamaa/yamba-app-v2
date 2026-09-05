/**
 * message-service — main.ts
 * =========================
 * Chantier F (D61). Port 6005 (A18). Coordination Expéditeur ↔ Voyageur : le rendez-vous
 * comme objet, le fil pour le reste, le numéro révélé tard.
 *
 * Même câblage que les autres services : Sentry en première ligne, identifiant de corrélation
 * dès la naissance, middleware d'erreurs commun, relais outbox démarré APRÈS le listen (le
 * service vit sans broker : les événements s'accumulent et partent au retour de Redpanda).
 */
import { initSentry } from "@packages/error-handler";
initSentry("message-service");
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
import { KafkaEventPublisher } from "@packages/messaging";
import messageRouter from "./routes/message.routes";
import adminRouter from "./routes/admin.router";
import { makeUnreadReminderService } from "./services/unread-reminder.service";
import { makeConversationRetentionService } from "./services/conversation-retention.service";
import { startUnreadReminderCron } from "./cron/unread-reminder.cron";
import { startConversationRetentionCron } from "./cron/conversation-retention.cron";
import { startOutboxRetentionCron } from "./cron/outbox-retention.cron";
import { MessagingOutboxRelay } from "./relay/messaging-relay";
import { buildOpenApiDocument } from "./openapi/build-openapi";

const logger = pino({ name: "message-service", level: process.env.LOG_LEVEL || "info" });
const app = express();

app.use((req, res, next) => {
  const correlationId = (req.headers["x-correlation-id"] as string | undefined) ?? randomUUID();
  req.headers["x-correlation-id"] = correlationId;
  res.setHeader("x-correlation-id", correlationId);
  next();
});
app.use(pinoHttp({ logger, customProps: (req) => ({ correlationId: req.headers["x-correlation-id"] }) }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/health", healthHandler("message-service", { mongo: mongoCheck(prisma), redis: redisCheck(redis) })); // D64 3A
app.get("/openapi.json", (_req, res) => {
  res.json(buildOpenApiDocument());
});

app.use("/messages", messageRouter);
// F-PR3 (D61 7A) — lecture admin depuis un dossier, file des signalements (session admin seulement).
app.use("/admin/conversations", adminRouter);
app.use(errorMiddleware);

const port = Number(process.env.MESSAGE_SERVICE_PORT ?? 6005);
const server = app.listen(port, () => {
  logger.info({ port }, "message-service listening");
});

// Relais outbox : démarré après le listen, arrêté proprement (le bail est libéré).
const relayEnabled = process.env.MESSAGING_RELAY_ENABLED !== "false";
const relay = relayEnabled
  ? new MessagingOutboxRelay({
      publisher: new KafkaEventPublisher({ clientId: "message-service", brokers: (process.env.KAFKA_BROKERS ?? "localhost:9092").split(",") }),
      logger: logger.child({ module: "messaging-relay" }),
    })
  : null;
relay?.start();
if (!relayEnabled) logger.info("Messaging outbox relay disabled (MESSAGING_RELAY_ENABLED=false)");

// F-PR3 (D61 6A) — relance email des messages non lus (15 min, une par heure et par conversation).
const reminderEnabled = process.env.MESSAGING_REMINDER_CRON_ENABLED !== "false";
const reminderCron = reminderEnabled ? startUnreadReminderCron(makeUnreadReminderService(), logger.child({ module: "unread-reminder-cron" })) : null;
if (!reminderEnabled) logger.info("Unread reminder cron disabled (MESSAGING_REMINDER_CRON_ENABLED=false)");

// F-PR3 (D61 8A) — purge nocturne des conversations un an après la fin du deal.
// C-PR8c (D64 6A) — purge des événements `conversation` publiés
const outboxRetentionCron = process.env.OUTBOX_RETENTION_CRON_ENABLED !== "false" ? startOutboxRetentionCron("conversation", "message-service", logger.child({ module: "outbox-retention-cron" })) : null;

const retentionEnabled = process.env.MESSAGING_RETENTION_CRON_ENABLED !== "false";
const retentionCron = retentionEnabled ? startConversationRetentionCron(makeConversationRetentionService(), logger.child({ module: "conversation-retention-cron" })) : null;
if (!retentionEnabled) logger.info("Conversation retention cron disabled (MESSAGING_RETENTION_CRON_ENABLED=false)");

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "message-service shutting down");
  reminderCron?.stop();
  retentionCron?.stop();
  outboxRetentionCron?.stop();
  if (relay) await relay.stop().catch((err) => logger.error({ err }, "Relay stop failed"));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

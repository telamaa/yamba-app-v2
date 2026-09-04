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
import cors from "cors";
import cookieParser = require("cookie-parser");
import { randomUUID } from "crypto";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import { KafkaEventPublisher } from "@packages/messaging";
import messageRouter from "./routes/message.routes";
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

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "message-service" });
});
app.get("/openapi.json", (_req, res) => {
  res.json(buildOpenApiDocument());
});

app.use("/messages", messageRouter);
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

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "message-service shutting down");
  if (relay) await relay.stop().catch((err) => logger.error({ err }, "Relay stop failed"));
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

/**
 * notification-service — main.ts
 * ==============================
 * Boîte aux lettres de Yamba (chantier B1-PR4bis). Port 6004 (A16).
 *
 * Lot 1 (squelette) : boot SANS secret ni connexion DB obligatoire
 * (template service B1 — leçon getImageKit) : /health vit sans base
 * ni broker. Le consumer booking-events (A25) démarrera après le
 * listen, connexion broker LAZY, aux lots suivants — même pattern
 * que le relay du deal-service (A24).
 *
 * pino + correlation ID dès la naissance : chaque requête porte un
 * id traçable ; le consumer reprendra le correlationId porté par
 * LES ÉVÉNEMENTS pour tracer seed → outbox → Kafka → notification.
 */
import express from "express";
import cors from "cors";
import cookieParser = require("cookie-parser");
import { randomUUID } from "crypto";
import pino from "pino";
import { pinoHttp } from "pino-http";
import { errorMiddleware } from "@packages/error-handler/error-middleware";

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

app.use(errorMiddleware);

const port = Number(process.env.NOTIFICATION_SERVICE_PORT ?? 6004);
const server = app.listen(port, () => {
  logger.info(`notification-service listening on :${port}`);
});

server.on("error", (err) => {
  logger.error(err, "server error");
});

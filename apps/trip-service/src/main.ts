import { initSentry } from "@packages/error-handler";
import adminRouter from "./routes/admin.router";
// C-PR3 (D56 7A) — Sentry : inerte sans SENTRY_DSN ; 5xx tagués du service et de l'identifiant de corrélation.
initSentry("trip-service");
import express from 'express';
// Cron quotidien : PUBLISHED/PAUSED → COMPLETED (arrivée + 24h)
import { startCompleteTripsCron } from "./cron/complete-trips.cron";
import cors from "cors";
import cookieParser = require("cookie-parser");
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import tripRouter from "./routes/trip.router";
import uploadRouter from "./routes/upload.routes";
import { healthHandler, mongoCheck, redisCheck } from "@packages/libs/health";
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";
// Chantier 0 (D3) — OAS 3.1 généré depuis @packages/api-contracts
import { buildOpenApiDocument } from "./openapi/build-openapi";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);
app.use(express.json({ limit: "100mb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send({ message: "Hello Trip API" });
});
app.get("/health", healthHandler("trip-service", { mongo: mongoCheck(prisma), redis: redisCheck(redis) })); // D64 3A

// OpenAPI 3.1 (source de vérité : Zod) — construit une fois au démarrage.
const openApiDocument = buildOpenApiDocument();
app.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});

// Visionneuse de doc (Scalar via CDN, zéro dépendance npm) : lit le
// document vivant ci-dessus, donc toujours à jour par construction —
// contrairement au Swagger legacy retiré au Lot C, qui mentait.
app.get("/docs", (req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head>
  <title>Yamba — Trip Service API</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/openapi.json"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`);
});

// Routes
app.use("/trips", tripRouter);
app.use("/uploads", uploadRouter);
app.use("/admin", adminRouter); // C-PR4 (D57) — trajets, masquage, billets

app.use(errorMiddleware);

const port = process.env.PORT || 6002;
const server = app.listen(port, () => {
  console.log(`Trip service running at http://localhost:${port}`);
  console.log(`OpenAPI 3.1 at http://localhost:${port}/openapi.json`);
  console.log(`API docs at http://localhost:${port}/docs`);
  startCompleteTripsCron();
});

server.on("error", (err) => {
  console.log("Server Error:", err);
});

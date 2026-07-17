import express from 'express';
// Cron quotidien : PUBLISHED/PAUSED → COMPLETED (arrivée + 24h)
import { startCompleteTripsCron } from "./cron/complete-trips.cron";
import cors from "cors";
import cookieParser = require("cookie-parser");
import swaggerUi from "swagger-ui-express";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import tripRouter from "./routes/trip.router";
import uploadRouter from "./routes/upload.routes";
// Chantier 0 (D3) — OAS 3.1 généré depuis @packages/api-contracts
import { buildOpenApiDocument } from "./openapi/build-openapi";

const swaggerDocument = require("./swagger-output.json");

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

// Swagger legacy (swagger-autogen) — retiré au Lot C du chantier 0
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs-json", (req, res) => {
  res.json(swaggerDocument);
});

// OpenAPI 3.1 (source de vérité : Zod) — construit une fois au démarrage
const openApiDocument = buildOpenApiDocument();
app.get("/openapi.json", (req, res) => {
  res.json(openApiDocument);
});

// Routes
app.use("/trips", tripRouter);
app.use("/uploads", uploadRouter);

app.use(errorMiddleware);

const port = process.env.PORT || 6002;
const server = app.listen(port, () => {
  console.log(`Trip service running at http://localhost:${port}`);
  console.log(`Swagger Docs at http://localhost:${port}/api-docs`);
  console.log(`OpenAPI 3.1 at http://localhost:${port}/openapi.json`);

  // Lot 3 — Démarre le cron une fois le serveur prêt (idempotent)
  startCompleteTripsCron();
});

server.on("error", (err) => {
  console.log("Server Error:", err);
});

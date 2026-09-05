import { initSentry } from "@packages/error-handler";
// C-PR3 (D56 7A) — Sentry : inerte sans SENTRY_DSN ; 5xx tagués du service et de l'identifiant de corrélation.
initSentry("auth-service");
import express from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import {errorMiddleware} from "@packages/error-handler/error-middleware";
import router from "./routes/auth.router";
import carrierRouter from "./routes/carrier.router";
import userPublicRouter from "./routes/user-public.router";
import savedRouteRouter from "./routes/saved-route.router";
import adminRouter from "./routes/admin.router";
import { healthHandler, mongoCheck, redisCheck } from "@packages/libs/health";
import { buildOpenApiDocument } from "./openapi/build-openapi"; // A145
import prisma from "@packages/libs/prisma";
import redis from "@packages/libs/redis";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://192.168.1.155:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send({ 'message': 'Hello Auth API'});
});
app.get("/health", healthHandler("auth-service", { mongo: mongoCheck(prisma), redis: redisCheck(redis) })); // D64 3A

// A145 — OpenAPI 3.1 GÉNÉRÉ depuis les schémas Zod (D3), construit une fois au boot ;
// un test exige que chaque route montée soit documentée. Visionneuse Scalar (CDN).
const openApiDocument = buildOpenApiDocument();
app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});
app.get("/docs", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html>
<head><title>Yamba — Auth Service API</title><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body><script id="api-reference" data-url="/openapi.json"></script><script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script></body>
</html>`);
});

// Routes
app.use("/api", router);
app.use("/api", carrierRouter);
app.use("/api", userPublicRouter);
app.use("/api", savedRouteRouter);
app.use("/api", adminRouter); // chantier C (D54) — /auth/admin/*, /admin/*

app.use(errorMiddleware);

const port = process.env.PORT || 6001;
const server = app.listen(port, () => {
  console.log(`Auth service is running at http://localhost:${port}/api`);
});

server.on("error", (err) => {
  console.log("Server Error:", err);
});

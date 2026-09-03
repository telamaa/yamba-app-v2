import express from 'express';
import cors from "cors";
import cookieParser from "cookie-parser";
import {errorMiddleware} from "@packages/error-handler/error-middleware";
import router from "./routes/auth.router";
import carrierRouter from "./routes/carrier.router";
import userPublicRouter from "./routes/user-public.router";
import savedRouteRouter from "./routes/saved-route.router";
import adminRouter from "./routes/admin.router";

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

// Le Swagger legacy (swagger-autogen, /api-docs, /docs-json) a été retiré
// avec la session D27 — la conversion OpenAPI 3.1 d'auth-service (contrats
// Zod dans @packages/api-contracts) est un chantier ultérieur.

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

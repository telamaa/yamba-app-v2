import express from 'express';
import cors from 'cors';
import proxy from "express-http-proxy";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { randomUUID } from "crypto";

const app = express();

app.use(
  // cors({
  //   // origin: ["http://localhost:3000"],
  //   origin: ["http://localhost:3000", "http://192.168.1.155:3000"],
  //   allowedHeaders: ["Authorization", "Content-Type"],
  //   credentials: true,
  // })

  cors({
    origin: (origin, callback) => {
      // Requêtes sans origin (curl, server-side) : autoriser
      if (!origin) return callback(null, true);
      // 3000 = user-ui · 3001 = admin-ui (chantier C, D54). Même en proxy
      // D48 (Next → gateway), l'en-tête Origin du navigateur est transmis :
      // l'admin ouvert sur l'IP LAN doit donc être connu ici aussi.
      const allowed = [
        /^http:\/\/localhost:300[01]$/,
        /^http:\/\/192\.168\.\d+\.\d+:300[01]$/, // Wi-Fi domestique
        /^http:\/\/10\.\d+\.\d+\.\d+:300[01]$/, // Réseau d'entreprise
      ];
      if (allowed.some((re) => re.test(origin))) return callback(null, true);
      return callback(new Error("Not allowed by CORS: " + origin));
    },
    credentials: true,
    // ... reste de ta config
  })
);

// ─── Correlation ID (B1 — template service) ──
// Posé à l'ENTRÉE du système : si le client n'en fournit pas, on en
// génère un. express-http-proxy transmet les headers → tous les
// services en aval (auth, trip, deal) reçoivent le même ID.
// deal-service (pino-http) le reprend et le renvoie dans sa réponse.
app.use((req, _res, next) => {
  if (!req.headers["x-correlation-id"]) {
    req.headers["x-correlation-id"] = randomUUID();
  }
  next();
});

app.use(morgan("dev"));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));
app.use(cookieParser());
app.set("trust proxy", 1);

// Apply rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: any) => (req.user ? 1000 : 100),
  message: { error: "Too many requests, please try again later!" },
  standardHeaders: true,
  skipFailedRequests: true,
  validate: false,
});

app.use(limiter);

app.get('/gateway-health', (req, res) => {
  res.send({ message: 'Welcome to api-gateway!' });
});

// ─── Trip Service (port 6002) ────────────────
// /api/trips/* → trip-service reçoit /trips/*
app.use(
  "/api/trips",
  proxy("http://localhost:6002", {
    proxyReqPathResolver: (req) => `/trips${req.url}`,
  })
);

// ─── Upload Service (port 6002) ──────────────
// /api/uploads/* → trip-service reçoit /uploads/*
app.use(
  "/api/uploads",
  proxy("http://localhost:6002", {
    proxyReqPathResolver: (req) => `/uploads${req.url}`,
  })
);

// ─── Deal Service (port 6003) ────────────────
// ⚠️ Déclarés AVANT le catch-all auth ("/") — sinon /api/deals
// partirait vers auth-service.
// /api/deals/* → deal-service reçoit /deals/*
app.use(
  "/api/deals",
  proxy("http://localhost:6003", {
    proxyReqPathResolver: (req) => `/deals${req.url}`,
  })
);

// /api/me/bookings/* → deal-service reçoit /me/bookings/*
// (liste "Mes envois" côté Expéditeur — PR3)
app.use(
  "/api/me/bookings",
  proxy("http://localhost:6003", {
    proxyReqPathResolver: (req) => `/me/bookings${req.url}`,
  })
);

// /api/me/deals/* → deal-service reçoit /me/deals/*
// (deals reçus côté Voyageur, tous trajets — A44)
app.use(
  "/api/me/deals",
  proxy("http://localhost:6003", {
    proxyReqPathResolver: (req) => `/me/deals${req.url}`,
  })
);

// /api/admin/disputes/* → deal-service reçoit /admin/disputes/* (chantier C, D54)
// Le reste de /api/admin/* (me, audit) et /api/auth/admin/* → auth-service (catch-all).
app.use(
  "/api/admin/disputes",
  proxy("http://localhost:6003", {
    proxyReqPathResolver: (req) => `/admin/disputes${req.url}`,
  })
);

// /api/admin/trips/*, /api/admin/tickets/* → trip-service reçoit /admin/… (C-PR4, D57)
app.use(
  "/api/admin/trips",
  proxy("http://localhost:6002", {
    proxyReqPathResolver: (req) => `/admin/trips${req.url}`,
  })
);
app.use(
  "/api/admin/tickets",
  proxy("http://localhost:6002", {
    proxyReqPathResolver: (req) => `/admin/tickets${req.url}`,
  })
);

// /api/me/wallet → deal-service reçoit /me/wallet
// (Finances : portefeuille Voyageur + paiements Expéditeur — A83)
app.use(
  "/api/me/wallet",
  proxy("http://localhost:6003", {
    proxyReqPathResolver: (req) => `/me/wallet${req.url}`,
  })
);

// ─── Notification Service (port 6004) ───────
// ⚠️ Déclaré AVANT le catch-all auth ("/") — sinon /api/me/notifications
// partirait vers auth-service (leçon squelette deal, PR1).
app.use(
  "/api/me/notifications",
  proxy("http://localhost:6004", {
    proxyReqPathResolver: (req) => `/me/notifications${req.url}`,
  })
);

// ─── Auth Service (port 6001) — catch-all ────
// /api/auth/*, /api/carrier/* → auth-service
app.use("/", proxy("http://localhost:6001"));

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});
server.on('error', console.error);

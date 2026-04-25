import express from 'express';
import cors from 'cors';
import proxy from "express-http-proxy";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  })
);

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

// ─── Auth Service (port 6001) — catch-all ────
// /api/auth/*, /api/carrier/* → auth-service
app.use("/", proxy("http://localhost:6001"));

const port = process.env.PORT || 8080;
const server = app.listen(port, () => {
  console.log(`API Gateway listening at http://localhost:${port}`);
});
server.on('error', console.error);

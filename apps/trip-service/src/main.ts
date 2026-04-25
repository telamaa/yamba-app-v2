import express from 'express';
import cors from "cors";
import cookieParser = require("cookie-parser");
import swaggerUi from "swagger-ui-express";
import { errorMiddleware } from "@packages/error-handler/error-middleware";
import tripRouter from "./routes/trip.router";
import uploadRouter from "./routes/upload.routes";
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

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.get("/docs-json", (req, res) => {
  res.json(swaggerDocument);
});

// Routes
app.use("/trips", tripRouter);
app.use("/uploads", uploadRouter);

app.use(errorMiddleware);

const port = process.env.PORT || 6002;
const server = app.listen(port, () => {
  console.log(`Trip service running at http://localhost:${port}`);
  console.log(`Swagger Docs at http://localhost:${port}/api-docs`);
});

server.on("error", (err) => {
  console.log("Server Error:", err);
});

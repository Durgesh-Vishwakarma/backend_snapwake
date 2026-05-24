import cors from "cors";
import express from "express";
import helmet from "helmet";
import os from "os";
import { PORT } from "./config/env.js";
import { authRouter } from "./routes/auth.routes.js";
import { verifyRouter } from "./routes/verify.routes.js";
import { logEvent } from "./utils/logger.js";
import { errorResponse } from "./utils/response.js";

const app = express();

app.use((req, res, next) => {
  req.setTimeout(60_000);
  res.setTimeout(60_000);
  next();
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "snapwake-ai",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/verify", verifyRouter);

app.use((_req, res) => {
  res.status(404).json(errorResponse("Route not found."));
});

app.use((error, req, res, _next) => {
  const isUploadSizeError = error?.code === "LIMIT_FILE_SIZE";
  const isUploadError =
    error?.name === "MulterError" ||
    error?.message?.includes("Unsupported image format");
  const status = isUploadSizeError ? 413 : isUploadError ? 400 : 500;

  logEvent("error", "express_error", {
    method: req.method,
    path: req.originalUrl,
    status,
    reason: error?.message,
  });

  if (isUploadSizeError) {
    return res.status(413).json(errorResponse("Uploaded image exceeds size limit."));
  }

  if (isUploadError) {
    return res.status(400).json(errorResponse(error.message));
  }

  return res.status(500).json(errorResponse("Internal server error"));
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`SnapWake AI backend running on port ${PORT}`);

  Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry?.family === "IPv4" && !entry.internal)
    .forEach((entry) => {
      console.log(`Phone/dev-client URL: http://${entry.address}:${PORT}`);
    });
});

const shutdown = () => {
  console.log("Shutting down SnapWake backend...");

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

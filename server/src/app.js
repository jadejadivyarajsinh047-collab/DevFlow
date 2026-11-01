
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import workspaceRoutes from "./routes/workspaceRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import commentRoutes from "./routes/commentRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";

const app = express();

app.use(helmet());

// Allowed frontend origins
const allowedOrigins = [
  "http://localhost:5173",
  process.env.CLIENT_URL,
  "https://devflow123-alpha.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (e.g. health checks)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "2mb" }));

app.use(morgan("dev"));

app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
  })
);

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "DevFlow API",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/tasks", commentRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/chat", chatRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);

  if (err.message?.startsWith("CORS blocked origin:")) {
    return res.status(403).json({
      message: err.message,
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      message: "That record already exists.",
    });
  }

  res.status(err.status || 500).json({
    message: err.message || "Internal server error.",
  });
});

export default app;

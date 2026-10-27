import express from "express";
import cors from "cors";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    }),
  );

  app.use(express.json());

  // Route de vérification imposée par le livret.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}
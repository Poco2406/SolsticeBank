import express from "express";
import cors from "cors";
import { env } from "./config/env.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());

  // Route de vérification imposée par le livret.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}
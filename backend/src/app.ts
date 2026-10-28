import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { transactionRouter } from "./routes/transaction.routes.js";
import { accountRouter } from "./routes/account.routes.js";
import { docsRouter } from "./docs/swagger.js";
import { usersRouter } from "./routes/users.routes.js";
import { meRouter } from "./routes/me.routes.js";
import { transferRouter } from "./routes/transfer.routes.js";
import { movementsRouter } from "./routes/movements.routes.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());

  // Route de vérification imposée par le livret.
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/api/users", usersRouter);
  app.use("/api/me", meRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/account", accountRouter);
  app.use("/api/movements", movementsRouter);
  app.use("/api/transactions", transactionRouter);
  app.use("/api/transfers", transferRouter);
  app.use("/api/docs", docsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
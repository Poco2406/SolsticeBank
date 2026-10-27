import mongoose from "mongoose";
import { env } from "./config/env.js";
import { createApp } from "./app.js";

async function start() {
  await mongoose.connect(env.mongodbUri);
  console.log("Connexion à MongoDB réussie.");

  const app = createApp();

  app.listen(env.port, "localhost", () => {
    console.log(`API disponible sur http://localhost:${env.port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Impossible de démarrer le serveur :", error);
  process.exit(1);
});
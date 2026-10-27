import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";

async function start() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("La variable MONGODB_URI est manquante.");
  }

  await mongoose.connect(mongoUri);
  console.log("Connexion à MongoDB réussie.");

  const app = createApp();
  const port = Number(process.env.PORT ?? 3000);

  app.listen(port, "localhost", () => {
    console.log(`API disponible sur http://localhost:${port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Impossible de démarrer le serveur :", error);
  process.exit(1);
});
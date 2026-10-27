import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { createApp } from "./app.js";

async function start() {
  await connectDb(env.mongodbUri);

  const app = createApp();

  app.listen(env.port, "localhost", () => {
    console.log(`API disponible sur http://localhost:${env.port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Impossible de démarrer le serveur :", error);
  process.exit(1);
});
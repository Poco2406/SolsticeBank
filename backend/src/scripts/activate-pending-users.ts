// src/scripts/activate-pending-users.ts
// Migration ponctuelle : le statut "pending" n'existe plus, les comptes concernés passent en "active".
// Lancement depuis backend/ : npx tsx src/scripts/activate-pending-users.ts
import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../config/db.js";
import { User } from "../models/User.js";

await connectDb(env.mongodbUri);

try {
    // Passage par la collection brute : "pending" n'est plus dans l'enum du modèle.
    const result = await User.collection.updateMany(
        { status: "pending" },
        { $set: { status: "active" } },
    );
    console.log(`${result.modifiedCount} compte(s) "pending" passé(s) en "active".`);
} finally {
    await disconnectDb();
}

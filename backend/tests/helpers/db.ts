// Base de test isolée : connexion, nettoyage entre les tests, déconnexion.
// Usage dans un fichier de test : appeler useTestDb() en haut du describe principal.
import mongoose from "mongoose";
import { env } from "../../src/config/env.js";
import { connectDb, disconnectDb } from "../../src/config/db.js";

function databaseName(uri: string): string {
    return new URL(uri).pathname.slice(1);
}

// Garde-fou : on ne vide jamais une base qui ne serait pas une base de test.
function assertTestDatabase() {
    const testDb = databaseName(env.mongodbTestUri);
    if (!testDb.endsWith("_test")) {
        throw new Error(`MONGODB_TEST_URI doit viser une base « *_test » (reçu : « ${testDb || "aucune"} »).`);
    }
    if (testDb === databaseName(env.mongodbUri)) {
        throw new Error("MONGODB_TEST_URI ne doit pas viser la même base que MONGODB_URI.");
    }
}

export async function clearDb() {
    const collections = Object.values(mongoose.connection.collections);
    await Promise.all(collections.map((c) => c.deleteMany({})));
}

export function useTestDb() {
    beforeAll(async () => {
        assertTestDatabase();
        await connectDb(env.mongodbTestUri);
        // Index uniques (email, pseudo, idempotence…) construits avant les tests.
        await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
        await clearDb();
    });

    afterEach(async () => {
        await clearDb();
    });

    afterAll(async () => {
        await disconnectDb();
    });
}

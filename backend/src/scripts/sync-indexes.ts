// src/scripts/sync-indexes.ts
// Aligne les index MongoDB sur ceux déclarés dans les modèles.
// Utile quand un index a changé dans le code : Mongoose crée les nouveaux
// index au démarrage, mais ne remplace jamais un index existant.
// Lancement depuis backend/ : npx tsx src/scripts/sync-indexes.ts
import { env } from "../config/env.js";
import { connectDb, disconnectDb } from "../config/db.js";
import { User } from "../models/User.js";
import { Account } from "../models/Account.js";
import { Operation } from "../models/Operation.js";
import { Movement } from "../models/Movement.js";
import { Transfer } from "../models/Transfer.js";
import { Transaction } from "../models/Transaction.js";
import { AuthToken } from "../models/AuthToken.js";

const models = [User, Account, Operation, Movement, Transfer, Transaction, AuthToken];

await connectDb(env.mongodbUri);

try {
    for (const model of models) {
        const { toDrop, toCreate } = await model.diffIndexes();
        if (toDrop.length === 0 && toCreate.length === 0) {
            console.log(`${model.modelName} : index à jour.`);
            continue;
        }
        // syncIndexes supprime les index absents du schéma puis crée les manquants.
        await model.syncIndexes();
        console.log(`${model.modelName} : supprimés ${JSON.stringify(toDrop)}, créés ${JSON.stringify(toCreate)}.`);
    }
} finally {
    await disconnectDb();
}

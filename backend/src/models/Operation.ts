
import { Schema, model, type InferSchemaType } from "mongoose";

const operationSchema = new Schema(
    {
        actorId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            immutable: true,
        },
        accountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            immutable: true,
        },
        type: {
            type: String,
            enum: ["deposit", "withdrawal"],
            required: true,
            immutable: true,
        },
        amountCents: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: (value: number) =>
                    Number.isSafeInteger(value),
                message: "Le montant doit être un entier sûr.",
            },
            immutable: true,
        },
        idempotencyKey: {
            type: String,
            required: true,
            immutable: true,
        },
        requestFingerprint: {
            type: String,
            required: true,
            immutable: true,
        },
        balanceAfterCents: {
            type: Number,
            required: true,
            min: 0,
            validate: {
                validator: (value: number) =>
                    Number.isSafeInteger(value),
                message: "Le solde doit être un entier sûr.",
            },
            immutable: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    },
);

// Une même clé ne peut correspondre qu'à une opération par utilisateur.
operationSchema.index(
    { actorId: 1, idempotencyKey: 1 },
    { unique: true },
);

// Lecture des opérations d'un utilisateur, de la plus récente à la plus ancienne.
operationSchema.index({ actorId: 1, createdAt: -1 });

export type OperationDoc = InferSchemaType<typeof operationSchema>;

export const Operation = model("Operation", operationSchema);

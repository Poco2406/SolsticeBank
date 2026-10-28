
import { Schema, model, type InferSchemaType } from "mongoose";

const movementSchema = new Schema(
    {
        ownerId: {
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
        operationId: {
            type: Schema.Types.ObjectId,
            ref: "Operation",
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

// Un reçu ne doit générer qu'un seul mouvement.
movementSchema.index({ operationId: 1 }, { unique: true });

// Historique d'un compte, du plus récent au plus ancien.
movementSchema.index({ ownerId: 1, createdAt: -1 });

export type MovementDoc = InferSchemaType<typeof movementSchema>;

export const Movement = model("Movement", movementSchema);

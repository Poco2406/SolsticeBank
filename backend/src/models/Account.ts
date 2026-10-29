
import { Schema, model, type InferSchemaType } from "mongoose";
import { randomInt } from "node:crypto";

function generateFrenchIban(): string {
    const bankCode = String(randomInt(0, 10000)).padStart(5, "0");
    const branchCode = String(randomInt(0, 10000)).padStart(5, "0");
    const accountNumber = Array.from(
        { length: 11 },
        () => String(randomInt(0, 10)),
    ).join("");
    const key = String(randomInt(0, 100)).padStart(2, "0");

    const bban = `${bankCode}${branchCode}${accountNumber}${key}`;

    // Calcul de la clé IBAN française : BBAN + FR00, puis modulo 97.
    const rearranged = `${bban}FR00`;
    const numeric = rearranged.replace(/[A-Z]/g, (letter) =>
        String(letter.charCodeAt(0) - 55),
    );
    const checkDigits = String(98 - Number(BigInt(numeric) % 97n))
        .padStart(2, "0");

    return `FR${checkDigits}${bban}`;
}

const accountSchema = new Schema(
    {
        ownerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true,
        },
        iban: {
            type: String,
            required: true,
            unique: true,
            default: generateFrenchIban,
            immutable: true,
            validate: {
                validator: (value: string) =>
                    /^FR\d{25}$/.test(value),
                message: "L'IBAN doit respecter le format français.",
            },
        },
        currency: {
            type: String,
            enum: ["EUR"],
            required: true,
            default: "EUR",
        },
        balanceCents: {
            type: Number,
            required: true,
            default: 50000,
            min: 0,
            validate: {
                validator: (value: number) =>
                    Number.isSafeInteger(value),
                message: "Le solde doit être un entier sûr positif ou nul.",
            },
        },
        status: {
            type: String,
            enum: ["active", "closed"],
            required: true,
            default: "active",
        },
    },
    { timestamps: true },
);

// Les index uniques sur ownerId et iban sont déclarés sur les champs (unique: true).

export type AccountDoc = InferSchemaType<typeof accountSchema>;
export const Account = model("Account", accountSchema);

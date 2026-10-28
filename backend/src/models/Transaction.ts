
import { Schema, model, type InferSchemaType } from "mongoose";

const transactionSchema = new Schema(
    {
        ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        label: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
        amount: {
            type: Number,
            required: true,
            min: 1,
            validate: {
                validator: (value: number) => Number.isSafeInteger(value),
                message: "Le montant doit être un entier positif sûr.",
            },
        },
        type: { type: String, enum: ["income", "expense"], required: true },
        date: {
            type: String,
            required: true,
            validate: {
                validator: (value: string) => {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

                    const date = new Date(`${value}T00:00:00.000Z`);
                    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
                },
                message: "La date doit être une date réelle au format YYYY-MM-DD.",
            },
        },
    },
    { timestamps: true },
);

transactionSchema.index({ ownerId: 1, date: -1 });

export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = model("Transaction", transactionSchema);


import { Schema, model, type InferSchemaType } from "mongoose";

const transferSchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      immutable: true,
    },
    senderAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      immutable: true,
    },
    recipientAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
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
        message: "Le montant doit être un entier positif sûr.",
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Une clé d'idempotence ne peut correspondre
// qu'à un virement par utilisateur.
transferSchema.index(
  { senderId: 1, idempotencyKey: 1 },
  { unique: true },
);

transferSchema.index({ senderId: 1, createdAt: -1 });
transferSchema.index({ recipientId: 1, createdAt: -1 });

export type TransferDoc = InferSchemaType<typeof transferSchema>;

export const Transfer = model("Transfer", transferSchema);

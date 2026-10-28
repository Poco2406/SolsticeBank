
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
      immutable: true,
    },
    transferId: {
      type: Schema.Types.ObjectId,
      ref: "Transfer",
      immutable: true,
    },
    type: {
      type: String,
      enum: [
        "deposit",
        "withdrawal",
        "transfer_debit",
        "transfer_credit",
      ],
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

// Un mouvement appartient soit à une opération,
// soit à un virement, mais jamais aux deux.
movementSchema.pre("validate", function () {
  const hasOperation = this.operationId != null;
  const hasTransfer = this.transferId != null;

  if (hasOperation === hasTransfer) {
    this.invalidate(
      "operationId",
      "Un mouvement doit être lié à une opération ou à un virement.",
    );
  }

  if (
    hasOperation &&
    !["deposit", "withdrawal"].includes(this.type)
  ) {
    this.invalidate(
      "type",
      "Une opération doit être un dépôt ou un retrait.",
    );
  }

  if (
    hasTransfer &&
    !["transfer_debit", "transfer_credit"].includes(this.type)
  ) {
    this.invalidate(
      "type",
      "Un virement doit être un débit ou un crédit.",
    );
  }
});

// Un seul mouvement par opération classique.
movementSchema.index(
  { operationId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      operationId: { $type: "objectId" },
    },
  },
);

// Un débit et un crédit maximum par virement.
movementSchema.index(
  { transferId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      transferId: { $type: "objectId" },
    },
  },
);

// Historique du compte.
movementSchema.index({ ownerId: 1, createdAt: -1 });

export type MovementDoc = InferSchemaType<typeof movementSchema>;

export const Movement = model("Movement", movementSchema);

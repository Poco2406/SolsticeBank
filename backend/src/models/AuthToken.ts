import { Schema, model, type InferSchemaType } from "mongoose";

const authTokenSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    purpose: {
      type: String,
      enum: ["email_verification", "password_reset"],
      required: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    consumedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "authTokens",
  },
);

// Suppression automatique des jetons expirés.
// Le délai de suppression MongoDB peut varier.
authTokenSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 },
);

export type AuthTokenDoc = InferSchemaType<typeof authTokenSchema>;

export const AuthToken = model("AuthToken", authTokenSchema);

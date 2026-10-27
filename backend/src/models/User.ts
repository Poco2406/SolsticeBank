import { Schema, model, type InferSchemaType } from "mongoose";

const addressSchema = new Schema(
    {
        street: { type: String, trim: true },
        complement: { type: String, trim: true, default: null },
        postalCode: { type: String, trim: true },
        city: { type: String, trim: true },
        country: { type: String, trim: true },
    },
    { _id: false },
);

const userSchema = new Schema(
    {
        // Inscription (contrat du livret)
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash: { type: String, required: true },

        // Profil, complété après l'inscription
        firstName: { type: String, trim: true, default: null },
        lastName: { type: String, trim: true, default: null },
        username: { type: String, trim: true, default: null }, // le pseudo
        gender: { type: String, enum: ["female", "male", "other", "unspecified"], default: "unspecified" },
        birthDate: { type: String, default: null }, // date civile YYYY-MM-DD, non modifiable
        address: { type: addressSchema, default: null },
        phone: { type: String, trim: true, default: null }, // format international, ex. +33612345678

        // État du compte
        status: { type: String, enum: ["pending", "active", "closed"], default: "pending" },
        emailVerifiedAt: { type: Date, default: null },
        tokenVersion: { type: Number, default: 0 },
    },
    { timestamps: true },
);

// Pseudo unique, insensible à la casse, uniquement quand il est renseigné.
userSchema.index(
    { username: 1 },
    {
        unique: true,
        collation: { locale: "fr", strength: 2 },
        partialFilterExpression: { username: { $type: "string" } },
    },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
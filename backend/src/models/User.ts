import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

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
        // Pas de vérification d'email obligatoire : un compte est actif dès l'inscription.
        status: { type: String, enum: ["active", "closed"], default: "active" },
        emailVerifiedAt: { type: Date, default: null },
        tokenVersion: { type: Number, default: 0 },
        closedAt: { type: Date, default: null }, // date de suppression du compte (DELETE /api/me)
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
export type UserDocument = HydratedDocument<UserDoc>;
export const User = model("User", userSchema);
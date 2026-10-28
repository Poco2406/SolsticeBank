import { z } from "zod";
import { civilDateSchema } from "./common.js";

const name = z.string().trim().min(1).max(60);

export const profileFields = {
    firstName: name,
    lastName: name,
    username: z.string().trim().regex(/^[a-zA-Z0-9._-]{3,30}$/, "3 à 30 caractères : lettres, chiffres, . _ -"),
    gender: z.enum(["female", "male", "other", "unspecified"]),
    birthDate: civilDateSchema,
    phone: z.string().trim().regex(/^\+[1-9]\d{6,14}$/, "format international, ex. +33612345678"),
    address: z
        .object({
            street: z.string().trim().min(1).max(120),
            complement: z.string().trim().max(120).nullable().optional(),
            postalCode: z.string().trim().min(2).max(12),
            city: z.string().trim().min(1).max(80),
            country: z.string().trim().min(2).max(80),
        })
        .strict(),
};

// Inscription : profil complet obligatoire s'il est fourni.
export const fullProfileSchema = z.object(profileFields).strict();

// Modification : champs facultatifs, mais au moins un.
export const profilePatchSchema = z
    .object(profileFields)
    .partial()
    .strict()
    .refine((body) => Object.keys(body).length > 0, "le corps ne peut pas être vide");

export type FullProfile = z.infer<typeof fullProfileSchema>;
import { z } from "zod";
import mongoose from "mongoose";
import { badRequest } from "../errors/AppError.js";

// Identifiant MongoDB : un id malformé doit donner 400, pas 404.
export function assertObjectId(id: string): void {
    if (!mongoose.isValidObjectId(id) || !/^[a-f\d]{24}$/i.test(id)) {
        throw badRequest("Identifiant invalide.");
    }
}

// Email normalisé : trim + minuscules.
export const emailSchema = z.string().trim().toLowerCase().email();

// Date civile réelle au format YYYY-MM-DD (refuse 2026-02-30).
export const civilDateSchema = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
    }, "date impossible");

// Montant en centimes : entier sûr strictement positif.
export const amountCentsSchema = z
    .number()
    .int()
    .positive()
    .refine(Number.isSafeInteger, "montant trop grand");
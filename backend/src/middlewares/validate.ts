import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { badRequest } from "../errors/AppError.js";

// Valide req.body et le remplace par la version nettoyée (trim, etc.).
export const validateBody =
    (schema: ZodType): RequestHandler =>
        (req, _res, next) => {
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const first = result.error.issues[0];
                const field = first?.path.join(".") || "corps";
                throw badRequest(`${field} : ${first?.message ?? "valeur invalide"}`);
            }
            req.body = result.data;
            next();
        };
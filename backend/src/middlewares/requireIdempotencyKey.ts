
import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

export const requireIdempotencyKey: RequestHandler = (
    req,
    res,
    next,
) => {
    const key = req.get("Idempotency-Key")?.trim();

    if (!key || key.length > 128) {
        next(
            new AppError(
                400,
                "INVALID_INPUT",
                "L'en-tête Idempotency-Key est obligatoire et doit faire au maximum 128 caractères.",
            ),
        );
        return;
    }

    res.locals.idempotencyKey = key;
    next();
};

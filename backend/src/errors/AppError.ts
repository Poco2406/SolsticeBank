export type ErrorCode =
    | "INVALID_INPUT"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "EMAIL_ALREADY_USED"
    | "INSUFFICIENT_FUNDS"
    | "INTERNAL_ERROR";

export class AppError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: ErrorCode,
        message: string,
    ) {
        super(message);
        this.name = "AppError";
    }
}

export const badRequest = (message = "Données invalides.") =>
    new AppError(400, "INVALID_INPUT", message);
export const unauthorized = (message = "Authentification requise.") =>
    new AppError(401, "UNAUTHORIZED", message);
export const notFound = (message = "Ressource introuvable.") =>
    new AppError(404, "NOT_FOUND", message);
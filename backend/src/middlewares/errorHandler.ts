import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

// Route inconnue : 404 au format du contrat.
export const notFoundHandler: RequestHandler = (_req, res) => {
    res.status(404).json({
        error: { code: "NOT_FOUND", message: "Route introuvable." },
    });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
    // Erreur métier levée volontairement.
    if (err instanceof AppError) {
        res.status(err.status).json({
            error: { code: err.code, message: err.message },
        });
        return;
    }

    // JSON mal formé envoyé par le client.
    if (err?.type === "entity.parse.failed") {
        res.status(400).json({
            error: { code: "INVALID_INPUT", message: "Corps JSON invalide." },
        });
        return;
    }

    // Tout le reste : on journalise côté serveur, on ne révèle rien au client.
    console.error(err);
    res.status(500).json({
        error: { code: "INTERNAL_ERROR", message: "Erreur interne du serveur." },
    });
};
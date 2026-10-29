import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireBankingActive } from "../middlewares/requireBankingActive.js";
import * as accounts from "../services/account.service.js";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";
import { requireIdempotencyKey } from "../middlewares/requireIdempotencyKey.js";
import * as operations from "../services/operation.service.js";
import { notFound } from "../errors/AppError.js";

export const accountRouter = Router();

// Toutes les routes nécessitent une authentification
accountRouter.use(requireAuth);

// Récupérer le compte bancaire de l'utilisateur connecté
// (consultable même sans profil complet : le tableau de bord affiche le solde)
accountRouter.get("/", async (req, res) => {
    const account = await accounts.getByOwnerId(req.userId!);

    if (!account) {
        throw notFound("Aucun compte bancaire trouvé.");
    }

    res.status(200).json({ account });
});


const amountSchema = z.object({
    amountCents: z.number().int().positive().safe(),
}).strict();

// Déposer de l'argent
accountRouter.post(
    "/deposits",
    requireBankingActive,
    requireIdempotencyKey,
    validateBody(amountSchema),
    async (req, res) => {
        const result = await operations.execute(
            req.userId!,
            "deposit",
            req.body.amountCents,
            res.locals.idempotencyKey as string,
        );

        res.status(201).json(operations.toOperationResponse(result));
    },
);

// Retirer de l'argent
accountRouter.post(
    "/withdrawals",
    requireBankingActive,
    requireIdempotencyKey,
    validateBody(amountSchema),
    async (req, res) => {
        const result = await operations.execute(
            req.userId!,
            "withdrawal",
            req.body.amountCents,
            res.locals.idempotencyKey as string,
        );

        res.status(201).json(operations.toOperationResponse(result));
    },
);

// L'historique est servi par GET /api/movements (movements.routes.ts).

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import * as accounts from "../services/account.service.js";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";
import { requireIdempotencyKey } from "../middlewares/requireIdempotencyKey.js";
import * as operations from "../services/operation.service.js";
import * as movementService from "../services/movement.service.js";

export const accountRouter = Router();

// Toutes les routes nécessitent une authentification
accountRouter.use(requireAuth);

// Récupérer le compte bancaire de l'utilisateur connecté
accountRouter.get("/", async (req, res) => {
    const account = await accounts.getByOwnerId(req.userId!);

    if (!account) {
        res.status(404).json({
            message: "Aucun compte bancaire trouvé.",
        });
        return;
    }

    res.status(200).json({ account });
});


const amountSchema = z.object({
    amountCents: z.number().int().positive().safe(),
}).strict();

// Déposer de l'argent
accountRouter.post(
    "/deposits",
    requireIdempotencyKey,
    validateBody(amountSchema),
    async (req, res) => {
        const result = await operations.execute(
            req.userId!,
            "deposit",
            req.body.amountCents,
            res.locals.idempotencyKey as string,
        );

        res.status(201).json(result);
    },
);

// Retirer de l'argent
accountRouter.post(
    "/withdrawals",
    requireIdempotencyKey,
    validateBody(amountSchema),
    async (req, res) => {
        const result = await operations.execute(
            req.userId!,
            "withdrawal",
            req.body.amountCents,
            res.locals.idempotencyKey as string,
        );

        res.status(201).json(result);
    },
);


accountRouter.get("/movements", async (req, res) => {
    const movements = await movementService.getByOwnerId(
        req.userId!,
    );

    res.status(200).json({
        movements,
        count: movements.length,
    });
});

import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import * as accounts from "../services/account.service.js";

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
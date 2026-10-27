
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import * as transactions from "../services/transaction.service.js";

const transactionSchema = z.object({
    label: z.string().trim().min(1).max(120),
    amount: z.number().int().positive().safe(),
    type: z.enum(["income", "expense"]),
    date: z.iso.date(),
}).strict();

const updateTransactionSchema = transactionSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être renseigné." },
);

export const transactionRouter = Router();

// Toutes les routes nécessitent une authentification
transactionRouter.use(requireAuth);

// Récupérer toutes les transactions
transactionRouter.get("/", async (req, res) => {
    res.status(200).json({
        items: await transactions.getAll(req.userId!),
    });
});

// Créer une transaction
transactionRouter.post("/", validateBody(transactionSchema), async (req, res) => {
    res.status(201).json(await transactions.create(req.userId!, req.body));
});

// Récupérer une transaction par son ID
transactionRouter.get("/:id", async (req, res) => {
    res.status(200).json(await transactions.getById(req.userId!, req.params.id as string));
});

// Modifier une transaction
transactionRouter.patch("/:id", validateBody(updateTransactionSchema), async (req, res) => {
    res.status(200).json(await transactions.update(req.userId!, req.params.id as string, req.body));
});

// Supprimer une transaction
transactionRouter.delete("/:id", async (req, res) => {
    await transactions.remove(req.userId!, req.params.id as string);
    res.status(204).send();
});

import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireBankingActive } from "../middlewares/requireBankingActive.js";
import { badRequest } from "../errors/AppError.js";
import { amountCentsSchema, assertObjectId, civilDateSchema } from "../validation/common.js";
import { getMovement, listMovements } from "../services/movement.service.js";

// Paramètres d'URL : tout arrive en chaîne, d'où z.coerce pour les nombres.
const listQuerySchema = z
    .object({
        type: z.enum(["deposit", "withdrawal"]).optional(),
        from: civilDateSchema.optional(),
        to: civilDateSchema.optional(),
        minAmountCents: z.coerce.number().pipe(amountCentsSchema).optional(),
        maxAmountCents: z.coerce.number().pipe(amountCentsSchema).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
    })
    .strict()
    // Les dates YYYY-MM-DD se comparent correctement en tant que chaînes.
    .refine((q) => !q.from || !q.to || q.from <= q.to, "from doit être antérieure ou égale à to")
    .refine(
        (q) => q.minAmountCents === undefined || q.maxAmountCents === undefined || q.minAmountCents <= q.maxAmountCents,
        "minAmountCents doit être inférieur ou égal à maxAmountCents",
    );

export const movementsRouter = Router();

// Historique bancaire : réservé aux comptes dont le profil est complet.
movementsRouter.use(requireAuth, requireBankingActive);

movementsRouter.get("/", async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        const first = parsed.error.issues[0];
        const field = first?.path.join(".") || "paramètres";
        throw badRequest(`${field} : ${first?.message ?? "valeur invalide"}`);
    }
    const { page, limit, ...filters } = parsed.data;
    res.status(200).json(await listMovements(req.userId!, filters, page, limit));
});

movementsRouter.get("/:id", async (req, res) => {
    const { id } = req.params;
    assertObjectId(id);
    res.status(200).json(await getMovement(req.userId!, id));
});

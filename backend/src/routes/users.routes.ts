import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { badRequest } from "../errors/AppError.js";
import { assertObjectId } from "../validation/common.js";
import { listDirectory, getPublicUser } from "../services/users.service.js";

const listQuerySchema = z
    .object({
        search: z.string().trim().min(2).max(60).optional(),
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(100),
    })
    .strict();

export const usersRouter = Router();

usersRouter.get("/", requireAuth, async (req, res) => {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw badRequest("Paramètres invalides : search ≥ 2 caractères, page ≥ 1, limit entre 1 et 100.");
    }
    const { page, limit, search } = parsed.data;
    res.status(200).json(await listDirectory(req.userId!, page, limit, search));
});

usersRouter.get("/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    assertObjectId(id);
    res.status(200).json(await getPublicUser(req.userId!, id));
});
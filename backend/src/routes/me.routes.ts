import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validate.js";
import { profilePatchSchema } from "../validation/profile.js";
import { getMe, updateMe } from "../services/profile.service.js";
import { deleteAccount } from "../services/accountDeletion.service.js";

// Suppression : le mot de passe actuel confirme la demande.
const deleteSchema = z.object({ password: z.string().min(1) }).strict();

export const meRouter = Router();

// Profil de l'utilisateur connecté.
meRouter.get("/", requireAuth, async (req, res) => {
    res.status(200).json(await getMe(req.userId!));
});

// Modification partielle du profil (au moins un champ).
meRouter.patch("/", requireAuth, validateBody(profilePatchSchema), async (req, res) => {
    res.status(200).json(await updateMe(req.userId!, req.body));
});

// Suppression définitive du compte (voir accountDeletion.service.ts).
meRouter.delete("/", requireAuth, validateBody(deleteSchema), async (req, res) => {
    await deleteAccount(req.userId!, req.body.password);
    res.status(204).end();
});
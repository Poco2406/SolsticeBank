import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { validateBody } from "../middlewares/validate.js";
import { profilePatchSchema } from "../validation/profile.js";
import { getMe, updateMe } from "../services/profile.service.js";

export const meRouter = Router();

// Profil de l'utilisateur connecté.
meRouter.get("/", requireAuth, async (req, res) => {
    res.status(200).json(await getMe(req.userId!));
});

// Modification partielle du profil (au moins un champ).
meRouter.patch("/", requireAuth, validateBody(profilePatchSchema), async (req, res) => {
    res.status(200).json(await updateMe(req.userId!, req.body));
});
// src/middlewares/requireBankingActive.ts
// À placer APRÈS requireAuth sur les routes d'argent (compte, dépôts, retraits, virements, historique).
import type { RequestHandler } from "express";
import { User } from "../models/User.js";
import { AppError, unauthorized } from "../errors/AppError.js";
import { isProfileComplete } from "../services/profile.service.js";

export const requireBankingActive: RequestHandler = async (req, _res, next) => {
    const user = await User.findById(req.userId);
    if (!user || user.status === "closed") throw unauthorized();

    // Seul un compte créé avec l'inscription minimale du livret peut être incomplet.
    if (!isProfileComplete(user)) {
        throw new AppError(403, "FORBIDDEN", "Complétez votre profil pour accéder aux fonctions bancaires.");
    }

    next();
};
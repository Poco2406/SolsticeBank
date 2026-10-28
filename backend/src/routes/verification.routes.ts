import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";

import { requireAuth } from "../middlewares/requireAuth.js";
import { User } from "../models/User.js";
import { AuthToken } from "../models/AuthToken.js";
import { createAuthToken } from "../services/authTokenService.js";
import { sendEmail } from "../services/emailService.js";
import { tryActivate } from "../services/profile.service.js";
import { badRequest, unauthorized } from "../errors/AppError.js";
import { env } from "../config/env.js";

export const verificationRouter = Router();

// Limite les demandes de lien : 5 par tranche de 15 minutes.
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Trop de demandes. Réessayez dans quelques minutes.",
      },
    });
  },
});

const confirmSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

// POST /api/auth/verification/request
// Demander (ou renvoyer) un lien de vérification à l'utilisateur connecté.
verificationRouter.post("/request", requestLimiter, requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);

  if (!user || user.status === "closed") {
    throw unauthorized("Session invalide.");
  }

  if (user.emailVerifiedAt) {
    res.status(200).json({ message: "Adresse email déjà vérifiée." });
    return;
  }

  // Invalider les anciens liens de vérification encore actifs.
  await AuthToken.updateMany(
    { userId: user._id, purpose: "email_verification", consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );

  // Créer un nouveau jeton valable 30 minutes.
  const token = await createAuthToken(user._id, "email_verification", 30);

  const link = `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: user.email,
    subject: "Vérifiez votre adresse email - SolsticeBank",
    text: `Pour vérifier votre adresse email, ouvrez ce lien : ${link}`,
  });

  res.status(200).json({ message: "Email de vérification envoyé." });
});

// POST /api/auth/verification/confirm
// Consommer le jeton, marquer l'email comme vérifié, puis activer le compte si possible.
verificationRouter.post("/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest("Jeton invalide.");
  }

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");

  const verifiedUserId = await mongoose.connection
    .transaction(async (session) => {
      const token = await AuthToken.findOneAndUpdate(
        {
          tokenHash,
          purpose: "email_verification",
          consumedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { consumedAt: new Date() } },
        { new: true, session },
      );

      if (!token) return null;

      const user = await User.findOneAndUpdate(
        {
          _id: token.userId,
          status: { $ne: "closed" },
          emailVerifiedAt: null,
        },
        { $set: { emailVerifiedAt: new Date() } },
        { new: true, session },
      );

      // Annule toute la transaction : le jeton n'est pas consommé.
      if (!user) throw new Error("EMAIL_VERIFICATION_FAILED");

      return String(user._id);
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "EMAIL_VERIFICATION_FAILED") {
        return null;
      }
      throw error;
    });

  if (!verifiedUserId) {
    throw badRequest("Lien invalide, expiré ou déjà utilisé.");
  }

  // Hors transaction : l'activation (et bientôt la création du compte bancaire)
  // ne doit pas être rejouée si MongoDB relance la transaction.
  const user = await User.findById(verifiedUserId);
  if (user) await tryActivate(user);

  res.status(200).json({ message: "Adresse email vérifiée avec succès." });
});
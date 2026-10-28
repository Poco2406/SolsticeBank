import { Router, type RequestHandler } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";

import { User } from "../models/User.js";
import { AuthToken } from "../models/AuthToken.js";
import { createAuthToken } from "../services/authTokenService.js";
import { sendEmail } from "../services/emailService.js";
import { badRequest } from "../errors/AppError.js";
import { env } from "../config/env.js";
import { emailSchema } from "../validation/common.js";

export const passwordRouter = Router();

// Réponse au format du contrat quand la limite est atteinte.
const tooManyRequests: RequestHandler = (_req, res) => {
  res.status(429).json({
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Trop de demandes. Réessayez dans quelques minutes.",
    },
  });
};

// Limite les demandes de réinitialisation : 5 par tranche de 15 minutes.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: tooManyRequests,
});

// Limite les essais de jetons : 10 par tranche de 15 minutes.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: tooManyRequests,
});

const forgotSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

const resetSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: z
      .string()
      .min(8)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "Le mot de passe dépasse 72 octets."),
  })
  .strict();

// POST /api/auth/password/forgot
passwordRouter.post("/forgot", forgotLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest("Données invalides.");
  }

  // Réponse identique, que l'utilisateur existe ou non.
  const response = {
    message: "Si ce compte existe, un lien de réinitialisation sera envoyé.",
  };

  const user = await User.findOne({
    email: parsed.data.email,
    status: { $ne: "closed" },
  });

  if (!user) {
    res.status(200).json(response);
    return;
  }

  // Un seul lien valide à la fois : invalider les anciens.
  await AuthToken.updateMany(
    { userId: user._id, purpose: "password_reset", consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );

  // Nouveau jeton valable 30 minutes.
  const token = await createAuthToken(user._id, "password_reset", 30);

  const link = `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: user.email,
    subject: "Réinitialisation du mot de passe - SolsticeBank",
    text: `Pour réinitialiser votre mot de passe, ouvrez ce lien : ${link}`,
  });

  res.status(200).json(response);
});

// POST /api/auth/password/reset
passwordRouter.post("/reset", resetLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);

  if (!parsed.success) {
    throw badRequest("Jeton ou mot de passe invalide.");
  }

  const { token, password } = parsed.data;

  // Hacher le nouveau mot de passe avant la transaction.
  const passwordHash = await bcrypt.hash(password, 12);

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const resetSuccessful = await mongoose.connection
    .transaction(async (session) => {
      const authToken = await AuthToken.findOneAndUpdate(
        {
          tokenHash,
          purpose: "password_reset",
          consumedAt: null,
          expiresAt: { $gt: new Date() },
        },
        { $set: { consumedAt: new Date() } },
        { new: true, session },
      );

      if (!authToken) return false;

      const user = await User.findOneAndUpdate(
        { _id: authToken.userId, status: { $ne: "closed" } },
        {
          $set: { passwordHash },
          $inc: { tokenVersion: 1 }, // invalide tous les JWT existants
        },
        { new: true, session },
      );

      if (!user) throw new Error("PASSWORD_RESET_USER_NOT_FOUND");

      // Invalider les autres jetons de réinitialisation encore actifs.
      await AuthToken.updateMany(
        { userId: authToken.userId, purpose: "password_reset", consumedAt: null },
        { $set: { consumedAt: new Date() } },
        { session },
      );

      return true;
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "PASSWORD_RESET_USER_NOT_FOUND") {
        return false;
      }
      throw error;
    });

  if (!resetSuccessful) {
    throw badRequest("Lien invalide, expiré ou déjà utilisé.");
  }

  res.status(200).json({ message: "Mot de passe réinitialisé avec succès." });
});
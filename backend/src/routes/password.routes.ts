
import { Router } from "express";
import { z } from "zod";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";

import { User } from "../models/User.js";
import { AuthToken } from "../models/AuthToken.js";
import { createAuthToken } from "../services/authTokenService.js";
import { sendEmail } from "../services/emailService.js";
import { env } from "../config/env.js";
import { emailSchema } from "../validation/common.js";

export const passwordRouter = Router();

// Limite les demandes de réinitialisation.
const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

// Limite les essais de jetons.
const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const forgotSchema = z.object({
  email: emailSchema,
}).strict();

const resetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Le mot de passe dépasse 72 octets.",
  ),
}).strict();

// POST /api/auth/password/forgot
passwordRouter.post("/forgot", forgotLimiter, async (req, res) => {
  const parsed = forgotSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Données invalides.",
      },
    });
  }

  const user = await User.findOne({
    email: parsed.data.email.trim().toLowerCase(),
    status: { $ne: "closed" },
  });

  // Réponse identique, que l'utilisateur existe ou non.
  const response = {
    message: "Si ce compte existe, un lien de réinitialisation sera envoyé.",
  };

  if (!user) {
    return res.status(200).json(response);
  }

  // Génère un nouveau jeton valable 30 minutes.
  const token = await createAuthToken(
    user._id,
    "password_reset",
    30,
  );

  const link =
    `${env.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: user.email,
    subject: "Réinitialisation du mot de passe - SolsticeBank",
    text: `Pour réinitialiser votre mot de passe, ouvrez ce lien : ${link}`,
  });

  return res.status(200).json(response);
});

// POST /api/auth/password/reset
passwordRouter.post("/reset", resetLimiter, async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Jeton ou mot de passe invalide.",
      },
    });
  }

  const { token, password } = parsed.data;

  // Hacher le nouveau mot de passe avant la transaction.
  const passwordHash = await bcrypt.hash(password, 12);

  const tokenHash = createHash("sha256")
    .update(token)
    .digest("hex");

  const resetSuccessful = await mongoose.connection.transaction(
    async (session) => {
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
        {
          _id: authToken.userId,
          status: { $ne: "closed" },
        },
        {
          $set: { passwordHash },
          $inc: { tokenVersion: 1 },
        },
        { new: true, session },
      );

      if (!user) {
        throw new Error("PASSWORD_RESET_USER_NOT_FOUND");
      }

      // Invalider les autres jetons de réinitialisation.
      await AuthToken.updateMany(
        {
          userId: authToken.userId,
          purpose: "password_reset",
          consumedAt: null,
        },
        { $set: { consumedAt: new Date() } },
        { session },
      );

      return true;
    },
  ).catch((error: unknown) => {
    if (
      error instanceof Error &&
      error.message === "PASSWORD_RESET_USER_NOT_FOUND"
    ) {
      return false;
    }
    throw error;
  });

  if (!resetSuccessful) {
    return res.status(400).json({
      error: {
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "Lien invalide, expiré ou déjà utilisé.",
      },
    });
  }

  return res.status(200).json({
    message: "Mot de passe réinitialisé avec succès.",
  });
});


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
import { env } from "../config/env.js";

export const verificationRouter = Router();

const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

const confirmSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

// Demander un lien de vérification
verificationRouter.post(
  "/request",
  requestLimiter,
  requireAuth,
  async (req, res) => {
    const user = await User.findById(req.userId);

    if (!user || user.status === "closed") {
      return res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "Session invalide.",
        },
      });
    }

    if (user.emailVerifiedAt) {
      return res.status(200).json({
        message: "Adresse email déjà vérifiée.",
      });
    }

    // Invalider les anciens liens de vérification
    await AuthToken.updateMany(
    {
    userId: user._id,
    purpose: "email_verification",
    consumedAt: null,
    },
    {
    $set: { consumedAt: new Date() },
     },
    );

    // Créer un nouveau jeton
    const token = await createAuthToken(
    user._id,
    "email_verification",
    30,
    );

    const link =
      `${env.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    await sendEmail({
      to: user.email,
      subject: "Vérifiez votre adresse email - SolsticeBank",
      text: `Pour vérifier votre adresse email, ouvrez ce lien : ${link}`,
    });

    return res.status(200).json({
      message: "Email de vérification envoyé.",
    });
  },
);

// Confirmer une adresse email
verificationRouter.post("/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Jeton invalide.",
      },
    });
  }

  const tokenHash = createHash("sha256")
    .update(parsed.data.token)
    .digest("hex");

  const verified = await mongoose.connection.transaction(
    async (session) => {
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

      if (!token) return false;

      const user = await User.findOneAndUpdate(
        {
          _id: token.userId,
          status: { $ne: "closed" },
          emailVerifiedAt: null,
        },
        { $set: { emailVerifiedAt: new Date() } },
        { new: true, session },
      );

      if (!user) {
        throw new Error("EMAIL_VERIFICATION_FAILED");
      }

      return true;
    },
  ).catch((error: unknown) => {
    if (
      error instanceof Error &&
      error.message === "EMAIL_VERIFICATION_FAILED"
    ) {
      return false;
    }
    throw error;
  });

  if (!verified) {
    return res.status(400).json({
      error: {
        code: "INVALID_OR_EXPIRED_TOKEN",
        message: "Lien invalide, expiré ou déjà utilisé.",
      },
    });
  }

  return res.status(200).json({
    message: "Adresse email vérifiée avec succès.",
  });
});

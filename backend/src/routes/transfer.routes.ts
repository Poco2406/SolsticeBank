
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { requireBankingActive } from "../middlewares/requireBankingActive.js";
import { requireIdempotencyKey } from "../middlewares/requireIdempotencyKey.js";
import { validateBody } from "../middlewares/validate.js";
import { executeTransfer, toTransferResponse } from "../services/transfer.service.js";

export const transferRouter = Router();

const transferSchema = z.object({
  recipientIban: z.string().trim().regex(
    /^FR\d{25}$/,
    "L'IBAN doit respecter le format français.",
  ),
  amountCents: z.number().int().positive().safe(),
}).strict();

// Toutes les routes de virements nécessitent une authentification
// et un profil bancaire actif.
transferRouter.use(requireAuth);
transferRouter.use(requireBankingActive);

// Effectuer un virement
transferRouter.post(
  "/",
  requireIdempotencyKey,
  validateBody(transferSchema),
  async (req, res) => {
    const result = await executeTransfer(
      req.userId!,
      req.body,
      res.locals.idempotencyKey as string,
    );

    res.status(result.replayed ? 200 : 201).json({
      transfer: toTransferResponse(result.transfer),
      replayed: result.replayed,
    });
  },
);

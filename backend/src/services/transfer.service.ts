
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { Account } from "../models/Account.js";
import { User } from "../models/User.js";
import { Transfer } from "../models/Transfer.js";
import { Movement } from "../models/Movement.js";
import { AppError } from "../errors/AppError.js";

type TransferInput = {
  recipientIban: string;
  amountCents: number;
};

function conflict(message: string): AppError {
  return new AppError(409, "CONFLICT", message);
}

function fingerprint(data: TransferInput): string {
  return createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
}

// Recherche d'un virement déjà enregistré avec cette clé.
async function getPreviousTransfer(
  senderId: string,
  idempotencyKey: string,
  requestFingerprint: string,
  session?: mongoose.ClientSession,
) {
  const query = Transfer.findOne({
    senderId,
    idempotencyKey,
  });

  if (session) query.session(session);

  const previous = await query.exec();

  if (!previous) return null;

  if (previous.requestFingerprint !== requestFingerprint) {
    throw conflict(
      "Cette clé d'idempotence a déjà été utilisée avec des données différentes.",
    );
  }

  return previous;
}

export async function executeTransfer(
  senderId: string,
  data: TransferInput,
  idempotencyKey: string,
) {
  const recipientIban = data.recipientIban.trim().toUpperCase();
  const amountCents = data.amountCents;

  // 1. Validation du montant et du destinataire.
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "Le montant doit être un entier positif en centimes.",
    );
  }

  if (!/^FR\d{25}$/.test(recipientIban)) {
    throw new AppError(
      400,
      "INVALID_INPUT",
      "L'IBAN destinataire doit respecter le format français.",
    );
  }

  const requestFingerprint = fingerprint({
    recipientIban,
    amountCents,
  });

  // 2. Réutilisation d'un résultat déjà enregistré.
  const previous = await getPreviousTransfer(
    senderId,
    idempotencyKey,
    requestFingerprint,
  );

  if (previous) {
    return { transfer: previous, replayed: true };
  }

  try {
    // 3. Toutes les écritures sont atomiques et séquentielles.
    const result = await mongoose.connection.transaction(
      async (session) => {
        // Deuxième vérification dans la transaction.
        const existing = await getPreviousTransfer(
          senderId,
          idempotencyKey,
          requestFingerprint,
          session,
        );

        if (existing) {
          return { transfer: existing, replayed: true };
        }

        // 4. Rechercher le compte émetteur actif.
        const sender = await Account.findOne({
          ownerId: senderId,
          status: "active",
        }).session(session);

        if (!sender) {
          throw conflict("Compte émetteur inactif ou introuvable.");
        }

        // 5. Rechercher le compte destinataire actif.
        const recipient = await Account.findOne({
          iban: recipientIban,
          status: "active",
        }).session(session);

        if (!recipient) {
          throw conflict("Compte destinataire inactif ou introuvable.");
        }

        // 6. Refuser un auto-virement.
        if (
          String(sender._id) === String(recipient._id) ||
          String(sender.ownerId) === String(recipient.ownerId)
        ) {
          throw new AppError(
            400,
            "INVALID_INPUT",
            "Vous ne pouvez pas effectuer un virement vers votre propre compte.",
          );
        }

        // Vérifier également le statut de l'utilisateur destinataire.
        const recipientUser = await User.findOne({
          _id: recipient.ownerId,
          status: { $ne: "closed" },
        }).session(session);

        if (!recipientUser) {
          throw conflict("Le destinataire n'est plus actif.");
        }

        // 7. Débit conditionnel : solde suffisant et compte actif.
        const debited = await Account.findOneAndUpdate(
          {
            _id: sender._id,
            status: "active",
            balanceCents: { $gte: amountCents },
          },
          {
            $inc: { balanceCents: -amountCents },
          },
          {
            new: true,
            runValidators: true,
            session,
          },
        );

        if (!debited) {
          throw new AppError(
            409,
            "INSUFFICIENT_FUNDS",
            "Solde insuffisant ou compte émetteur inactif.",
          );
        }

        // 8. Crédit conditionnel : pas de dépassement numérique.
        const credited = await Account.findOneAndUpdate(
          {
            _id: recipient._id,
            status: "active",
            balanceCents: {
              $gte: 0,
              $lte: Number.MAX_SAFE_INTEGER - amountCents,
            },
          },
          {
            $inc: { balanceCents: amountCents },
          },
          {
            new: true,
            runValidators: true,
            session,
          },
        );

        if (!credited) {
          throw conflict(
            "Le crédit est impossible : compte inactif ou dépassement numérique.",
          );
        }

        // 9. Enregistrer le reçu du virement.
        const [transfer] = await Transfer.create(
          [
            {
              senderId,
              recipientId: recipient.ownerId,
              senderAccountId: debited._id,
              recipientAccountId: credited._id,
              amountCents,
              idempotencyKey,
              requestFingerprint,
            },
          ],
          { session },
        );

        // 10. Enregistrer le mouvement de débit.
        await Movement.create(
          [
            {
              ownerId: senderId,
              accountId: debited._id,
              transferId: transfer._id,
              type: "transfer_debit",
              amountCents,
              balanceAfterCents: debited.balanceCents,
            },
          ],
          { session },
        );

        // 11. Enregistrer le mouvement de crédit.
        await Movement.create(
          [
            {
              ownerId: recipient.ownerId,
              accountId: credited._id,
              transferId: transfer._id,
              type: "transfer_credit",
              amountCents,
              balanceAfterCents: credited.balanceCents,
            },
          ],
          { session },
        );

        return { transfer, replayed: false };
      },
    );

    return result;
  } catch (error: unknown) {
    // Une autre requête a pu enregistrer la même clé entre-temps.
    const duplicateKey =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000;

    if (duplicateKey) {
      const existing = await getPreviousTransfer(
        senderId,
        idempotencyKey,
        requestFingerprint,
      );

      if (existing) {
        return { transfer: existing, replayed: true };
      }
    }

    throw error;
  }
}

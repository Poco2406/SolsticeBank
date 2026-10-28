
import mongoose from "mongoose";
import { createHash } from "node:crypto";
import { Account } from "../models/Account.js";
import { Operation } from "../models/Operation.js";
import { Movement } from "../models/Movement.js";
import { AppError } from "../errors/AppError.js";

type OperationType = "deposit" | "withdrawal";

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;

function conflict(message: string): AppError {
    return new AppError(409, "CONFLICT", message);
}

function notFound(message: string): AppError {
    return new AppError(404, "NOT_FOUND", message);
}

function fingerprint(
    type: OperationType,
    amountCents: number,
): string {
    return createHash("sha256")
        .update(JSON.stringify({ type, amountCents }))
        .digest("hex");
}

async function getPreviousResult(
    actorId: string,
    idempotencyKey: string,
    requestFingerprint: string,
    session?: mongoose.ClientSession,
) {
    const operationQuery = Operation.findOne({
        actorId,
        idempotencyKey,
    });

    if (session) {
        operationQuery.session(session);
    }

    const operation = await operationQuery.exec();

    if (!operation) return null;

    if (operation.requestFingerprint !== requestFingerprint) {
        throw conflict(
            "Cette clé d'idempotence a déjà été utilisée avec un contenu différent.",
        );
    }

    const movementQuery = Movement.findOne({
        operationId: operation._id,
    });

    if (session) {
        movementQuery.session(session);
    }

    const movement = await movementQuery.exec();

    if (!movement) {
        throw new AppError(
            500,
            "INTERNAL_ERROR",
            "Le mouvement associé à cette opération est introuvable.",
        );
    }

    return {
        operation,
        movement,
        balanceCents: operation.balanceAfterCents,
    };
}

export async function execute(
    actorId: string,
    type: OperationType,
    amountCents: number,
    idempotencyKey: string,
) {
    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
        throw new AppError(
            400,
            "INVALID_INPUT",
            "Le montant doit être un entier positif en centimes.",
        );
    }

    const requestFingerprint = fingerprint(type, amountCents);

    // Une répétition connue ne doit pas modifier le solde une deuxième fois.
    const previous = await getPreviousResult(
        actorId,
        idempotencyKey,
        requestFingerprint,
    );

    if (previous) return previous;

    const session = await mongoose.startSession();

    try {
        let result: {
            operation: unknown;
            movement: unknown;
            balanceCents: number;
        } | null = null;

        await session.withTransaction(async () => {
            // Vérification supplémentaire à l'intérieur de la transaction.
            const existing = await getPreviousResult(
                actorId,
                idempotencyKey,
                requestFingerprint,
                session,
            );

            if (existing) {
                result = existing;
                return;
            }

            const account = await Account.findOne({
                ownerId: actorId,
                status: "active",
            }).session(session);

            if (!account) {
                throw notFound("Compte bancaire actif introuvable.");
            }

            let updatedAccount;

            if (type === "withdrawal") {
                updatedAccount = await Account.findOneAndUpdate(
                    {
                        _id: account._id,
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
                )
                    .lean()
                    .exec();
            } else {
                updatedAccount = await Account.findOneAndUpdate(
                    {
                        _id: account._id,
                        status: "active",
                        balanceCents: {
                            $lte: MAX_SAFE_INTEGER - amountCents,
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
                )
                    .lean()
                    .exec();
            }

            if (!updatedAccount) {
                if (type === "withdrawal") {
                    throw conflict(
                        "Solde insuffisant pour effectuer ce retrait.",
                    );
                }

                throw conflict(
                    "Le dépôt dépasserait la limite numérique autorisée.",
                );
            }

            const [operation] = await Operation.create(
                [
                    {
                        actorId,
                        accountId: updatedAccount._id,
                        type,
                        amountCents,
                        idempotencyKey,
                        requestFingerprint,
                        balanceAfterCents: updatedAccount.balanceCents,
                    },
                ],
                { session },
            );

            const [movement] = await Movement.create(
                [
                    {
                        ownerId: actorId,
                        accountId: updatedAccount._id,
                        operationId: operation._id,
                        type,
                        amountCents,
                        balanceAfterCents: updatedAccount.balanceCents,
                    },
                ],
                { session },
            );

            result = {
                operation,
                movement,
                balanceCents: updatedAccount.balanceCents,
            };
        });

        if (!result) {
            throw new AppError(
                500,
                "INTERNAL_ERROR",
                "L'opération n'a pas produit de résultat.",
            );
        }

        return result;
    } catch (error: unknown) {
        // Deux requêtes simultanées avec la même clé peuvent se rencontrer
        // sur l'index unique. On récupère alors le résultat déjà enregistré.
        const duplicateKey =
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000;

        if (duplicateKey) {
            const previous = await getPreviousResult(
                actorId,
                idempotencyKey,
                requestFingerprint,
            );

            if (previous) return previous;
        }

        throw error;
    } finally {
        await session.endSession();
    }
}

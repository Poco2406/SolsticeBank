
import { Types } from "mongoose";
import { Transaction } from "../models/Transaction.js";
import { AppError, badRequest } from "../errors/AppError.js";

type TransactionInput = {
    label: string;
    amount: number;
    type: "income" | "expense";
    date: string;
};

type TransactionUpdate = Partial<TransactionInput>;

function assertTransactionId(id: string) {
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
        throw badRequest("Identifiant de transaction invalide.");
    }
}

function toTransactionResponse(transaction: {
    _id: unknown;
    ownerId: unknown;
    label: string;
    amount: number;
    type: "income" | "expense";
    date: string;
}) {
    return {
        id: String(transaction._id),
        ownerId: String(transaction.ownerId),
        label: transaction.label,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
    };
}

// Récupérer toutes les transactions de l'utilisateur
export async function getAll(ownerId: string) {
    const transactions = await Transaction.find({ ownerId }).sort({ date: -1 });

    return transactions.map(toTransactionResponse);
}

// Récupérer une transaction par son ID
export async function getById(ownerId: string, id: string) {
    assertTransactionId(id);

    const transaction = await Transaction.findOne({
        _id: new Types.ObjectId(id),
        ownerId,
    });

    if (!transaction) {
        throw new AppError(404, "NOT_FOUND", "Transaction introuvable.");
    }

    return toTransactionResponse(transaction);
}

// Créer une transaction
export async function create(ownerId: string, data: TransactionInput) {
    const transaction = await Transaction.create({
        ownerId,
        ...data,
    });

    return toTransactionResponse(transaction);
}

// Modifier une transaction
export async function update(ownerId: string, id: string, data: TransactionUpdate) {
    assertTransactionId(id);

    const transaction = await Transaction.findOneAndUpdate(
        { _id: new Types.ObjectId(id), ownerId },
        { $set: data },
        { new: true, runValidators: true },
    );

    if (!transaction) {
        throw new AppError(404, "NOT_FOUND", "Transaction introuvable.");
    }

    return toTransactionResponse(transaction);
}

// Supprimer une transaction
export async function remove(ownerId: string, id: string) {
    assertTransactionId(id);

    const transaction = await Transaction.findOneAndDelete({
        _id: new Types.ObjectId(id),
        ownerId,
    });

    if (!transaction) {
        throw new AppError(404, "NOT_FOUND", "Transaction introuvable.");
    }
}

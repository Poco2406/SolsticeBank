import { Account } from "../models/Account.js";

function toAccountResponse(account: {
    _id: unknown;
    ownerId: unknown;
    iban: string;
    currency: string;
    balanceCents: number;
    status: "active" | "closed";
    createdAt: Date;
    updatedAt: Date;
}) {
    return {
        id: String(account._id),
        ownerId: String(account.ownerId),
        iban: account.iban,
        currency: account.currency,
        balanceCents: account.balanceCents,
        status: account.status,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
    };
}

export async function getByOwnerId(ownerId: string) {
    const account = await Account.findOne({ ownerId });

    if (!account) {
        return null;
    }

    return toAccountResponse(account);
}

export async function createAccountForUser(ownerId: string) {
    const existingAccount = await Account.findOne({ ownerId });

    if (existingAccount) {
        return toAccountResponse(existingAccount);
    }

    try {
        const account = await Account.create({
            ownerId,
            currency: "EUR",
            balanceCents: 50000,
            status: "active",
        });

        return toAccountResponse(account);
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
        ) {
            const account = await Account.findOne({ ownerId });

            if (account) {
                return toAccountResponse(account);
            }
        }

        throw error;
    }
}
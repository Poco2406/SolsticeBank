// src/services/accountDeletion.service.ts
// Suppression de compte (DELETE /api/me), en une seule transaction :
//  - utilisateur : statut closed, coordonnées effacées, email libéré,
//    sessions invalidées (tokenVersion) → absent de l'annuaire, connexion impossible ;
//  - compte bancaire : clôturé, solde conservé comme trace du solde abandonné ;
//  - carnet budgétaire et jetons d'email : supprimés ;
//  - mouvements, opérations et virements : conservés (immuables). L'autre partie
//    d'un virement voit désormais « un compte supprimé » dans son historique.
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { User } from "../models/User.js";
import { Account } from "../models/Account.js";
import { Transaction } from "../models/Transaction.js";
import { AuthToken } from "../models/AuthToken.js";
import { AppError, unauthorized } from "../errors/AppError.js";

export async function deleteAccount(userId: string, password: string) {
    const user = await User.findById(userId);
    if (!user || user.status === "closed") throw unauthorized();

    // 403 et non 401 : le jeton est valide, seule la confirmation échoue
    // (un 401 déconnecterait le front).
    if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new AppError(403, "FORBIDDEN", "Mot de passe incorrect.");
    }

    await mongoose.connection.transaction(async (session) => {
        const closed = await User.updateOne(
            { _id: user._id, status: { $ne: "closed" } },
            {
                $set: {
                    status: "closed",
                    closedAt: new Date(),
                    // Email unique remplacé : l'adresse d'origine redevient libre
                    email: `deleted-${user._id}@deleted.invalid`,
                    passwordHash: "!",
                    firstName: null,
                    lastName: null,
                    username: null,
                    gender: "unspecified",
                    birthDate: null,
                    phone: null,
                    address: null,
                    emailVerifiedAt: null,
                },
                $inc: { tokenVersion: 1 }, // tous les JWT existants deviennent invalides
            },
            { session },
        );
        // Une autre requête de suppression est passée entre-temps
        if (closed.modifiedCount === 0) throw unauthorized();

        await Account.updateOne({ ownerId: user._id }, { $set: { status: "closed" } }, { session });
        await Transaction.deleteMany({ ownerId: user._id }, { session });
        await AuthToken.deleteMany({ userId: user._id }, { session });
    });
}

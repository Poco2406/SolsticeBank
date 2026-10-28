import { Types } from "mongoose";
import { User } from "../models/User.js";
import { notFound } from "../errors/AppError.js";

type PublicUserRow = {
    _id: Types.ObjectId;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
};

const PUBLIC_FIELDS = { firstName: 1, lastName: 1, username: 1 } as const;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function toPublicUser(u: PublicUserRow) {
    return {
        id: String(u._id),
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        username: u.username ?? null,
    };
}

// Liste des utilisateurs actifs, sauf l'utilisateur connecté. Recherche facultative.
export async function listDirectory(
    currentUserId: string,
    page: number,
    limit: number,
    search?: string,
) {
    const terms = search ? search.trim().split(/\s+/).map(escapeRegex) : [];
    const filter = {
        status: "active" as const,
        _id: { $ne: new Types.ObjectId(currentUserId) },
        ...(terms.length > 0 && {
            $and: terms.map((term) => {
                const re = new RegExp(term, "i");
                return { $or: [{ firstName: re }, { lastName: re }, { username: re }] };
            }),
        }),
    };

    const [docs, total] = await Promise.all([
        User.find(filter, PUBLIC_FIELDS)
            .sort({ lastName: 1, firstName: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean<PublicUserRow[]>(),
        User.countDocuments(filter),
    ]);

    return { items: docs.map(toPublicUser), page, limit, total };
}

// Fiche publique d'un utilisateur actif (destinataire d'un virement).
export async function getPublicUser(currentUserId: string, targetId: string) {
    if (targetId === currentUserId) {
        throw notFound("Utilisateur introuvable."); // on ne se choisit pas soi-même
    }
    const user = await User.findOne({ _id: targetId, status: "active" }, PUBLIC_FIELDS)
        .lean<PublicUserRow | null>();
    if (!user) throw notFound("Utilisateur introuvable.");
    return toPublicUser(user);
}
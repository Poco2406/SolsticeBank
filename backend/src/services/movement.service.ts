import { Types } from "mongoose";
import { Movement } from "../models/Movement.js";
import { Transfer } from "../models/Transfer.js";
import { User } from "../models/User.js";
import { notFound } from "../errors/AppError.js";

export const MOVEMENT_TYPES = ["deposit", "withdrawal", "transfer_debit", "transfer_credit"] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

// Un mouvement vient soit d'une opération (dépôt/retrait), soit d'un virement.
type MovementRow = {
    _id: Types.ObjectId;
    accountId: Types.ObjectId;
    operationId?: Types.ObjectId | null;
    transferId?: Types.ObjectId | null;
    type: MovementType;
    amountCents: number;
    balanceAfterCents: number;
    createdAt: Date;
};

export type MovementFilters = {
    type?: MovementType;
    from?: string; // date civile YYYY-MM-DD, incluse
    to?: string; // date civile YYYY-MM-DD, incluse
    minAmountCents?: number;
    maxAmountCents?: number;
};

// Les dates civiles des filtres sont des jours à Paris, pas des jours UTC.
const TIME_ZONE = "Europe/Paris";

// Format public d'un mouvement : id au lieu de _id, sans ownerId ni __v.
// Aussi utilisé par les réponses des dépôts et retraits (account.routes).
export function toMovementResponse(m: MovementRow) {
    return {
        id: String(m._id),
        accountId: String(m.accountId),
        operationId: m.operationId ? String(m.operationId) : null,
        transferId: m.transferId ? String(m.transferId) : null,
        type: m.type,
        amountCents: m.amountCents,
        balanceAfterCents: m.balanceAfterCents,
        createdAt: m.createdAt,
    };
}

// Correspondant d'un virement : seulement les données publiques de l'annuaire.
type Counterparty = { id: string; firstName: string | null; lastName: string | null; username: string | null };

// Ajoute `counterparty` à chaque mouvement : l'autre partie d'un virement,
// null pour un dépôt ou un retrait (2 requêtes pour toute la page).
async function withCounterparties(movements: MovementRow[]) {
    const transferIds = movements.flatMap((m) => (m.transferId ? [m.transferId] : []));
    const transfers = transferIds.length
        ? await Transfer.find({ _id: { $in: transferIds } }, { senderId: 1, recipientId: 1 })
            .lean<{ _id: Types.ObjectId; senderId: Types.ObjectId; recipientId: Types.ObjectId }[]>()
        : [];

    // Débit : l'autre partie est le destinataire ; crédit : l'expéditeur.
    const otherPartyOf = new Map<string, string>();
    for (const m of movements) {
        const transfer = m.transferId && transfers.find((t) => t._id.equals(m.transferId!));
        if (transfer) {
            otherPartyOf.set(String(m._id), String(m.type === "transfer_debit" ? transfer.recipientId : transfer.senderId));
        }
    }

    const userIds = [...new Set(otherPartyOf.values())];
    const users = userIds.length
        ? await User.find({ _id: { $in: userIds } }, { firstName: 1, lastName: 1, username: 1 })
            .lean<{ _id: Types.ObjectId; firstName?: string | null; lastName?: string | null; username?: string | null }[]>()
        : [];
    const byId = new Map<string, Counterparty>(
        users.map((u) => [
            String(u._id),
            { id: String(u._id), firstName: u.firstName ?? null, lastName: u.lastName ?? null, username: u.username ?? null },
        ]),
    );

    return movements.map((m) => {
        const otherId = otherPartyOf.get(String(m._id));
        return { ...toMovementResponse(m), counterparty: (otherId && byId.get(otherId)) || null };
    });
}

// Instant UTC correspondant à minuit (heure de Paris) du jour donné.
// Les changements d'heure ont lieu la nuit vers 2-3 h : minuit n'est jamais ambigu.
function parisMidnight(day: string): Date {
    const utcMidnight = new Date(`${day}T00:00:00Z`);
    const offset = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, timeZoneName: "longOffset" })
        .formatToParts(utcMidnight)
        .find((part) => part.type === "timeZoneName")?.value; // ex. "GMT+02:00"
    const match = offset?.match(/GMT([+-])(\d{2}):(\d{2})/);
    const offsetMinutes = match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
    return new Date(utcMidnight.getTime() - offsetMinutes * 60_000);
}

function nextDay(day: string): string {
    const date = new Date(`${day}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

// Historique paginé de l'utilisateur, du plus récent au plus ancien.
export async function listMovements(ownerId: string, filters: MovementFilters, page: number, limit: number) {
    const { type, from, to, minAmountCents, maxAmountCents } = filters;
    const filter = {
        ownerId: new Types.ObjectId(ownerId),
        ...(type && { type }),
        ...((from || to) && {
            createdAt: {
                ...(from && { $gte: parisMidnight(from) }),
                ...(to && { $lt: parisMidnight(nextDay(to)) }),
            },
        }),
        ...((minAmountCents !== undefined || maxAmountCents !== undefined) && {
            amountCents: {
                ...(minAmountCents !== undefined && { $gte: minAmountCents }),
                ...(maxAmountCents !== undefined && { $lte: maxAmountCents }),
            },
        }),
    };

    const [docs, total] = await Promise.all([
        Movement.find(filter)
            .sort({ createdAt: -1, _id: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean<MovementRow[]>(),
        Movement.countDocuments(filter),
    ]);

    return { items: await withCounterparties(docs), page, limit, total };
}

// Détail d'un mouvement : 404 s'il n'existe pas ou appartient à un autre utilisateur.
export async function getMovement(ownerId: string, id: string) {
    const movement = await Movement.findOne({ _id: id, ownerId }).lean<MovementRow | null>();
    if (!movement) throw notFound("Mouvement introuvable.");
    const [withCounterparty] = await withCounterparties([movement]);
    return withCounterparty;
}

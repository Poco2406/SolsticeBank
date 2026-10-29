import { Types } from "mongoose";
import { Movement } from "../models/Movement.js";
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

    return { items: docs.map(toMovementResponse), page, limit, total };
}

// Détail d'un mouvement : 404 s'il n'existe pas ou appartient à un autre utilisateur.
export async function getMovement(ownerId: string, id: string) {
    const movement = await Movement.findOne({ _id: id, ownerId }).lean<MovementRow | null>();
    if (!movement) throw notFound("Mouvement introuvable.");
    return toMovementResponse(movement);
}

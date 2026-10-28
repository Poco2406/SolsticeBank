
import { Movement } from "../models/Movement.js";

export async function getByOwnerId(ownerId: string) {
    return Movement.find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
        .exec();
}

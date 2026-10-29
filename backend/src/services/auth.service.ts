import bcrypt from "bcrypt";
import mongoose from "mongoose";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError, badRequest, unauthorized } from "../errors/AppError.js";
import { assertAdultBirthDate } from "./profile.service.js";
import { FullProfile } from "../validation/profile.js";
import { createAccountForUser } from "./account.service.js";

const BCRYPT_ROUNDS = 12;

function assertBcryptLength(password: string) {
    // bcrypt ignore tout au-delà de 72 octets : on refuse plutôt que tronquer.
    if (Buffer.byteLength(password, "utf8") > 72) {
        throw badRequest("password : 72 octets maximum.");
    }
}

function signToken(userId: string, tokenVersion: number) {
    return jwt.sign({ sub: userId, tv: tokenVersion }, env.jwtSecret, {
        expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
    });
}

function toAuthResponse(user: { _id: unknown; email: string; tokenVersion: number }) {
    const id = String(user._id);
    return { user: { id, email: user.email }, token: signToken(id, user.tokenVersion) };
}

export async function register(email: string, password: string, profile?: FullProfile) {
    assertBcryptLength(password);

    if (profile) assertAdultBirthDate(profile.birthDate);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user;

    try {
        // Utilisateur et compte bancaire créés ensemble, ou pas du tout.
        user = await mongoose.connection.transaction(async (session) => {
            const [created] = await User.create([{ email, passwordHash, ...profile }], { session });
            await createAccountForUser(String(created._id), session);
            return created;
        });
    } catch (err: unknown) {
        const e = err as {
            code?: number;
            keyPattern?: Record<string, unknown>;
        };

        if (e.code === 11000 && e.keyPattern?.username) {
            throw new AppError(409, "CONFLICT", "Ce pseudo est déjà utilisé.");
        }

        if (e.code === 11000) {
            throw new AppError(409, "EMAIL_ALREADY_USED", "Cet email est déjà utilisé.");
        }

        throw err;
    }

    return toAuthResponse(user);

}

export async function login(email: string, password: string) {
    assertBcryptLength(password);
    const user = await User.findOne({ email });
    const ok = user && user.status !== "closed" && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) {
        throw unauthorized("Email ou mot de passe incorrect.");
    }
    return toAuthResponse(user);
}
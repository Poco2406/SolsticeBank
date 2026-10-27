import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError, badRequest, unauthorized } from "../errors/AppError.js";

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

export async function register(email: string, password: string) {
    assertBcryptLength(password);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    try {
        const user = await User.create({ email, passwordHash });
        return toAuthResponse(user);
    } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
            throw new AppError(409, "EMAIL_ALREADY_USED", "Cet email est déjà utilisé.");
        }
        throw err;
    }
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
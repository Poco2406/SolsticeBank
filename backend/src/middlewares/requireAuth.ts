import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { unauthorized } from "../errors/AppError.js";

export const requireAuth: RequestHandler = async (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) throw unauthorized();

    let payload: jwt.JwtPayload;
    try {
        payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    } catch {
        throw unauthorized("Jeton invalide ou expiré.");
    }

    const user = await User.findById(payload.sub).select("status tokenVersion");
    if (!user || user.status === "closed" || user.tokenVersion !== payload.tv) {
        throw unauthorized("Session invalide.");
    }

    req.userId = String(user._id);
    next();
};
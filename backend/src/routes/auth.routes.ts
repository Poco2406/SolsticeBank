import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";
import { emailSchema } from "../validation/common.js";
import * as auth from "../services/auth.service.js";

const credentials = z.object({ email: emailSchema, password: z.string().min(8) }).strict();

export const authRouter = Router();

authRouter.post("/register", validateBody(credentials), async (req, res) => {
    res.status(201).json(await auth.register(req.body.email, req.body.password));
});

authRouter.post("/login", validateBody(credentials), async (req, res) => {
    res.status(200).json(await auth.login(req.body.email, req.body.password));
});
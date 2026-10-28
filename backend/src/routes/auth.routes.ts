import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middlewares/validate.js";
import { emailSchema } from "../validation/common.js";
import * as auth from "../services/auth.service.js";
import { verificationRouter } from "./verification.routes.js";
import { passwordRouter } from "./password.routes.js";
import { fullProfileSchema } from "../validation/profile.js";

const credentials = z.object({ email: emailSchema, password: z.string().min(8) }).strict();

export const authRouter = Router();

const registerSchema = z
  .object({ email: emailSchema, password: z.string().min(8), profile: fullProfileSchema.optional() })
  .strict(); 

authRouter.post("/register", validateBody(registerSchema), async (req, res) => {
  const { email, password, profile } = req.body;
  res.status(201).json(await auth.register(email, password, profile));
});

authRouter.post("/login", validateBody(credentials), async (req, res) => {
    res.status(200).json(await auth.login(req.body.email, req.body.password));
});

authRouter.use("/verification", verificationRouter);

authRouter.use("/password", passwordRouter);
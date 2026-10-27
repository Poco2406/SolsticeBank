
import { createHash, randomBytes } from "node:crypto";
import { Types } from "mongoose";
import { AuthToken } from "../models/AuthToken.js";

export type TokenPurpose =
  | "email_verification"
  | "password_reset";

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export async function createAuthToken(
  userId: Types.ObjectId,
  purpose: TokenPurpose,
  validityMinutes = 30,
): Promise<string> {
  const token = randomBytes(32).toString("hex");

  await AuthToken.create({
    userId,
    tokenHash: hashToken(token),
    purpose,
    expiresAt: new Date(
      Date.now() + validityMinutes * 60_000
    ),
    consumedAt: null,
  });

  return token;
}

export async function consumeAuthToken(
  token: string,
  purpose: TokenPurpose,
): Promise<Types.ObjectId | null> {
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const document = await AuthToken.findOneAndUpdate(
    {
      tokenHash: hashToken(token),
      purpose,
      consumedAt: null,
      expiresAt: { $gt: new Date() },
    },
    {
      $set: { consumedAt: new Date() },
    },
    { new: true },
  );

  return document?.userId ?? null;
}

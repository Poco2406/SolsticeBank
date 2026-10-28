// src/services/profile.service.ts
import { User, type UserDocument } from "../models/User.js";
import { AppError, badRequest, unauthorized } from "../errors/AppError.js";
import type { FullProfile } from "../validation/profile.js";

// ---------- Âge et majorité ----------

// Date du jour à Paris, au format YYYY-MM-DD.
function todayInParis(): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// Découpe une date civile YYYY-MM-DD en nombres (format garanti par Zod).
function parts(date: string): { y: number; m: number; d: number } {
    return {
        y: Number(date.slice(0, 4)),
        m: Number(date.slice(5, 7)),
        d: Number(date.slice(8, 10)),
    };
}

// Âge en années pleines à une date donnée.
function ageOn(birthDate: string, today: string): number {
    const b = parts(birthDate);
    const t = parts(today);
    const birthdayPassed = t.m > b.m || (t.m === b.m && t.d >= b.d);
    return t.y - b.y - (birthdayPassed ? 0 : 1);
}

// Refuse une date future ou une personne mineure. 18 ans pile : accepté.
export function assertAdultBirthDate(birthDate: string): void {
    const today = todayInParis();
    if (birthDate > today) {
        throw badRequest("birthDate : date dans le futur.");
    }
    if (ageOn(birthDate, today) < 18) {
        throw badRequest("birthDate : SOLSTICE BANK est réservée aux personnes majeures.");
    }
}

// ---------- Profil ----------

// Un profil complet est requis pour utiliser les fonctions bancaires
// (cas d'un compte créé avec l'inscription minimale du livret).
export function isProfileComplete(u: UserDocument): boolean {
    return Boolean(
        u.firstName &&
        u.lastName &&
        u.username &&
        u.birthDate &&
        u.phone &&
        u.address?.street &&
        u.address?.postalCode &&
        u.address?.city &&
        u.address?.country,
    );
}

// Seuls champs renvoyés au propriétaire du compte : jamais de hash ni de tokenVersion.
export function toProfile(u: UserDocument) {
    return {
        id: String(u._id),
        email: u.email,
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        username: u.username ?? null,
        gender: u.gender,
        birthDate: u.birthDate ?? null,
        address: u.address
            ? {
                street: u.address.street ?? null,
                complement: u.address.complement ?? null,
                postalCode: u.address.postalCode ?? null,
                city: u.address.city ?? null,
                country: u.address.country ?? null,
            }
            : null,
        phone: u.phone ?? null,
        status: u.status,
        emailVerified: Boolean(u.emailVerifiedAt),
        profileComplete: isProfileComplete(u),
    };
}

// ---------- Routes /api/me ----------

async function findOpenUser(userId: string): Promise<UserDocument> {
    const user = await User.findById(userId);
    if (!user || user.status === "closed") throw unauthorized();
    return user;
}

export async function getMe(userId: string) {
    const user = await findOpenUser(userId);
    return toProfile(user);
}

export async function updateMe(userId: string, data: Partial<FullProfile>) {
    const user = await findOpenUser(userId);

    if (data.birthDate !== undefined) {
        if (user.birthDate && user.birthDate !== data.birthDate) {
            throw badRequest("birthDate : la date de naissance n'est plus modifiable.");
        }
        assertAdultBirthDate(data.birthDate);
    }

    user.set(data);
    try {
        await user.save();
    } catch (err: unknown) {
        const e = err as { code?: number; keyPattern?: Record<string, unknown> };
        if (e.code === 11000 && e.keyPattern?.username) {
            throw new AppError(409, "CONFLICT", "Ce pseudo est déjà utilisé.");
        }
        throw err;
    }

    return toProfile(user);
}
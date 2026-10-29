// Création d'utilisateurs de test via l'API (comme le ferait le front).
import request from "supertest";
import type { Express } from "express";

export const PASSWORD = "MotDePasse123!";

let counter = 0;

// Profil complet valide ; le pseudo doit être unique.
export function validProfile(username = `user${++counter}`) {
    return {
        firstName: "Alice",
        lastName: "Martin",
        username,
        gender: "female",
        birthDate: "1995-04-12",
        phone: "+33612345678",
        address: {
            street: "12 rue de la Paix",
            complement: null,
            postalCode: "75002",
            city: "Paris",
            country: "France",
        },
    };
}

export type TestUser = { id: string; email: string; token: string; auth: string };

// Inscription minimale du livret ({ email, password }) : compte sans profil.
export async function registerMinimal(app: Express, email = `min${++counter}@example.test`): Promise<TestUser> {
    const res = await request(app).post("/api/auth/register").send({ email, password: PASSWORD });
    if (res.status !== 201) throw new Error(`Inscription échouée (${res.status}) : ${JSON.stringify(res.body)}`);
    return { id: res.body.user.id, email, token: res.body.token, auth: `Bearer ${res.body.token}` };
}

// Inscription avec profil complet : accès aux fonctions bancaires.
export async function registerWithProfile(
    app: Express,
    username = `user${++counter}`,
    email = `${username}@example.test`,
): Promise<TestUser> {
    const res = await request(app)
        .post("/api/auth/register")
        .send({ email, password: PASSWORD, profile: validProfile(username) });
    if (res.status !== 201) throw new Error(`Inscription échouée (${res.status}) : ${JSON.stringify(res.body)}`);
    return { id: res.body.user.id, email, token: res.body.token, auth: `Bearer ${res.body.token}` };
}

// Identifiant valide qui n'existe pas en base.
export const ABSENT_ID = "507f1f77bcf86cd799439011";

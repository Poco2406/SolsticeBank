// Inscription, connexion, JWT et réinitialisation du mot de passe.
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";
import { Account } from "../src/models/Account.js";
import { createAuthToken } from "../src/services/authTokenService.js";
import { useTestDb } from "./helpers/db.js";
import { PASSWORD, registerMinimal, validProfile } from "./helpers/users.js";

const app = createApp();

// Date de naissance d'une personne qui a exactement `years` ans aujourd'hui (heure de Paris).
function birthDateYearsAgo(years: number, dayOffset = 0): string {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
    const date = new Date(`${today}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() - years);
    date.setUTCDate(date.getUTCDate() + dayOffset);
    return date.toISOString().slice(0, 10);
}

describe("Authentification", () => {
    useTestDb();

    describe("POST /api/auth/register", () => {
        test("inscription minimale du livret : 201 {user:{id,email}, token}", async () => {
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "alice@example.test", password: PASSWORD });

            expect(res.status).toBe(201);
            expect(Object.keys(res.body).sort()).toEqual(["token", "user"]);
            expect(res.body.user).toEqual({ id: expect.any(String), email: "alice@example.test" });
            expect(jwt.verify(res.body.token, env.jwtSecret)).toMatchObject({ sub: res.body.user.id });
            expect(JSON.stringify(res.body)).not.toMatch(/password/i);
        });

        test("le mot de passe est stocké haché (bcrypt), jamais en clair", async () => {
            await request(app).post("/api/auth/register").send({ email: "a@example.test", password: PASSWORD });
            const user = await User.findOne({ email: "a@example.test" });
            expect(user?.passwordHash).toMatch(/^\$2[aby]\$12\$/);
            expect(user?.passwordHash).not.toContain(PASSWORD);
        });

        test("un compte bancaire de 500 € est créé avec l'utilisateur", async () => {
            const alice = await registerMinimal(app);
            const res = await request(app).get("/api/account").set("Authorization", alice.auth);
            expect(res.status).toBe(200);
            expect(res.body.account).toMatchObject({ balanceCents: 50000, currency: "EUR", status: "active" });
        });

        test("email déjà utilisé, quelle que soit la casse : 409 EMAIL_ALREADY_USED", async () => {
            await request(app).post("/api/auth/register").send({ email: "alice@example.test", password: PASSWORD });
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "  ALICE@Example.TEST ", password: PASSWORD });
            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("EMAIL_ALREADY_USED");
        });

        test.each([
            ["email invalide", { email: "pas-un-email", password: PASSWORD }],
            ["mot de passe trop court", { email: "a@example.test", password: "court" }],
            ["mot de passe au-delà de 72 octets", { email: "a@example.test", password: "é".repeat(37) }],
            ["champ inconnu", { email: "a@example.test", password: PASSWORD, role: "admin" }],
            ["corps vide", {}],
        ])("%s : 400 INVALID_INPUT", async (_cas, body) => {
            const res = await request(app).post("/api/auth/register").send(body);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_INPUT");
        });

        test("avec profil complet : 201 et profil enregistré", async () => {
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "b@example.test", password: PASSWORD, profile: validProfile("bob") });
            expect(res.status).toBe(201);

            const me = await request(app).get("/api/me").set("Authorization", `Bearer ${res.body.token}`);
            expect(me.body).toMatchObject({ username: "bob", status: "active", profileComplete: true });
        });

        test("profil incomplet : 400 et aucun compte créé", async () => {
            const { phone: _phone, ...incomplete } = validProfile("bob");
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "b@example.test", password: PASSWORD, profile: incomplete });
            expect(res.status).toBe(400);
            expect(await User.countDocuments()).toBe(0);
        });

        test("pseudo déjà pris, quelle que soit la casse : 409 CONFLICT", async () => {
            await request(app)
                .post("/api/auth/register")
                .send({ email: "a@example.test", password: PASSWORD, profile: validProfile("Alice") });
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "b@example.test", password: PASSWORD, profile: validProfile("alice") });
            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("CONFLICT");
        });

        test("mineur (18 ans demain) : 400 et rien n'est créé", async () => {
            const profile = { ...validProfile("mineur"), birthDate: birthDateYearsAgo(18, 1) };
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "m@example.test", password: PASSWORD, profile });
            expect(res.status).toBe(400);
            expect(await User.countDocuments()).toBe(0);
            expect(await Account.countDocuments()).toBe(0);
        });

        test("18 ans pile aujourd'hui : 201", async () => {
            const profile = { ...validProfile("majeur"), birthDate: birthDateYearsAgo(18) };
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "m@example.test", password: PASSWORD, profile });
            expect(res.status).toBe(201);
        });
    });

    describe("POST /api/auth/login", () => {
        test("bons identifiants : 200, même format que register", async () => {
            const alice = await registerMinimal(app, "alice@example.test");
            const res = await request(app)
                .post("/api/auth/login")
                .send({ email: "Alice@Example.test", password: PASSWORD });
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ user: { id: alice.id, email: "alice@example.test" }, token: expect.any(String) });
        });

        test("mauvais mot de passe et email inconnu : même 401, même message", async () => {
            await registerMinimal(app, "alice@example.test");
            const wrongPassword = await request(app)
                .post("/api/auth/login")
                .send({ email: "alice@example.test", password: "MauvaisMotDePasse" });
            const unknownEmail = await request(app)
                .post("/api/auth/login")
                .send({ email: "inconnu@example.test", password: PASSWORD });

            expect(wrongPassword.status).toBe(401);
            expect(unknownEmail.status).toBe(401);
            expect(wrongPassword.body.error.code).toBe("UNAUTHORIZED");
            expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
        });

        test("corps invalide : 400", async () => {
            const res = await request(app).post("/api/auth/login").send({ email: "alice@example.test" });
            expect(res.status).toBe(400);
        });
    });

    describe("JWT", () => {
        test("jeton expiré : 401", async () => {
            const alice = await registerMinimal(app);
            const expired = jwt.sign({ sub: alice.id, tv: 0 }, env.jwtSecret, { expiresIn: -10 });
            const res = await request(app).get("/api/me").set("Authorization", `Bearer ${expired}`);
            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe("UNAUTHORIZED");
        });

        test("jeton falsifié (autre clé) : 401", async () => {
            const alice = await registerMinimal(app);
            const forged = jwt.sign({ sub: alice.id, tv: 0 }, "cle-de-l-attaquant");
            const res = await request(app).get("/api/me").set("Authorization", `Bearer ${forged}`);
            expect(res.status).toBe(401);
        });

        test("jeton valide d'un utilisateur supprimé : 401", async () => {
            const alice = await registerMinimal(app);
            await User.deleteOne({ _id: alice.id });
            const res = await request(app).get("/api/me").set("Authorization", alice.auth);
            expect(res.status).toBe(401);
        });
    });

    describe("Réinitialisation du mot de passe", () => {
        async function resetToken(email: string) {
            const user = await User.findOne({ email });
            return createAuthToken(user!._id, "password_reset", 30);
        }

        test("forgot : réponse neutre, que l'email existe ou non", async () => {
            const res = await request(app)
                .post("/api/auth/password/forgot")
                .send({ email: "inconnu@example.test" });
            expect(res.status).toBe(200);
            expect(res.body.message).toEqual(expect.any(String));
        });

        test("reset : nouveau mot de passe actif, anciennes sessions invalidées", async () => {
            const alice = await registerMinimal(app, "alice@example.test");
            const token = await resetToken(alice.email);

            const reset = await request(app)
                .post("/api/auth/password/reset")
                .send({ token, password: "NouveauMotDePasse1!" });
            expect(reset.status).toBe(200);

            // L'ancien JWT ne fonctionne plus.
            const oldSession = await request(app).get("/api/me").set("Authorization", alice.auth);
            expect(oldSession.status).toBe(401);

            const oldPassword = await request(app).post("/api/auth/login").send({ email: alice.email, password: PASSWORD });
            expect(oldPassword.status).toBe(401);
            const newPassword = await request(app)
                .post("/api/auth/login")
                .send({ email: alice.email, password: "NouveauMotDePasse1!" });
            expect(newPassword.status).toBe(200);
        });

        test("reset : un jeton ne sert qu'une fois", async () => {
            const alice = await registerMinimal(app, "alice@example.test");
            const token = await resetToken(alice.email);

            await request(app).post("/api/auth/password/reset").send({ token, password: "NouveauMotDePasse1!" });
            const reused = await request(app)
                .post("/api/auth/password/reset")
                .send({ token, password: "EncoreUnAutre1!" });
            expect(reused.status).toBe(400);
        });

        test("reset : jeton expiré refusé", async () => {
            const alice = await registerMinimal(app, "alice@example.test");
            const user = await User.findOne({ email: alice.email });
            const token = await createAuthToken(user!._id, "password_reset", -1);

            const res = await request(app)
                .post("/api/auth/password/reset")
                .send({ token, password: "NouveauMotDePasse1!" });
            expect(res.status).toBe(400);
        });
    });
});

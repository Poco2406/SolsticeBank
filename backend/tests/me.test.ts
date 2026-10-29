// Profil de l'utilisateur connecté : GET / PATCH /api/me.
import request from "supertest";
import { createApp } from "../src/app.js";
import { useTestDb } from "./helpers/db.js";
import { registerMinimal, registerWithProfile, validProfile } from "./helpers/users.js";

const app = createApp();

describe("/api/me", () => {
    useTestDb();

    test("GET sans jeton : 401", async () => {
        const res = await request(app).get("/api/me");
        expect(res.status).toBe(401);
    });

    test("GET : profil du propriétaire, sans données sensibles", async () => {
        const alice = await registerWithProfile(app, "alice");
        const res = await request(app).get("/api/me").set("Authorization", alice.auth);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ id: alice.id, email: alice.email, username: "alice", status: "active" });
        for (const secret of ["passwordHash", "password", "tokenVersion", "_id", "__v"]) {
            expect(res.body).not.toHaveProperty(secret);
        }
    });

    test("compte sans profil : profileComplete false, puis true après PATCH complet", async () => {
        const alice = await registerMinimal(app);
        const before = await request(app).get("/api/me").set("Authorization", alice.auth);
        expect(before.body.profileComplete).toBe(false);

        const res = await request(app).patch("/api/me").set("Authorization", alice.auth).send(validProfile("alice"));
        expect(res.status).toBe(200);
        expect(res.body.profileComplete).toBe(true);
    });

    test("PATCH partiel : seul le champ envoyé change", async () => {
        const alice = await registerWithProfile(app, "alice");
        const res = await request(app).patch("/api/me").set("Authorization", alice.auth).send({ firstName: "Alicia" });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ firstName: "Alicia", lastName: "Martin", username: "alice" });
    });

    test.each([
        ["vide", {}],
        ["champ inconnu", { role: "admin" }],
        ["email (non modifiable ici)", { email: "autre@example.test" }],
        ["status", { status: "closed" }],
        ["pseudo invalide", { username: "a b" }],
        ["téléphone invalide", { phone: "0612345678" }],
    ])("PATCH %s : 400", async (_cas, body) => {
        const alice = await registerWithProfile(app, "alice");
        const res = await request(app).patch("/api/me").set("Authorization", alice.auth).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    test("PATCH : la date de naissance n'est plus modifiable une fois renseignée", async () => {
        const alice = await registerWithProfile(app, "alice");
        const res = await request(app).patch("/api/me").set("Authorization", alice.auth).send({ birthDate: "1990-01-01" });
        expect(res.status).toBe(400);
    });

    test("PATCH : pseudo déjà pris par un autre (casse ignorée) : 409", async () => {
        await registerWithProfile(app, "Bob");
        const alice = await registerWithProfile(app, "alice");
        const res = await request(app).patch("/api/me").set("Authorization", alice.auth).send({ username: "bob" });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("CONFLICT");
    });
});

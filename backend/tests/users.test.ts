// Annuaire : GET /api/users et GET /api/users/:id.
import request from "supertest";
import { createApp } from "../src/app.js";
import { useTestDb } from "./helpers/db.js";
import { ABSENT_ID, registerMinimal, registerWithProfile } from "./helpers/users.js";

const app = createApp();

const PUBLIC_KEYS = ["firstName", "id", "lastName", "username"];

describe("Annuaire /api/users", () => {
    useTestDb();

    test("sans jeton : 401", async () => {
        const res = await request(app).get("/api/users");
        expect(res.status).toBe(401);
    });

    test("liste les comptes visibles, sauf soi-même et les comptes sans profil", async () => {
        const alice = await registerWithProfile(app, "alice");
        await registerWithProfile(app, "bob");
        await registerMinimal(app); // sans pseudo : invisible

        const res = await request(app).get("/api/users").set("Authorization", alice.auth);
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ page: 1, total: 1 });
        expect(res.body.items.map((u: { username: string }) => u.username)).toEqual(["bob"]);
    });

    test("n'expose que id, prénom, nom et pseudo", async () => {
        const alice = await registerWithProfile(app, "alice");
        await registerWithProfile(app, "bob");

        const res = await request(app).get("/api/users").set("Authorization", alice.auth);
        expect(Object.keys(res.body.items[0]).sort()).toEqual(PUBLIC_KEYS);
        expect(JSON.stringify(res.body)).not.toMatch(/email|phone|birthDate|address|passwordHash/);
    });

    test("recherche par pseudo et pagination", async () => {
        const alice = await registerWithProfile(app, "alice");
        await registerWithProfile(app, "bob");
        await registerWithProfile(app, "bobby");
        await registerWithProfile(app, "carol");

        const search = await request(app).get("/api/users?search=bob").set("Authorization", alice.auth);
        expect(search.body.total).toBe(2);

        const page = await request(app).get("/api/users?limit=1&page=2").set("Authorization", alice.auth);
        expect(page.body).toMatchObject({ page: 2, limit: 1, total: 3 });
        expect(page.body.items).toHaveLength(1);
    });

    test.each(["limit=0", "limit=101", "page=0", "search=a", "inconnu=1"])("paramètre invalide (%s) : 400", async (query) => {
        const alice = await registerWithProfile(app, "alice");
        const res = await request(app).get(`/api/users?${query}`).set("Authorization", alice.auth);
        expect(res.status).toBe(400);
    });

    describe("GET /api/users/:id", () => {
        test("fiche publique d'un autre utilisateur", async () => {
            const alice = await registerWithProfile(app, "alice");
            const bob = await registerWithProfile(app, "bob");

            const res = await request(app).get(`/api/users/${bob.id}`).set("Authorization", alice.auth);
            expect(res.status).toBe(200);
            expect(Object.keys(res.body).sort()).toEqual(PUBLIC_KEYS);
            expect(res.body.username).toBe("bob");
        });

        test("soi-même, compte sans profil ou absent : 404", async () => {
            const alice = await registerWithProfile(app, "alice");
            const hidden = await registerMinimal(app);

            for (const id of [alice.id, hidden.id, ABSENT_ID]) {
                const res = await request(app).get(`/api/users/${id}`).set("Authorization", alice.auth);
                expect(res.status).toBe(404);
                expect(res.body.error.code).toBe("NOT_FOUND");
            }
        });

        test("id malformé : 400", async () => {
            const alice = await registerWithProfile(app, "alice");
            const res = await request(app).get("/api/users/123").set("Authorization", alice.auth);
            expect(res.status).toBe(400);
        });
    });
});

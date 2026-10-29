// Carnet budgétaire /api/transactions : contrat CRUD du livret (BudgetFlow).
import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app.js";
import { useTestDb } from "./helpers/db.js";
import { ABSENT_ID, registerMinimal, type TestUser } from "./helpers/users.js";

const app = createApp();

const valid = { label: "Courses", amount: 12345, type: "expense", date: "2026-10-05" };

async function create(user: TestUser, body: object = valid) {
    return request(app).post("/api/transactions").set("Authorization", user.auth).send(body);
}

describe("/api/transactions", () => {
    useTestDb();

    let alice: TestUser;
    let bob: TestUser;

    beforeEach(async () => {
        alice = await registerMinimal(app);
        bob = await registerMinimal(app);
    });

    describe("parcours CRUD nominal", () => {
        test("liste vide : 200 {items: []}", async () => {
            const res = await request(app).get("/api/transactions").set("Authorization", alice.auth);
            expect(res.status).toBe(200);
            expect(res.body).toEqual({ items: [] });
        });

        test("création, liste, détail, modification, suppression", async () => {
            const created = await create(alice);
            expect(created.status).toBe(201);
            expect(typeof created.body.id).toBe("string");
            expect(created.body).toMatchObject(valid);
            expect(created.body).not.toHaveProperty("_id");
            const { id } = created.body;

            const list = await request(app).get("/api/transactions").set("Authorization", alice.auth);
            expect(list.status).toBe(200);
            expect(list.body.items).toHaveLength(1);
            expect(list.body.items[0]).toMatchObject({ id, ...valid });

            const detail = await request(app).get(`/api/transactions/${id}`).set("Authorization", alice.auth);
            expect(detail.status).toBe(200);
            expect(detail.body).toMatchObject({ id, ...valid });

            const patched = await request(app)
                .patch(`/api/transactions/${id}`)
                .set("Authorization", alice.auth)
                .send({ amount: 500, type: "income" });
            expect(patched.status).toBe(200);
            expect(patched.body).toMatchObject({ id, label: "Courses", amount: 500, type: "income" });

            const deleted = await request(app).delete(`/api/transactions/${id}`).set("Authorization", alice.auth);
            expect(deleted.status).toBe(204);
            expect(deleted.text).toBe("");

            const after = await request(app).get(`/api/transactions/${id}`).set("Authorization", alice.auth);
            expect(after.status).toBe(404);
            expect(after.body.error.code).toBe("NOT_FOUND");
        });

        test("le libellé est trimé", async () => {
            const res = await create(alice, { ...valid, label: "  Loyer  " });
            expect(res.status).toBe(201);
            expect(res.body.label).toBe("Loyer");
        });
    });

    describe("entrées invalides : 400 INVALID_INPUT", () => {
        test.each([
            ["montant décimal", { ...valid, amount: 12.34 }],
            ["montant nul", { ...valid, amount: 0 }],
            ["montant négatif", { ...valid, amount: -100 }],
            ["montant en chaîne", { ...valid, amount: "12345" }],
            ["montant au-delà d'un entier sûr", { ...valid, amount: Number.MAX_SAFE_INTEGER + 1 }],
            ["type hors énumération", { ...valid, type: "transfer" }],
            ["date impossible", { ...valid, date: "2026-02-30" }],
            ["date mal formée", { ...valid, date: "05/10/2026" }],
            ["libellé vide après trim", { ...valid, label: "   " }],
            ["libellé trop long", { ...valid, label: "x".repeat(121) }],
            ["champ obligatoire manquant", { label: "Courses", amount: 100, type: "expense" }],
            ["id fourni", { ...valid, id: ABSENT_ID }],
            ["ownerId fourni", { ...valid, ownerId: ABSENT_ID }],
            ["champ inconnu", { ...valid, category: "food" }],
        ])("POST refusé : %s", async (_cas, body) => {
            const res = await create(alice, body);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_INPUT");
            expect(res.body.error.message).toEqual(expect.any(String));
        });

        test.each([
            ["PATCH vide", {}],
            ["ownerId", { ownerId: ABSENT_ID }],
            ["id", { id: ABSENT_ID }],
            ["champ inconnu", { foo: "bar" }],
            ["montant invalide", { amount: 12.34 }],
        ])("PATCH refusé : %s", async (_cas, body) => {
            const { body: tx } = await create(alice);
            const res = await request(app)
                .patch(`/api/transactions/${tx.id}`)
                .set("Authorization", alice.auth)
                .send(body);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_INPUT");
        });

        test("JSON mal formé", async () => {
            const res = await request(app)
                .post("/api/transactions")
                .set("Authorization", alice.auth)
                .set("Content-Type", "application/json")
                .send('{"label": "Courses",');
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_INPUT");
        });

        test.each(["get", "patch", "delete"] as const)("id malformé en %s : 400", async (method) => {
            const res = await request(app)[method]("/api/transactions/pas-un-id")
                .set("Authorization", alice.auth)
                .send({ label: "x" });
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_INPUT");
        });

        test("id valide mais absent : 404", async () => {
            const res = await request(app).get(`/api/transactions/${ABSENT_ID}`).set("Authorization", alice.auth);
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("NOT_FOUND");
        });
    });

    describe("authentification : 401 UNAUTHORIZED", () => {
        test.each([
            ["sans en-tête", undefined],
            ["schéma autre que Bearer", "Basic abc"],
            ["jeton malformé", "Bearer pas.un.jwt"],
        ])("%s", async (_cas, header) => {
            const req = request(app).get("/api/transactions");
            if (header) req.set("Authorization", header);
            const res = await req;
            expect(res.status).toBe(401);
            expect(res.body.error.code).toBe("UNAUTHORIZED");
            expect(res.body).not.toHaveProperty("items");
        });

        test("jeton signé avec une autre clé (falsifié)", async () => {
            const forged = jwt.sign({ sub: alice.id, tv: 0 }, "pas-la-bonne-cle");
            const res = await request(app).get("/api/transactions").set("Authorization", `Bearer ${forged}`);
            expect(res.status).toBe(401);
        });

        test("POST sans jeton ne crée rien", async () => {
            const res = await request(app).post("/api/transactions").send(valid);
            expect(res.status).toBe(401);
            const list = await request(app).get("/api/transactions").set("Authorization", alice.auth);
            expect(list.body.items).toHaveLength(0);
        });
    });

    describe("isolation entre comptes A et B", () => {
        test("B ne voit pas les transactions de A dans sa liste", async () => {
            await create(alice);
            await create(bob, { ...valid, label: "Cinéma" });

            const res = await request(app).get("/api/transactions").set("Authorization", bob.auth);
            expect(res.body.items).toHaveLength(1);
            expect(res.body.items[0].label).toBe("Cinéma");
        });

        test("B reçoit 404 en GET, PATCH et DELETE sur un objet de A, qui reste intact", async () => {
            const { body: tx } = await create(alice);

            const get = await request(app).get(`/api/transactions/${tx.id}`).set("Authorization", bob.auth);
            const patch = await request(app)
                .patch(`/api/transactions/${tx.id}`)
                .set("Authorization", bob.auth)
                .send({ amount: 1 });
            const del = await request(app).delete(`/api/transactions/${tx.id}`).set("Authorization", bob.auth);

            for (const res of [get, patch, del]) {
                expect(res.status).toBe(404);
                expect(res.body.error.code).toBe("NOT_FOUND");
            }

            const own = await request(app).get(`/api/transactions/${tx.id}`).set("Authorization", alice.auth);
            expect(own.status).toBe(200);
            expect(own.body.amount).toBe(valid.amount);
        });

        test("le propriétaire est celui du JWT, jamais celui du corps", async () => {
            const res = await create(bob, { ...valid, ownerId: alice.id });
            expect(res.status).toBe(400);
            const list = await request(app).get("/api/transactions").set("Authorization", alice.auth);
            expect(list.body.items).toHaveLength(0);
        });
    });
});

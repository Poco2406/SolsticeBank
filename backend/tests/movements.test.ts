// Dépôts, retraits et historique /api/movements.
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { useTestDb } from "./helpers/db.js";
import { ABSENT_ID, registerMinimal, registerWithProfile, type TestUser } from "./helpers/users.js";

const app = createApp();

function operation(user: TestUser, kind: "deposits" | "withdrawals", amountCents: number, key = randomUUID()) {
    return request(app)
        .post(`/api/account/${kind}`)
        .set("Authorization", user.auth)
        .set("Idempotency-Key", key)
        .send({ amountCents });
}

describe("Opérations et historique", () => {
    useTestDb();

    describe("dépôts et retraits", () => {
        test("dépôt puis retrait : solde mis à jour, réponse sans détails internes", async () => {
            const alice = await registerWithProfile(app, "alice");

            const deposit = await operation(alice, "deposits", 5000);
            expect(deposit.status).toBe(201);
            expect(deposit.body.balanceCents).toBe(55000);
            expect(deposit.body.operation).toMatchObject({ id: expect.any(String), type: "deposit", amountCents: 5000 });
            expect(JSON.stringify(deposit.body)).not.toMatch(/idempotencyKey|requestFingerprint|_id|__v/);

            const withdrawal = await operation(alice, "withdrawals", 2000);
            expect(withdrawal.status).toBe(201);
            expect(withdrawal.body.balanceCents).toBe(53000);
        });

        test("retrait supérieur au solde : 409 INSUFFICIENT_FUNDS, solde inchangé", async () => {
            const alice = await registerWithProfile(app, "alice");
            const res = await operation(alice, "withdrawals", 50001);
            expect(res.status).toBe(409);
            expect(res.body.error.code).toBe("INSUFFICIENT_FUNDS");

            const account = await request(app).get("/api/account").set("Authorization", alice.auth);
            expect(account.body.account.balanceCents).toBe(50000);
        });

        test("idempotence : même clé et même montant = un seul dépôt ; montant différent = 409", async () => {
            const alice = await registerWithProfile(app, "alice");
            const key = randomUUID();

            const first = await operation(alice, "deposits", 1000, key);
            const replay = await operation(alice, "deposits", 1000, key);
            expect(replay.status).toBe(201);
            expect(replay.body.operation.id).toBe(first.body.operation.id);
            expect(replay.body.balanceCents).toBe(51000);

            const conflict = await operation(alice, "deposits", 2000, key);
            expect(conflict.status).toBe(409);
            expect(conflict.body.error.code).toBe("CONFLICT");
        });

        test("sans Idempotency-Key ou montant invalide : 400", async () => {
            const alice = await registerWithProfile(app, "alice");
            const noKey = await request(app)
                .post("/api/account/deposits")
                .set("Authorization", alice.auth)
                .send({ amountCents: 1000 });
            expect(noKey.status).toBe(400);

            const decimal = await operation(alice, "deposits", 10.5);
            expect(decimal.status).toBe(400);
        });

        test("profil incomplet : 403 sur les opérations, solde consultable", async () => {
            const alice = await registerMinimal(app);
            const res = await operation(alice, "deposits", 1000);
            expect(res.status).toBe(403);
            expect(res.body.error.code).toBe("FORBIDDEN");

            const account = await request(app).get("/api/account").set("Authorization", alice.auth);
            expect(account.status).toBe(200);
        });
    });

    describe("GET /api/movements", () => {
        test("liste vide puis mouvements du plus récent au plus ancien", async () => {
            const alice = await registerWithProfile(app, "alice");
            const empty = await request(app).get("/api/movements").set("Authorization", alice.auth);
            expect(empty.status).toBe(200);
            expect(empty.body).toEqual({ items: [], page: 1, limit: 20, total: 0 });

            await operation(alice, "deposits", 1000);
            await operation(alice, "withdrawals", 300);

            const res = await request(app).get("/api/movements").set("Authorization", alice.auth);
            expect(res.body.total).toBe(2);
            expect(res.body.items.map((m: { type: string }) => m.type)).toEqual(["withdrawal", "deposit"]);
            expect(res.body.items[0]).not.toHaveProperty("ownerId");
        });

        test("filtres type, montant, dates et pagination", async () => {
            const alice = await registerWithProfile(app, "alice");
            await operation(alice, "deposits", 1000);
            await operation(alice, "deposits", 5000);
            await operation(alice, "withdrawals", 300);

            const get = (query: string) => request(app).get(`/api/movements?${query}`).set("Authorization", alice.auth);

            expect((await get("type=deposit")).body.total).toBe(2);
            expect((await get("minAmountCents=1000&maxAmountCents=4999")).body.total).toBe(1);

            const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
            expect((await get(`from=${today}&to=${today}`)).body.total).toBe(3);
            expect((await get("from=2000-01-01&to=2000-01-31")).body.total).toBe(0);

            const page = await get("limit=2&page=2");
            expect(page.body).toMatchObject({ page: 2, limit: 2, total: 3 });
            expect(page.body.items).toHaveLength(1);
        });

        test.each([
            "type=transfer",
            "from=2026-02-30",
            "from=2026-10-31&to=2026-10-01",
            "minAmountCents=500&maxAmountCents=100",
            "minAmountCents=12.5",
            "limit=101",
            "ownerId=" + ABSENT_ID,
        ])("paramètre invalide (%s) : 400", async (query) => {
            const alice = await registerWithProfile(app, "alice");
            const res = await request(app).get(`/api/movements?${query}`).set("Authorization", alice.auth);
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe("INVALID_INPUT");
        });

        test("isolation : B ne voit pas les mouvements de A, ni en liste ni en détail", async () => {
            const alice = await registerWithProfile(app, "alice");
            const bob = await registerWithProfile(app, "bob");
            const { body } = await operation(alice, "deposits", 1000);

            const list = await request(app).get("/api/movements").set("Authorization", bob.auth);
            expect(list.body.total).toBe(0);

            const detail = await request(app).get(`/api/movements/${body.movement.id}`).set("Authorization", bob.auth);
            expect(detail.status).toBe(404);

            const own = await request(app).get(`/api/movements/${body.movement.id}`).set("Authorization", alice.auth);
            expect(own.status).toBe(200);
            expect(own.body).toMatchObject({ id: body.movement.id, type: "deposit", amountCents: 1000 });
        });

        test("détail : id malformé 400, absent 404 ; profil incomplet 403", async () => {
            const alice = await registerWithProfile(app, "alice");
            expect((await request(app).get("/api/movements/abc").set("Authorization", alice.auth)).status).toBe(400);
            expect((await request(app).get(`/api/movements/${ABSENT_ID}`).set("Authorization", alice.auth)).status).toBe(404);

            const incomplete = await registerMinimal(app);
            expect((await request(app).get("/api/movements").set("Authorization", incomplete.auth)).status).toBe(403);
        });

        test("virement : chacun voit l'autre partie (données publiques), dépôt sans correspondant", async () => {
            const alice = await registerWithProfile(app, "alice");
            const bob = await registerWithProfile(app, "bob");
            await operation(alice, "deposits", 1000);

            const transfer = await request(app)
                .post("/api/transfers")
                .set("Authorization", alice.auth)
                .set("Idempotency-Key", randomUUID())
                .send({ recipientId: bob.id, amountCents: 2500 });
            expect(transfer.status).toBe(201);

            const aliceList = await request(app).get("/api/movements").set("Authorization", alice.auth);
            const [debit, deposit] = aliceList.body.items;
            expect(debit).toMatchObject({ type: "transfer_debit", counterparty: { id: bob.id, username: "bob" } });
            expect(Object.keys(debit.counterparty).sort()).toEqual(["firstName", "id", "lastName", "username"]);
            expect(deposit).toMatchObject({ type: "deposit", counterparty: null });

            const bobList = await request(app).get("/api/movements").set("Authorization", bob.auth);
            const credit = bobList.body.items[0];
            expect(credit).toMatchObject({ type: "transfer_credit", counterparty: { id: alice.id, username: "alice" } });

            const detail = await request(app).get(`/api/movements/${credit.id}`).set("Authorization", bob.auth);
            expect(detail.body.counterparty).toMatchObject({ username: "alice" });
            expect(JSON.stringify(bobList.body)).not.toMatch(/iban|email|phone/);
        });
    });
});

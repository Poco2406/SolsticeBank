// Virements vers un utilisateur choisi dans l'annuaire (recipientId) ou par IBAN.
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { useTestDb } from "./helpers/db.js";
import { ABSENT_ID, registerMinimal, registerWithProfile, type TestUser } from "./helpers/users.js";

const app = createApp();

function transfer(user: TestUser, body: object, key = randomUUID()) {
    return request(app)
        .post("/api/transfers")
        .set("Authorization", user.auth)
        .set("Idempotency-Key", key)
        .send(body);
}

async function balance(user: TestUser): Promise<number> {
    const res = await request(app).get("/api/account").set("Authorization", user.auth);
    return res.body.account.balanceCents;
}

describe("POST /api/transfers : choix du destinataire", () => {
    useTestDb();

    let alice: TestUser;
    let bob: TestUser;

    beforeEach(async () => {
        alice = await registerWithProfile(app, "alice");
        bob = await registerWithProfile(app, "bob");
    });

    test("par recipientId (annuaire) : 201, soldes et historiques mis à jour", async () => {
        const res = await transfer(alice, { recipientId: bob.id, amountCents: 2500 });

        expect(res.status).toBe(201);
        expect(res.body.replayed).toBe(false);
        expect(res.body.transfer).toMatchObject({ id: expect.any(String), recipientId: bob.id, amountCents: 2500 });
        expect(JSON.stringify(res.body)).not.toMatch(/idempotencyKey|requestFingerprint|iban/i);

        expect(await balance(alice)).toBe(47500);
        expect(await balance(bob)).toBe(52500);

        const bobHistory = await request(app).get("/api/movements").set("Authorization", bob.auth);
        expect(bobHistory.body.items[0]).toMatchObject({ type: "transfer_credit", amountCents: 2500 });
    });

    test("par recipientIban : toujours accepté", async () => {
        const account = await request(app).get("/api/account").set("Authorization", bob.auth);
        const res = await transfer(alice, { recipientIban: account.body.account.iban, amountCents: 1000 });
        expect(res.status).toBe(201);
        expect(await balance(bob)).toBe(51000);
    });

    test("idempotence par recipientId : rejoué une seule fois ; autre destinataire avec la même clé = 409", async () => {
        const carol = await registerWithProfile(app, "carol");
        const key = randomUUID();

        await transfer(alice, { recipientId: bob.id, amountCents: 1000 }, key);
        const replay = await transfer(alice, { recipientId: bob.id, amountCents: 1000 }, key);
        expect(replay.status).toBe(200);
        expect(replay.body.replayed).toBe(true);
        expect(await balance(alice)).toBe(49000);

        const other = await transfer(alice, { recipientId: carol.id, amountCents: 1000 }, key);
        expect(other.status).toBe(409);
    });

    test.each([
        ["aucun destinataire", { amountCents: 1000 }],
        ["les deux à la fois", { recipientId: ABSENT_ID, recipientIban: "FR7630006000011234567890189", amountCents: 1000 }],
        ["recipientId malformé", { recipientId: "abc", amountCents: 1000 }],
    ])("%s : 400", async (_cas, body) => {
        const res = await transfer(alice, body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_INPUT");
    });

    test("vers soi-même par recipientId : 400, solde inchangé", async () => {
        const res = await transfer(alice, { recipientId: alice.id, amountCents: 1000 });
        expect(res.status).toBe(400);
        expect(await balance(alice)).toBe(50000);
    });

    test("destinataire absent ou invisible dans l'annuaire : 404, solde inchangé", async () => {
        const hidden = await registerMinimal(app); // sans profil : pas dans l'annuaire

        for (const recipientId of [ABSENT_ID, hidden.id]) {
            const res = await transfer(alice, { recipientId, amountCents: 1000 });
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe("NOT_FOUND");
        }
        expect(await balance(alice)).toBe(50000);
    });

    test("solde insuffisant : 409 INSUFFICIENT_FUNDS", async () => {
        const res = await transfer(alice, { recipientId: bob.id, amountCents: 50001 });
        expect(res.status).toBe(409);
        expect(res.body.error.code).toBe("INSUFFICIENT_FUNDS");
    });

    test("émetteur sans profil : 403", async () => {
        const incomplete = await registerMinimal(app);
        const res = await transfer(incomplete, { recipientId: bob.id, amountCents: 1000 });
        expect(res.status).toBe(403);
    });
});

// Concurrence : plusieurs requêtes qui touchent le même solde au même moment.
// Toutes les requêtes d'un test partent ensemble (Promise.all) : c'est la situation
// d'une race condition (double clic, script qui rejoue une requête, coupure réseau).
// Les tests vérifient que l'argent n'est jamais créé, perdu ou dépensé deux fois.
import { jest } from "@jest/globals";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { Movement } from "../src/models/Movement.js";
import { Operation } from "../src/models/Operation.js";
import { Transfer } from "../src/models/Transfer.js";
import { useTestDb } from "./helpers/db.js";
import { registerWithProfile, type TestUser } from "./helpers/users.js";

const app = createApp();

// Solde offert à l'inscription : 500 €.
const START = 50000;

// Les transactions en conflit sont rejouées par MongoDB : on laisse du temps.
jest.setTimeout(60_000);

function operation(user: TestUser, kind: "deposits" | "withdrawals", amountCents: number, key = randomUUID()) {
    return request(app)
        .post(`/api/account/${kind}`)
        .set("Authorization", user.auth)
        .set("Idempotency-Key", key)
        .send({ amountCents });
}

function transfer(from: TestUser, to: TestUser, amountCents: number, key = randomUUID()) {
    return request(app)
        .post("/api/transfers")
        .set("Authorization", from.auth)
        .set("Idempotency-Key", key)
        .send({ recipientId: to.id, amountCents });
}

async function balance(user: TestUser): Promise<number> {
    const res = await request(app).get("/api/account").set("Authorization", user.auth);
    return res.body.account.balanceCents;
}

// Lance `n` requêtes en même temps et renvoie toutes les réponses.
function simultaneously<T>(n: number, send: (i: number) => PromiseLike<T>): Promise<T[]> {
    return Promise.all(Array.from({ length: n }, (_, i) => send(i)));
}

function countStatus(responses: { status: number }[], status: number) {
    return responses.filter((r) => r.status === status).length;
}

describe("Concurrence sur les soldes", () => {
    useTestDb();

    let alice: TestUser;
    let bob: TestUser;

    beforeEach(async () => {
        alice = await registerWithProfile(app, "alice");
        bob = await registerWithProfile(app, "bob");
    });

    describe("double dépense", () => {
        test("10 retraits simultanés de 80 € sur 500 € : 6 acceptés, 4 refusés, solde jamais négatif", async () => {
            const responses = await simultaneously(10, () => operation(alice, "withdrawals", 8000));

            expect(countStatus(responses, 201)).toBe(6);
            expect(countStatus(responses, 409)).toBe(4);
            for (const r of responses.filter((r) => r.status === 409)) {
                expect(r.body.error.code).toBe("INSUFFICIENT_FUNDS");
            }

            // 500 − 6 × 80 = 20 €, et exactement 6 mouvements de retrait.
            expect(await balance(alice)).toBe(START - 6 * 8000);
            expect(await Movement.countDocuments({ ownerId: alice.id, type: "withdrawal" })).toBe(6);

            // Chaque retrait accepté a vu un solde différent : aucun n'a lu un solde périmé.
            const soldesApres = responses.filter((r) => r.status === 201).map((r) => r.body.balanceCents);
            expect(new Set(soldesApres).size).toBe(6);
            expect(Math.min(...soldesApres)).toBe(2000);
        });

        test("5 virements simultanés de 200 € vers Bob : 2 acceptés, l'argent total ne change pas", async () => {
            const responses = await simultaneously(5, () => transfer(alice, bob, 20000));

            expect(countStatus(responses, 201)).toBe(2);
            expect(countStatus(responses, 409)).toBe(3);

            const [a, b] = [await balance(alice), await balance(bob)];
            expect(a).toBe(START - 2 * 20000);
            expect(b).toBe(START + 2 * 20000);
            expect(a + b).toBe(2 * START);
            expect(await Transfer.countDocuments({ senderId: alice.id })).toBe(2);
        });
    });

    describe("mise à jour perdue (lost update)", () => {
        test("20 dépôts simultanés de 1 € : les 20 sont comptés", async () => {
            const responses = await simultaneously(20, () => operation(alice, "deposits", 100));

            expect(countStatus(responses, 201)).toBe(20);
            expect(await balance(alice)).toBe(START + 20 * 100);
        });

        test("virements croisés simultanés Alice ⇄ Bob : chacun retrouve 500 €", async () => {
            // 10 × 50 € dans chaque sens, envoyés en même temps.
            const responses = await simultaneously(20, (i) =>
                i % 2 === 0 ? transfer(alice, bob, 5000) : transfer(bob, alice, 5000),
            );

            expect(countStatus(responses, 201)).toBe(20);
            expect(await balance(alice)).toBe(START);
            expect(await balance(bob)).toBe(START);
        });
    });

    describe("rejeu de la même requête (idempotence)", () => {
        test("même retrait envoyé 5 fois en même temps : débité une seule fois", async () => {
            const key = randomUUID();
            const responses = await simultaneously(5, () => operation(alice, "withdrawals", 3000, key));

            expect(countStatus(responses, 201)).toBe(5);
            // Toutes les réponses décrivent la même opération.
            expect(new Set(responses.map((r) => r.body.operation.id)).size).toBe(1);

            expect(await balance(alice)).toBe(START - 3000);
            expect(await Operation.countDocuments({ actorId: alice.id, idempotencyKey: key })).toBe(1);
            expect(await Movement.countDocuments({ ownerId: alice.id, type: "withdrawal" })).toBe(1);
        });

        test("même virement envoyé 5 fois en même temps : un seul virement, rejoué 4 fois", async () => {
            const key = randomUUID();
            const responses = await simultaneously(5, () => transfer(alice, bob, 10000, key));

            // Le premier crée le virement (201), les autres le rejouent (200).
            expect(countStatus(responses, 201)).toBe(1);
            expect(countStatus(responses, 200)).toBe(4);
            expect(responses.filter((r) => r.status === 200).every((r) => r.body.replayed === true)).toBe(true);
            expect(new Set(responses.map((r) => r.body.transfer.id)).size).toBe(1);

            expect(await balance(alice)).toBe(START - 10000);
            expect(await balance(bob)).toBe(START + 10000);
            expect(await Transfer.countDocuments({ senderId: alice.id })).toBe(1);
            expect(await Movement.countDocuments({ transferId: responses[0].body.transfer.id })).toBe(2);
        });

        test("même clé, montants différents en même temps : un seul accepté, les autres en 409", async () => {
            const key = randomUUID();
            const responses = await simultaneously(4, (i) => operation(alice, "withdrawals", 1000 * (i + 1), key));

            expect(countStatus(responses, 201)).toBe(1);
            expect(countStatus(responses, 409)).toBe(3);
            for (const r of responses.filter((r) => r.status === 409)) {
                expect(r.body.error.code).toBe("CONFLICT");
            }

            const accepted = responses.find((r) => r.status === 201)!;
            expect(await balance(alice)).toBe(START - accepted.body.operation.amountCents);
        });
    });
});

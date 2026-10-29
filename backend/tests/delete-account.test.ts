// Suppression de compte : DELETE /api/me.
import request from "supertest";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { Account } from "../src/models/Account.js";
import { Movement } from "../src/models/Movement.js";
import { Transaction } from "../src/models/Transaction.js";
import { Transfer } from "../src/models/Transfer.js";
import { User } from "../src/models/User.js";
import { useTestDb } from "./helpers/db.js";
import { PASSWORD, registerWithProfile, type TestUser } from "./helpers/users.js";

const app = createApp();

function deleteMe(user: TestUser, body: object = { password: PASSWORD }) {
    return request(app).delete("/api/me").set("Authorization", user.auth).send(body);
}

function transfer(from: TestUser, body: object) {
    return request(app)
        .post("/api/transfers")
        .set("Authorization", from.auth)
        .set("Idempotency-Key", randomUUID())
        .send(body);
}

describe("DELETE /api/me", () => {
    useTestDb();

    let alice: TestUser;
    let bob: TestUser;

    beforeEach(async () => {
        alice = await registerWithProfile(app, "alice");
        bob = await registerWithProfile(app, "bob");
    });

    test("sans jeton : 401", async () => {
        const res = await request(app).delete("/api/me").send({ password: PASSWORD });
        expect(res.status).toBe(401);
    });

    test.each([
        ["corps vide", {}],
        ["mot de passe vide", { password: "" }],
        ["champ inconnu", { password: PASSWORD, force: true }],
    ])("%s : 400, rien n'est supprimé", async (_cas, body) => {
        const res = await deleteMe(alice, body);
        expect(res.status).toBe(400);
        expect((await request(app).get("/api/me").set("Authorization", alice.auth)).status).toBe(200);
    });

    test("mauvais mot de passe : 403 (la session reste ouverte), rien n'est supprimé", async () => {
        const res = await deleteMe(alice, { password: "PasLeBonMotDePasse" });
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("FORBIDDEN");
        expect((await request(app).get("/api/me").set("Authorization", alice.auth)).status).toBe(200);
    });

    test("succès : 204, sessions invalidées, connexion impossible", async () => {
        const res = await deleteMe(alice);
        expect(res.status).toBe(204);
        expect(res.text).toBe("");

        expect((await request(app).get("/api/me").set("Authorization", alice.auth)).status).toBe(401);
        const login = await request(app).post("/api/auth/login").send({ email: alice.email, password: PASSWORD });
        expect(login.status).toBe(401);

        // Seconde suppression avec l'ancien jeton : refusée
        expect((await deleteMe(alice)).status).toBe(401);
    });

    test("coordonnées effacées, email libéré, compte bancaire clôturé avec son solde", async () => {
        await deleteMe(alice);

        const user = await User.findById(alice.id).lean();
        expect(user).toMatchObject({
            status: "closed",
            firstName: null,
            lastName: null,
            username: null,
            phone: null,
            address: null,
            birthDate: null,
        });
        expect(user?.email).not.toBe(alice.email);
        expect(user?.closedAt).toBeInstanceOf(Date);

        // Le solde abandonné reste tracé sur le compte clôturé
        const account = await Account.findOne({ ownerId: alice.id }).lean();
        expect(account).toMatchObject({ status: "closed", balanceCents: 50000 });

        // L'email et le pseudo d'origine peuvent resservir
        const again = await registerWithProfile(app, "alice", alice.email);
        expect(again.id).not.toBe(alice.id);
    });

    test("retiré de l'annuaire, plus de virement possible vers lui", async () => {
        const iban = (await Account.findOne({ ownerId: alice.id }).lean())!.iban;
        await deleteMe(alice);

        const directory = await request(app).get("/api/users").set("Authorization", bob.auth);
        expect(directory.body.items).toEqual([]);
        expect((await request(app).get(`/api/users/${alice.id}`).set("Authorization", bob.auth)).status).toBe(404);

        expect((await transfer(bob, { recipientId: alice.id, amountCents: 1000 })).status).toBe(404);
        expect((await transfer(bob, { recipientIban: iban, amountCents: 1000 })).status).toBe(409);
    });

    test("carnet supprimé ; historique de l'autre partie conservé, sans correspondant", async () => {
        await request(app)
            .post("/api/transactions")
            .set("Authorization", alice.auth)
            .send({ label: "Courses", amount: 1234, type: "expense", date: "2026-10-05" });
        const sent = await transfer(alice, { recipientId: bob.id, amountCents: 2500 });
        expect(sent.status).toBe(201);

        await deleteMe(alice);

        // Le carnet d'Alice n'existe plus ; son virement reste dans les traces
        expect(await Transaction.countDocuments({ ownerId: alice.id })).toBe(0);
        expect(await Transfer.countDocuments({ senderId: alice.id })).toBe(1);
        expect(await Movement.countDocuments({ ownerId: alice.id })).toBe(1);

        // Bob voit toujours le virement reçu, mais plus le nom d'Alice
        const bobHistory = await request(app).get("/api/movements").set("Authorization", bob.auth);
        expect(bobHistory.body.items[0]).toMatchObject({ type: "transfer_credit", amountCents: 2500, counterparty: null });
    });
});

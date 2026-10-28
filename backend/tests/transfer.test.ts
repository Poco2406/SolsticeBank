
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { User } from "../src/models/User.js";
import { Account } from "../src/models/Account.js";
import { Movement } from "../src/models/Movement.js";
import { Transfer } from "../src/models/Transfer.js";
import { executeTransfer } from "../src/services/transfer.service.js";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("POST /api/transfers", () => {
  test("refuse un virement sans authentification", async () => {
    const app = createApp();

    const response = await request(app)
      .post("/api/transfers")
      .set("Idempotency-Key", "test-virement-001")
      .send({
        recipientIban: "FR7630006000011234567890189",
        amountCents: 5000,
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  });
describe("Idempotence des virements", () => {
  test("un même virement de 50 € ne doit être exécuté qu'une fois", async () => {
    const testUri = process.env.MONGODB_TEST_URI;

    if (!testUri) {
      throw new Error("MONGODB_TEST_URI manquante.");
    }

    const databaseName = new URL(testUri).pathname.slice(1);

    if (databaseName !== "solstice_test") {
      throw new Error("Base de test non autorisée.");
    }

    const testId = randomUUID();
    const key = `transfer-test-${testId}`;
    const createdIds: mongoose.Types.ObjectId[] = [];

    await mongoose.connect(testUri);

    try {
      // Préparer les index nécessaires.
      await Transfer.init();
      await Movement.init();

      const sender = await User.create({
        email: `sender-${testId}@example.test`,
        passwordHash: "test-only",
        status: "active",
      });

      createdIds.push(sender._id);

      const recipient = await User.create({
        email: `recipient-${testId}@example.test`,
        passwordHash: "test-only",
        status: "active",
      });

      createdIds.push(recipient._id);

      const senderAccount = await Account.create({
        ownerId: sender._id,
        balanceCents: 50000,
        status: "active",
      });

      const recipientAccount = await Account.create({
        ownerId: recipient._id,
        balanceCents: 50000,
        status: "active",
      });

      const requestData = {
        recipientIban: recipientAccount.iban,
        amountCents: 5000,
      };

      // Premier virement.
      const first = await executeTransfer(
        String(sender._id),
        requestData,
        key,
      );

      // Même demande avec la même clé.
      const second = await executeTransfer(
        String(sender._id),
        requestData,
        key,
      );

      const updatedSender = await Account.findById(senderAccount._id);
      const updatedRecipient = await Account.findById(recipientAccount._id);

      const transfers = await Transfer.find({
        senderId: sender._id,
        idempotencyKey: key,
      });

      const movements = await Movement.find({
        transferId: first.transfer._id,
      });

      expect(first.replayed).toBe(false);
      expect(second.replayed).toBe(true);

      expect(updatedSender?.balanceCents).toBe(45000);
      expect(updatedRecipient?.balanceCents).toBe(55000);

      expect(transfers).toHaveLength(1);
      expect(movements).toHaveLength(2);

      expect(movements.map((m) => m.type).sort()).toEqual([
        "transfer_credit",
        "transfer_debit",
      ]);
    } finally {
      // Nettoyer uniquement les données créées par ce test.
      if (createdIds.length > 0) {
        const testTransfers = await Transfer.find({
          senderId: { $in: createdIds },
        });

        await Movement.deleteMany({
          transferId: { $in: testTransfers.map((t) => t._id) },
        });

        await Transfer.deleteMany({
          _id: { $in: testTransfers.map((t) => t._id) },
        });

        await Account.deleteMany({
          ownerId: { $in: createdIds },
        });

        await User.deleteMany({
          _id: { $in: createdIds },
        });
      }

      await mongoose.disconnect();
    }
  });
});


describe("Refus des virements", () => {
  test("refuse les virements invalides sans modifier les soldes", async () => {
    const uri = process.env.MONGODB_TEST_URI;
    if (!uri || new URL(uri).pathname !== "/solstice_test") {
      throw new Error("Base de test non autorisée.");
    }

    await mongoose.connect(uri);

    const sender = new mongoose.Types.ObjectId();
    const recipient = new mongoose.Types.ObjectId();
    const key = randomUUID();

    try {
      const senderAccount = await Account.create({
        ownerId: sender,
        balanceCents: 10000,
        status: "active",
      });

      const recipientAccount = await Account.create({
        ownerId: recipient,
        balanceCents: 50000,
        status: "active",
      });

      await User.create([
        {
          _id: sender,
          email: `sender-${key}@example.test`,
          passwordHash: "test-only",
          status: "active",
        },
        {
          _id: recipient,
          email: `recipient-${key}@example.test`,
          passwordHash: "test-only",
          status: "active",
        },
      ]);

      // Auto-virement
      await expect(
        executeTransfer(String(sender), {
          recipientIban: senderAccount.iban,
          amountCents: 1000,
        }, randomUUID()),
      ).rejects.toMatchObject({ status: 400 });

      // Solde insuffisant
      await expect(
        executeTransfer(String(sender), {
          recipientIban: recipientAccount.iban,
          amountCents: 20000,
        }, randomUUID()),
      ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });

      // Destinataire inactif
      await Account.updateOne(
        { _id: recipientAccount._id },
        { $set: { status: "closed" } },
      );

      await expect(
        executeTransfer(String(sender), {
          recipientIban: recipientAccount.iban,
          amountCents: 1000,
        }, randomUUID()),
      ).rejects.toMatchObject({ status: 409 });

      // Montant dépassant la limite numérique
      await expect(
        executeTransfer(String(sender), {
          recipientIban: recipientAccount.iban,
          amountCents: Number.MAX_SAFE_INTEGER + 1,
        }, randomUUID()),
      ).rejects.toMatchObject({ status: 400 });

      expect(
        (await Account.findById(senderAccount._id))?.balanceCents,
      ).toBe(10000);

      expect(
        (await Account.findById(recipientAccount._id))?.balanceCents,
      ).toBe(50000);
    } finally {
      await Account.deleteMany({ ownerId: { $in: [sender, recipient] } });
      await User.deleteMany({ _id: { $in: [sender, recipient] } });
      await mongoose.disconnect();
    }
  });
});



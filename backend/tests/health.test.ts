
import request from "supertest";
import { createApp } from "../src/app.js";

describe("GET /api/health", () => {
  test("doit retourner HTTP 200 et le statut ok", async () => {
    const app = createApp();

    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
    });
  });
});

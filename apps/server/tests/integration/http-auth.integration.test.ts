import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createHttpApp } from "../../src/http/app.js";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";

describe("HTTP auth integration", () => {
  it("returns unauthorized without bearer token", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => {
        throw new Error("unauthorized");
      })
    };

    const app = createHttpApp({
      readinessCheck: async () => ({
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      }),
      authMiddleware: buildAuthMiddleware(authService as never)
    });

    const response = await request(app).get("/api/protected/profile");
    expect(response.status).toBe(401);
  });

  it("returns profile for valid token", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        tenantId: "tenant-a",
        expiresAt: 1_900_000_000
      }))
    };

    const app = createHttpApp({
      readinessCheck: async () => ({
        ok: true,
        checks: {
          database: "ok",
          config: "ok"
        }
      }),
      authMiddleware: buildAuthMiddleware(authService as never)
    });

    const response = await request(app)
      .get("/api/protected/profile")
      .set("Authorization", "Bearer valid-token");
    expect(response.status).toBe(200);
    expect(response.body.subject).toBe("player-1");
  });
});
import { describe, expect, it, vi } from "vitest";
import { buildAuthMiddleware } from "../../src/http/auth-middleware.js";
import { OperatorClaimContract } from "@game/shared-types";

type StubRequest = {
  headers: {
    authorization?: string;
  };
};

type StubResponse = {
  locals: {
    principal?: unknown;
  };
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
};

describe("auth middleware role mapping", () => {
  function createResponse(): StubResponse {
    const response = {
      locals: {},
      status: vi.fn(),
      json: vi.fn()
    };

    response.status.mockReturnValue(response);
    return response;
  }

  it("sets authorization.isOperator true when roles claim contains operator", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-1",
        tenantScopedSubject: "tenant-a|player-1",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        expiresAt: 1_900_000_000,
        roles: ["Operator"]
      }))
    };

    const middleware = buildAuthMiddleware(authService as never);
    const req = {
      headers: {
        authorization: "Bearer valid-token"
      }
    } satisfies StubRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.principal).toMatchObject({
      authorization: {
        isOperator: true
      }
    });
  });

  it("sets authorization.isOperator false for non-operator claims", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-2",
        tenantScopedSubject: "tenant-a|player-2",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        expiresAt: 1_900_000_000,
        roles: ["Player"],
        scp: "read write"
      }))
    };

    const middleware = buildAuthMiddleware(authService as never);
    const req = {
      headers: {
        authorization: "Bearer valid-token"
      }
    } satisfies StubRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.principal).toMatchObject({
      authorization: {
        isOperator: false
      }
    });
  });

  it("uses bounded transitional fallback when contract source is roles_with_scope_fallback", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-3",
        tenantScopedSubject: "tenant-a|player-3",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        expiresAt: 1_900_000_000,
        roles: ["Player"],
        scp: "read ops"
      }))
    };

    const contract: OperatorClaimContract = {
      source: "roles_with_scope_fallback",
      roleValues: ["operator", "ops", "admin"],
      scopeValues: ["ops", "admin"]
    };

    const middleware = buildAuthMiddleware(authService as never, contract);
    const req = {
      headers: {
        authorization: "Bearer valid-token"
      }
    } satisfies StubRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.principal).toMatchObject({
      authorization: {
        isOperator: true
      }
    });
  });

  it("does not use scope fallback when contract source is roles", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-4",
        tenantScopedSubject: "tenant-a|player-4",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        expiresAt: 1_900_000_000,
        roles: ["Player"],
        scp: "ops"
      }))
    };

    const contract: OperatorClaimContract = {
      source: "roles",
      roleValues: ["operator", "ops", "admin"],
      scopeValues: ["ops", "admin"]
    };

    const middleware = buildAuthMiddleware(authService as never, contract);
    const req = {
      headers: {
        authorization: "Bearer valid-token"
      }
    } satisfies StubRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.principal).toMatchObject({
      authorization: {
        isOperator: false
      }
    });
  });

  it("supports scope-only operator contract when source is scopes", async () => {
    const authService = {
      verifyAccessToken: vi.fn(async () => ({
        subject: "player-5",
        tenantScopedSubject: "tenant-a|player-5",
        issuer: "https://issuer.example",
        audience: "api://tile-fighter-server",
        expiresAt: 1_900_000_000,
        scp: "read admin"
      }))
    };

    const contract: OperatorClaimContract = {
      source: "scopes",
      roleValues: ["operator", "ops", "admin"],
      scopeValues: ["ops", "admin"]
    };

    const middleware = buildAuthMiddleware(authService as never, contract);
    const req = {
      headers: {
        authorization: "Bearer valid-token"
      }
    } satisfies StubRequest;
    const res = createResponse();
    const next = vi.fn();

    await middleware(req as never, res as never, next as never);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals.principal).toMatchObject({
      authorization: {
        isOperator: true
      }
    });
  });
});

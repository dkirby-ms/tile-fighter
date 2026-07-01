import { NextFunction, Request, Response } from "express";
import { AuthService } from "../auth/auth-service.js";
import {
  DEFAULT_OPERATOR_CLAIM_CONTRACT,
  OperatorClaimContract,
  OperatorClaimSource
} from "@game/shared-types";

type OperatorAwarePrincipal = {
  roles?: unknown;
  groups?: unknown;
  wids?: unknown;
  scp?: unknown;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function hasOperatorRole(principal: OperatorAwarePrincipal, contract: OperatorClaimContract): boolean {
  const roleLikeClaims = [
    ...asStringArray(principal.roles),
    ...asStringArray(principal.groups),
    ...asStringArray(principal.wids)
  ];

  const roleValues = new Set(contract.roleValues.map((value) => value.toLowerCase()));
  const hasRoleMatch = roleLikeClaims.some((claim) =>
    roleValues.has(claim.toLowerCase())
  );
  return hasRoleMatch;
}

function hasOperatorScope(principal: OperatorAwarePrincipal, contract: OperatorClaimContract): boolean {
  if (typeof principal.scp !== "string") {
    return false;
  }

  const scopeValues = new Set(contract.scopeValues.map((value) => value.toLowerCase()));
  return principal.scp
    .split(" ")
    .some((scope) => scopeValues.has(scope.toLowerCase()));
}

function resolveOperatorAuthorization(
  principal: OperatorAwarePrincipal,
  contract: OperatorClaimContract
): boolean {
  const source: OperatorClaimSource = contract.source;

  if (source === "roles") {
    const isOperator = hasOperatorRole(principal, contract);
    if (isOperator) {
      // Audit logging: operator authorization via roles
      // Can be used to track operator action patterns across identity systems
      console.debug("[AuthMiddleware] Operator auth resolved via roles");
    } else {
      console.debug("[AuthMiddleware] Operator auth NOT resolved via roles");
    }
    return isOperator;
  }

  if (source === "scopes") {
    const isOperator = hasOperatorScope(principal, contract);
    if (isOperator) {
      // Audit logging: operator authorization via scopes
      console.debug("[AuthMiddleware] Operator auth resolved via scopes");
    } else {
      console.debug("[AuthMiddleware] Operator auth NOT resolved via scopes");
    }
    return isOperator;
  }

  // Defense-in-depth: fallback to roles first, then scopes
  // This allows flexibility across identity system configurations
  const viaRoles = hasOperatorRole(principal, contract);
  if (viaRoles) {
    console.debug("[AuthMiddleware] Operator auth resolved via roles (fallback)");
    return true;
  }

  const viaScopes = hasOperatorScope(principal, contract);
  if (viaScopes) {
    console.debug("[AuthMiddleware] Operator auth resolved via scopes (fallback)");
    return true;
  }

  console.debug("[AuthMiddleware] Operator auth NOT resolved (no matching roles, no matching scopes)");
  return false;
}

function withAuthorizationFlag<T extends object>(
  principal: T,
  operatorClaimContract: OperatorClaimContract
): T & { authorization: { isOperator: boolean } } {
  const operatorAware = principal as T & OperatorAwarePrincipal;
  const isOperator = resolveOperatorAuthorization(operatorAware, operatorClaimContract);

  return {
    ...principal,
    authorization: { isOperator }
  };
}

export function buildAuthMiddleware(
  authService: AuthService,
  operatorClaimContract: OperatorClaimContract = DEFAULT_OPERATOR_CLAIM_CONTRACT,
  options: { devAuthMode?: "enforce" | "allow" } = {}
) {
  const devAuthMode = options.devAuthMode ?? "enforce";

  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

    try {
      const principal = await authService.verifyAccessToken(token);
      res.locals.principal = withAuthorizationFlag(principal, operatorClaimContract);
      next();
    } catch {
      if (devAuthMode === "allow") {
        const devSubject = "dev-user";
        const devTenantId = "dev-tenant";
        res.locals.principal = withAuthorizationFlag(
          {
            subject: devSubject,
            tenantScopedSubject: `${devTenantId}|${devSubject}`,
            issuer: "dev-auth-bypass",
            audience: "api://tile-fighter-server",
            tenantId: devTenantId,
            tokenVersion: "2.0",
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            roles: ["Operator"]
          },
          operatorClaimContract
        );
        next();
        return;
      }

      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
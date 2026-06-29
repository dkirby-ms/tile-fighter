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
    return hasOperatorRole(principal, contract);
  }

  if (source === "scopes") {
    return hasOperatorScope(principal, contract);
  }

  if (hasOperatorRole(principal, contract)) {
    return true;
  }

  return hasOperatorScope(principal, contract);
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
  operatorClaimContract: OperatorClaimContract = DEFAULT_OPERATOR_CLAIM_CONTRACT
) {
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
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
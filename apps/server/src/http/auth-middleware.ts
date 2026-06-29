import { NextFunction, Request, Response } from "express";
import { AuthService } from "../auth/auth-service.js";

type OperatorAwarePrincipal = {
  roles?: unknown;
  groups?: unknown;
  wids?: unknown;
  scp?: unknown;
};

const OPERATOR_ROLE_VALUES = new Set(["operator", "ops", "admin"]);
const OPERATOR_SCOPE_VALUES = new Set(["ops", "admin"]);

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function hasOperatorRole(principal: OperatorAwarePrincipal): boolean {
  const roleLikeClaims = [
    ...asStringArray(principal.roles),
    ...asStringArray(principal.groups),
    ...asStringArray(principal.wids)
  ];

  const hasRoleMatch = roleLikeClaims.some((claim) =>
    OPERATOR_ROLE_VALUES.has(claim.toLowerCase())
  );
  if (hasRoleMatch) {
    return true;
  }

  if (typeof principal.scp !== "string") {
    return false;
  }

  return principal.scp
    .split(" ")
    .some((scope) => OPERATOR_SCOPE_VALUES.has(scope.toLowerCase()));
}

function withAuthorizationFlag<T extends object>(principal: T): T & { authorization: { isOperator: boolean } } {
  const operatorAware = principal as T & OperatorAwarePrincipal;
  const isOperator = hasOperatorRole(operatorAware);

  return {
    ...principal,
    authorization: { isOperator }
  };
}

export function buildAuthMiddleware(authService: AuthService) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const authorization = req.headers.authorization;
    const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

    try {
      const principal = await authService.verifyAccessToken(token);
      res.locals.principal = withAuthorizationFlag(principal);
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
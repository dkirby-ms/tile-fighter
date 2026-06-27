import { NextFunction, Request, Response } from "express";
import { AuthService } from "../auth/auth-service.js";

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
      res.locals.principal = principal;
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };
}
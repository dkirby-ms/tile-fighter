import { Router } from "express";

export function createProtectedRoutes(): Router {
  const router = Router();

  router.get("/api/protected/profile", (_req, res) => {
    const principal = res.locals.principal;
    res.status(200).json({
      subject: principal.subject,
      tenantScopedSubject: principal.tenantScopedSubject,
      issuer: principal.issuer,
      tenantId: principal.tenantId,
      tokenVersion: principal.tokenVersion
    });
  });

  return router;
}
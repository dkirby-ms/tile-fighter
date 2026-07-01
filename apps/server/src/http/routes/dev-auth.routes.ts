import { Router } from "express";
import { AuthService } from "../../auth/auth-service.js";

export type DevAuthRoutesDependencies = {
  authService: AuthService;
  enabled: boolean;
};

export function createDevAuthRoutes(dependencies: DevAuthRoutesDependencies): Router {
  const router = Router();

  router.post("/api/dev/access-token", (req, res) => {
    if (!dependencies.enabled) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const subjectCandidate = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
    if (!subjectCandidate) {
      res.status(400).json({ error: "subject is required" });
      return;
    }

    const accessToken = dependencies.authService.issueDevAccessToken(subjectCandidate);
    res.status(200).json({
      accessToken,
      subject: subjectCandidate,
      expiresInSeconds: 900
    });
  });

  return router;
}
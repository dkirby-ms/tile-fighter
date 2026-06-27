import { Router } from "express";
import { ReadinessReport } from "@game/shared-types";

export function createHealthRoutes(readinessCheck: () => Promise<ReadinessReport>): Router {
  const router = Router();

  router.get("/healthz", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.get("/readyz", async (_req, res) => {
    const report = await readinessCheck();
    res.status(report.ok ? 200 : 503).json(report);
  });

  return router;
}
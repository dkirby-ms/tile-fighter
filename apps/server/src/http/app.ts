import express, { RequestHandler } from "express";
import { ReadinessReport } from "@game/shared-types";
import { createHealthRoutes } from "./routes/health.routes.js";
import { createProtectedRoutes } from "./routes/protected.routes.js";

export type HttpAppDependencies = {
  readinessCheck: () => Promise<ReadinessReport>;
  authMiddleware: RequestHandler;
};

export function createHttpApp(dependencies: HttpAppDependencies) {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json());
  app.use(createHealthRoutes(dependencies.readinessCheck));
  app.use(dependencies.authMiddleware);
  app.use(createProtectedRoutes());

  return app;
}
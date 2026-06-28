import express, { RequestHandler } from "express";
import { ReadinessReport } from "@game/shared-types";
import { createHealthRoutes } from "./routes/health.routes.js";
import { createProtectedRoutes } from "./routes/protected.routes.js";
import { createSessionRoutes } from "./routes/session.routes.js";
import { TelemetrySink } from "../telemetry/telemetry-sink.js";
import { AuthService } from "../auth/auth-service.js";
import { SessionLifecycleService } from "../session/session-lifecycle.service.js";

export type HttpAppDependencies = {
  readinessCheck: () => Promise<ReadinessReport>;
  authMiddleware: RequestHandler;
  telemetrySink: TelemetrySink;
  authService: AuthService;
  lifecycleService: SessionLifecycleService;
};

export function createHttpApp(dependencies: HttpAppDependencies) {
  const app = express();
  app.disable("x-powered-by");

  app.use(express.json());
  app.use(createHealthRoutes(dependencies.readinessCheck));
  app.use(dependencies.authMiddleware);
  app.use(createProtectedRoutes());
  app.use(
    createSessionRoutes({
      telemetrySink: dependencies.telemetrySink,
      authService: dependencies.authService,
      lifecycleService: dependencies.lifecycleService
    })
  );

  return app;
}
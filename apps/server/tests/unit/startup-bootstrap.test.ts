import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeConfig } from "../../src/config/env.js";

const mocks = vi.hoisted(() => {
  const readRuntimeConfig = vi.fn();
  const createDatabaseRuntime = vi.fn();
  const verifyDatabaseConnectivity = vi.fn();
  const closeDatabaseRuntime = vi.fn();
  const createTileRepository = vi.fn();
  const createRegionSnapshotRepository = vi.fn();
  const createRegionDiffRepository = vi.fn();
  const createSessionCheckpointRepository = vi.fn();
  const createRegionSnapshotService = vi.fn();
  const createRegionDiffService = vi.fn();
  const createHttpApp = vi.fn();
  const buildAuthMiddleware = vi.fn();
  const registerGracefulShutdown = vi.fn();
  const createServer = vi.fn();
  const define = vi.fn();
  const gracefullyShutdown = vi.fn();
  const listen = vi.fn();
  const close = vi.fn();

  class AuthService {
    constructor() {}
  }

  class TelemetrySink {
    constructor() {}
  }

  class SessionLifecycleService {
    public start = vi.fn();
    public stop = vi.fn();

    constructor() {}
  }

  class SessionCheckpointService {
    constructor() {}
  }

  class ReconnectTokenService {
    constructor() {}
  }

  class ArenaRoom {}

  return {
    readRuntimeConfig,
    createDatabaseRuntime,
    verifyDatabaseConnectivity,
    closeDatabaseRuntime,
    createTileRepository,
    createRegionSnapshotRepository,
    createRegionDiffRepository,
    createSessionCheckpointRepository,
    createRegionSnapshotService,
    createRegionDiffService,
    createHttpApp,
    buildAuthMiddleware,
    registerGracefulShutdown,
    createServer,
    define,
    gracefullyShutdown,
    listen,
    close,
    AuthService,
    TelemetrySink,
    SessionLifecycleService,
    SessionCheckpointService,
    ReconnectTokenService,
    ArenaRoom
  };
});

vi.mock("../../src/config/env.js", () => ({
  readRuntimeConfig: mocks.readRuntimeConfig
}));

vi.mock("../../src/persistence/db.js", () => ({
  createDatabaseRuntime: mocks.createDatabaseRuntime,
  verifyDatabaseConnectivity: mocks.verifyDatabaseConnectivity,
  closeDatabaseRuntime: mocks.closeDatabaseRuntime
}));

vi.mock("../../src/persistence/tile.repository.js", () => ({
  createTileRepository: mocks.createTileRepository
}));

vi.mock("../../src/persistence/region-snapshot.repository.js", () => ({
  createRegionSnapshotRepository: mocks.createRegionSnapshotRepository
}));

vi.mock("../../src/persistence/region-diff.repository.js", () => ({
  createRegionDiffRepository: mocks.createRegionDiffRepository
}));

vi.mock("../../src/persistence/session-checkpoint.repository.js", () => ({
  createSessionCheckpointRepository: mocks.createSessionCheckpointRepository
}));

vi.mock("../../src/domain/region-snapshot.service.js", () => ({
  createRegionSnapshotService: mocks.createRegionSnapshotService
}));

vi.mock("../../src/domain/region-diff.service.js", () => ({
  createRegionDiffService: mocks.createRegionDiffService
}));

vi.mock("../../src/http/app.js", () => ({
  createHttpApp: mocks.createHttpApp
}));

vi.mock("../../src/http/auth-middleware.js", () => ({
  buildAuthMiddleware: mocks.buildAuthMiddleware
}));

vi.mock("../../src/shutdown/graceful-shutdown.js", () => ({
  registerGracefulShutdown: mocks.registerGracefulShutdown
}));

vi.mock("../../src/auth/auth-service.js", () => ({
  AuthService: mocks.AuthService
}));

vi.mock("../../src/telemetry/telemetry-sink.js", () => ({
  TelemetrySink: mocks.TelemetrySink
}));

vi.mock("../../src/session/session-lifecycle.service.js", () => ({
  SessionLifecycleService: mocks.SessionLifecycleService
}));

vi.mock("../../src/session/session-checkpoint.service.js", () => ({
  SessionCheckpointService: mocks.SessionCheckpointService
}));

vi.mock("../../src/auth/reconnect-token.service.js", () => ({
  ReconnectTokenService: mocks.ReconnectTokenService
}));

vi.mock("../../src/rooms/arena.room.js", () => ({
  ArenaRoom: mocks.ArenaRoom
}));

vi.mock("node:http", () => ({
  default: {
    createServer: mocks.createServer
  }
}));

vi.mock("@colyseus/ws-transport", () => ({
  WebSocketTransport: vi.fn(function MockWebSocketTransport() {})
}));

vi.mock("@colyseus/core", () => ({
  Server: vi.fn(function MockServer() {
    return {
      define: mocks.define,
      gracefullyShutdown: mocks.gracefullyShutdown
    };
  })
}));

describe("server bootstrap wiring", () => {
  beforeEach(() => {
    mocks.readRuntimeConfig.mockReturnValue(createRuntimeConfig({
      placementCommandReplayWindowSeconds: 777
    }));
    mocks.createDatabaseRuntime.mockReturnValue({ db: {} });
    mocks.verifyDatabaseConnectivity.mockResolvedValue(undefined);
    mocks.closeDatabaseRuntime.mockResolvedValue(undefined);
    mocks.createTileRepository.mockReturnValue({});
    mocks.createRegionSnapshotRepository.mockReturnValue({});
    mocks.createRegionDiffRepository.mockReturnValue({});
    mocks.createSessionCheckpointRepository.mockReturnValue({});
    mocks.createRegionSnapshotService.mockReturnValue({});
    mocks.createRegionDiffService.mockReturnValue({});
    mocks.createHttpApp.mockReturnValue(() => undefined);
    mocks.buildAuthMiddleware.mockReturnValue(() => undefined);
    mocks.gracefullyShutdown.mockResolvedValue(undefined);
    mocks.listen.mockImplementation((_port: number, callback?: () => void) => {
      callback?.();
    });
    mocks.close.mockImplementation((callback: (error?: Error) => void) => {
      callback();
    });
    mocks.createServer.mockReturnValue({
      listen: mocks.listen,
      close: mocks.close
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("passes runtime replay window to tile repository options during bootstrap", async () => {
    await import("../../src/index.ts");

    await vi.waitFor(() => {
      expect(mocks.createTileRepository).toHaveBeenCalledWith(
        expect.objectContaining({
          replayWindowSeconds: 777,
          telemetrySink: expect.anything()
        })
      );
    });
  });
});

function createRuntimeConfig(overrides: Partial<RuntimeConfig> = {}): RuntimeConfig {
  return {
    nodeEnv: "test",
    port: 3001,
    databaseUrl: "postgres://localhost:5432/test",
    entraIssuer: "https://issuer.example",
    entraAudience: "api://tile-fighter-server",
    entraJwksUrl: "https://issuer.example/keys",
    entraTokenVersion: "2.0",
    tenantMode: "single",
    entraTenantId: "tenant-a",
    allowedTenantIds: [],
    deniedTenantIds: [],
    allowedIssuers: [],
    telemetrySinkMode: "off",
    joinTokenSigningSecret: "01234567890123456789012345678901",
    joinTokenTtlSeconds: 120,
    sessionHeartbeatTtlSeconds: 30,
    sessionCleanupIntervalSeconds: 10,
    sessionReconnectGracePeriodSeconds: 300,
    tilePlaceThrottleMaxRequests: 5,
    tilePlaceThrottleWindowMs: 60000,
    tilePlaceThrottleTtlMs: 24 * 60 * 60 * 1000,
    placementCommandReplayWindowSeconds: 900,
    regionDiffDefaultMaxTiles: 500,
    regionDiffMaxTilesPerRequest: 1000,
    regionDiffMaxViewportArea: 10000,
    deltaAckTimeoutMs: 350,
    deltaRetransmitMaxAttempts: 1,
    deltaAckPendingTtlMs: 30000,
    deltaOutboundCapPerConnection: 128,
    ...overrides
  };
}

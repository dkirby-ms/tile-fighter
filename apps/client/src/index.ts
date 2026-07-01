export { ExternalIdSessionStateMachine } from "./auth/external-id-session.js";
export type { AuthState, AcquireTokenResult } from "./auth/external-id-session.js";
export { buildMsalConfiguration } from "./auth/msal-config.js";
export type { ExternalIdClientConfig } from "./auth/msal-config.js";
export { getJoinToken } from "./auth/join-token-caller.js";
export type { JoinTokenResponse } from "./auth/join-token-caller.js";
export { SessionBootstrapStore } from "./session/bootstrap-store.js";
export type { BootstrapPayload, ReconnectContext } from "./session/bootstrap-store.js";
export { sendHeartbeat } from "./session/heartbeat-caller.js";
export type { HeartbeatResponse } from "./session/heartbeat-caller.js";
export {
	reconnectSession,
	ReconnectCallerError
} from "./session/reconnect-caller.js";
export type {
	ReconnectResponse,
	ReplayDelta,
	ReconnectFailureClass
} from "./session/reconnect-caller.js";
export {
	applyReplayAndValidateChecksum,
	computeFullRegionCanonicalChecksum,
	ReplayChecksumError
} from "./session/replay-checksum.js";
export type {
	ReplayTileState,
	ReplayChecksumInput,
	ReplayChecksumResult
} from "./session/replay-checksum.js";
export {
	RealtimeDeltaHandler,
	createRealtimeDeltaHandler
} from "./session/realtime-delta-handler.js";
export type {
	RealtimeDeltaPayload,
	DeltaAckPayload,
	ApplyDeltaCallback,
	DeltaAckObserver
} from "./session/realtime-delta-handler.js";
export {
	createInitialCreatorToolState,
	reduceCreatorToolState,
	reduceCreatorToolStateWithMeta,
	DEFAULT_CREATOR_PALETTE
} from "./creator/tool-state.js";
export type {
	CreatorToolState,
	CreatorToolStateAction,
	CreatorToolTransitionMeta,
	CreatorToolTransitionResult,
	CreatorPaletteConfig,
	CreatorTargetCell,
	PendingPlacementInfo,
	OptimisticPlacementStatus
} from "./creator/tool-state.js";
export {
	derivePlacementPreview,
	deriveOccupancyLookup,
	derivePlacementPreviewBoundaryState,
	shouldEmitPlacementPreviewShown
} from "./creator/placement-preview.js";
export type {
	PlacementPreviewStatus,
	PlacementPreviewResult,
	PlacementOccupancyCell,
	PlacementPreviewBoundaryState
} from "./creator/placement-preview.js";
export {
	sanitizePlacementSubmitInput,
	createPlacementCommandId,
	isValidPlacementCommandId
} from "./creator/placement-input.js";
export type {
	PlacementSubmitInput,
	PlacementInputOptions,
	PlacementInputIssue,
	PlacementInputIssueCode,
	PlacementInputSanitizeResult
} from "./creator/placement-input.js";
export { placeTile } from "./creator/placement-caller.js";
export type {
	PlacementCallerFailure,
	PlacementCallerFailureClass,
	PlacementSubmitResult,
	PlacementCallerDependencies,
	PlacementCallerOptions
} from "./creator/placement-caller.js";
export { CreatorTelemetryAdapter } from "./creator/creator-telemetry.js";
export type {
	CreatorTelemetryEventName,
	CreatorTelemetryEvent,
	CreatorTelemetrySink,
	CreatorTelemetryOptions,
	PlacementPreviewShownEventInput,
	CreatorTransitionTelemetryInput,
	ViewportChangedTelemetryInput,
	ZoomLevelChangedTelemetryInput,
	CameraTelemetryBoundaryInput
} from "./creator/creator-telemetry.js";
export {
	createInitialCameraState,
	reduceCameraState,
	reduceCameraStateWithBoundary,
	deriveCameraTransitionBoundary,
	clampCameraState,
	clampCameraCenter,
	clampCameraZoom,
	normalizeCameraBounds,
	normalizeCameraZoomBounds,
	deriveCameraBoundsFromMap
} from "./navigation/camera-state.js";
export type {
	CameraBounds,
	CameraZoomBounds,
	CameraState,
	CameraAction,
	CreateInitialCameraStateInput,
	CameraTransitionBoundary,
	CameraStateTransition
} from "./navigation/camera-state.js";
export {
	deriveViewportFromCamera,
	normalizeViewportToBounds,
	normalizeViewportToPolicy,
	deriveViewportArea
} from "./navigation/viewport-math.js";
export type { ViewportDerivationInput } from "./navigation/viewport-math.js";
export { createViewportDiffCaller } from "./navigation/viewport-caller.js";
export type {
	QueueViewportDiffInput,
	ViewportCallerError,
	ViewportDiffCallerObservers,
	CreateViewportDiffCallerOptions,
	ViewportDiffCallerDependencies,
	ViewportDiffCaller
} from "./navigation/viewport-caller.js";
export { deriveVisibleTiles } from "./navigation/viewport-culling.js";
export type { TileBounds, CullableTile } from "./navigation/viewport-culling.js";

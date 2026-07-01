import { describe, expect, it } from "vitest";
import {
  createInitialBrowserAppState,
  setAccessibility,
  setOnboardingState,
  withAppState
} from "../../src/browser/state.js";

describe("onboarding and accessibility state", () => {
  it("tracks onboarding step progression and completion", () => {
    let state = createInitialBrowserAppState();
    const startedAtMs = state.onboarding.startedAtMs;

    state = setOnboardingState(state, {
      activeStep: 2
    });
    expect(state.onboarding.activeStep).toBe(2);
    expect(state.onboarding.completed).toBe(false);

    state = setOnboardingState(state, {
      completed: true,
      skipped: false,
      completedAtMs: startedAtMs + 12_000,
      activeStep: 3
    });

    expect(state.onboarding.completed).toBe(true);
    expect(state.onboarding.completedAtMs).toBe(startedAtMs + 12_000);
  });

  it("updates accessibility preferences deterministically", () => {
    let state = createInitialBrowserAppState();

    state = setAccessibility(state, {
      highContrastEnabled: true,
      reducedMotionEnabled: true
    });

    expect(state.accessibility.highContrastEnabled).toBe(true);
    expect(state.accessibility.reducedMotionEnabled).toBe(true);
  });

  it("captures first tile placement timestamp in state", () => {
    let state = createInitialBrowserAppState();

    state = withAppState(state, {
      firstTilePlacedAtMs: state.onboarding.startedAtMs + 1500
    });

    expect(state.firstTilePlacedAtMs).toBeGreaterThan(state.onboarding.startedAtMs);
  });
});

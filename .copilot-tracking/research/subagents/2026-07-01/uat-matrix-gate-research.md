# UAT Matrix and Release Gate Research
**Issue:** #90 — Epics 4 and 5 UAT Matrix and Release Gate  
**Date:** 2026-07-01  
**Status:** Complete

---

## Research Questions and Findings

---

### Q1: Manual UAT gate in GitHub Actions — environment protection rules requiring human approval before promotion

**Finding:**

GitHub Actions supports manual approval gates natively through **Environment Protection Rules**. For the tile-fighter repo, the `prod` environment already uses the `environment: prod` declaration in `release-prod.yml`, and the `dev` environment uses `environment: dev`.

**Mechanism:**
- In the GitHub repository settings under **Settings → Environments**, each named environment can have "Required reviewers" configured (up to 6 individuals or teams).
- When a workflow job references `environment: prod` and required reviewers are set, GitHub pauses the job and sends an approval request to the designated reviewers. The job cannot proceed until a reviewer approves.
- This is the standard mechanism — no additional Action is needed. The pause happens before the job's steps execute.

**UAT gate pattern for tile-fighter:**
- Create a new environment (e.g., `uat`) or reuse `prod` protection rules.
- Add the solo dev (dkirby-ms) as a required reviewer on the `prod` environment.
- The `release-prod.yml` workflow already targets `environment: prod`, so adding a required reviewer there is sufficient to force manual sign-off before prod deployment.
- Alternatively, insert a dedicated `uat-gate` job that runs before `release-prod`, uses `environment: uat`, and requires manual approval. This is cleaner because it separates the UAT sign-off from the deployment credential scope.

**Evidence reference:** GitHub Docs — [Using environments for deployment](https://docs.github.com/en/actions/deployment/targeting-different-deployment-environments/using-environments-for-deployment#required-reviewers)

**Relevant repo context:**
- `release-prod.yml` line 1: `environment: prod` — required reviewers can be added here immediately.
- `release-dev.yml` uses `environment: dev` — separate protection rules apply.
- The `verify-release.yml` runs post-deploy (not a gate); the UAT gate must be injected pre-promotion into `release-prod.yml` or as a prerequisite job.

---

### Q2: Recommended format for a manual UAT evidence record (no test scripts)

**Finding:**

When UAT is run manually without scripts, each run record should be a structured document or comment that provides enough information for a future reviewer to reproduce the test judgment. The standard fields for a solo-dev project at this stage are:

| Field | Description |
|-------|-------------|
| `matrix_row` | Which matrix row (1–6) this record covers |
| `build_sha` | Full 40-char Git commit SHA (`github.sha`) of the tested build |
| `image_tag` | Container image tag (`<ACR_LOGIN_SERVER>/tile-fighter-server:<SHA>`) |
| `environment` | `dev` or `prod` |
| `test_date` | ISO-8601 datetime with timezone |
| `tester` | GitHub handle |
| `preconditions` | What state the system was in before the test (e.g., fresh session, specific seed) |
| `steps_performed` | Numbered list of manual actions taken |
| `expected_output` | What should happen per acceptance criteria |
| `actual_output` | What actually happened, verbatim where possible |
| `telemetry_observed` | List of telemetry events confirmed in the sink (event name + key fields) |
| `pass_fail` | `PASS` / `FAIL` / `BLOCKED` |
| `defect_links` | GitHub issue numbers for any defects raised |
| `notes` | Deviations, environmental issues, caveats |

**Storage recommendation:** GitHub issue comments on issue #90 (see Q10).

---

### Q3: Matrix Row 1 — Bond determinism under repeated seeded runs (E4-S1, not yet built)

**Scope:** E4-S1 — pure bonding evaluator (glow-chain / blend-gradient / pulse-rhythm)

**What a tester does manually (when built):**
1. Load the app on a known build SHA.
2. Place tiles in a fixed pattern that should trigger each bond type:
   - Same-hue adjacency → expect `glow-chain` bond
   - Two-color adjacency → expect `blend-gradient` bond
   - Alternating pair pattern → expect `pulse-rhythm` bond
3. Record what bond visual effect appears.
4. Reset the canvas / start a new session with the same tile placement pattern.
5. Repeat steps 2–3 at least 3 times.
6. Confirm identical bond outputs across all runs.

**Observable outputs:**
- Bond visual effect type matches expectation for each adjacency rule.
- Bond visual type is identical across repeated placements of the same pattern.
- No "ghost" bonds appearing on tiles without adjacency.
- Bond effects absent when tiles are non-adjacent.

**Telemetry confirmation:**
- `bonding_triggered` event should fire with a `bond_type` field set to one of: `glow-chain`, `blend-gradient`, `pulse-rhythm`.
- The `bond_type` value must match the expected rule for the tested adjacency pattern.
- Verify in the telemetry sink (TELEMETRY_SINK_URL) that no `bonding_triggered` event fires when no adjacency is present.

**Pass criteria:** Same bond type for same pattern across ≥3 independent runs; telemetry event confirms correct bond type each time.

**Note:** E4-S4 adds a CI regression suite for this — manual UAT is the human-observer layer, not a replacement for E4-S4.

---

### Q4: Matrix Row 2 — Neighborhood recompute under burst placement (E4-S2, not yet built)

**Scope:** E4-S2 — neighborhood index and bounded recompute queue

**What a tester does manually (when built):**
1. Open the game on a build SHA that includes E4-S1 + E4-S2.
2. Place tiles rapidly in a cluster (simulate burst) — e.g., 10+ tiles in 5 seconds in the same region.
3. Observe whether:
   - Bond effects appear correctly on all placed tiles (not just the last one).
   - Bond effects appear only for genuinely adjacent tiles (no overreach to non-neighbors).
   - The UI remains responsive during burst (no perceptible stall or unresponsive input).
4. Observe telemetry in the sink for the sequence of events.
5. After burst settles, confirm all expected bonds are visible and no phantom bonds exist.

**"Queue lag within budget" evidence a human observer can collect:**
- Time from last tile placement to when all bond effects are visible on screen (stopwatch or video frame analysis).
- This is the human-observable proxy for queue drain time. No exact millisecond budget is defined in E4-S2, so the criterion is: "all effects appear within 1–2 seconds of burst completion" (reasonable given E3-S4's 200ms placement ack budget as a reference).
- Telemetry events to confirm:
  - `bond_recalc_started` fires for each new placement.
  - `bond_recalc_completed` fires after queue drains (no outstanding recalcs).
  - `bond_recalc_skipped` fires when a tile has no adjacency change (confirming redundant recalc suppression).
- The absence of duplicate `bonding_triggered` events for unchanged neighbors confirms "no redundant bond events publish."

**Pass criteria:** All bond effects appear within a reasonable interval after burst; telemetry shows `bond_recalc_completed` after the sequence; no duplicate events for unchanged neighbors.

---

### Q5: Matrix Row 3 — Palette preview → place → bond confirmation (E5-S1 + E4-S3)

**Scope:** E5-S1 (palette picker / placement preview) + E4-S3 (bond visuals rendered client-side)

**Specific UI interactions to test:**
1. Open palette → confirm `palette_opened` telemetry fires.
2. Select a shape → confirm preview appears on canvas at cursor position; confirm `shape_selected` telemetry.
3. Select a color → confirm preview updates with chosen color; confirm `color_selected` telemetry.
4. Hover over an occupied cell → confirm blocked indicator appears (not just blank).
5. Hover over a valid cell → confirm preview appears at that cell.
6. Click to place on a valid cell → confirm optimistic indicator appears immediately.
7. Wait for server acknowledgement → confirm optimistic indicator resolves to placed tile.
8. If the placed tile is adjacent to a same-hue tile, confirm bond visual (glow-chain) appears within ~2 seconds.
9. Confirm `bond_effect_rendered` telemetry fires after bond visual appears.

**Pass criteria:**
- Preview updates instantly on shape/color select (no perceptible lag).
- Blocked indicator shown on occupied cell.
- Optimistic indicator appears before server ack.
- Bond visual appears after placement when adjacency rules apply.
- Telemetry: `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown`, `bonding_triggered`, `bond_effect_rendered` all observed in the sink for a single placement-and-bond interaction.

---

### Q6: Matrix Row 4 — Pan/zoom with bond readability (E5-S2 + E4-S3)

**Scope:** E5-S2 (camera / culling) + E4-S3 (bond effect render at zoom levels)

**Zoom levels to test:**
- The backlog doesn't specify explicit zoom levels. Reasonable tiers to test manually:
  - 100% (1:1, default): bond effects fully visible; tile borders legible.
  - 50% (zoomed out): individual tiles still distinguishable; bond glow/pulse visible but smaller.
  - 200% (zoomed in): bond gradients/glows render at higher detail; no pixelation artifacts.
  - Min zoom (maximum out): tile clusters visible as colored regions; bonds indicated by color continuity.

**Legibility criteria:**
- At each zoom level, confirm that tile edges (borders) are distinguishable from the bond effect overlay.
- Bond glow/gradient must not obscure tile identity (which tile is which color/shape).
- At min zoom, bond effects should simplify gracefully (not render as noise).
- Pan: camera moves without "swimming" or input lag; tiles snap into view at the new viewport immediately.

**Culling check:**
- Scroll to an empty region → confirm no bond effect artifacts appear for off-screen tiles.
- Telemetry: `viewport_changed`, `zoom_level_changed` fire on pan and zoom actions respectively.

**Pass criteria:** Bond visuals remain legible at all tested zoom levels; no artifacts at min/max zoom; pan is smooth (no visible stutter); culling prevents off-screen render artifacts; telemetry events fire on zoom and pan.

---

### Q7: Matrix Row 5 — Onboarding to first tile ≤30s (E5-S3)

**Scope:** E5-S3 (onboarding stepper + first tile time)

**How a tester measures "p50" manually:**
- p50 (median) requires multiple data points. For a solo dev, pragmatic approach is:
  - Run the onboarding flow 5 times (minimum) in separate incognito browser sessions to simulate a new player.
  - Record the time from "tutorial overlay appears" to "first tile confirmed placed" using a stopwatch or screen recording with timestamp.
  - Sort the 5 times; the median (3rd value) is the p50 estimate.
  - 5 samples is a small-N estimate — sufficient for UAT gating, not statistical rigor.
- Record each run's time in the evidence record.
- Also test the "skip tutorial" path: skip → place first tile; confirm this path also completes in ≤30s.

**Telemetry confirmation:**
- `tutorial_started` fires when overlay appears.
- `tutorial_completed` fires when stepper finishes (or skip is used).
- `first_tile_time_recorded` fires with the elapsed time when first tile placement is acknowledged.
- Compare `first_tile_time_recorded` payload value against 30000ms threshold.

**Pass criteria:**
- Median of 5 manual runs ≤30 seconds.
- `first_tile_time_recorded` telemetry payload confirms ≤30s elapsed.
- Both "complete tutorial" and "skip tutorial" paths pass independently.

---

### Q8: Matrix Row 6 — Keyboard-only + high-contrast + reduced-motion (E5-S4 + E4-S3)

**Scope:** E5-S4 (accessibility settings) + E4-S3 (reduced-motion bond visuals)

**Relevant WCAG criteria:**
- **WCAG 2.1 SC 2.1.1 (Keyboard, Level A):** All functionality available via keyboard alone; no keyboard trap.
- **WCAG 2.1 SC 2.1.2 (No Keyboard Trap, Level A):** Focus can be moved away from any component using keyboard.
- **WCAG 2.1 SC 1.4.3 (Contrast Minimum, Level AA):** Text and UI components meet 4.5:1 contrast ratio (3:1 for large text and UI components).
- **WCAG 2.1 SC 1.4.11 (Non-Text Contrast, Level AA):** UI component boundaries (tile borders, button outlines) ≥3:1 against adjacent colors.
- **WCAG 2.1 SC 2.3.3 (Animation from Interactions, Level AAA):** Motion can be disabled — however, **SC 2.3.3 is AAA**; the practical standard is to honor `prefers-reduced-motion` media query (CSS/JS) which is a widely-adopted expectation even if not a Level A/AA hard requirement.

**Specific interactions to test (keyboard-only):**
1. Tab through palette controls → confirm each tool (shape picker, color picker) is reachable.
2. Use arrow keys or Tab to move placement cursor on canvas.
3. Press Enter/Space to place a tile at cursor position.
4. Confirm tile is placed and bond effect appears without any mouse input.
5. Confirm focus indicator is visible on all interactive elements throughout the flow.

**High-contrast mode:**
1. Enable the in-app high-contrast toggle.
2. Confirm tile borders are visible at ≥3:1 contrast ratio against background.
3. Confirm bond glow effects do not reduce tile edge contrast below threshold.
4. Tool: use browser DevTools accessibility checker or a contrast ratio tool (e.g., WebAIM Contrast Checker) for spot checks.

**Reduced-motion:**
1. Enable in-app reduced-motion toggle (or set OS-level `prefers-reduced-motion: reduce`).
2. Place a tile that should trigger a bond effect.
3. Confirm bond animation is reduced (static color change or brief fade instead of animated glow/pulse).
4. Confirm `reduced_motion_enabled` / `bond_effect_rendered` telemetry fires.
5. Confirm no animation plays that could trigger photosensitivity concerns.

**Pass criteria:**
- Full placement-and-bond flow completable with keyboard only (no mouse).
- All interactive elements have visible focus indicators.
- High-contrast mode meets ≥3:1 for UI component boundaries (WCAG 1.4.11 AA).
- Reduced-motion mode eliminates full animations; confirms via `reduced_motion_enabled` telemetry.
- Telemetry: `a11y_mode_enabled`, `keyboard_placement_used`, `bond_effect_rendered` (with reduced-motion context) observed.

---

### Q9: GitHub release gate mechanism — blocking environment promotion until human signs off

**Finding:**

The standard GitHub mechanism is:

1. **Required Reviewers on a GitHub Environment** (Settings → Environments → [env name] → Protection Rules → Required reviewers).
2. When a workflow job specifies `environment: <name>` and the environment has required reviewers configured, GitHub suspends the job before executing any steps and sends an email/notification to the listed reviewers.
3. A reviewer visits the Actions run URL, reviews the context (build SHA, run logs), and clicks "Approve and deploy" (or "Reject").
4. The job proceeds only after approval; rejection fails the workflow.

**For tile-fighter specifically:**
- `release-prod.yml` already uses `environment: prod`. Adding dkirby-ms as a required reviewer on the `prod` environment is the minimal change needed.
- A cleaner pattern is a two-job workflow:
  ```yaml
  jobs:
    uat-gate:
      name: UAT sign-off required
      runs-on: ubuntu-latest
      environment: uat   # has required reviewer; no secrets needed
      steps:
        - name: UAT attestation
          run: echo "UAT approved for ${{ github.sha }}"

    release-prod:
      name: Build and deploy prod
      needs: uat-gate
      runs-on: ubuntu-latest
      environment: prod
      # ... existing steps
  ```
- This separates the approval step (no deploy credentials in scope) from the actual deployment (full secrets in scope), which is better from a least-privilege standpoint.
- The `environment: uat` job can include an `environment.url` pointing to the UAT evidence issue comment for traceability.

**Current gap:** `release-prod.yml` has no `needs` dependency and no pre-promotion gate. The verification workflow (`verify-release.yml`) runs post-deploy, not pre-promotion.

---

### Q10: Recommended evidence storage approach for a solo dev

**Finding:**

For a solo dev, the lowest-overhead high-traceability option is **GitHub issue comments on issue #90**.

**Rationale:**
- Issue #90 is already the UAT tracking issue; linking all evidence there keeps context co-located.
- GitHub issue comments support markdown tables, code blocks, and checklists — sufficient for structured evidence records.
- Comments are timestamped and tied to the GitHub actor, providing built-in audit identity.
- No additional tooling, wikis, or file-system overhead.
- Searchable via GitHub search.

**Pattern:**
- For each UAT run, post a comment on issue #90 with the structured evidence record (see Q2 fields).
- Use a comment heading like `## UAT Run: Row 1 — Bond Determinism | SHA: <short-sha> | PASS`.
- When all rows pass for a build SHA, post a summary comment: `## UAT Sign-off: Build <sha> — All rows PASS` and close or move the issue to the next state.

**Alternative:** `.copilot-tracking/uat/` files in the repo. This works but adds file churn to the commit history and requires a push to record evidence. Issue comments are lower friction for manual UAT.

**The `.copilot-tracking/` pattern is better suited** for:
- Planning artifacts, research (like this document), and session-to-session agent continuity.
- Not for individual runtime UAT evidence records.

---

### Q11: Build SHA recording — source from GitHub Actions context

**Finding:**

In GitHub Actions, the commit SHA is available as:

```yaml
${{ github.sha }}   # Full 40-character SHA
```

This is already used in tile-fighter's release workflows:
- `release-dev.yml`: `IMAGE_TAG: ${{ github.sha }}`
- `release-prod.yml`: `IMAGE_TAG: ${{ github.sha }}`

The SHA identifies both the Git commit and the immutable container image pushed to ACR (`<ACR_LOGIN_SERVER>/tile-fighter-server:<sha>`).

**How to record in a UAT evidence comment:**

1. From the GitHub Actions run page, the SHA is visible in the run context (`triggered by commit <sha>`).
2. The full SHA is also in the workflow run URL: `https://github.com/dkirby-ms/tile-fighter/actions/runs/<run-id>`.
3. For manual UAT (not triggered from Actions), obtain the SHA from `git log --oneline -1` or from the Docker image tag on the deployed container:
   ```bash
   az containerapp show \
     --resource-group <rg> \
     --name tile-fighter-server \
     --query "properties.template.containers[0].image" -o tsv
   # Returns: <acr>/tile-fighter-server:<sha>
   ```
4. Record the full 40-char SHA in the evidence record's `build_sha` field. Use the first 7 chars as the short identifier in the comment heading.

**Short SHA for display:** `echo "${{ github.sha }}" | cut -c1-7`

---

## Codebase Context Summary

### Current CI/CD Structure (from workflow files and cicd-harness.md)

| Workflow | Trigger | Environment | Blocking gate today |
|----------|---------|-------------|---------------------|
| `ci.yml` | PR + push to main | none | npm audit high/critical; type-check; tests |
| `release-dev.yml` | push to main; manual | `dev` | Trivy HIGH/CRITICAL; container scan |
| `release-prod.yml` | manual only | `prod` | Trivy HIGH/CRITICAL; container scan |
| `verify-release.yml` | post release-dev/prod; manual | `dev` or `prod` | /healthz, /readyz, auth smoke, E3-S4 latency budget |
| `nonprod-load.yml` | scheduled; manual | `dev` | E3-S4 budget assertion |
| `semver-release.yml` | push to main | none | SemVer tag generation |

**E4/E5 UAT gap:** No pre-promotion gate exists for feature validation. `verify-release.yml` covers E1/E3 post-deploy smoke only. UAT gate for E4+E5 must be added.

### E4 Story Status
- **E4-S1:** Bonding evaluator (glow-chain/blend-gradient/pulse-rhythm) — NOT BUILT
- **E4-S2:** Neighborhood recompute queue — NOT BUILT
- **E4-S3:** Client bond visual rendering + reduced motion — NOT BUILT
- **E4-S4:** CI regression suite for bond determinism — NOT BUILT

### E5 Story Status
- **E5-S1:** Palette picker + placement preview — NOT BUILT
- **E5-S2:** Pan/zoom + culling — NOT BUILT
- **E5-S3:** Onboarding stepper + first tile ≤30s — NOT BUILT
- **E5-S4:** Keyboard + high-contrast + reduced-motion a11y — NOT BUILT

### Current Client UI
Basic HTML form (X/Y inputs + place tile button). No visual canvas, no palette, no pan/zoom.

### Telemetry Events Expected by E4/E5
| Epic | Event | Story |
|------|-------|-------|
| E4 | `bonding_triggered` (with `bond_type`) | E4-S1 |
| E4 | `bond_recalc_started`, `bond_recalc_completed`, `bond_recalc_skipped` | E4-S2 |
| E4 | `bond_effect_rendered`, `reduced_motion_enabled` | E4-S3 |
| E5 | `palette_opened`, `shape_selected`, `color_selected`, `placement_preview_shown` | E5-S1 |
| E5 | `viewport_changed`, `zoom_level_changed` | E5-S2 |
| E5 | `tutorial_started`, `tutorial_completed`, `first_tile_time_recorded` | E5-S3 |
| E5 | `a11y_mode_enabled`, `keyboard_placement_used` | E5-S4 |

---

## Key Discoveries

1. **GitHub environment protection rules are the correct mechanism** for a manual UAT gate. The repo already uses named environments (`dev`, `prod`). No new Action needed — just configure Required Reviewers on the `prod` environment (or a new `uat` environment for cleaner separation).

2. **A two-job pattern (`uat-gate` → `release-prod`)** is cleaner than adding a reviewer to the `prod` environment directly, because it scopes the approval step to a credential-free context.

3. **`verify-release.yml` runs post-deploy and covers E1/E3 only.** The E4/E5 UAT gate must block pre-promotion (before `release-prod.yml` runs) — it cannot be added to `verify-release.yml`.

4. **Manual p50 for onboarding** requires a minimum of 5 runs in fresh incognito sessions to produce a meaningful median. Telemetry's `first_tile_time_recorded` payload value provides a machine-readable confirmation.

5. **WCAG 1.4.11 (Non-Text Contrast, Level AA) and 2.1.1 (Keyboard, Level A)** are the directly applicable standards for E5-S4. SC 2.3.3 (reduced-motion, Level AAA) is aspirational; honoring `prefers-reduced-motion` is the practical implementation target.

6. **Build SHA is already tracked** via `IMAGE_TAG: ${{ github.sha }}` in both release workflows. Evidence records should capture the full 40-char SHA as the canonical build identity.

7. **Issue #90 comments** are the recommended evidence storage location — co-located with the UAT tracking context, no tooling overhead, built-in audit trail.

8. **All E4/E5 stories are unbuilt.** The UAT matrix can be defined now (rows, evidence fields, pass criteria), but execution rows cannot run until the stories are implemented. The matrix issue serves as the planning artifact and sign-off gate definition.

---

## Clarifying Questions (Cannot Be Answered Through Research Alone)

1. Should the UAT gate block `release-dev` or only `release-prod`? (The issue says "candidate build gate blocks promotion" — promotion usually implies dev→prod, suggesting only `release-prod` needs the gate.)

2. Is there an existing `uat` GitHub Environment configured in the repo settings, or should the UAT sign-off be added as a required reviewer on the existing `prod` environment?

3. Is there a defined zoom level range for E5-S2 (e.g., 25%–400%)? The backlog doesn't specify min/max zoom bounds.

4. Should the UAT evidence record include a screen recording reference (e.g., a link to a video in a GitHub release asset), or are written observations sufficient?

5. For Row 1 (bond determinism), does "repeated seeded runs" imply a fixed world-state seed mechanism exists in the server, or does it mean placing the same pattern manually in a fresh canvas?

---

## Recommended Next Research (Not Completed This Session)

- [ ] Verify whether the `prod` environment in the repo's GitHub settings currently has any Required Reviewers configured (requires GitHub API access or UI inspection).
- [ ] Confirm exact zoom level range when E5-S2 is implemented and update Row 4 test steps.
- [ ] Research whether `first_tile_time_recorded` telemetry payload schema is defined anywhere in the codebase (search for the event name in source files once E5-S3 is built).
- [ ] Check if any existing `.copilot-tracking/` UAT artifacts exist from prior UAT work on E1/E3.
- [ ] Research WCAG 2.2 updates relevant to E5-S4 (SC 2.4.11 Focus Appearance is Level AA in WCAG 2.2, which adds stricter focus indicator requirements).

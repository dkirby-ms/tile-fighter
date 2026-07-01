<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
# Sprint Issue Analysis - Layer 1 Epic 4 and 5 UAT Overlap

* **Artifact(s)**: docs/layer1-backlog.md
* **Repository**: dkirby-ms/tile-fighter
* **Milestone**: Layer 1 MVP

## Planned Issues

### IS001 - Update - Epic 4 UAT alignment for deterministic bonding with testable UX hooks

* **Working Title**: epic(layer1): E4 deterministic bonding engine and visual effects
* **Key Search Terms**: "deterministic bonding", "visual effects hooks", "bond regression suite", "reduced motion"
* **Working Description**:
  ```markdown
  Align Epic 4 with UAT-ready slices that can be validated in the browser client as each story lands.

  ## UAT-centric refinements
  - Add explicit per-story UAT evidence requirements (fixture IDs, expected render outcomes, reduced-motion checks).
  - Split acceptance checkpoints into two lanes:
    - Determinism lane: server/shared evaluator outputs are stable under repeated runs.
    - Experience lane: client receives and renders expected effect payloads without motion regressions.
  - Require a single "Bonding UAT Pack" artifact for each candidate build:
    - Golden fixture output table (from E4-S4)
    - Event-to-render verification screenshots/video snippets for Glow/Blend/Pulse
    - Reduced-motion variant verification for same scenarios

  ## Cross-epic handshake to Epic 5
  - E4-S3 must publish a stable effect contract consumed by E5 accessibility and onboarding flows.
  - E4-S4 regression output should be consumable in E5 onboarding smoke so first-use guidance reflects actual effect behavior.
  ```
* **Working Labels**: epic, layer1, feature, uat
* **Working Milestone**: Layer 1 MVP
* **Found Issue Field Values**:
  * state: open
  * labels: none observed in provided issue payload
  * milestone: none observed in provided issue payload
* **Suggested Issue Field Values**:
  * labels: epic, layer1, feature, uat
  * milestone: Layer 1 MVP

#### IS001 - Related and Discovered Information

* Related Requirements from docs/layer1-backlog.md
  * E4-S1 defines deterministic Glow/Blend/Pulse outputs.
  * E4-S2 bounds recalculation to local neighborhoods to maintain performance.
  * E4-S3 introduces visual render hooks and reduced motion.
  * E4-S4 provides deterministic golden regression gate.
* Related Key Details from docs/layer1-backlog.md
  * E4 exit criterion requires deterministic outputs stable under load.
  * Existing sprint sequence places E4 before social expansion, making it a core UAT gate.

### IS002 - Update - Epic 5 UAT alignment for creator flow with deterministic effect visibility

* **Working Title**: epic(layer1): E5 creator ux navigation and accessibility
* **Key Search Terms**: "creator UX", "preview", "pan zoom", "onboarding", "accessibility"
* **Working Description**:
  ```markdown
  Align Epic 5 with UAT-ready creator journeys that directly exercise Epic 4 outputs.

  ## UAT-centric refinements
  - Add journey-based acceptance slices that map to testable user actions:
    - Journey A: open palette -> preview valid/invalid placement -> place tile -> see deterministic bond outcome.
    - Journey B: pan/zoom to bonded cluster -> verify culling and legibility while effects remain interpretable.
    - Journey C: first-session onboarding -> place first tile under 30 seconds with bond feedback confirmation.
    - Journey D: keyboard-only + high-contrast + reduced-motion path through placement and bond confirmation.
  - Require each journey to produce repeatable UAT scripts and expected telemetry markers.

  ## Cross-epic handshake to Epic 4
  - E5-S3 onboarding copy and confirmation callouts must reference actual E4 bond types in language users can recognize.
  - E5-S4 accessibility toggles must validate against E4-S3 low-motion variants, not independent placeholder animations.
  ```
* **Working Labels**: epic, layer1, enhancement, uat
* **Working Milestone**: Layer 1 MVP
* **Found Issue Field Values**:
  * state: open
  * labels: none observed in local backlog snapshot
  * milestone: none observed in local backlog snapshot
* **Suggested Issue Field Values**:
  * labels: epic, layer1, enhancement, uat
  * milestone: Layer 1 MVP

#### IS002 - Related and Discovered Information

* Related Requirements from docs/layer1-backlog.md
  * E5-S1 covers palette, preview, and optimistic placement indicator.
  * E5-S2 covers pan/zoom and visible-only rendering.
  * E5-S3 defines first-tile-in-30-seconds onboarding target.
  * E5-S4 defines keyboard, contrast, and reduced-motion accessibility support.
* Related Key Details from docs/layer1-backlog.md
  * E4-S3 depends on E5-S2 and E5-S4 depends on E4-S3, indicating direct overlap where UAT can be combined.

### IS003 - Create - Shared Epic 4 and 5 UAT matrix and release gate checklist

* **Working Title**: plan(layer1): shared E4-E5 UAT matrix and release gate
* **Key Search Terms**: "UAT matrix", "shared regression", "release gate", "bond + creator journeys"
* **Working Description**:
  ```markdown
  Create a cross-epic UAT matrix to prevent duplicate QA effort and to validate user-visible outcomes end-to-end.

  ## Scope
  - Define combined test matrix rows by user journey and technical risk.
  - Include deterministic assertions (E4) and usability/accessibility assertions (E5) in same row.
  - Capture required evidence, owner, cadence, and pass/fail gate criteria.

  ## Minimum matrix rows
  1. Bond determinism under repeated placement seed
  2. Local recompute under burst placement with visible effect correctness
  3. Palette preview to placement to effect confirmation
  4. Pan/zoom and culling with bond readability at multiple zoom levels
  5. Onboarding to first tile with bond feedback <=30s p50
  6. Keyboard-only + reduced-motion + high-contrast placement-and-bond flow

  ## Gate policy
  - No promotion to shared UAT environment unless all mandatory rows pass.
  - CI bond regression gate (E4-S4) and smoke UAT journey subset must both pass.
  ```
* **Working Labels**: planning, layer1, uat
* **Working Milestone**: Layer 1 MVP
* **Suggested Issue Field Values**:
  * labels: planning, layer1, uat
  * milestone: Layer 1 MVP

#### IS003 - Related and Discovered Information

* Related Key Details from docs/layer1-backlog.md
  * Sprint table separates deterministic bonding and creator UX across sprints, but dependencies indicate high overlap.
  * Combining UAT scripts reduces retest churn and validates real player experience earlier.
<!-- markdown-table-prettify-ignore-end -->

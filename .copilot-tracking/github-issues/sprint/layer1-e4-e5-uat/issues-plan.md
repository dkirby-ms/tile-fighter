<!-- markdownlint-disable-file -->
<!-- markdown-table-prettify-ignore-start -->
# Issues Plan

* **Repository**: dkirby-ms/tile-fighter
* **Milestone**: Layer 1 MVP

## IS001 - Update - Epic 4 UAT alignment for deterministic bonding with testable UX hooks

Update Epic 4 to explicitly include UAT evidence requirements and a two-lane acceptance structure so deterministic behavior and client-visible outcomes are validated together.

IS001 - Similarity: #4=Match (same epic, direct update)

* IS001 - issue_number: #4
* IS001 - title: epic(layer1): E4 deterministic bonding engine and visual effects
* IS001 - state: open
* IS001 - labels: epic, layer1, feature, uat
* IS001 - milestone: Layer 1 MVP
* IS001 - assignees: none

### IS001 - body

```markdown
## Why now
Bonding is the core delight mechanic and must be deterministic before UX/social layering.

## In-scope
- Glow/Blend/Pulse rules
- Local neighborhood recalculation
- Visual effect hooks and reduced motion support
- Bond regression suite
- UAT evidence pack for Glow/Blend/Pulse including reduced-motion variants

## Out-of-scope
- Advanced chain combos

## UAT alignment
- Determinism lane: golden fixture outputs and seeded repeatability checks
- Experience lane: event-to-render checks in browser client for each bond type
- Promotion gate requires both lanes to pass for candidate builds

## Primary risks
- Non-deterministic outcomes
- Recalc perf spikes
- Divergence between evaluator output and client-rendered effect behavior

## Harness mapping
- 1 source validation
- 2 deterministic build and type safety
- 6 post-deploy verification

## Exit criteria
- Rule corpus deterministic under repeated runs
- Bond regression suite blocks bad merges
- UAT evidence pack complete for all bond variants and reduced-motion mode

## Stories
- E4-S1
- E4-S2
- E4-S3
- E4-S4
```

### IS001 - Relationships

* IS001 - linked-plan - IS003: Epic 4 UAT evidence is governed by shared E4/E5 matrix

## IS002 - Update - Epic 5 UAT alignment for creator journey validation

Update Epic 5 to make UAT journeys explicit and tied to deterministic bond outputs so usability testing and gameplay correctness are validated in the same run.

IS002 - Similarity: #5=Match (same epic, direct update)

* IS002 - issue_number: #5
* IS002 - title: epic(layer1): E5 creator ux navigation and accessibility
* IS002 - state: open
* IS002 - labels: epic, layer1, enhancement, uat
* IS002 - milestone: Layer 1 MVP
* IS002 - assignees: none

### IS002 - body

```markdown
## Why now
Creator usability determines retention; UAT must validate the full journey with deterministic bond feedback.

## In-scope
- Palette + shape picker + placement preview
- Pan/zoom and visible-region rendering
- First-session onboarding to first tile in <=30 seconds p50
- Accessibility support (keyboard, high contrast, reduced motion)
- Journey-based UAT scripts tied to bond outcomes

## Out-of-scope
- Deep mobile editor parity
- Cosmetics UI

## UAT alignment
- Journey A: palette -> preview -> place -> bond feedback
- Journey B: pan/zoom to bonded clusters with readability checks
- Journey C: onboarding to first tile <=30s with confirmation
- Journey D: keyboard-only + high contrast + reduced motion placement-and-bond flow
- Promotion gate requires pass on mandatory journeys for candidate builds

## Primary risks
- Interaction complexity
- Accessibility regressions
- Onboarding mismatches with actual bond behavior

## Harness mapping
- 2 deterministic build and type safety
- 6 post-deploy verification

## Exit criteria
- First tile placement in <30 seconds for new session
- Keyboard + reduced motion usable
- Shared UAT matrix rows for creator journeys pass in target environment

## Stories
- E5-S1
- E5-S2
- E5-S3
- E5-S4
```

### IS002 - Relationships

* IS002 - linked-plan - IS003: Epic 5 journey validation is governed by shared E4/E5 matrix

## IS003 - Create - Shared E4/E5 UAT matrix and release gate

Create a planning issue that defines a single UAT matrix and release gate criteria spanning deterministic bonding and creator UX.

IS003 - Similarity: #4=Similar (overlap in bond validation), #5=Similar (overlap in creator flow), Distinct as cross-epic gate artifact

* IS003 - issue_number: {{TEMP-1}}
* IS003 - title: plan(layer1): shared E4-E5 UAT matrix and release gate
* IS003 - state: open
* IS003 - labels: planning, layer1, uat
* IS003 - milestone: Layer 1 MVP
* IS003 - assignees: none

### IS003 - body

```markdown
## Summary
Define and run a unified UAT matrix for Epics 4 and 5 so deterministic bonding behavior and creator experience are validated together.

## Matrix rows
1. Bond determinism under repeated seeded runs
2. Local neighborhood recompute under burst placement with correct published effects
3. Palette preview -> place -> bond confirmation flow
4. Pan/zoom and culling with bond readability at multiple zoom levels
5. Onboarding to first tile <=30 seconds p50 with bond confirmation
6. Keyboard-only + high-contrast + reduced-motion placement-and-bond flow

## Evidence required per row
- Test script reference
- Expected outputs
- Telemetry markers observed
- Environment and build SHA
- Pass/fail and defect links

## Acceptance criteria
- Mandatory matrix rows are defined and owned
- Candidate build gate blocks promotion when any mandatory row fails
- Execution cadence and evidence storage location are documented
```

### IS003 - Relationships

* IS003 - parent-of - #4: UAT gate applies to Epic 4 outcomes
* IS003 - parent-of - #5: UAT gate applies to Epic 5 outcomes
<!-- markdown-table-prettify-ignore-end -->

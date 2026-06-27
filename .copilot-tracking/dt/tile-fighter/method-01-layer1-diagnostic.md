## Layer 1 Diagnostic: Core Minimum Feature Set

**North Star:** "People can place tiles in the shared canvas without getting stressed out"

### Diagnostic Findings

#### Griefing Surface Area – SIMPLIFIED ✓

**Original GDD approach:** Owner-first rights window, regional rollback, moderation baseline
**Layer 1 approach:** No tile removal. Only placement + self-edit within 10 minutes.

**Impact:** 
- Eliminates ~80% of griefing surface
- No moderation arms race at Layer 1
- People can't destroy each other's work, only add to it
- Reduces solo dev moderation burden to near-zero

**Decision:** APPROVED. "Can't remove tiles" does not break core vision.

---

### Still Unresolved – Diagnostic Questions

#### 1. Tile Bonding Effects – Core or Delightful Accident?

**Current GDD:** Bonding is a major mechanic. Players strategize to trigger Glow Chains, Blend Gradients, Pulse Rhythms.

**Diagnostic question:** Is this core to "place without stress," or does it add optimization pressure?

- If bonding is *required* for fun, then players need to understand adjacency rules = stress.
- If bonding is a *delight* they discover accidentally, then it supports flow = no stress.

**Your call:** Does bonding feel like something you want people to *figure out*, or *accidentally discover*?

---

#### 2. Placement Cooldowns – RESOLVED ✓

**Decision:** Remove visible cooldown from Layer 1. Backend rate-limiting only to prevent spam abuse.

**Rationale:** Visible cooldown is stress; backend rate-limiting achieves the same anti-spam goal without interrupting flow.

---

#### 3. Reactions System – RESOLVED ✓

**Decision:** Simple heart counter. No anti-spam daily budget, no diversity weighting, no algorithmic ranking.

**Rationale:** Knowing people reacted is enough to feel "seen." Complexity is Layer 2.

---

#### 4. Discovery System – RESOLVED ✓

**Decision:** Two-tier discovery:
1. **Primary:** Scroll/navigate the shared canvas directly
2. **Secondary:** Map pins (bookmarks) that players can publish to a shared pinned list for others to navigate to

**Rationale:** Crowd-sourced discovery via pinning is low-friction and avoids algorithmic ranking complexity.

**New diagnostic question:** Does pinning create moderation risk (spam pinning) or is that acceptable for Layer 1?

---

#### 5. Real-Time Synchronization – Hard Requirements

**Current GDD:** WebSocket deltas, <150 ms placement acknowledgement, rollback service

**Diagnostic question:** What sync complexity is actually needed for "place without stress"?

- If a tile takes 500ms to appear, does that break the experience?
- If two people place the same tile and one "loses," does that create stress?

**Your call:** What's your acceptable latency and conflict tolerance for Layer 1?

---

---

## CRITICAL DESIGN CLARITY – CORE GAME IDENTITY

**Decision:** MMO ART SANDBOX (multiplayer scale, creative focus, no treadmill)

**Implication:** This reframes the entire design.

- ✓ Core loop is CREATION, not discovery/curation
- ✓ Reactions are validating bonus, not engagement treadmill
- ✓ Scale is about "infinite room to explore and create," not "managed social platform"
- ✓ Moderation is minimal (safety), not comprehensive (abuse prevention at scale)

**Resolved Technical Details:**

| Decision | Detail |
|---|---|
| **Tile Bonding** | Automatic (red tile next to red = glow). No learning curve. Chain combos can be Layer 2. |
| **Canvas Structure** | Expandable. Start large (e.g., 32k x 32k), expand dynamically as needed. |
| **Retention Hook** | Canvas evolution + organic community creation. Seasonal themes optional post-Layer 1. |

**What this means for the GDD:**
- Strip: progression systems, featured boards, cosmetic economy, advanced discovery algorithms, griefing mechanics, moderation baseline complexity
- Keep: simple tile placement, automatic bonding effects, basic reactions, map pins for discovery
- Defer: seasonal events, creator cosmetics, advanced sharding strategies

**What this solves:**
- Eliminates ~70% of the original GDD complexity
- Makes the solo dev timeline realistic (likely 4-6 months, not 18)
- Aligns "relaxing" with actual design (no optimization pressure)
- Reduces moderation burden to near-zero at Layer 1

---

### Next Steps

Rebuild the GDD from the Art Sandbox foundation, not the MMO template.

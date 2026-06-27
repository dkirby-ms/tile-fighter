---
description: Generate a production-ready game design document from a concept brief
---

## Purpose

Generate a complete, implementation-ready game design document (GDD) suitable for design, engineering, art, production, QA, and stakeholder review.

## Inputs

Use the values provided by the user. If any required value is missing, ask concise clarifying questions first. If the user asks to proceed without answers, state assumptions explicitly.

* Working title
* Genre and subgenre
* Target platform(s)
* Target audience
* Camera and perspective
* Core player fantasy
* Visual and tonal direction
* Monetization model
* Team size and delivery timeline
* Technical constraints (engine, networking, performance, hardware)
* Must-have features
* Nice-to-have features
* Inspirations and differentiators
* Target rating and content boundaries

## Output Requirements

Write in clear, practical language. Prefer concrete details over abstract statements. Keep scope grounded in team size and timeline.

Produce the document with these sections in order:

1. High concept
2. Design pillars with explicit do and do-not implications
3. Audience and positioning
4. Core loop and secondary loops
5. Player journey (early, mid, late)
6. Systems design
7. Content design
8. Narrative and lore approach
9. Art direction
10. Audio direction
11. UX and accessibility
12. Technical design notes
13. Production plan and milestones
14. QA strategy and telemetry plan
15. Monetization and live ops (if applicable)
16. Risk register with mitigation owners
17. MVP launch definition and go or no-go checklist
18. Post-launch roadmap (30, 90, 180 days)

## System Depth Expectations

Include practical detail for implementation:

* At least one sample mission or level breakdown
* At least one progression and economy balancing framework
* A starter enemy or challenge taxonomy
* Core tuning levers and what they affect
* Content production assumptions and dependencies

## Production Constraints

Force clear scope control:

* Separate MVP scope from post-launch scope
* Identify high-risk features and provide lower-risk fallback options
* Call out unknowns blocking delivery and how to de-risk them
* Include a sample first two-week sprint plan

## Output Format

Return:

* A one-page executive summary
* The full GDD
* A compact assumptions list
* A top risks table with severity, probability, owner, and mitigation
* A final section named Open Questions for Team Alignment

## Quality Bar

The result should be specific enough that cross-functional teams can start implementation immediately with minimal follow-up.
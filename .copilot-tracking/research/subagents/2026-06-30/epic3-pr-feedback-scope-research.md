---
title: Epic3 PR Feedback Scope Research
description: Research findings for PR feedback implementation scope on branch epic3.
author: GitHub Copilot
ms.date: 2026-06-30
ms.topic: reference
---

## Research Scope

* Branch: epic3
* Focus files:
  * apps/server/src/http/app.ts
  * apps/server/src/rooms/arena.room.ts
  * apps/server/src/domain/delta-fanout.service.ts
  * apps/server/src/index.ts
* Concerns from handoff:
  * Fanout dispatch path and publish call inputs in app bootstrap
  * Registry registration and teardown lifecycle in room handling
  * Outbound cap reset semantics in delta fanout
  * Replay window config wiring at entrypoint
* Additional requested outputs:
  * Existing related tests
  * Exact npm validation commands from package scripts for targeted and full validation

## Findings In Progress

TBD

## Open Questions

TBD

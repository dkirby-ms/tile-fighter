---
title: Colyseus Azure Scaffold Prompt Research
description: Research notes to build a high-quality prompt for generating a Colyseus 0.17 server-authoritative scaffold on Azure.
ms.date: 2026-06-27
ms.topic: reference
---

## Request Summary

* Build a prompt that generates a scaffold for a Colyseus 0.17 server-authoritative game in TypeScript
* Backend storage must use PostgreSQL
* Cloud hosting target is Azure Container Apps
* Identity and authentication must use OAuth with Entra External Identities

## Current Inputs

* Topic: Prompt design for project scaffold generation
* Date: 2026-06-27
* Sandbox root: .copilot-tracking/sandbox
* Expected first run folder: .copilot-tracking/sandbox/2026-06-27-colyseus-scaffold-001

## Research Questions

* Recommended Colyseus 0.17 project structure for server-authoritative gameplay
* Practical folder and module boundaries for TypeScript backend
* PostgreSQL integration patterns suitable for Colyseus session/account data
* Azure Container Apps deployment artifacts and runtime settings
* Entra External Identities OAuth integration flow and backend token validation approach
* Security, observability, and local-dev parity requirements to bake into scaffold prompt

## Findings Log

* Use a server-authoritative Colyseus layout with thin Room classes and domain/command modules for simulation logic.
* Add PostgreSQL with migration-first workflow and pooled connections; avoid persistence calls in latency-sensitive room loops.
* Target Azure Container Apps with WebSocket-capable ingress, health probes, secret references, and revision-based rollout.
* Enforce OAuth/OIDC with Entra External Identities using authorization code flow and strict JWT validation in both HTTP routes and room join auth.
* Include strong guardrails in the prompt: typed env loader, no plaintext secrets, deterministic migrations, and graceful shutdown hooks.
* Define non-optional acceptance criteria for build/test/deploy readiness and security posture.

## Open Issues

* Confirm whether the first scaffold version should include Redis Presence/Driver for horizontal scale.
* Confirm multi-tenant versus single-tenant token validation defaults for Entra External Identities.
* Confirm whether Dapr sidecar integration is in or out of scope for initial Azure Container Apps deployment.

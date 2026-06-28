# RedfireForge Roadmap (Living)

> Last Updated: 2026-06-28
> Purpose: Product direction and active priorities only.

## Product Position

RedfireForge is a visual API testing and workflow automation workbench combining:
- Visual workflow design
- API execution and validation
- Load testing
- Results/debug exploration
- Catalog-driven test generation

## Current State Snapshot

### Stable/Delivered
- Workflow designer and execution engine foundation
- Results explorer and debug console patterns
- Validation and assertion system
- Data-driven testing flows
- API catalog core functionality
- Kafka integration foundation and modularized service layer
- Rust executor path and performance-oriented execution modes
- **Dual-track builds (Standard vs Learning Hub):** `VITE_ENABLE_DEMO_HUB` feature flag, separate vitest product/demo projects, **`@redfireforge/demo-hub`** npm workspace package (`packages/demo-hub/`), lazy `DemoShellHost`, dual Tauri bundle IDs (`com.redfireforge.desktop` / `.demo`)
- **GraphQL Studio:** batch execution with per-tab response sync, batch results modal, SDL schema diff, collections runner/import preview, multi-tab workspace, mock server, and IndexedDB-backed tabs/auth/schema cache (DB v9)
- **GraphQL Demo Hub:** 19 interactive lessons (GQL-1–GQL-19) — Phase 8 human validation **19/19** (Web + Tauri, 2026-06-27); Lesson Notes panel; Docker-backed E2E smoke specs; §11.0 workspace isolation (`gql110` 5/5)

### In Progress / Deferred
- Distributed execution (future scale milestone)
- Remaining selective E2E coverage for environment-dependent scenarios
- Ongoing UX and maintainability refinements
- **Optional:** publish `@redfireforge/demo-hub` to public npm (monorepo extraction ✅ 2026-06-26; package remains `"private": true`)

## Priority Tracks

### Track A: Reliability and Maintainability
- Keep test and typecheck gates strict.
- Continue reducing local complexity in touched areas.
- Consolidate duplicated patterns into shared abstractions.

### Track B: Execution Scale
- Prepare architecture for distributed/multi-instance execution.
- Improve observability for long-running and high-volume runs.

### Track C: Developer Experience
- Improve onboarding docs and compact planning artifacts.
- Keep sample workflows and lessons aligned with current UI.
- Expand high-value CI-friendly reporting paths.

## Next Major Milestones

1. Distributed execution planning and prototype slice.
2. Targeted environment-backed E2E stabilization for deferred specs.
3. Continued modernization of high-churn UI modules with shared patterns.

## Release Gate Checklist

Before major milestone completion:
- `npx tsc -b --noEmit` passes
- Relevant unit/integration tests pass
- Relevant E2E subset passes with visible reporter output
- Docs for changed behavior are updated

## Archive Policy

This roadmap is intentionally compact.
Detailed competitive analysis, historical completion logs, and long-form phase narratives were removed to minimize token overhead.
Use git history for historical context.

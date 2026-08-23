# RedfireForge Roadmap (Living)

> Last Updated: 2026-08-22
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
- API catalog core functionality (incl. **Convert / Upgrade to OpenAPI YAML**: Swagger 2.0 → 3.0/3.1 (dual-engine swagger2openapi/Scalar) and OpenAPI 3.0/3.1 → 3.1/3.2 upgrades, validation gate + auto-fallback, advisory deep lint, download or save-as-version)
- Kafka integration foundation and modularized service layer
- Rust executor path and performance-oriented execution modes
- **Dual-track builds (Standard vs Learning Hub):** `VITE_ENABLE_DEMO_HUB` feature flag, separate vitest product/demo projects, **`@redfireforge/demo-hub`** npm workspace package (`packages/demo-hub/`), lazy `DemoShellHost`, dual Tauri bundle IDs (`com.redfireforge.desktop` / `.demo`)
- **GraphQL Studio:** batch execution with per-tab response sync, batch results modal, SDL schema diff, collections runner/import preview, multi-tab workspace, mock server, and IndexedDB-backed tabs/auth/schema cache (DB v9)
- **GraphQL Demo Hub:** 19 interactive lessons (GQL-1–GQL-19) — Phase 8 human validation **19/19** (Web + Tauri, 2026-06-27); Lesson Notes panel; Docker-backed E2E smoke specs; §11.0 workspace isolation (`gql110` 5/5)
- **gRPC Demo Hub:** 16 shipped lessons (GRPC-1–GRPC-24) including Workflow Runner & Results (GRPC-24), load testing (GRPC-12), workflow integration (GRPC-11), and advanced Studio panels; lesson helpers split under 900-line monolith limit with scoped helper unit tests

### In Progress / Deferred
- Distributed execution (future scale milestone)
- ~~Remaining selective E2E coverage for environment-dependent scenarios~~ **✅ Complete 2026-08-22 — full E2E suite passes across all ~130 specs**
- Ongoing UX and maintainability refinements
- **Optional:** publish `@redfireforge/demo-hub` to public npm (monorepo extraction ✅ 2026-06-26; package remains `"private": true`)

### Deferred Feature Work (planned but not yet implemented)
- **Demo Hub — CLI domain** (`cliDomain`): interactive guided CLI lessons (WF-style terminal surface, `DemoTerminal` component, `terminalCommand`/`terminalOutput` step fields). Full plan: `docs/future/cli/cli-demo-plan.md`
- **Demo Hub — Workflow domain** (`workflowDomain`): WF-1 through WF-8 general-purpose workflow curriculum (HTTP workflows, control flow, variables, debugging, versioning). `workflowDomain` is registered but has zero lessons. Full plan: `docs/future/demo-lesson/workflow-demo-lesson.md`
- **Demo Hub — Test Harness domain** (`harnessDomain`): TH-1 through TH-9 lessons (Feature Group authoring, validation, Test Runner, Parameterized Runner, load profiles, results analysis). `harnessDomain` is registered but has zero lessons. Full plan: `docs/future/demo-lesson/test-harness-demo-lesson.md`
- **Demo Hub — Catalog v2 lessons**: redesign of CAT-1 through CAT-4 to cover Re-import/Update, Version History/Compare/Restore, Auth panel, and full Export to Requests walkthrough. Full plan: `docs/future/demo-lesson/catalog-demo-lesson.md`
- **Demo Hub — Requests v2 lessons**: extended coverage per `docs/future/demo-lesson/request-demo-lessons-v2.md`
- **Source restructuring** (full repository-wide directory migration): deferred until no active release-critical work in flight. Incremental moves only for now. See `RESTRUCTURING_PLAN.md`

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
2. ~~Targeted environment-backed E2E stabilization for deferred specs.~~ **✅ Complete 2026-08-22**
3. Continued modernization of high-churn UI modules with shared patterns.
4. Demo Hub domain expansion: Workflow (WF-1–8), Test Harness (TH-1–9), CLI lessons — see Deferred Feature Work above.

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

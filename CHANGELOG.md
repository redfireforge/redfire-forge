# Changelog (Active)

This is the lightweight active changelog.

For full historical entries, see:
- CHANGELOG.archive.md

Format follows Keep a Changelog and Semantic Versioning.

---

## [Unreleased]

### Added
- **gRPC Studio planning document** — expanded architecture and phase plan in `docs/plan/future/grpc/grpc-studio-plan.md`.
- **`useDemoHub.coverage-resume.test.ts`** — isolated live-demo resume/session coverage tests (module-mock safe).
- **`@redfireforge/demo-hub` workspace package** (`packages/demo-hub/`): Phase 7 monorepo extraction — lessons, hub UI, adapters; separate Vitest demo project; optional public npm publish deferred.
- **Demo adapter layer** (`packages/demo-hub/`): stable bridge API for GraphQL Studio, workflow designer, environment, and app shell — lessons no longer import product hooks directly.
- **Lesson Notes panel** in Demo Hub: per-lesson scratch notes with resizable side panel and persistent storage.
- Environment Manager multi-protocol endpoint panels (GraphQL, WebSocket, SSE, Kafka).
- GraphQL Demo Hub lessons (GQL-1 through GQL-19): queries, mutations, subscriptions, batch execution, TLS, multi-tab, mock server, workflow integration, and related E2E specs.
- **§11.0 hard-refresh policy** for GraphQL demo workspace isolation — documented in `e2e/DEMO-LESSON-E2E-MEMO.md` §12; acceptance E2E 5/5 (`gql110`).
- **GQL-17/19 quality audit** — automated enhancement-tier gate in `graphql-lesson-quality-audit.test.ts` (14/14).
- **GraphQL Studio batch response UX:** per-tab response slices synced from batch runs, response banner with batch context, failed-operation pill, and **View full batch** modal entry point.
- GraphQL Studio SDL line diff viewer with golden test cases, collection import preview, profile tab-usage indicators, and schema cache in IndexedDB (v9 stores).
- GraphQL Studio batch execution UI, advanced settings, schema layer hooks, and live-demo overlay.
- Shared selector modules (`gql`, `ws`, etc.) extracted from monolithic `selectors.ts`.

### Changed
- GraphQL demo workspace mutators (`prepareDemoWorkspace`, `closeDemoWorkspace`, etc.) no-op when `VITE_ENABLE_DEMO_HUB=false`.
- GraphQL Studio page and App shell refactored to stay under 900-line monolith limit.
- Demo Player prerequisite gate supports multi-endpoint Docker checks and GraphQL tab-budget gating.
- **Phase 8 human validation complete** — all 19 GraphQL Demo Hub lessons signed off Web + Tauri (2026-06-27).
- **Web storage:** large array blobs (catalog, workflows, environments, GraphQL Studio tabs/auth/schema) use IndexedDB only on save — no localStorage fallback for oversized payloads; empty legacy arrays are cleared without migration.
- Unit test coverage raised to >90% on every source file (statements, branches, functions, lines).

### Fixed
- **Demo Hub coverage gate:** remaining lesson helpers and `useDemoHub.ts` brought to ≥90% on all metrics; targeted coverage-gaps tests (no full lesson walks).
- **`useDemoHub` auto-play pause:** `toggleAutoPlay` now pauses via `isPlayingRef` so `pauseAutoPlay()` runs reliably when stopping playback.
- PrerequisiteGate infinite re-render loop (`probeEndpoints` memoization).
- GraphQL endpoint badge hostname display (localhost vs 127.0.0.1).
- Whitespace-only per-tab GraphQL endpoints now inherit profile/page default (batch endpoint parity).
- GQL-15 batch demo lesson: history panel hidden on step 1, step 3 tab-add flow, step 9 highlights batch modal on partial errors.
- Monaco/vitest test environment polyfills, IDB/storage test mocks, and assorted GraphQL route/TLS handler edge cases.

---

## Recent Release Highlights

### 0.6.x
- Major workflow, testing, and platform reliability improvements.
- Kafka and protocol feature depth expanded.
- Coverage, type safety, and E2E stability improvements.

### 0.5.x
- Data Mapper, validation, and results explorer refinements.
- Workflow UX and storage reliability improvements.

> Historical details and exhaustive release notes were moved to `CHANGELOG.archive.md` to reduce documentation token overhead.

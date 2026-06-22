# Changelog (Active)

This is the lightweight active changelog.

For full historical entries, see:
- CHANGELOG.archive.md

Format follows Keep a Changelog and Semantic Versioning.

---

## [Unreleased]

### Added
- Environment Manager multi-protocol endpoint panels (GraphQL, WebSocket, SSE, Kafka).
- GraphQL Demo Hub lessons (GQL-1 through GQL-19): queries, mutations, subscriptions, batch execution, TLS, multi-tab, mock server, workflow integration, and related E2E specs.
- GraphQL Studio batch execution UI, advanced settings, schema layer hooks, and live-demo overlay.
- Shared selector modules (`gql`, `ws`, etc.) extracted from monolithic `selectors.ts`.

### Changed
- GraphQL Studio page and App shell refactored to stay under 900-line monolith limit.
- Demo Player prerequisite gate supports multi-endpoint Docker checks and GraphQL tab-budget gating.
- Unit test coverage raised to >90% on every source file (statements, branches, functions, lines).

### Fixed
- PrerequisiteGate infinite re-render loop (`probeEndpoints` memoization).
- GraphQL endpoint badge hostname display (localhost vs 127.0.0.1).
- Monaco/vitest test environment polyfills and assorted GraphQL route/TLS handler edge cases.

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

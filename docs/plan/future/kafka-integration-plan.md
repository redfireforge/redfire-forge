# Kafka Integration Plan — Re-evaluated Phase Blueprint

> Objective: add Kafka as a first-class capability across runner, workflow, and observability while preserving current product stability.
> Created: 2026-05-21
> Re-evaluated: 2026-05-29
> Status: Future plan (not started)

---

## 1. Re-evaluation Summary

Execution tracker: docs/plan/future/kafka-integration-tracker.md

This re-evaluation changes the previous approach in four important ways:

1. Scope is split into strict vertical phases with hard exit gates. No UI-first or broad parallel implementation.
2. Transport foundation comes first (server + typed client + lifecycle), then workflow and runner features.
3. Load behavior for Kafka consume is explicitly constrained to avoid non-deterministic load tests.
4. Result observability and CI guidance are treated as product requirements, not post-implementation polish.

Primary risks identified:

- Consumer lifecycle leaks (stuck consumers, stale subscriptions, orphaned group IDs).
- Unbounded memory in streaming subscriptions.
- Flaky behavior in load mode if real-topic consumption is used naively.
- UX complexity (cluster config + auth + topic browsing + node config) causing operator errors.

Guiding constraints:

- Keep existing HTTP and workflow behavior unchanged unless behind explicit Kafka paths.
- Match existing architecture patterns (platform-aware transport, server proxy in dev/browser, Tauri-native path later).
- Every phase must ship with deterministic tests and a rollback-safe integration boundary.

---

## 2. Target Capabilities

Kafka support should cover five product outcomes:

1. Kafka as test target (produce/consume from runner context).
2. Kafka workflow nodes (Kafka Produce, Kafka Consume).
3. Kafka-triggered workflow start and Kafka-based wait/correlation resume.
4. Optional publishing of run summaries to Kafka topics.
5. Stable operations: connection management, auth/SSL, status visibility, and diagnostics.

Non-goals for initial rollout:

- Exactly-once semantics guarantees.
- Cross-cluster replication management.
- Full schema registry UX (deferred to advanced phase).

---

## 3. Delivery Strategy

Implementation is organized into 9 phases. Each phase includes:

- Scope and deliverables
- Detailed implementation plan
- Test plan
- Risks and mitigations
- Exit criteria

Recommended branch strategy:

- One feature branch per phase or per two tightly coupled phases.
- No multi-phase mega-PRs.

---

## Phase 1 — Kafka Core Transport Foundation

Estimated effort: 3-4 days
Dependencies: none

### Scope

Build reliable server-side Kafka service primitives and typed request/response contracts.

### Deliverables

- Kafka type contracts for connection, produce, consume, filter, subscription metadata.
- Kafka service module with:
  - connect/disconnect lifecycle
  - topic listing and basic cluster info
  - produce
  - one-shot consume
  - subscription create/list/unsubscribe
- Express routes under /api/kafka/*.
- Build script updates for runtime dependency bundling.

### Detailed plan

1. Add runtime dependency for Kafka client (kafkajs).
2. Introduce kafka-types module with strict interfaces and defaults.
3. Implement kafka-service singleton with defensive lifecycle management:
   - idempotent connect/disconnect
   - explicit service state
   - subscription registry map with abort/stop hooks
4. Implement route layer with consistent success/error envelopes and log integration.
5. Add timeout guards to all long-running operations.

### Test plan

- Unit test kafka-service with full kafkajs mocks.
- Route tests for each endpoint and all negative paths.
- Lifecycle tests for repeated connect/disconnect and orphan cleanup.

### Risks and mitigations

- Risk: leaked consumers in failed subscribe paths.
- Mitigation: central subscription registry + finally cleanup in all route flows.

### Exit criteria

- All /api/kafka/* routes pass tests.
- No open consumer handles after disconnect in tests.
- TypeScript and lint pass.

---

## Phase 2 — Client Transport + App-level Kafka State

Estimated effort: 2-3 days
Dependencies: Phase 1

### Scope

Create platform-aware kafka client transport and centralized frontend state for connection/status.

### Deliverables

- kafkaClient transport utility with operation dispatcher.
- App-level state for Kafka connectivity and topics.
- Storage persistence for Kafka cluster configs.
- Basic connection status model (connected/disconnected/testing/error).

### Detailed plan

1. Implement kafkaOp dispatcher with override hook (matching existing transport patterns).
2. Default browser/dev path uses /api/kafka/* proxy.
3. Add storage utilities for Kafka cluster configuration.
4. Wire state initialization in app startup and persistence on update.
5. Add connection status poll strategy with backoff.

### Test plan

- kafkaClient selection/routing tests.
- Storage load/save/migration tests.
- App state tests for init, reconnect, and error state transitions.

### Risks and mitigations

- Risk: polling can spam server or hide stale state.
- Mitigation: adaptive polling and event-triggered refresh after mutating operations.

### Exit criteria

- Stable status updates in UI state tests.
- No unhandled promise rejections in client transport tests.

---

## Phase 3 — Kafka Settings UX (Cluster Management)

Estimated effort: 3-4 days
Dependencies: Phase 2

### Scope

Provide full cluster configuration and connectivity management UX.

### Deliverables

- Kafka settings page and tab registration.
- Cluster list + editor (add/edit/delete).
- Auth options (none/plain/scram).
- SSL options and validation.
- Topic browser panel after successful connection.
- Header connection indicator.

### Detailed plan

1. Add settings tab and route integration.
2. Build editor with broker list controls and schema validation.
3. Add test connection action and status badge updates.
4. Add topic browse/search with loading/error/empty states.
5. Add auto-connect option and startup behavior.

### Test plan

- Component tests for editor validation and actions.
- Integration tests for connect/test/save flows.
- Accessibility checks for form errors and status announcements.

### Risks and mitigations

- Risk: invalid config combinations create confusing failures.
- Mitigation: pre-submit validation and targeted error mapping from server errors.

### Exit criteria

- User can configure, test, and save multiple clusters reliably.
- Topic browser works for connected clusters.

---

## Phase 4 — Workflow Node Model and Execution Hooks

Estimated effort: 4-5 days
Dependencies: Phase 3

### Scope

Introduce Kafka Produce and Kafka Consume as workflow nodes with typed config and execution integration.

### Deliverables

- Workflow node type additions (kafkaProduce, kafkaConsume).
- Default node data and node factory integration.
- Node UI components and config panels.
- Workflow executor support paths for both nodes.

### Detailed plan

1. Extend workflow type unions and node data contracts.
2. Implement default data and migration safety for older workflows.
3. Build node visuals and property editors.
4. Implement executor branches:
   - kafkaProduce: interpolate variables, send, capture metadata.
   - kafkaConsume: consume with timeout/filter and extract variables.
5. Add structured execution log entries for Kafka node events.

### Test plan

- Type-level and factory tests for node defaults.
- Executor tests for success/failure/timeout/filter/extraction paths.
- Workflow integration tests combining Kafka + HTTP nodes.

### Risks and mitigations

- Risk: variable extraction from malformed payloads.
- Mitigation: safe parse + explicit extraction failure results with actionable messages.

### Exit criteria

- Kafka nodes execute in workflow engine with deterministic behavior.
- Existing non-Kafka workflows remain unaffected.

---

## Phase 5 — Workflow Trigger and Wait Semantics (Kafka-driven)

Estimated effort: 4-6 days
Dependencies: Phase 4

### Scope

Enable Kafka as trigger input and as correlation wait-resume source.

### Deliverables

- Kafka Trigger workflow start capability.
- KafkaWait behavior for pause and resume on match.
- Correlation matching strategy (key/header/jsonpath).
- Timeout and cancellation semantics.

### Detailed plan

1. Add trigger contract for payload-to-variable seeding.
2. Implement subscription-driven workflow invocation boundary with backpressure limits.
3. Add KafkaWait node behavior in runtime controller.
4. Define and implement match precedence and tie-breaking rules.
5. Add observability for wait state transitions (waiting/matched/timed-out/cancelled).

### Test plan

- Trigger integration tests with seeded variable assertions.
- Wait/resume tests for match/no-match/timeout/race conditions.
- Recovery tests for restart/disconnect while waiting.

### Risks and mitigations

- Risk: duplicate resume events due to rebalance/replay behavior.
- Mitigation: idempotency token per wait state and consume offset guard.

### Exit criteria

- End-to-end trigger and wait flows pass deterministically in tests.
- Timeout and cancellation produce predictable outcomes.

---

## Phase 6 — Runner Kafka Scenarios (Produce/Consume as Test Actions)

Estimated effort: 5-7 days
Dependencies: Phase 4

### Scope

Support Kafka operations in test runner scenarios and result model.

### Deliverables

- Scenario model extension for kafkaProduce and kafkaConsume test actions.
- Runner execution support (standard and parameterized modes).
- Result model extensions for Kafka metadata and assertion outcomes.

### Detailed plan

1. Extend scenario schema and migration paths.
2. Implement execution logic in runner orchestration.
3. Add assertion support for message metadata/body checks.
4. Map Kafka action results into existing summary metrics where compatible.
5. Add explicit non-HTTP result visualization in results UI.

### Test plan

- Runner unit tests for kafka action scenarios.
- Parameterized data-driven tests with Kafka templating.
- Result rendering tests in dashboard and detail views.

### Risks and mitigations

- Risk: metric confusion (latency semantics differ from HTTP).
- Mitigation: separate metric labels and clear result typing in UI.

### Exit criteria

- Kafka runner actions are executable and reportable.
- Mixed suites (HTTP + Kafka) run without type or rendering regressions.

---

## Phase 7 — Load-mode Policy for Kafka Consume

Estimated effort: 3-4 days
Dependencies: Phase 6

### Scope

Define and enforce deterministic behavior of Kafka consume under load.

### Deliverables

- Explicit load behavior modes:
  - consume-real
  - synthetic-message
  - skip
- Guardrails and UX warnings for unsafe load configs.
- Aggregated load metrics compatibility for non-HTTP actions.

### Detailed plan

1. Implement load behavior mode handling in execution planner.
2. Add UI controls with default-safe mode policy.
3. Add warnings for unbounded or nondeterministic setups.
4. Document operational recommendations by mode.

### Test plan

- Planner tests for each load mode.
- Load-run simulation tests for deterministic completion.
- Regression tests for existing load profile behavior.

### Risks and mitigations

- Risk: real consume mode causes flaky throughput tests.
- Mitigation: default to synthetic-message for load unless explicitly overridden.

### Exit criteria

- Load runs are stable and reproducible across repeated executions.
- Unsafe configurations are visibly flagged before run start.

---

## Phase 8 — Results Publishing to Kafka

Estimated effort: 2-3 days
Dependencies: Phase 6

### Scope

Publish summarized test/workflow results to configurable Kafka topic.

### Deliverables

- Optional results publishing toggle in Kafka config.
- Standardized results envelope for publishing.
- Retry and failure reporting policy.

### Detailed plan

1. Define publish payload schema and version field.
2. Hook publish after run completion path.
3. Add failure policy (log-only by default; optional fail-run mode later).
4. Add traceability fields (runId/project/env/suite/type).

### Test plan

- Payload schema tests.
- Publish retry tests.
- Failure behavior tests (publish unavailable).

### Risks and mitigations

- Risk: publish failures pollute primary execution path.
- Mitigation: non-blocking default mode with explicit opt-in strict mode later.

### Exit criteria

- Result summaries publish successfully when enabled.
- Core run completion behavior remains stable when publish fails.

---

## Phase 9 — Tauri-native Kafka Transport (rdkafka)

Estimated effort: 5-8 days
Dependencies: Phases 1-8 stable in server-proxy mode

### Scope

Add native Kafka path for desktop mode to reduce proxy dependency and improve performance.

### Deliverables

- Tauri commands for connect/produce/consume/subscribe operations.
- Rust-side Kafka lifecycle manager with parity to server behavior.
- Frontend transport switch for Tauri environment.

### Detailed plan

1. Introduce rdkafka in Tauri workspace.
2. Implement rust command handlers mirroring server contracts.
3. Add transport routing and compatibility tests.
4. Keep server-proxy path as fallback for parity validation.

### Test plan

- Rust command tests for lifecycle and operations.
- Frontend transport fallback tests.
- Cross-transport parity tests (same request -> equivalent response shape).

### Risks and mitigations

- Risk: behavior drift between kafkajs and rdkafka.
- Mitigation: contract tests against shared golden fixtures.

### Exit criteria

- Desktop uses native transport successfully.
- Contract parity across transports proven in tests.

---

## Optional Phase 10 — Schema Registry and Advanced Payload UX

Estimated effort: 4-6 days
Dependencies: Phase 6+

### Scope

Add optional Avro/Protobuf schema registry integration and payload tooling.

### Deliverables

- Schema registry connection config.
- Encode/decode helpers in produce/consume paths.
- UI affordances for schema subject/version selection.

### Test plan

- Contract tests with schema registry mocks.
- Encode/decode correctness tests.

### Exit criteria

- Schema-aware publish/consume works with explicit opt-in.

---

## 4. Cross-phase Quality Gates

Each phase must satisfy all gates before advancing:

1. Type safety: npx tsc -b --noEmit
2. Unit/integration tests for touched files pass
3. No lint regressions in touched areas
4. Backward compatibility verified for non-Kafka features
5. Plan/docs updated for any design drift

---

## 5. Rollout Plan

Recommended release slices:

- Release A: Phases 1-3 (foundation + settings)
- Release B: Phases 4-5 (workflow node execution + trigger/wait)
- Release C: Phases 6-8 (runner + load policy + result publishing)
- Release D: Phase 9 (Tauri-native transport)

Feature flag recommendation:

- kafka.enabled global flag for early rollout.
- Separate sub-flags for trigger/wait and runner mode if needed.

---

## 6. Open Questions to Resolve Before Implementation

1. Should Kafka consume default to latest offset always, or be user-selectable in all contexts?
2. What is the long-term canonical result schema for non-HTTP actions in comparisons/trends?
3. Do we need per-project Kafka cluster scoping or global app-level clusters only?
4. Should results publishing failures ever fail a test run in CI contexts?
5. How strict should PII handling be for payload logging in debug mode?

---

## 7. Definition of Done (Full Kafka Initiative)

Kafka integration is considered complete when:

1. Kafka clusters can be configured, tested, and monitored from settings.
2. Kafka Produce and Kafka Consume nodes are usable in workflows with variable extraction.
3. Kafka can trigger workflows and resume KafkaWait states reliably.
4. Runner supports Kafka actions and reports results clearly.
5. Load-mode behavior for consume is deterministic and documented.
6. Optional result publishing to Kafka works with safe defaults.
7. Desktop native transport is available with parity tests.
8. Documentation and training materials exist for all user-facing Kafka capabilities.

# Kafka Integration Plan — Re-evaluated Phase Blueprint

> Objective: add Kafka as a first-class capability across runner, workflow, and observability while preserving current product stability.
> Created: 2026-05-21
> Re-evaluated: 2026-05-31
> Discussion sync updated: 2026-05-31
> Status: In progress (Phase 1 closeout complete; Phase 2A transport abstraction complete; Phase 2B state/persistence baseline complete; Phase 2C refresh/resilience complete; Phase 3A navigation/settings shell complete; Phase 3B cluster list/editor foundation complete; Phase 3C secure auth/TLS diagnostics complete; Phase 3D topic browser/startup restoration implemented; Phase 3 AppHeader connection indicator complete; Phase 4A workflow contracts/defaults complete; Phase 4B node UI/config editing complete; Phase 4C executor integration complete; Phase 4D logging/observability complete; Phase 5 Trigger+Wait Semantics complete; Phase 6A-6D Runner Kafka Scenarios complete; Phase 7A Load behavior model complete; Phase 7B Planner/runtime enforcement complete; Phase 7C UX/operational guidance complete; Phase 7 Advanced Validation complete (deterministic sim + constant-arrival gating + variance checks); Phase 8A Publish contract/settings complete; Phase 8B Publish-on-completion runtime complete; Phase 8C Publish validation complete — unit tests + broker-level scenarios all PASS)

---

## 1. Re-evaluation Summary

Execution tracker: docs/plan/future/kafka/integration-tracker.md
Execution test plan: docs/plan/future/kafka/integration-test-plan.md
Local development guide: docs/guides/kafka-local-dev.md

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
- Keep Kafka UX scoped to RedfireForge's product reality: a developer/testing workbench, not a full enterprise Kafka governance console.
- Kafka features are not considered complete until they are exercised through the actual UI against a real broker, not only unit mocks.

UI mockups:

- docs/mockups/kafka-cluster-studio.html
- docs/mockups/kafka-topic-explorer.html
- docs/mockups/kafka-message-studio.html
- docs/mockups/kafka-workflow-integration.html

Validation reference:

- docs/plan/future/kafka/integration-test-plan.md
- docs/guides/kafka-local-dev.md

Discussion outcomes captured in this revision:

- The four HTML mockups are the current UX reference set for early Kafka surface design.
- Visual validation is required for settings, topic browsing, publish/consume, and workflow Kafka flows.
- Local testing should use a real Kafka-compatible broker with seeded topics/messages before any staging rollout.
- Secure-cluster validation must be treated as a first-class gate, not a post-merge follow-up.

## 1.1 Executive Phase Overview

Use this section as the fast read for Kafka delivery order.

| Phase | Name | Primary outcome | Key dependencies |
|---|---|---|---|
| 1 | Core Transport Foundation | Server-side Kafka contracts, lifecycle, routes, and local plaintext Docker broker bootstrap | None |
| 2 | Client Transport + App State | Frontend transport, persisted cluster configs, and stable connection state | Phase 1 |
| 3 | Settings UX | Cluster management, auth/TLS setup, topic browsing, header status, secure Docker validation | Phase 2 |
| 4 | Workflow Kafka Nodes | Kafka Produce and Kafka Consume workflow nodes plus executor integration | Phase 3 |
| 5 | Trigger + Wait Semantics | Kafka-triggered workflow start and KafkaWait correlation/resume behavior | Phase 4 |
| 6 | Runner Kafka Scenarios | Kafka as a test runner target with parameterization and results rendering | Phase 4 |
| 7 | Load-mode Policy | Deterministic Kafka consume behavior in load scenarios | Phase 6 |
| 8 | Results Publishing | Optional publishing of run summaries to Kafka topics | Phase 6 |
| 9 | Tauri-native Transport | Native desktop Kafka transport with contract parity to server-proxy mode | Phases 1-8 stable |

Recommended milestone grouping:

1. Foundation milestone: Phases 1-3
2. Workflow milestone: Phases 4-5
3. Runner and reporting milestone: Phases 6-8
4. Desktop parity milestone: Phase 9

Recommended implementation order:

1. Build the transport and Docker-backed local environment first.
2. Build the settings UX with real broker validation before any workflow UX ships.
3. Add workflow nodes before trigger/wait semantics.
4. Add runner support only after workflow execution is already stable.
5. Add results publishing and load-policy constraints after Kafka is already a stable execution surface.
6. Add native desktop transport only after server-proxy mode is proven.

Tracking guidance:

- Use docs/plan/future/kafka/integration-tracker.md for weekly execution checklists.
- Use docs/plan/future/kafka/integration-test-plan.md for validation scope and real-broker test strategy.
- Use docs/guides/kafka-local-dev.md for Docker bootstrap, seeded topics, and security test setup.

## 1.2 Competitor Feature Benchmark (Roadmap-Aligned)

Primary competitor baseline in this repository comes from ROADMAP.md:

- k6, Gatling, Locust, Artillery, JMeter, Bruno, Hoppscotch, Postman (plus n8n where relevant for workflow positioning)

Because most of these are not Kafka-native operations consoles, this section is split into two views:

1. Roadmap baseline competitors (strategic product positioning)
2. Kafka-native tool references (feature-depth calibration)

Capability scale used in this section:

- None: feature not materially present
- Basic: feature exists for simple use
- Strong: feature is robust for day-to-day usage
- Enterprise: feature includes governance, policy, and deep operational controls

### A. Roadmap baseline competitors (strategic)

| Tool | Kafka cluster UX | Topic browse/search | Publish/consume UX | Security setup UX | Workflow trigger/wait equivalent | Runner-native Kafka test actions |
|---|---|---|---|---|---|---|
| k6 | None | None | None | None | None | Basic via scripting/extension patterns |
| Gatling | None | None | None | None | None | Basic via code-level integrations |
| Locust | None | None | None | None | None | Basic via Python custom code |
| Artillery | None | None | None | None | None | Basic via config/plugins |
| JMeter | Basic (plugin/ecosystem driven) | Basic | Basic | Basic | None | Basic-to-Strong (script/plugin heavy) |
| Bruno | None | None | None | None | None | None |
| Hoppscotch | None | None | None | None | None | None |
| Postman | Basic (integration/collection ecosystem) | Basic | Basic | Basic | Basic flows (not Kafka-native) | Basic (collection scripting) |
| n8n | Basic (via connectors/custom nodes) | Basic | Basic | Basic | Strong workflow model, not Kafka-ops-focused | None-to-Basic |

Interpretation for RedfireForge:

1. Most roadmap competitors are strong in HTTP and generic API testing, but weak as Kafka operations workbenches.
2. This creates space for RedfireForge to provide Kafka as a first-class workflow and runner surface, not only as raw protocol integration.
3. JMeter/Postman/n8n are partial references for interaction patterns, not direct Kafka-console feature parity targets.

### B. Kafka-native references (feature depth)

Reference tools:

- AKHQ, Kafka UI (Provectus), Kafdrop, Redpanda Console, Conduktor, Offset Explorer

| Capability | AKHQ | Kafka UI (Provectus) | Kafdrop | Redpanda Console | Conduktor | Offset Explorer |
|---|---|---|---|---|---|---|
| Multi-cluster management | Strong | Strong | Basic | Strong | Enterprise | Basic |
| Cluster security setup (SASL/TLS) | Strong | Strong | Strong | Strong | Enterprise | Strong |
| UI auth/SSO/RBAC | Strong | Strong | Basic (proxy pattern) | Strong | Enterprise | Basic |
| Topic browsing and search/filter | Strong | Strong | Strong | Strong | Strong | Strong |
| Publish messages | Strong | Strong | Basic-to-Strong | Strong | Strong | Strong |
| Consume/replay/debug workflows | Strong | Strong | Basic | Strong | Enterprise | Strong |
| Consumer lag and offset visibility | Strong | Strong | Strong | Strong | Strong | Strong |
| Schema registry support | Strong | Strong | Strong | Strong | Strong | Basic-to-Strong |
| ACL and access-control operations | Strong | Basic-to-Strong | Basic | Strong | Enterprise | Basic |
| Connect/connectors management | Basic-to-Strong | Strong | Basic | Strong | Strong | Basic |
| Governance features (masking, audit, policy) | Basic-to-Strong | Strong | None-to-Basic | Strong | Enterprise | Basic |

Feature implications for RedfireForge scope:

1. Baseline parity target (must-have): secure cluster setup, topic search/list/detail, publish, bounded consume/debug, consumer lag visibility.
2. Near-term differentiator: workflow-native Kafka Trigger and KafkaWait integration, plus test-runner-native Kafka actions.
3. Explicit non-goal for initial rollout: enterprise governance parity (full policy engine, large-scale tenancy governance, chargeback, deep compliance automation).
4. Practical quality bar: match strong developer workflow depth from leading OSS Kafka tools while staying intentionally narrower than enterprise control-plane products.

Source links reviewed during this benchmark:

- ROADMAP.md
- https://akhq.io/docs/
- https://github.com/provectus/kafka-ui
- https://github.com/obsidiandynamics/kafdrop
- https://docs.redpanda.com/current/console/
- https://www.conduktor.io/
- https://www.kafkatool.com/

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
- Enterprise governance surfaces such as ACL administration, RBAC dashboards, chargeback, and multi-tenant policy management.

## 2.1 UI/UX Direction

Kafka should be presented as four developer-facing surfaces:

1. Cluster Studio — connection setup, security, connection test, topic preview.
2. Topic Explorer — topic search, topic health, message inspection with bounded filters.
3. Message Studio — publish and consume workflows for debugging and test preparation.
4. Workflow Integration — Kafka trigger, Kafka wait, Kafka produce, and payload-to-variable mapping.

The product should explicitly avoid feeling like a platform admin console in its first iterations. The UX should prioritize:

- fast cluster switching
- explicit security setup
- bounded message browsing
- workflow/test integration
- reusable publish/consume templates

The current reference artifacts map directly to planned product surfaces:

- Cluster Studio mockup -> Phase 3 settings and connection management UX
- Topic Explorer mockup -> Phase 3 topic browse/detail UX and later troubleshooting flows
- Message Studio mockup -> Phase 4 and Phase 6 publish/consume UX for workflow and runner use cases
- Workflow Integration mockup -> Phase 4 and Phase 5 workflow-node, trigger, and wait experiences

## 2.2 Validation Strategy Summary

Kafka delivery must be validated in four layers:

1. Unit tests for contracts, state transitions, mappings, and validation logic.
2. Real-broker integration tests for connect, topic browse, produce, consume, subscribe, trigger, wait, and publish-summary behavior.
3. Visual browser tests for the actual user journeys represented in the mockups.
4. Secure staging-cluster validation for auth, SSL, multi-broker behavior, and operational error handling.

Required local validation environments:

- Local plaintext broker environment for fast day-to-day integration checks.
- Local secure broker environment for auth and SSL UX/error validation.
- Shared staging cluster for final pre-merge or pre-release validation of Kafka slices.

## 2.3 Local Docker Integration Environment

Kafka implementation should ship with a concrete local Docker-based integration environment, not just abstract instructions.

Planned local environment shape:

- Default local stack: Redpanda in Docker for fast startup and lower operational overhead during day-to-day development.
- Compatibility option: Apache Kafka in Docker may be added later if protocol-specific parity issues appear, but the first supported local environment should stay single-vendor and simple.
- Browser/dev app path should talk to Kafka only through the server-side /api/kafka/* integration boundary.

Planned repository assets:

- docker/kafka/plaintext/docker-compose.yml
- docker/kafka/secure/docker-compose.yml
- docker/kafka/topics/create-topics.sh
- docker/kafka/topics/reset-topics.sh
- docker/kafka/topics/seed-messages.sh
- docs/guides/kafka-local-dev.md

Implementation note:

- docs/guides/kafka-local-dev.md is now the living guide for local Kafka bootstrap, seeded topics, security validation, and day-to-day developer workflow.

Planned local profiles:

1. Plaintext profile
  - single-node broker
  - seeded topics for routine UI, workflow, and runner testing
  - used by most local integration and Playwright scenarios
2. Secure profile
  - broker with SASL and TLS enabled
  - used for connection-form validation, auth/SSL regression testing, and certificate handling flows
3. Optional console helper
  - lightweight broker console or admin UI for manual inspection during development only
  - not a product dependency and not part of user-facing RedfireForge UX

Operational expectations for the Docker environment:

- one command to start plaintext environment
- one command to start secure environment
- one command to reseed/reset test topics and messages
- stable topic and message fixtures so Playwright and integration tests stay reproducible
- teardown command that leaves no stale broker state between runs

Initial seeded topic set:

- orders.created
- orders.updated
- orders.failed
- payments.authorized
- inventory.adjusted
- notifications.email
- redfireforge.workflow.input
- redfireforge.workflow.output
- redfireforge.results.summary
- redfireforge.debug.consume

## 2.4 Security Setup Plan

Kafka security support must be planned as a concrete delivery stream, not only as optional form fields.

Initial security scope:

- no-auth plaintext local profile for fast development
- SASL/PLAIN support
- SASL/SCRAM support
- SSL/TLS server verification
- optional client certificate/key inputs for clusters that require mutual TLS
- read-only cluster profile guidance for production-like browsing scenarios

Planned security handling rules:

- security values should be stored separately from casual UI display and masked in the editor where appropriate
- local secure development credentials may use checked-in sample env templates, but real secrets must come from ignored env files or OS/runtime secret storage
- certificate validation errors must map to readable UI states instead of generic request failures
- invalid combinations such as SSL enabled with missing CA material should fail local validation before connect
- test-connection responses must distinguish auth failure, network failure, TLS validation failure, and timeout

Planned secure-cluster validation matrix:

1. valid SASL/PLAIN credentials
2. valid SCRAM credentials
3. invalid username/password
4. TLS enabled with valid CA
5. TLS enabled with invalid or missing CA
6. read-only cluster connection that allows browse but blocks publish

Security rollout expectation by phase:

- Phase 1: server contracts and transport must already support auth and SSL request shapes
- Phase 3: settings UX must implement auth/SSL editing, validation, and readable error states
- Phase 4-6: workflow and runner operations must respect the selected secure cluster profile without special-case hacks
- Phase 8: results publishing must behave consistently on secure clusters

Initial seeded topic set should include at minimum:

- orders.created
- orders.updated
- orders.failed
- payments.authorized
- redfireforge.workflow.input
- redfireforge.workflow.output
- redfireforge.results.summary

Visual acceptance for Kafka work should verify:

- cluster status changes are visible and understandable
- topic browsing is backed by real topic metadata
- publish success surfaces real partition/offset metadata
- consume behavior is bounded and visibly filter-driven
- workflow run history clearly shows waiting, resumed, timeout, and failure states

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

Testing rollout rule:

- Each phase should ship its own real-broker validation slice and, when user-facing, at least one visual end-to-end Kafka scenario before the next phase begins.

Detailed execution rule:

- Each phase below is further split into sub-phases. These sub-phases are the intended implementation order and should be treated as the default PR and review boundaries unless a later implementation pass proves a tighter split is safer.

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
- Local Docker broker assets for plaintext development and seeded-topic integration testing.

### Detailed plan

1. Add runtime dependency for Kafka client (kafkajs).
2. Introduce kafka-types module with strict interfaces and defaults.
3. Implement kafka-service singleton with defensive lifecycle management:
   - idempotent connect/disconnect
   - explicit service state
   - subscription registry map with abort/stop hooks
4. Implement route layer with consistent success/error envelopes and log integration.
5. Add timeout guards to all long-running operations.
6. Add local Docker broker definition and topic seed/reset scripts for the plaintext integration environment.
7. Ensure connection contracts already carry auth/SSL fields even before the full settings UX is built.

### Sub-phases

#### Phase 1A - Contracts and dependency baseline

Goal: establish typed Kafka request and response contracts before any service logic becomes coupled to library-specific shapes.

Implementation steps:

1. Add `kafkajs` and update build/runtime packaging so the server can load Kafka dependencies safely.
2. Define connection, topic-list, produce, consume, subscribe, unsubscribe, and status contracts.
3. Include auth and TLS fields in contracts now even if UI support lands later.
4. Define standard success and error envelope shapes for `/api/kafka/*`.

Outputs:

- typed contract module
- shared route response shapes
- dependency and build updates

Gate to next sub-phase:

- contracts are stable enough that service and route layers can build on them without reworking shapes immediately afterward

Phase 1A implementation notes (2026-05-29):

- Added `kafkajs` to dependencies and updated server build external list.
- Implemented typed Kafka contracts including auth/TLS-ready connection fields.
- Added standard success/error envelope helpers for `/api/kafka/*` route parity.
- Added Kafka service skeleton with explicit state snapshot model.
- Added initial Phase 1A tests and validated with `npx tsc -b --noEmit`, targeted vitest, and scoped eslint.
- Self-review bug fix: ensured not-implemented skeleton operations do not mutate lifecycle state.

#### Phase 1B - Service lifecycle and admin primitives

Goal: create the server-side Kafka service with clean lifecycle handling before layering execution features on top.

Implementation steps:

1. Implement service state model for disconnected, connecting, connected, error.
2. Add idempotent connect and disconnect behavior.
3. Add topic listing and lightweight cluster/status metadata.
4. Introduce a central subscription registry with cleanup hooks.
5. Add defensive timeout handling and safe teardown paths.

Outputs:

- kafka service singleton
- lifecycle and status primitives
- subscription registry baseline

Gate to next sub-phase:

- repeated connect/disconnect calls do not leak consumers, timers, or stale state

Phase 1B re-review additions:

1. Explicit idempotency rule:
  - connect to the same active cluster should return a stable success envelope without recreating Kafka admin clients
  - disconnect while already disconnected should return success and avoid throwing
2. Explicit cluster mismatch guard:
  - disconnect/topics/subscriptions requests carrying a different clusterId than the active one should fail with deterministic cluster-mismatch errors
3. Explicit timeout discipline:
  - connect, disconnect, topic listing, and subscription cleanup operations should all use bounded timeout wrappers
4. Explicit subscription lifecycle baseline:
  - Phase 1B should include a central registry API (register/list/unsubscribe) even if actual consume streaming is completed in Phase 1C

Phase 1B implementation notes (2026-05-29):

- Implemented Kafka runtime adapter abstraction (`src-server/kafka/kafka-adapter.ts`) so service tests can mock broker behavior without real Kafka dependencies.
- Implemented service lifecycle primitives in `src-server/kafka/kafka-service.ts`:
  - connection validation and state transitions (disconnected/connecting/connected/error)
  - idempotent connect/disconnect behavior
  - timeout-safe connect/disconnect and cleanup paths
  - topic listing with internal-topic filtering and partition metadata
  - subscription registry baseline with register/list/unsubscribe and cleanup hooks
- Added Phase 1B unit tests in `src-server/kafka/kafka-service.test.ts` covering:
  - connect success/failure
  - idempotent reconnect to same cluster
  - topic listing connected/disconnected behavior
  - subscription cleanup during unsubscribe/disconnect
  - repeated connect-disconnect-connect stability loops
- Self-review fix included in implementation: mismatch and not-connected paths now return stable error envelopes instead of implicit runtime failures.

Phase 1A/1B re-review notes (2026-05-29, additional QA rounds):

- Fixed idempotent disconnect behavior when already disconnected and a mismatched clusterId is provided.
- Fixed stale disconnected status metadata by clearing clusterId on successful disconnect.
- Fixed subscription replacement cleanup to avoid unhandled promise rejections from fire-and-forget cleanup handlers.
- Added auth validation guardrails so authenticated modes require username and password.
- Re-ran targeted Kafka unit tests, lint, and type checks after fixes with no remaining issues detected.

#### Phase 1C - Produce, consume, and route surface

Goal: expose actual Kafka operations through the server boundary.

Implementation steps:

1. Implement produce with metadata capture.
2. Implement bounded consume-once with timeout, max messages, and filters.
3. Implement subscribe, list subscriptions, and unsubscribe operations.
4. Add `/api/kafka/*` routes with consistent error mapping.
5. Add log hooks for operational visibility.

Outputs:

- live server route surface for Kafka operations
- produce and consume primitives usable by later phases

Gate to next sub-phase:

- route behavior is test-covered and operationally diagnosable

Phase 1C re-review additions:

1. Explicit request-shape guardrails at route boundary:
  - body-based operations must reject non-object payloads
  - query coercion for booleans (for example `includeInternal`) must reject invalid tokens
2. Explicit error-to-http mapping discipline:
  - invalid request/validation envelopes -> 400
  - not connected / connect-in-progress -> 503
  - cluster mismatch -> 409
3. Explicit async lifecycle resilience:
  - long-running subscribe failures must not leave stale registry entries
  - cleanup failures should remain non-fatal for disconnect stability

Phase 1C implementation notes (2026-05-29):

- Extended Kafka runtime adapter (`src-server/kafka/kafka-adapter.ts`) with producer and consumer abstractions.
- Implemented service operations in `src-server/kafka/kafka-service.ts`:
  - `produce` with metadata capture and timeout-safe producer lifecycle
  - `consumeOnce` with timeout/max-message bounds plus key/header/jsonPath filtering
  - `subscribe` runtime integration with registry-backed cleanup
- Added full Kafka route surface in `src-server/routes/kafka-routes.ts`:
  - `/api/kafka/connect`
  - `/api/kafka/disconnect`
  - `/api/kafka/status`
  - `/api/kafka/topics`
  - `/api/kafka/produce`
  - `/api/kafka/consume-once`
  - `/api/kafka/subscribe`
  - `/api/kafka/subscriptions`
  - `/api/kafka/unsubscribe`
- Wired router into server and log hooks via `createKafkaRouter({ onLog: broadcastLog })` in `src-server/webhook-server.ts`.
- Added route tests in `src-server/routes/kafka-routes.test.ts` and expanded service tests in `src-server/kafka/kafka-service.test.ts` for produce/consume/subscribe flows.

Phase 1C re-review fix notes (2026-05-29, two-round QA):

- Fixed stale-subscription leak risk by auto-removing failed background subscriptions when `consumer.run` fails.
- Fixed route-boundary validation gap by rejecting array payloads for body-based Kafka operations.
- Added defensive service-level request-shape validation for `connect`, `produce`, `consumeOnce`, and `subscribe` to prevent malformed direct-call crashes.
- Added regression tests for malformed route and service payloads to lock in request-shape guard behavior.
- Re-ran targeted tests, lint, and type checks after fixes with no remaining Phase 1C issues detected.

#### Phase 1D - Local Docker bootstrap and integration smoke

Goal: make the phase reproducible for other phases through a real local broker environment.

Implementation steps:

1. Add plaintext Docker compose file.
2. Add create-topics, reset-topics, and seed-messages scripts.
3. Add health-check and smoke-test commands.
4. Confirm startup, seed, connect, produce, consume, disconnect, and teardown all work from local automation.
5. Record the bootstrap workflow in the local Kafka guide.

Outputs:

- reusable local plaintext Kafka environment
- deterministic seeded topic set
- documented bootstrap workflow

Gate to phase exit:

- the next phases can depend on a stable Docker-backed integration environment instead of ad hoc local setup

Phase 1D re-review additions:

1. Explicit reproducibility requirement:
  - plaintext bootstrap should be runnable from one top-level helper script, not only by manually chaining commands
2. Explicit validation separation:
  - static validation (shell syntax, compose config, asset tests) should be tracked separately from runtime broker smoke
3. Explicit environment-blocker reporting:
  - if runtime smoke cannot be executed because Docker/daemon access is unavailable, record the exact blocker in docs instead of silently marking the phase complete

Phase 1D implementation notes (2026-05-29):

- Added plaintext Redpanda compose stack in `docker/kafka/plaintext/docker-compose.yml`.
- Added topic asset set:
  - `docker/kafka/topics/topics.txt`
  - `docker/kafka/topics/create-topics.sh`
  - `docker/kafka/topics/reset-topics.sh`
  - `docker/kafka/topics/seed-messages.sh`
- Added plaintext helper scripts:
  - `docker/kafka/plaintext/healthcheck.sh`
  - `docker/kafka/plaintext/smoke-test.sh`
  - `scripts/kafka-plaintext-bootstrap.sh`
- Added example env file: `docker/kafka/env/plaintext.env.example`.
- Added asset verification coverage in `src-server/kafka/kafka-docker-assets.test.ts`.

Phase 1D re-review fix notes (2026-05-29, live runtime validation):

- Fixed asset verification test root-path resolution so Docker asset tests read from the actual repository root.
- Corrected validation workflow to lint only touched TypeScript scope instead of shell scripts.
- Fixed Redpanda seed script header usage to match the current `rpk topic produce` CLI (`-H key:value`).
- Fixed smoke script localhost requests to bypass environment HTTP proxies.
- Fixed bootstrap/server assumption by auto-starting a Kafka-enabled local server from this repo when `/api/kafka/status` is unavailable.
- Fixed `consume-once` control flow so result settlement does not deadlock on `consumer.stop()` within the message handler.
- Bounded `consume-once` cleanup so slow/stuck KafkaJS shutdown does not keep the HTTP response open indefinitely.
- Made smoke produce/consume deterministic per run via unique key, trace id, and consumer group identifiers.
- Re-ran the full plaintext bootstrap successfully against Docker Desktop: broker up, topics seeded, connect/topics/produce/consume-once/disconnect passed, teardown clean.

### Phase 1 Re-evaluation Notes

After re-evaluating Phase 1, the most important planning adjustment is to lock this phase to transport and reproducibility only.

Phase 1 should avoid UI drift and feature creep by treating the following as hard boundaries:

1. Build and validate the backend contract surface first.
2. Prove lifecycle safety with deterministic tests.
3. Deliver a reproducible plaintext Docker environment usable by all later phases.
4. Defer user-facing settings UX complexity to Phase 3.

### Phase 1 Explicit Non-goals

The following are intentionally out of scope for Phase 1:

- Kafka settings page and cluster editor UI
- secure profile UX and certificate upload handling
- workflow node implementation
- trigger/wait runtime behavior
- runner schema and results rendering changes
- Tauri-native Kafka transport

### Phase 1 Contract Boundary (Minimum Route Surface)

The phase is complete only if these route families are implemented with stable envelopes:

1. `/api/kafka/connect`
2. `/api/kafka/disconnect`
3. `/api/kafka/status`
4. `/api/kafka/topics`
5. `/api/kafka/produce`
6. `/api/kafka/consume-once`
7. `/api/kafka/subscribe`
8. `/api/kafka/subscriptions`
9. `/api/kafka/unsubscribe`

Required contract behavior for all route families:

- consistent success envelope shape
- consistent error envelope shape
- request validation before Kafka client calls
- timeout-safe execution and cleanup
- auth and TLS fields accepted in contracts even when plaintext profile is default

### Phase 1 Implementation File Map (Planned)

Expected implementation surfaces for Phase 1:

- `src-server/kafka/` for service, contracts, and helpers
- `src-server/routes/` for `/api/kafka/*` route handlers
- `docker/kafka/plaintext/docker-compose.yml`
- `docker/kafka/topics/create-topics.sh`
- `docker/kafka/topics/reset-topics.sh`
- `docker/kafka/topics/seed-messages.sh`
- `docs/guides/kafka-local-dev.md`

This map is intended to keep Phase 1 implementation modular and reviewable in small PR slices.

### Phase 1 Acceptance Checklist (Hard Gate)

Before Phase 1 is marked complete, all of the following must be true:

1. All minimum route families are implemented and covered by route-level tests.
2. Lifecycle tests confirm no orphan subscriptions/consumers after disconnect.
3. Repeated connect-disconnect-connect loops are stable in automated tests.
4. Plaintext Docker profile can bootstrap, seed, smoke test, and teardown with documented commands.
5. Integration smoke confirms connect -> topics -> produce -> consume-once -> disconnect against real broker.
6. TypeScript and lint checks pass for touched scope.
7. Phase 1 remains UI-neutral (no settings/editor feature creep merged under this phase).

### Test plan

- Unit test kafka-service with full kafkajs mocks.
- Route tests for each endpoint and all negative paths.
- Lifecycle tests for repeated connect/disconnect and orphan cleanup.
- Real-broker integration test for connect -> list topics -> produce -> consume -> disconnect.
- Docker-backed integration smoke for seeded plaintext environment startup and teardown.

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

### Sub-phases

#### Phase 2A - Transport abstraction

Goal: isolate frontend Kafka calls behind one transport entry point.

Implementation steps:

1. Define operation-based client dispatcher.
2. Route browser/dev mode through `/api/kafka/*`.
3. Add override hooks so tests can inject transport behavior.
4. Normalize client-side parsing of success and error envelopes.

Outputs:

- frontend kafka client transport
- test override hook

#### Phase 2B - Persistence and state model

Goal: establish durable client-side state for clusters and status.

Implementation steps:

1. Define stored cluster shape and migrations.
2. Implement load/save helpers.
3. Add app-level Kafka state for clusters, selected cluster, status, and last error.
4. Add initialization and fallback behavior for empty or invalid storage.

Outputs:

- persistent cluster config model
- app-level Kafka state baseline

#### Phase 2C - Refresh and resilience behavior

Goal: keep UI state accurate without noisy polling or stale failures.

Implementation steps:

1. Add event-driven refresh after connect/disconnect/test/save.
2. Add bounded polling for status when useful.
3. Add backoff for repeated failures.
4. Clear stale error states on successful recovery.

Outputs:

- resilient connection-state refresh behavior
- cleaner transition model for later UX work

### Phase 2B Implementation Notes (2026-05-30)

- Added shared Kafka cluster config model and normalization helpers in `src/shared/kafka/kafkaConfig.ts`.
- Added persistence helpers with legacy-key migration and normalization in `src/shared/kafka/kafkaStorage.ts`.
- Added app-level Kafka state hook baseline in `src/app/hooks/useKafkaState.ts`, including:
  - startup hydration of cluster list + selected cluster
  - fallback selection behavior when persisted selected cluster is missing
  - connection snapshot and last-error state handling
  - persistence-on-change for clusters and selected cluster id
- Added Phase 2B unit coverage:
  - `src/shared/kafka/kafkaStorage.test.ts` for save/load/migration behavior
  - `src/app/hooks/useKafkaState.test.ts` for init/upsert/remove/error-state transitions
- Validation run after implementation:
  - `npx vitest run src/shared/kafka/kafkaStorage.test.ts src/app/hooks/useKafkaState.test.ts src/shared/kafka/kafkaClient.test.ts`
  - `npx eslint src/shared/kafka/kafkaConfig.ts src/shared/kafka/kafkaStorage.ts src/shared/kafka/kafkaStorage.test.ts src/app/hooks/useKafkaState.ts src/app/hooks/useKafkaState.test.ts`
  - `npx tsc -b --noEmit`

### Phase 2C Implementation Notes (2026-05-30)

- Added typed UI-safe Kafka client error mapping in `src/shared/kafka/kafkaClient.ts`:
  - `KafkaClientError` for structured operation/code/retryable error handling
  - `toKafkaUiSafeError(...)` for UI-safe error classification (`auth`, `tls`, `timeout`, `network`, `validation`, `cluster`, `server`, `unknown`)
- Added status refresh and resilience behavior in `src/app/hooks/useKafkaState.ts`:
  - event-driven `refreshConnectionStatus(...)` and nonce-triggered refresh after save/select/update flows
  - bounded polling loop for Kafka status with capped exponential backoff
  - failure streak tracking (`statusPollFailureStreak`) with bounded cap to avoid runaway retries
  - connection/test/disconnect helpers (`connectSelectedCluster`, `testSelectedClusterConnection`, `disconnectActiveCluster`) that trigger status refresh and preserve UI-safe states
  - stale-error recovery behavior: successful status refresh clears stale errors while preserving unrelated hydration/persistence failures
- Added Phase 2C test coverage:
  - `src/shared/kafka/kafkaClient.test.ts` for UI-safe network error mapping
  - `src/app/hooks/useKafkaState.test.ts` for connect/refresh/disconnect paths and bounded failure streak behavior
- Validation after implementation and bug-fix revisit:
  - `npx vitest run src/app/hooks/useKafkaState.test.ts src/shared/kafka/kafkaClient.test.ts src/shared/kafka/kafkaStorage.test.ts`
  - `npx eslint src/shared/kafka/kafkaClient.ts src/shared/kafka/kafkaClient.test.ts src/app/hooks/useKafkaState.ts src/app/hooks/useKafkaState.test.ts src/shared/kafka/kafkaStorage.ts src/shared/kafka/kafkaStorage.test.ts src/shared/kafka/kafkaConfig.ts`
  - `npx tsc -b --noEmit`

Gate to phase exit:

- client state transitions are stable enough that the settings UI can build against them without introducing duplicated transport logic

### Test plan

- kafkaClient selection/routing tests.
- Storage load/save/migration tests.
- App state tests for init, reconnect, and error state transitions.
- Integration test for persisted cluster config -> reconnect -> status refresh against a live broker.

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
- Distinct connection error states for auth failure, TLS failure, timeout, and broker unreachable.

### Detailed plan

1. Add settings tab and route integration.
2. Build editor with broker list controls and schema validation.
3. Add test connection action and status badge updates.
4. Add topic browse/search with loading/error/empty states.
5. Add auto-connect option and startup behavior.
6. Add auth/SSL form behavior for plaintext, SASL/PLAIN, and SCRAM flows.
7. Add local validation rules for incomplete or contradictory TLS/auth combinations.
8. Add readable mapping for invalid credentials, invalid CA/cert, and timeout failures.

### Sub-phases

#### Phase 3A - Navigation and settings shell

Goal: place Kafka cluster management into the app without yet solving the full form complexity.

Implementation steps:

1. Register Kafka settings tab or route.
2. Create settings page shell with loading, empty, and error states.
3. Add connection indicator entry points from the app header where appropriate.

Outputs:

- Kafka settings entry point
- app-level navigation anchor

#### Phase 3B - Cluster list and editor foundation

Goal: make cluster configuration CRUD real before advanced validation layers are added.

Implementation steps:

1. Build saved cluster list cards.
2. Build add/edit/delete flows.
3. Add broker-list editing and validation.
4. Persist cluster changes through Phase 2 state helpers.

Outputs:

- cluster list UX
- editor baseline for brokers and identity fields

#### Phase 3C - Auth, TLS, and connection diagnostics

Goal: implement secure connection setup as a first-class UX, not an afterthought.

Implementation steps:

1. Add plaintext, SASL/PLAIN, and SCRAM configuration flows.
2. Add TLS options for CA, cert, and key inputs as supported by the contract.
3. Add timeout and verification controls needed to exercise secure profiles from the settings UI.
4. Add local form validation for invalid combinations.
5. Map backend failures to readable auth, TLS, timeout, and broker-unreachable states.
5. Validate against the secure Docker profile.

Outputs:

- secure connection UX
- targeted error-state handling

Implementation detail note:

- Reuse the existing Kafka settings editor and `useKafkaState()` connection actions instead of introducing a separate secure-profile modal.
- Surface `connect`, `test connection`, and `disconnect` actions directly from the settings shell using the currently selected cluster.
- Keep diagnostics in the settings page as structured inline callouts/badges derived from client-side error classification, so Phase 3D can reuse the same status surface.

### Phase 3C Implementation Notes (2026-05-30)

- Extended the cluster draft/editor model in `src/features/kafka/kafkaClusterForm.ts` with:
  - connection and request timeout fields
  - SASL/PLAIN and SCRAM auth mode support
  - TLS enable/verify controls plus CA/cert/key/passphrase fields
  - local validation for timeout parsing, auth credentials, and TLS cert/key/passphrase combinations
- Expanded `src/features/kafka/KafkaSettingsPage.tsx` to make secure profile setup first-class:
  - auth selector plus conditional username/password inputs
  - TLS toggles and PEM textareas inside the existing editor
  - selected-cluster security summary in the shell
  - shell-level `Test Connection`, `Connect`, `Disconnect`, `Refresh Status`, and `Clear Error` actions
  - inline structured diagnostics driven by Kafka error classification instead of plain freeform error text only
- Added structured connection diagnostics to `src/app/hooks/useKafkaState.ts` via `lastErrorDetail`, so the settings UI can distinguish auth, TLS, timeout, network, validation, cluster, and server failures.
- Tightened broker reachability classification in `src/shared/kafka/kafkaClient.ts` for `ECONNREFUSED`/DNS-style failures while preserving generic server-error handling.
- Added server-side TLS validation guardrails in `src-server/kafka/kafka-service.ts` so cert/key/passphrase combinations are rejected even outside the React form flow.
- Added/updated focused coverage:
  - `src/features/kafka/kafkaClusterForm.test.ts`
  - `src/features/kafka/KafkaSettingsPage.test.tsx`
  - `src/app/hooks/useKafkaState.test.ts`
  - `src/shared/kafka/kafkaClient.test.ts`
  - `src-server/kafka/kafka-service.test.ts`
- Re-review note: the first 3C validation pass exposed an overly broad broker-message classifier and a few draft/test compatibility assumptions; these were corrected before the final validation pass.
- Second re-review note: disabling TLS in the editor was still persisting stale CA/cert/key/passphrase material; the save path now clears TLS secret fields when TLS is turned off, with a dedicated page regression test.
- Third re-review note: runtime Phase 3C diagnostics were being treated as startup-load failures when the saved cluster list was empty; the settings page now reserves the startup error shell for real load/persistence failures and keeps runtime validation/network diagnostics in the inline diagnostic banner path.
- Validation run after implementation and re-review:
  - `npx vitest run src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src-server/kafka/kafka-service.test.ts`
  - `npx vitest run src/shared/kafka/kafkaClient.test.ts`
  - `npx tsc -b --noEmit`

#### Phase 3D - Topic browser and startup behavior

Goal: complete the operational settings experience with real broker feedback.

Implementation steps:

1. Add topic browse/search panel for connected clusters.
2. Add loading, empty, and error states for topic browse.
3. Add auto-connect behavior and startup restoration rules.
4. Ensure connection status badges stay consistent with live broker state.

Outputs:

- end-to-end cluster management experience
- real topic feedback from connected brokers

Implementation detail note:

- Keep topic browsing inside `src/features/kafka/KafkaSettingsPage.tsx` and back it with the existing Kafka state hook rather than introducing a new global Kafka topic store.
- Extend `useKafkaState()` with the minimum Phase 3D state needed for startup restoration and topic loading: persisted auto-connect preference, topic list refresh, topic loading/error state, and include-internal toggle.
- Reuse the Phase 3C diagnostic surface and connection summary instead of adding a separate status system for topic browsing.
- Scope Phase 3D to the Kafka settings page; defer any app-header/global Kafka indicator until a later phase so this slice stays page-local and testable.

### Phase 3D Implementation Notes (2026-05-30)

- Extended shared Kafka storage/contracts for startup restoration and topic browsing:
  - added startup auto-connect storage key and load/save helpers in `src/shared/kafka/kafkaStorage.ts`
  - added startup-preference coverage in `src/shared/kafka/kafkaStorage.test.ts`
  - added shared topic summary type in `src/shared/kafka/kafkaConfig.ts`
- Extended `src/app/hooks/useKafkaState.ts` for Phase 3D runtime behavior:
  - persisted `autoConnectOnStartup` preference and setter
  - one-time startup auto-connect attempt for selected cluster
  - topic state/actions (`topics`, `topicsLoading`, `topicsError`, `includeInternalTopics`, `refreshTopics`)
  - topic cleanup behavior when the active cluster is removed or disconnected
- Expanded `src/features/kafka/KafkaSettingsPage.tsx` with a page-local topic browser:
  - topic panel with filter/search, include-internal toggle, refresh action, and partition badges
  - disconnected/loading/error/empty topic states
  - startup auto-connect toggle in the connection workspace
  - mockup-aligned visual treatment updates:
    - cluster-studio hero section and design-intent note
    - topic-explorer style chip filters (domain prefixes) and table-like topic list columns
    - updated topic-search copy to match explorer semantics (`Search topics, prefixes, domains, tags`)
    - cluster-list status hierarchy updates (`Connected` / `Idle` / `Failed`) with per-cluster security profile subtext
    - topic-explorer context chips (`Kafka / Topics`, selected cluster) for stronger page context parity with mockup
  - quality hardening and reuse extraction:
    - extracted shared settings helpers into `src/features/kafka/kafkaSettingsUtils.ts`
    - extracted reusable diagnostic UI into `src/features/kafka/KafkaDiagnosticBanner.tsx`
    - reduced `KafkaSettingsPage.tsx` from monolithic size to below the project monolith threshold
    - continued adjacent monolith/duplication cleanup in the same execution stream:
      - extracted shared base `RequestResult` mapping in `src/features/test-runner/utils/rustBridge.ts` for Rust result translation paths
      - extracted shared selection patch helper in `src/features/scenarios/components/DataSourceSetupModal.tsx` for wizard selection state updates
- Extended `src/app/hooks/useKafkaState.test.ts` with race/cancellation/refresh branch tests and raised `useKafkaState.ts` branch coverage above 90% in focused coverage validation.
- Reduced Kafka service monolith size by extracting validation/filter helpers into `src-server/kafka/kafka-service-utils.ts` and reusing them from `src-server/kafka/kafka-service.ts`.
- Re-review fixes during 3D implementation:
  - fixed startup auto-connect callback ordering in `useKafkaState()`
  - corrected topic-browser test assertion mismatch
  - reset topic filter when switching clusters to avoid stale-filter hidden lists
  - second re-review pass fix: reset topic filter when `selectedClusterId` changes externally (for example fallback selection after cluster removal) to prevent stale search text from hiding the newly selected cluster topics
- Validation run after implementation and revisit:
  - `npx vitest run src/shared/kafka/kafkaStorage.test.ts src/app/hooks/useKafkaState.test.ts src/features/kafka/KafkaSettingsPage.test.tsx`
  - `npx vitest run src/shared/kafka/kafkaStorage.test.ts src/app/hooks/useKafkaState.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/features/kafka/kafkaClusterForm.test.ts src-server/kafka/kafka-service.test.ts src/shared/kafka/kafkaClient.test.ts`
  - `npx tsc -b --noEmit`
  - second re-review round:
    - `npx vitest run src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src/shared/kafka/kafkaStorage.test.ts`
    - `npx tsc -b --noEmit`

Mockup alignment references for implemented and upcoming Kafka UI:

- implemented settings/topic surfaces:
  - `docs/mockups/kafka-cluster-studio.html`
  - `docs/mockups/kafka-topic-explorer.html`
- future publish/consume and workflow surfaces:
  - `docs/mockups/kafka-message-studio.html`
  - `docs/mockups/kafka-workflow-integration.html`

### AppHeader Kafka Connection Indicator Implementation Notes (2026-06-01)

- Created `src/app/components/KafkaConnectionIndicator.tsx`:
  - pure `deriveIndicatorStatus()` helper maps connection snapshot + hasClusters to one of: connected, connecting, error, disconnected, hidden
  - renders a compact button with colored status dot and "Kafka" label
  - hidden when no clusters are configured; visible as soon as at least one cluster exists
  - click navigates to the `kafka-settings` tab
  - accessibility: `aria-label` with full status description, `title` tooltip, `type="button"`, `aria-hidden` on decorative dot
- Added CSS in `src/styles/base.css`:
  - `.kafka-connection-indicator` base button with border/background/transition states
  - status-specific border tinting: green (connected), amber (connecting), red (error)
  - `.kafka-dot` colored circle with `box-shadow` glow and `@keyframes kafka-pulse` animation for connecting state
  - focus-visible outline for keyboard accessibility
- Integrated into `src/app/components/AppHeader.tsx`:
  - new props: `kafkaConnection`, `kafkaClusterName`, `kafkaHasClusters`, `onNavigateToKafkaSettings`
  - indicator placed between service selector and theme picker
- Lifted `useKafkaState()` to `src/app/App.tsx` (single instance) for shared state:
  - App passes `kafkaState.connection`, `kafkaState.selectedCluster?.name`, `kafkaState.clusters.length > 0`, and `() => setActiveTab('kafka-settings')` to AppHeader
  - `KafkaSettingsPage` refactored to receive `kafkaState: UseKafkaStateReturn` as a prop
  - eliminates dual-instance desync between header indicator and settings page
- Refactored `src/features/kafka/KafkaSettingsPage.test.tsx`:
  - removed `vi.mock('../../app/hooks/useKafkaState')` in favor of direct prop passing via `renderPage(state)` / `rerenderPage(rerender, state)` helpers
  - all 25 existing tests continue passing without behavioral changes
- Added `src/app/components/KafkaConnectionIndicator.test.tsx`:
  - 5 unit tests for `deriveIndicatorStatus` covering each state mapping
  - 8 component tests covering render/hidden logic, click navigation, cluster name fallback, accessibility attributes, and dot CSS classes
- Validation:
  - `npx tsc -b --noEmit` — zero errors
  - `npx vitest run src/app/components/KafkaConnectionIndicator.test.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/features/kafka/kafkaClusterForm.test.ts src/app/hooks/useKafkaState.test.ts` — 87 tests passed

### Secure-Profile Presets and Docker Smoke Implementation Notes (2026-06-01)

- Created secure Redpanda Docker profile at `docker/kafka/secure/docker-compose.yml`:
  - SASL enabled with `admin` superuser for cluster management
  - Init container creates `redfireforge-app` user (SCRAM-SHA-256), test topics, and topic/consumer-group ACLs
  - Non-conflicting port mapping (19093/18083/19645) allows running alongside plaintext profile
- Created `docker/kafka/env/secure.env.example` documenting all required environment variables
- Created connection presets module at `src/shared/kafka/kafkaConnectionPresets.ts`:
  - 6 curated presets: local-plaintext, local-sasl-plain, local-sasl-scram256, local-sasl-scram512, local-sasl-tls, local-tls-strict
  - each preset provides a complete template config with empty credentials for SASL presets
  - utility functions: `getPresetById`, `getPresetsByCategory`, `applyPreset` (generates clusterId + timestamps), `presetRequiresCredentials`, `presetRequiresTlsCert`
  - designed for future integration into the KafkaSettingsPage "from preset" create flow
- Created secure profile smoke test at `docker/kafka/secure/smoke-test.sh`:
  - 6 scenarios covering SASL/PLAIN, SCRAM-SHA-256, invalid credentials (auth error), invalid broker (network error), full produce/consume lifecycle, and timeout edge case
  - same structured pass/fail/skip reporting pattern as the P8C broker scenarios script
- Extended `src-server/kafka/kafka-docker-assets.test.ts` with 4 additional assertions for secure profile asset existence and content
- Added 18 unit tests in `src/shared/kafka/kafkaConnectionPresets.test.ts` covering preset structure, lookup, application, and requirement detection
- Validation:
  - `npx tsc -b --noEmit` — zero errors
  - `npx vitest run src/shared/kafka/kafkaConnectionPresets.test.ts src-server/kafka/kafka-docker-assets.test.ts src/shared/kafka/kafkaClient.test.ts src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx` — 82 tests passed

### Secure Docker End-to-End Validation — Race-Boundary Fix (2026-06-02)

Three issues identified and fixed during thorough re-evaluation:

**1. UI race-boundary: poll overwrites 'testing' state during SASL handshake**
- Problem: When `connectSelectedCluster()` sets `connection.state` to `'testing'`, the background status poll timer could fire during the (2–8s) SASL/SCRAM handshake window, fetch the broker's still-`'disconnected'` status, and overwrite the UI indicator to "Disconnected" — causing the AppHeader indicator to flicker.
- Fix: Added `connectOperationInFlightRef` guard in `src/app/hooks/useKafkaState.ts`. The poll's `refreshConnectionStatus()` now short-circuits (returns immediately) when a connect or disconnect operation is in flight, unless `force: true` is passed (used by the post-connect refresh).
- Applies to both `connectSelectedCluster()` and `disconnectActiveCluster()`.
- Added 2 new unit tests verifying the guard suppresses poll dispatch during in-flight operations.

**2. Docker smoke test init-container race**
- Problem: Running `./smoke-test.sh` immediately after `docker compose up -d` could hit a window where the init container hasn't yet created SCRAM users or topics, causing spurious S1/S2 failures.
- Fix: Added `wait_for_broker_ready()` gate to `docker/kafka/secure/smoke-test.sh` that retries a connect probe (up to 60s) before running scenarios. This ensures the SCRAM user and topics exist.

**3. S6 timeout scenario error code flakiness**
- Problem: On loopback, the S6 scenario's `connectionTimeoutMs: 1` could produce either `KAFKA_CONNECT_TIMEOUT` or `KAFKA_CONNECT_FAILED` depending on whether the TCP handshake or the SASL handshake was the one that timed out. The original assertion only accepted `KAFKA_CONNECT_TIMEOUT`, making the test flaky across environments.
- Fix: Broadened S6 assertion to also accept error codes containing `TIMEOUT`, `NETWORK`, or `CONNECT` as acceptable variants.

**Validation (all green):**
- `npx tsc -b --noEmit` — zero errors
- `npx vitest run` (5 files: useKafkaState, kafkaClient, kafkaConnectionPresets, docker-assets, KafkaConnectionIndicator) — 94 tests passed
- Manual end-to-end: `./docker/kafka/secure/smoke-test.sh` — 21/21 checks pass across 6 scenarios (S1–S6)
- Broker readiness gate confirmed working (immediate pass on warm container, waits correctly on cold start)

### Phase 3A Implementation Notes (2026-05-30)

- Added Kafka settings tab routing in app tab utilities (`src/app/utils/appTabUtils.ts`):
  - new `kafka-settings` tab type
  - settings-domain membership and URL tab persistence support
- Added Kafka tab anchor in settings sub-navigation (`src/app/components/AppSubNav.tsx`).
- Wired route rendering in app shell (`src/app/App.tsx`) for `kafka-settings`.
- Added Phase 3A shell page (`src/features/kafka/KafkaSettingsPage.tsx`) with:
  - loading state
  - startup error state
  - empty state for no clusters
  - basic saved-cluster shell list and selected-cluster summary
  - status refresh and clear-error shell actions
- Added shell styling in `src/styles/settings.css` for status badges, shell cards, and responsive cluster-row layout.
- Added Phase 3A tests:
  - `src/app/components/AppSubNav.test.tsx` for settings-tab visibility/navigation
  - `src/features/kafka/KafkaSettingsPage.test.tsx` for loading/error/empty/ready shell states
  - updated `src/app/utils/appTabUtils.test.ts` for `kafka-settings` guards and URL persistence behavior
- Re-review fix: added empty-state CTA in `src/features/kafka/KafkaSettingsPage.tsx` so a brand-new workspace can open the first-cluster editor without already having saved clusters.
- Re-review regression coverage: added `KafkaSettingsPage` test for the empty-state create CTA.
- Validation run after implementation and re-review:
  - `npx vitest run src/app/utils/appTabUtils.test.ts src/app/components/AppSubNav.test.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts`
  - `npx eslint src/app/App.tsx src/app/components/AppSubNav.tsx src/app/components/AppSubNav.test.tsx src/app/utils/appTabUtils.ts src/app/utils/appTabUtils.test.ts src/features/kafka/KafkaSettingsPage.tsx src/features/kafka/KafkaSettingsPage.test.tsx`
  - `npx tsc -b --noEmit`
- Second review round after empty-state fix:
  - `npx vitest run src/features/kafka/KafkaSettingsPage.test.tsx`
  - `npx vitest run src/app/utils/appTabUtils.test.ts src/app/components/AppSubNav.test.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts`
  - `npx eslint src/app/components/AppSubNav.tsx src/app/components/AppSubNav.test.tsx src/app/utils/appTabUtils.ts src/app/utils/appTabUtils.test.ts src/features/kafka/KafkaSettingsPage.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.ts src/app/hooks/useKafkaState.test.ts`
  - `npx tsc -b --noEmit`

### Phase 3B Implementation Notes (2026-05-30)

- Added Phase 3B cluster editor foundation helpers in `src/features/kafka/kafkaClusterForm.ts`:
  - deterministic default cluster draft creation
  - cluster-id slug normalization from display name
  - broker host:port validation with per-row error mapping
  - duplicate cluster-id validation with edit-mode exemption
- Added Phase 3B unit coverage in `src/features/kafka/kafkaClusterForm.test.ts` for helper behavior and validation edge cases.
- Expanded `src/features/kafka/KafkaSettingsPage.tsx` from shell-only view to CRUD-capable Phase 3B foundation:
  - saved cluster cards with select and edit actions
  - create/edit editor section with cluster name/id/client-id fields
  - broker list add/remove controls and inline validation feedback
  - save flow wired through `useKafkaState().upsertCluster(...)`
  - delete flow with explicit inline confirm step wired through `useKafkaState().removeCluster(...)`
- Added/expanded Phase 3B component tests in `src/features/kafka/KafkaSettingsPage.test.tsx`:
  - new-cluster launch + broker-row validation error path
  - edit-and-save broker update path
  - delete confirmation flow
- Re-review bug fix applied during Phase 3B implementation:
  - broker-row React keys were stabilized from value-derived keys to index keys to prevent input remount while typing.
- Re-review bug fix applied during final Phase 3B QA rounds:
  - edit-mode cluster name updates no longer auto-mutate `clusterId`.
  - explicit `clusterId` rename during edit now removes the old cluster id before upsert to prevent duplicate records.
  - added regression tests for both identity paths in `src/features/kafka/KafkaSettingsPage.test.tsx`.
  - create-mode manual `clusterId` edits now remain stable when the user later changes the cluster name, preventing the auto-slug helper from overwriting a custom id.
  - added regression coverage for create-mode custom-id preservation in `src/features/kafka/KafkaSettingsPage.test.tsx`.

- Validation run after implementation and re-review:
  - `npx vitest run src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src/app/utils/appTabUtils.test.ts src/app/components/AppSubNav.test.tsx`
  - `npx eslint src/features/kafka/kafkaClusterForm.ts src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.ts src/app/hooks/useKafkaState.test.ts src/app/utils/appTabUtils.ts src/app/components/AppSubNav.tsx src/app/App.tsx`
  - `npx tsc -b --noEmit`

- Second verification round after bug-fix revisit:
  - repeated the same vitest/eslint/tsc command set; all checks passed with no remaining Phase 3B issues.

- Final post-fix verification rounds:
  - round 1: `npx vitest run src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src/app/utils/appTabUtils.test.ts src/app/components/AppSubNav.test.tsx`, scoped eslint for touched Kafka/app files, and `npx tsc -b --noEmit` all passed.
  - round 2: repeated the same command set; all checks passed again with no diagnostics.
  - round 3: `npx vitest run src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx`, repeated the broader Phase 3B validation slice, scoped eslint for Phase 3B files, and `npx tsc -b --noEmit` all passed.

Gate to phase exit:

- users can configure, test, browse, and persist both plaintext and secure local profiles from the actual UI

### Test plan

- Component tests for editor validation and actions.
- Integration tests for connect/test/save flows.
- Accessibility checks for form errors and status announcements.
- Visual browser tests for cluster add/edit/test/save and topic browser search/detail flows against a real broker.
- Secure-profile visual and integration tests for SASL and TLS flows using the Docker secure environment.

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

### Phase objective and non-goals

Objective:

- add first-class Kafka node execution inside existing workflow graph runs without changing non-Kafka node behavior.

Non-goals in Phase 4:

- no trigger-start or wait-resume orchestration (Phase 5)
- no runner-level Kafka scenario model extension (Phase 6)
- no schema-registry publish/consume tooling (later phase)

### Detailed plan

1. Extend workflow type unions and node data contracts.
2. Implement default data and migration safety for older workflows.
3. Build node visuals and property editors.
4. Implement executor branches:
   - kafkaProduce: interpolate variables, send, capture metadata.
   - kafkaConsume: consume with timeout/filter and extract variables.
5. Add structured execution log entries for Kafka node events.

### Re-evaluation delta (2026-05-30)

Phase 4 scope remains correct, but delivery risk is mostly in integration points, not in raw Kafka calls.

Primary design adjustments from this re-review:

1. Keep all node-model additions aligned with existing workflow extension points instead of introducing Kafka-specific side channels.
2. Minimize graph-runner branching churn by isolating Kafka runtime behavior into dedicated handler module(s), following the current node-handler split pattern.
3. Treat variable insertion and node config UX parity as a mandatory gate, not optional polish, because most workflow regressions in this codebase appear in config modal and hint surfaces.
4. Add explicit redaction and payload-size guards in Kafka log detail so observability does not leak credentials or large message bodies.

Implementation anchors in the current codebase:

- workflow schema and node unions: `src/features/workflow/types/workflow.ts`
- node defaults and canvas type registration: `src/features/workflow/utils/workflowNodeFactory.ts`
- palette registration and grouping: `src/features/workflow/components/canvas/WorkflowPalette.tsx`
- node icon/category surfaces: `src/features/workflow/components/nodes/NodeIcon.tsx`
- config modal branch points and variable insert wiring: `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx`
- variable hint category map and hint merge logic: `src/features/workflow/utils/workflowVariableHints.ts`
- graph runner dispatch and handler context: `src/features/workflow/engine/graphRunner.ts`, `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts`, `src/features/workflow/engine/graphRunnerNodeHandlers.ts`

Phase 4 should be considered complete only when all of the above extension points are updated coherently.

### Required contracts (authoritative for Phase 4)

Workflow node additions:

- `kafkaProduce`
- `kafkaConsume`

Kafka Produce node data requirements:

- required: `clusterId`, `topic`
- optional input fields: `keyTemplate`, `partition`, `headers`, `bodyTemplate`
- optional runtime knobs: `ackMode`, `timeoutMs`
- optional extraction map: output variable bindings from produce metadata (`partition`, `offset`, `timestamp`, `topic`, `key`)

Kafka Consume node data requirements:

- required: `clusterId`, `topic`
- optional filters: `keyRegex`, `headerFilters`, `jsonPathFilters`
- required safety knobs: `timeoutMs`, `maxMessages`, `startPosition` (default bounded behavior)
- optional extraction map: selected message metadata/body fields to workflow variables

Migration and defaulting rules:

- old workflows (without Kafka nodes) remain byte-for-byte runnable
- missing new optional fields resolve to deterministic defaults
- invalid legacy node payloads are normalized, never crash the editor/runtime path

Execution result contract requirements:

- Kafka produce result includes deterministic metadata envelope
- Kafka consume result includes bounded message list plus selected-match metadata
- extraction failures are explicit node failures with actionable error messages

### Sub-phases

#### Phase 4A - Workflow contracts and defaults

Goal: add Kafka nodes to workflow schema safely before runtime behavior is implemented.

Status: complete.

Implementation steps:

1. Extend workflow unions and node contracts.
2. Define default config for produce and consume nodes.
3. Add migration safety for older workflows.
4. Add factory helpers and node-version snapshot tests so generated node payloads stay stable.

Outputs:

- stable workflow schema support for Kafka nodes

Detailed implementation checklist:

- update workflow node discriminated unions and node data interfaces
- add `defaultKafkaProduceNodeData()` and `defaultKafkaConsumeNodeData()` helpers
- register both node defaults in workflow node factory paths
- add migration guardrails in workflow hydration/normalization utilities
- add unit tests for defaults, migration normalization, and backwards compatibility
- keep optional Kafka fields omitted from saved payload when values are default-equivalent to avoid noisy workflow version diffs

Implementation notes (2026-05-30):

- The implemented Phase 4A slice is intentionally narrow: workflow schema, default factories, and persistence normalization only.
- Kafka produce/consume node contracts are now part of the workflow type system, and the factory returns deterministic defaults for both node kinds.
- Persisted Kafka payloads now omit default-equivalent optional fields so saved workflows stay stable across reopen/save cycles.
- Validation after implementation passed on the touched slice with focused workflow tests and a TypeScript build check.
- Re-review fix (2026-05-30): refined Kafka timeout stripping so a saved produce node no longer loses a valid non-default timeout when the persisted payload is ambiguous; consume defaults are still stripped when the data clearly looks like a consume node.
- Second validation round after the fix passed with focused workflow tests and `npx tsc -b --noEmit`.

Contract additions required in this phase:

- `KafkaProduceNodeData` and `KafkaConsumeNodeData` interfaces under workflow types
- shared typed structures for:
  - Kafka message header rows
  - consume filter rows (header and body/jsonpath)
  - extraction mappings for metadata/body fields
  - load-test behavior policy for consume nodes (aligned with existing event/wait node load semantics)
- deterministic default objects for all nested arrays and optional knobs

#### Phase 4B - Node UI and config editing

Goal: let users configure Kafka nodes in the designer.

Status: complete.

Implementation steps:

1. Build Kafka Produce node component and config form.
2. Build Kafka Consume node component and config form.
3. Add fields for cluster, topic, key, headers, filters, timeout, extraction, and body.
4. Follow existing workflow editor patterns for variable insertion and validation.
5. Align node editor copy and panel hierarchy with `docs/mockups/kafka-workflow-integration.html` while keeping existing RedfireForge workflow modal/components conventions.
6. Ensure every templated input supports variable insertion hints and placeholder parity with existing HTTP/workflow panels.

Outputs:

- workflow editor support for Kafka nodes

Implementation notes (2026-05-30):

- Added Kafka Produce and Kafka Consume config panels with the existing workflow editor field patterns.
- Registered Kafka nodes in the workflow palette and node icon/category surfaces.
- Wired Kafka variable hints and config modal routing through the shared workflow editor plumbing.
- Added focused component tests for the new Kafka panels and modal integration.
- Re-review fix after validation: corrected the Kafka Consume placeholder escaping issue and aligned tests with the new Integrations grouping.
- Validation after the fix passed with the targeted Kafka workflow/editor test slice and `npx tsc -b --noEmit`.
- Re-review round 2 (2026-05-31): found and fixed 3 additional issues:
  1. Missing canvas node components — created `KafkaProduceNode.tsx` and `KafkaConsumeNode.tsx`, registered in `nodeTypes`.
  2. `NON_HTTP_TYPES` used stale kebab-case entries — corrected to camelCase and added Kafka entries.
  3. `collectConditionVariableHints()` had no Kafka branches — added `kafkaProduce`/`kafkaConsume` to expose `outputBindings` as variable hints.
- Validation after round 2: `npx tsc -b --noEmit` clean, 212 files / 5187 tests passed.
- Mockup alignment (2026-05-31): aligned implemented UI with `kafka-workflow-integration.html` mockup:
  - Added `--cat-integration` CSS variables (teal `#32d0a5`) across all 12 theme blocks.
  - Added Kafka canvas node CSS (`.wf-node-kafkaProduce`, `.wf-node-kafkaConsume`, `.wf-kafka-body`, `.wf-kafka-details`, `.wf-kafka-topic`, `.wf-kafka-cluster`, `.wf-kafka-meta`).
  - Changed Kafka node category from `action` to `integration` in `NodeIcon.tsx` with "Integration" label.
  - Added `.wf-kafka-section` / `.wf-kafka-section-title` grouping for Headers, Filters, and Output Bindings in config panels.
  - Added label truncation selectors for `wf-kafka-body` plus 3 other missing node types.
- Validation after mockup alignment: `npx tsc -b --noEmit` clean, 212 files / 5187 tests passed.

Detailed implementation checklist:

- [x] add node renderer cards for produce/consume in workflow canvas node registry
- [x] add config editors with explicit required-field validation and inline errors
- [x] add extraction-mapping UI section consistent with existing variable mapping conventions
- [x] add reset-to-default behavior for advanced optional fields
- [x] add component tests for edit/save/reopen persistence and validation messages

Additional UI parity gates:

- [x] register both node types in workflow palette category lists and search behavior
- [x] add icon/category display mapping for both node types
- [x] expose variable insert actions on all templated fields (topic/key/body/header values/filter expressions/extraction expressions)
- [x] ensure config modal Input/Output/Logs tabs still render correctly for Kafka nodes and do not regress existing node types

#### Phase 4C - Executor integration

Goal: make Kafka nodes actually run.

Implementation steps:

1. Add executor branch for Kafka Produce.
2. Add executor branch for Kafka Consume.
3. Support interpolation, extraction, and timeout behavior.
4. Use selected cluster profile without bypassing shared transport paths.
5. Ensure node outputs are written into the same variable context surface used by non-Kafka nodes.

Outputs:

- functional Kafka workflow execution

Detailed implementation checklist:

- **extend `NodeHandlerContext` in `graphRunnerNodeHandlerContext.ts`**: add `kafkaOperations?: KafkaNodeOperations` optional field so Kafka handlers receive client dependencies through the shared context and remain unit-testable without a live broker; define `KafkaNodeOperations` interface (produce, consume, ping) in the same file or a co-located module
- create `src/features/workflow/engine/graphRunnerKafkaNodeHandlers.ts` with `handleKafkaProduceNode` and `handleKafkaConsumeNode` exports; all Kafka network calls go through `ctx.kafkaOperations`; no singleton/global client access inside the handler
- **update `graphRunner.ts` dispatch chain** (if-else chain at the `kafkaProduce` / `kafkaConsume` node types, after the existing `correlationWait` branch): add `else if (node.type === 'kafkaProduce')` and `else if (node.type === 'kafkaConsume')` cases calling the new handlers
- **update `graphRunnerNodeHandlers.ts` barrel**: add a `── Kafka nodes ──` section with re-exports of `handleKafkaProduceNode` and `handleKafkaConsumeNode` from the new handler module
- perform interpolation using `ctx.resolve()` from `VariableContext` for all template fields (`topic`, `keyTemplate`, `bodyTemplate`, header values, filter expressions) before constructing the network call; validate the rendered shape and return a node failure result if required fields are blank after resolution
- **`outputBindings` mechanics**: iterate `data.outputBindings`, skip disabled entries; for each enabled binding map `binding.source` (`'topic' | 'partition' | 'offset' | 'timestamp' | 'key'`) from the produce/consume result envelope and call `ctx.set(binding.targetVariable, String(value))`; if the source field is absent from the result, write an empty string and emit a warning log line (not a node failure)
- **`startPosition` field**: pass `data.startPosition` (default `'latest'` if omitted) to the Kafka client consume call; the consume handler must not hardcode a start position
- **`loadTestBehavior` field**: gate on `ctx.loadTestMode`; when `loadTestMode` is `true`, respect `data.loadTestBehavior.mode` — `'wait-for-real'` behaves identically to normal mode; `'auto-resume'` short-circuits the actual consume and resumes the node immediately with a synthetic empty result; `'synthetic-inject'` injects the configured synthetic payload as if a real message was received; document the synthetic-inject payload source in the handler JSDoc
- enforce bounded consume defaults at runtime even if omitted from node data: `timeoutMs` and `maxMessages` must never be unbounded
- add executor tests in `graphRunnerKafkaNodeHandlers.test.ts` covering: produce success with `outputBindings` written correctly; consume match with extraction; consume no-match timeout; validation failure (blank topic); auth/TLS/network failure classification; `loadTestBehavior: 'auto-resume'`; `startPosition: 'earliest'`

UI guidance note for post-Phase-4 surfaces:

- when publish/consume standalone screens are implemented, model the UX flow and grouping after `docs/mockups/kafka-message-studio.html` (bounded consume defaults, explicit filter blocks, and result-action footer buttons).

#### Phase 4D - Logging and mixed-workflow validation ✅

Goal: make Kafka workflows observable and safe to combine with existing nodes.

**Status: Complete**

Implementation notes:

- Defined `CapturedKafkaNodeDetails` and `KafkaFailureClass` types in `src/shared/types/trace.ts`; exported from shared types index.
- Added `kafkaDetails?: CapturedKafkaNodeDetails` field to `ExecutionEventDetails` for structured trace capture.
- Added `capturedKafkaDetails` map to `NodeHandlerContext` (parallel to `capturedHttpDetails`).
- Updated `graphRunner.ts`: initializes `capturedKafkaDetails` Map; passes through hCtx; Kafka trace event details block now merges `kafkaDetails` from the captured map alongside existing `kafkaConsumeBody`/`kafkaConsumeCount` temp vars.
- Enhanced both Kafka handlers with `performance.now()` timing, `capturedKafkaDetails` population, `truncate()` body preview (max 512 chars), and `classifyKafkaFailure()` error categorization.
- `classifyKafkaFailure()` classifies errors into: auth, tls, timeout, network, validation (with network as default fallback). Exported from barrel for reuse.
- Log messages now include duration (`Nms`) in success lines and `[failureClass]` prefix in error lines.
- Secret-safe: `CapturedKafkaNodeDetails` interface deliberately omits auth/TLS fields — no credentials can leak into traces.
- Created `graphRunner.kafkaNodes.test.ts` with 33 tests covering: failure classification (15 error categories), produce/consume capture details, body truncation, empty body, validation error exclusion, variable flow across produce→consume, secret omission, and non-Kafka regression.
- All 1172 engine tests pass (58 files), tsc clean.

Detailed implementation checklist:

- **extend `ExecutionEventDetails`** in `src/shared/types/trace.ts`: add a `// Kafka nodes` section with `kafkaDetails?: CapturedKafkaNodeDetails`; define `CapturedKafkaNodeDetails` interface with `{ topic: string; partition?: number; offset?: number; key?: string; durationMs: number; matchedMessages?: number; failureClass?: 'validation' | 'auth' | 'tls' | 'timeout' | 'network' | 'extraction' }`
- **extend `NodeHandlerContext`** in `graphRunnerNodeHandlerContext.ts`: add `capturedKafkaDetails?: Map<string, CapturedKafkaNodeDetails>` (parallel to existing `capturedHttpDetails`, `capturedSubWorkflowTraces`, `capturedScriptOutput` maps)
- **extend `graphRunner.ts`**: initialize `capturedKafkaDetails` Map; pass it through `NodeHandlerContext`; add `kafkaProduce` and `kafkaConsume` cases in the `onNodeComplete` `eventDetails` block to consume the map (same pattern as `capturedDetails = capturedHttpDetails.get(nodeId)`)
- **Kafka handler logging pattern**: emit three log lines per node — start (`prefix: '*'`, includes label, topic, timeout), outcome (`prefix: '*'` for success or `prefix: '!'` for failure), and a summary line with partition/offset/matchedMessages count
- **payload truncation**: use `truncate()` from `src/shared/utils/helpers.ts` (already exported); apply a max of **512 characters** for message value/body previews in log lines; never log full raw payloads
- **secret-safe logging**: auth credentials and TLS key/cert material must **not be logged at all** (omission, not masking); there is no `redact()` utility in the codebase — do not invent one; the handler simply skips those fields when building the log context object
- add standardized log event categories for Kafka node start/success/failure; include cluster id, topic, timeout, and bounded consume parameters in log context
- add mixed integration tests in a new `graphRunner.kafkaNodes.test.ts` file covering: `http -> kafkaProduce -> kafkaConsume -> http` chain; variable context flows across node boundaries; failure in Kafka node propagates/does not propagate based on `continueOnError` flag
- add regression tests in `graphRunner.kafkaNodes.test.ts` confirming non-Kafka workflows produce identical behavior after Kafka dispatch cases are added

Observability guardrails:

- truncate large message payload/body previews using `truncate()` from `helpers.ts` at max **512 characters**
- include message counts and timing metrics, not full raw payloads, in summary log lines
- ensure error logs include actionable failure class (validation, auth, tls, timeout, network, extraction) — matches `CapturedKafkaNodeDetails.failureClass` enum values

### Test plan

- Type-level and factory tests for node defaults.
- Executor tests for success/failure/timeout/filter/extraction paths.
- Workflow integration tests combining Kafka + HTTP nodes.

### Validation matrix (required before Phase 4 exit)

Contract and factory validation:

- node type unions compile cleanly with new Kafka node variants
- default factory snapshots are deterministic
- migration tests confirm old workflow fixtures still load and run

UI validation:

- node editors persist values across open/close cycles
- required fields block save with actionable inline errors
- variable insertion support works for templated fields

Runtime validation:

- produce success path writes metadata variables
- consume bounded fetch path returns deterministic envelope
- timeout, auth, tls, network, and validation failures classify correctly
- extraction mismatch/failure messages are explicit and non-ambiguous
- log entries are secret-safe and payload-size bounded

Mixed-flow validation:

- Kafka and HTTP nodes share variable context safely
- retry/continue-on-error behavior remains consistent with existing engine expectations

### Risks and mitigations

- Risk: variable extraction from malformed payloads.
- Mitigation: safe parse + explicit extraction failure results with actionable messages.
- Risk: consume nodes create long-running/flaky runs.
- Mitigation: enforce bounded defaults and require explicit opt-in to broader windows.
- Risk: hidden schema drift in node payload versions.
- Mitigation: node default snapshot tests plus migration fixture coverage.

### Exit criteria

- Kafka nodes execute in workflow engine with deterministic behavior.
- Existing non-Kafka workflows remain unaffected.
- Phase 4A-4D validation matrix passes with no unresolved type, test, or runtime regressions.

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

### Re-evaluation delta (2026-05-30)

Phase 5 scope remains valid, but the primary risk is orchestration consistency across runner, server callback, and correlation-store boundaries.

Primary design adjustments from this re-review:

1. Build Kafka trigger-start behavior on top of the existing trigger execution boundary and execution history persistence paths instead of adding a separate start pipeline.
2. Keep KafkaWait lifecycle compatible with existing correlation-wait semantics (pause, long-poll resume, timeout, cancellation) and reuse current correlation store abstractions.
3. Treat idempotency and stale-wait cleanup as mandatory exit gates, not optional hardening tasks.
4. Require explicit classification for resume outcomes (matched, non-matching, timed out, cancelled, duplicate) so run-history diagnostics remain actionable.
5. Enforce server/browser execution parity: trigger and wait behavior must remain consistent whether the workflow is resumed through browser long-poll bridges or server-owned execution paths.

Implementation anchors in the current codebase:

- trigger node handling and variable seeding patterns: `src/features/workflow/engine/graphRunnerTriggerHandlers.ts`
- correlation wait runtime handler behavior: `src/features/workflow/engine/graphRunnerCorrelationWaitHandler.ts`
- correlation store contracts and in-memory behavior: `src/features/workflow/engine/correlationStore.ts`
- browser remote correlation bridge and long-poll behavior: `src/features/workflow/engine/remoteCorrelationStore.ts`
- server correlation API, wait/resume queue, idempotency hooks: `src-server/correlation-handler.ts`
- server webhook execution entrypoint and workflow execution persistence: `src-server/webhook-server.ts`, `src-server/executeWorkflow.ts`

Phase 5 should be considered complete only when trigger-start and wait-resume are consistent across both browser-side and server-side correlation flows.

Critical parity constraint discovered during re-review:

- current shared server execution entry (`src-server/executeWorkflow.ts`) invokes graph runner without correlation-store wiring; Phase 5 must include explicit server-side correlation-store integration for wait/resume flows before phase exit.

### Required contracts (authoritative for Phase 5)

Kafka Trigger contract requirements:

- required: `clusterId`, `topic`, workflow target identifiers
- optional filters: key/header/jsonpath match blocks
- required variable seeding map from inbound message metadata/body
- explicit backpressure and concurrent-start bounds for trigger consumers

KafkaWait contract requirements:

- required: correlation extraction source/path/header/query fields
- required timeout and cancellation behavior with deterministic state transitions
- optional webhook/message filter expression with explicit pre-validation failure behavior
- explicit idempotency key strategy for duplicate callbacks and replay scenarios

Execution result contract requirements:

- trigger-start result includes source topic/partition/offset and seeded-variable summary
- wait-resume result includes waitDurationMs and resume source metadata
- timeout/cancel/duplicate resumes surface distinct, diagnosable failure classes

### Sub-phases

#### Phase 5A - Trigger contracts and workflow start boundary

Goal: define how inbound Kafka messages become workflow starts.

Implementation steps:

1. Add trigger contract for cluster, topic, filter, and variable seeding.
2. Define trigger registration lifecycle and backpressure limits.
3. Ensure inbound message handling is isolated from UI concerns.

Outputs:

- Kafka Trigger execution boundary

Detailed implementation checklist:

- add `KafkaTriggerNodeData` interface to `src/features/workflow/types/workflow.ts` and add it to the `WorkflowNodeData` union (alongside `KafkaProduceNodeData | KafkaConsumeNodeData`)
- add `KafkaWaitNodeData` interface to the same file and add it to the `WorkflowNodeData` union; define correlation extraction fields (source: `body` | `header` | `query`, path, expected value) mirroring the existing `CorrelationWaitNodeData` shape
- **also update `WorkflowNodeType` string literal union** in the same file to include `'kafkaTrigger'` and `'kafkaWait'` (currently ends at `'kafkaProduce' | 'kafkaConsume'`); without this addition the type system will not accept these node types
- define consumer group ID strategy for trigger subscriptions: derive group ID deterministically from `workflowId + triggerNodeId` so re-subscriptions on reconnect rejoin the same consumer group and do not replay already-processed offsets
- state trigger offset policy explicitly: default is `latest` (do not replay messages delivered before trigger was registered); `earliest` is opt-in only and must be a user-configurable field on `KafkaTriggerNodeData`
- define Kafka context variable keys seeded into workflow variable context after trigger fires: `kafka.trigger.topic`, `kafka.trigger.partition`, `kafka.trigger.offset`, `kafka.trigger.key`, `kafka.trigger.value`, and each message header as `kafka.trigger.header.<name>`; document these in contracts alongside existing `webhook.*` context keys
- define parallel context variable keys seeded on KafkaWait resume: `kafka.wait.topic`, `kafka.wait.partition`, `kafka.wait.offset`, `kafka.wait.key`, `kafka.wait.value`, and each header as `kafka.wait.header.<name>`
- define backpressure behavior on concurrent-start limit-hit: consumer is paused (not disconnected) when active trigger-started run count reaches the configured maximum; consumer auto-resumes when active count drops below the threshold; document the default maximum and where it is configured
- add contract tests for trigger payload mapping, invalid-config handling, and group ID derivation

#### Phase 5B - Trigger runtime and filtering

Goal: start workflows from real Kafka messages in a controlled way.

Implementation steps:

1. Implement trigger subscriptions.
2. Apply key, header, and JSON-path style matching.
3. Seed workflow variables from matched payloads.
4. Prevent duplicate workflow starts where possible.

Outputs:

- real Kafka-triggered workflow starts

Detailed implementation checklist:

- ✅ extend `src/features/workflow/engine/graphRunnerTriggerHandlers.ts` with a `KafkaTrigger` case handler; mirror the existing `WebhookTrigger` pattern for variable seeding, using the `kafka.trigger.*` context keys defined in 5A
- ✅ apply key/header/jsonpath filters before workflow-start dispatch (`matchesKafkaMessageFilters` — pure pre-dispatch filter; not called inside the handler itself)
- ✅ persist trigger-start execution metadata (topic, partition, offset, seeded-variable summary) via existing workflow execution storage paths
- ✅ add runtime tests for matching/non-matching/duplicate message delivery
- 🔲 implement trigger subscription startup/shutdown with explicit backpressure guardrails — **deferred**; see sub-task breakdown below
- 🔲 add bounded trigger-consumer startup/shutdown tests to confirm no orphan consumers on reconnect/redeploy paths — **deferred**; follows subscription manager implementation

**Phase 5B Deferred: Bounded Subscription Lifecycle — Sub-task Breakdown**

*Researched 2026-06-02. The following is a concrete, dependency-ordered work plan.*

**What already exists that Phase 5B can build on:**
- `KafkaTriggerNodeData.maxConcurrentRuns?: number` typed and defaulting to 10 in the node factory
- `matchesKafkaMessageFilters` — pure filter function, ready for use as pre-dispatch gate
- `deriveKafkaTriggerGroupId` — deterministic consumer group ID derivation
- `KafkaService.subscribe()` + `unsubscribe()` — long-lived consumer with ring buffer and cleanup hook
- `executeWorkflow()` in `src-server/executeWorkflow.ts` — shared execution entry point that resolves after `runGraph` completes; the promise resolution is the natural completion signal for `activeRunCount` decrement
- `Semaphore` class available at `src/shared/utils/semaphore.ts` (used by `WaitForCondition` nodes; not needed for this feature but referenced for pattern parity)

**What does NOT exist and must be built:**

Sub-task 1 — `src-server/kafka/kafka-adapter.ts`

Add `pause` and `resume` to the `KafkaConsumerAdapter` interface and implement in `KafkaJsConsumerAdapter`. KafkaJS natively supports `consumer.pause([{ topic, partitions? }])` and `consumer.resume(...)` as synchronous calls — they are not currently exposed through the adapter:

```ts
// Add to KafkaConsumerAdapter interface:
pause(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void;
resume(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void;

// KafkaJsConsumerAdapter implementation:
pause(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void {
  this.consumer.pause(topicPartitions);
}
resume(topicPartitions: Array<{ topic: string; partitions?: number[] }>): void {
  this.consumer.resume(topicPartitions);
}
```

Any mock `KafkaConsumerAdapter` used in tests must also gain these two no-op methods.

Sub-task 2 — Shared types + `executeWorkflow.ts` ✅

**Re-review (2026-06-03) found three gaps beyond the original plan; all fixed:**

1. **`src/shared/types/server-api.ts`** — `TriggerType` was still `'webhook' | 'schedule'`; extended to `'webhook' | 'schedule' | 'kafka-trigger'`. This is the shared type used by both the browser UI and the server — `ExecutionResult.triggerType: TriggerType` would have silently stored an invalid type for Kafka-triggered executions if left as-is. The UI execution history reads this field to display trigger type labels.

2. **`src-server/executeWorkflow.ts`** — `WorkflowExecutionInput.triggerType` already included `'kafka-trigger'`, but `saveErrorResult`'s input type still had the old `'webhook' | 'schedule'` union. Extended to `'webhook' | 'schedule' | 'kafka-trigger'`. Note: `saveErrorResult` is called from `webhook-server.ts` and `cron-scheduler.ts` but NOT from `kafkaTriggerSubscriptionManager.ts` (which handles dispatch errors inline).

3. **`src-server/kafka/kafka-adapter.ts`** — `KafkaConsumerRecord.timestamp` was `timestamp?: string` (optional), but `KafkaConsumedMessage.timestamp` is `timestamp: string` (required). The subscription manager passes `record: KafkaConsumerRecord` to `matchesKafkaMessageFilters(record, ...)` which expects `KafkaConsumedMessage`. KafkaJS always provides `message.timestamp` as a string in `eachMessage`, so making it required is correct.

**Tests added:** 1 new `saveErrorResult` test for `triggerType: 'kafka-trigger'` in `executeWorkflow.test.ts`.

**tsc note:** The default `npx tsc --noEmit` only checks `tsconfig.app.json` (covers `src/`). Server code requires `npx tsc -p tsconfig.server.json --noEmit` to catch server-side type errors. Both Phase 5B type errors were confirmed fixed by the server-side check.

Sub-task 3 — `src-server/kafka/kafkaTriggerSubscriptionManager.ts` (new file) ✅

Per-`(workflowId, nodeId)` trigger registry owning consumer lifetime and enforcing backpressure.

**Actual implementation** (differs slightly from original plan — better design):
- `activateTrigger` accepts `{ workflow, nodeId, connection, onLog? }` and derives `triggerData` internally from `workflow.nodes`. This removes the `triggerData` and `runtimeAdapter` params from the public API; `runtimeAdapter` is constructor-injected.
- `dispatchWorkflowRun` is a private module-level function (not an `onDispatch` callback) that calls `executeWorkflow` directly, building `__kafkaTriggerMessage` from the record.
- `getEntries()` returns a stripped snapshot (no consumer/cleanup refs) — better for the status endpoint.

```ts
interface TriggerEntry {
  workflowId: string;
  nodeId: string;
  topic: string;
  maxConcurrentRuns: number;
  activeRunCount: number;
  paused: boolean;
  /**
   * Set by cleanup() before consumer.stop() so in-flight finally() callbacks
   * never call consumer.resume() on a stopped consumer.
   */
  cancelled: boolean;
  consumer: KafkaConsumerAdapter;
  groupId: string;
  cleanup: () => Promise<void>;
}

class KafkaTriggerSubscriptionManager {
  // key: `${workflowId}::${nodeId}`
  private readonly entries = new Map<string, TriggerEntry>();

  async activateTrigger(params: {
    workflow: Workflow;
    nodeId: string;
    connection: KafkaConnectionConfig;
    onLog?: (line: LogLine) => void;
  }): Promise<void>;

  async deactivateTrigger(workflowId: string, nodeId: string): Promise<void>;
  async deactivateAll(): Promise<void>;
  getEntries(): Array<{ workflowId; nodeId; topic; groupId; maxConcurrentRuns; activeRunCount; paused }>;
}
```

`activateTrigger` message-dispatch logic inside `consumer.run()`:

```
if (!matchesKafkaMessageFilters(record, data.keyRegex, data.headerFilters, data.jsonPathFilters)) return;

if (entry.activeRunCount >= entry.maxConcurrentRuns) {
  // Race-window message after pause() — drop with warning log
  return;
}

entry.activeRunCount++;

if (!entry.paused && entry.activeRunCount >= entry.maxConcurrentRuns) {
  entry.paused = true;
  consumer.pause([{ topic }]);
}

void dispatchWorkflowRun(workflow, entry, record, onLog).finally(() => {
  entry.activeRunCount--;
  // Guard: don't resume a stopped consumer after deactivateTrigger
  if (entry.paused && !entry.cancelled && entry.activeRunCount < entry.maxConcurrentRuns) {
    entry.paused = false;
    consumer.resume([{ topic }]);
  }
});
```

**Key correctness invariants (verified by tests):**
1. Entry is NOT added to the map until after `consumer.connect()` + `consumer.subscribe()` succeed — no stale broken entries on connect failure.
2. `entry.cancelled = true` is set by `cleanup()` before `consumer.stop()` — in-flight `finally()` callbacks skip `consumer.resume()` after deactivation.
3. `consumer.run(...)` has a `.catch(...)` handler — startup errors are logged, not silently swallowed.

Sub-task 4 — `src-server/routes/kafka-trigger-routes.ts` (new file) + mount in `webhook-server.ts` ✅

REST endpoints for manual trigger activation/deactivation:

```
POST /api/kafka/trigger/activate   { workflowId, nodeId }
POST /api/kafka/trigger/deactivate { workflowId, nodeId }
GET  /api/kafka/trigger/active
```

Note: the original plan spec included `clusterId` in the `activate` body — the implementation intentionally ignores it and uses `kafkaService.getSnapshot().connection` instead, since the server manages one Kafka connection at a time.

`webhook-server.ts`: mounts the new router; calls `kafkaTriggerSubscriptionManager.deactivateAll()` in the SIGTERM/SIGINT shutdown handler.

**Re-review (2026-06-03) — bug fix and tests added:**

- **Bug fixed**: `POST /api/kafka/trigger/activate` previously returned HTTP 500 for client-side validation errors (node not found in workflow, node is not a kafkaTrigger type). Fixed by adding pre-validation in the route before calling `manager.activateTrigger()`: returns 404 when `nodeId` does not exist in `workflow.nodes`; returns 400 when the node exists but has a different type. Consumer infrastructure errors (connect/subscribe failures) still correctly return 500.
- **New file**: `src-server/routes/kafka-trigger-routes.test.ts` — 18 tests using supertest + mock service + mock manager pattern (matching `kafka-routes.test.ts` conventions). Coverage: input validation (400 for blank/missing fields), workflow not found (404), node not found (404), wrong node type (400), Kafka not connected (503), defensive connected-but-no-connection-object (503), happy-path 200 with `activateTrigger` call verified, `activateTrigger` throws (500), `deactivateTrigger` idempotent (200 even when trigger not active), active entries list (empty + populated).

Sub-task 5 — `src-server/kafka/kafkaTriggerSubscriptionManager.test.ts` (new file)

≥10 unit tests using a mock `KafkaConsumerAdapter` (7-method interface including `pause`/`resume`) and mocked `onDispatch`:

| Test | Validates |
|---|---|
| activateTrigger starts consumer on correct topic and group ID | happy path wiring |
| messages matching filters are dispatched via onDispatch | filter pass-through |
| messages NOT matching filters are ignored | filter rejection |
| activeRunCount increments on dispatch, decrements via finally() | counter lifecycle |
| consumer.pause called when activeRunCount reaches maxConcurrentRuns | backpressure trigger |
| consumer.resume called when activeRunCount drops below limit | backpressure release |
| messages in race window after pause are dropped (no dispatch) | drop-on-limit guard |
| deactivateTrigger stops and disconnects consumer | cleanup |
| deactivateAll cleans up all entries | server shutdown |
| re-activating an existing trigger deactivates the old consumer first | idempotent re-activation |

**Design decisions:**
- Race-window messages (arriving after `pause()` because kafkajs buffers internally) are **dropped with a warning log** (no queue). A queue adds complexity and unpredictable re-ordering; dropped messages are preferable for controlled load behavior.
- `pause/resume` granularity is per-topic (all partitions). If a workflow has multiple `kafkaTrigger` nodes on different topics, each has its own consumer instance.
- Activated triggers are **runtime-only** — not persisted. They are lost on server restart. Persistence of "which workflows have active Kafka triggers" (i.e., auto-restarting trigger subscriptions on server boot from a stored activation list) is unplanned future scope — it would require a new dedicated phase covering a workflow-activation store, boot-time subscription replay, and conflict-resolution on partial-restart scenarios.

#### Phase 5C - KafkaWait runtime

Goal: allow workflows to pause and resume on correlated Kafka messages.

Implementation steps:

1. Add wait state registration and correlation metadata.
2. Implement matching precedence and tie-breaking.
3. Resume workflow only on matching inbound messages.
4. Support timeout and cancellation paths.

Outputs:

- KafkaWait execution path

Detailed implementation checklist:

- **architecture decision**: KafkaWait gets its own handler `src/features/workflow/engine/graphRunnerKafkaWaitHandler.ts` (not an extension of `graphRunnerCorrelationWaitHandler.ts`) because Kafka extraction sources differ from webhook callback sources; the two handlers share correlation store abstractions but not handler code
- register wait states in correlation store with deterministic `timeoutAt` behavior, keyed by `KafkaWaitNodeData`-derived correlation config
- support correlation extraction from Kafka message body/header/key with explicit validation failures and `kafka.wait.*` context variable injection on resume
- wire resume path through existing long-poll/store abstractions (`correlationStore.ts`, `remoteCorrelationStore.ts`) without custom side channels
- **critical**: update `src-server/executeWorkflow.ts` to wire the correlation store instead of passing `undefined` (currently at line 73: `undefined, // correlationStore`); use the correlation store factory already present in `src-server/correlation-store-factory.ts`
- **critical**: also wire `kafkaOperations` in the same `runGraph` call in `executeWorkflow.ts` — it is currently absent entirely (the parameter is optional so TypeScript does not error, but without it any Kafka produce/consume nodes inside a Kafka-triggered workflow will silently be no-ops at the server execution path); the `KafkaNodeOperations` instance must be sourced from the server-side KafkaService and passed as the 18th argument to `runGraph`
- note: `graphRunnerCorrelationWaitHandler.test.ts` does NOT currently exist in the codebase; create it as part of this phase to cover the existing `graphRunnerCorrelationWaitHandler.ts` handler before extending the correlation path
- add tests for KafkaWait: wait->resume happy path, no-match path, timeout path, and consumer cleanup on timeout (no lingering Kafka subscription after wait expires)

#### Phase 5D - Recovery, idempotency, and observability ✅

Status: **Completed 2026-05-31**

Goal: harden trigger/wait behavior under real timing problems.

Implementation steps:

1. ✅ Add idempotency token strategy for waits.
2. ✅ Add restart and disconnect recovery behavior.
3. ✅ Add observable run-history states for waiting, resumed, timed out, and cancelled.
4. ✅ Validate race and replay scenarios.

Gate to phase exit:

- ✅ trigger and wait flows remain correct under rebalance, replay, timeout, and reconnect scenarios

Detailed implementation checklist:

- ✅ enforce idempotency handling for duplicate callbacks and replayed resume requests
- ✅ add stale-correlation cleanup checks for timeout and restart scenarios
- ✅ ensure run-history/status events distinguish waiting, resumed, timed out, cancelled, and duplicate
- ✅ add recovery tests for server restart/disconnect and delayed callback races
- ✅ verify response parity for resume outcomes across direct resume endpoint and callback endpoint flows

**Implementation Notes (2026-05-31):**

The key building block is the `dispatchKafkaResumeMessage(message)` function added to `correlation-handler.ts`. It is the main entry point for the server-side Kafka consumer: it receives an inbound Kafka message, extracts a correlation ID, finds the matching paused workflow, enforces idempotency, and calls `notifyResume()`. The design follows the existing HTTP webhook correlation path exactly for parity.

Key design decisions:
- **Idempotency key format**: `kafka:${topic}:${partition}:${offset}` — uniquely identifies a message position. Replayed offsets are detected via `checkIdempotency()` (same table used by HTTP webhooks). If idempotency key is cached AND the correlation is no longer in the store (already resumed), returns `{ resumed: false, reason: 'duplicate' }`. If the correlation is still in the store (e.g., new execution re-registered with same correlationId), it proceeds normally.
- **Correlation extraction** (`extractKafkaCorrelationId`): supports `key` (message key), `body` (JSON parse + JSONPath on message value), and `header` (case-normalised header lookup). A new `case 'key': return undefined` was added to the HTTP `extractCorrelationId` function so HTTP webhooks never accidentally match key-sourced entries.
- **Stale-wait cleanup**: `matchKafkaCorrelation` removes expired entries during the scan before checking expiry, matching the HTTP `matchCorrelation` pattern.
- **Orphaned entries after restart**: if `notifyResume()` finds no in-process waiter, it queues in `queuedResumes` for long-poll pickup — same as direct resume. Server restart resilience is inherited from the existing mechanism.
- **Outcome classification**: `graphRunnerKafkaWaitHandler.ts` now sets `__kwOutcome` in all wait paths (`'matched'`, `'timed_out'`, `'cancelled'`). `graphRunner.ts` reads it and populates `kafkaWaitDetails.outcome`. The `ExecutionEventDetails.kafkaWaitDetails.outcome` type was added to `trace.ts`.
- **Phase 5C bridge bug fixed**: `serverCorrelationBridge.ts` was incorrectly mapping `correlationSource === 'key'` to `'body'` before storing the `ServerPausedEntry`. This lost the source information needed for `matchKafkaCorrelation`. Fixed by removing the mapping — `'key'` is now preserved as-is.
- **Test coverage**: 36 new tests in `src-server/correlation-handler.kafka.test.ts` covering `extractKafkaIdempotencyKey`, `extractKafkaCorrelationId`, `matchKafkaCorrelation`, and `dispatchKafkaResumeMessage`. All 36 pass. 118 pre-existing tests in sibling files remain passing. TSC: 0 errors.

**Phase 5 second re-evaluation (2026-06-02):** Thorough code review of all Phase 5 source (7 files) and test (7 files) found **zero bugs**. All 187 tests pass (170 race/resilience + 17 contracts). Key validations:
- Abort-race pattern (`Promise.race` + `.catch(() => {})`) is correct — prevents unhandled rejection and properly classifies abort vs timeout in the catch block.
- `ServerCorrelationBridge.cleanup()` iteration-during-delete is safe (Map spec guarantees correctness); `matchKafkaCorrelation` uses array snapshot from `listAll()`.
- Idempotency guard (`!activeStore.find(match.correlationId)`) correctly allows replay when a new execution re-registers the same correlationId.
- Double-reject prevention confirmed: timeout callback, cancel(), and resume() all check `this.callbacks.has(correlationId)` before acting.
- `extractCorrelationId` HTTP path `case 'key': return undefined` confirmed in place.
- Integration chain (kafkaTrigger → kafkaWait → HTTP) validated end-to-end in both auto-resume and store-backed modes.
- No Docker validation needed — Phase 5 is purely in-memory correlation store logic.

### Validation matrix (required before Phase 5 exit)

Contract and lifecycle validation:

- trigger and wait contracts compile with deterministic defaults and migration-safe loading
- registration/cleanup logic leaves no stale correlation entries after timeout/cancel flows

Runtime validation:

- trigger starts exactly one workflow run for one matching inbound message
- wait resumes exactly once for one matching callback and ignores non-matching callbacks
- timeout and cancellation outcomes are explicit and stable under repeated runs
- duplicate callback delivery is idempotent and does not create duplicate resumes
- server-owned execution and browser-bridge execution produce equivalent wait/resume state transitions

Recovery validation:

- in-flight waits recover safely across reconnect/restart boundaries
- stale queued resumes expire without leaking memory or creating phantom completions

Observability validation:

- run history and logs expose trigger source metadata and wait state transitions
- failure states are classified into actionable categories (filter mismatch, timeout, cancelled, duplicate, transport)
- resume pathways report source channel (direct resume vs callback path) for operational diagnosis

### Test plan

- Trigger integration tests with seeded variable assertions.
- Wait/resume tests for match/no-match/timeout/race conditions.
- Recovery tests for restart/disconnect while waiting.
- Idempotency tests for duplicate resume callback delivery.

### Execution slicing matrix (recommended)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Exit Gate |
| --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p5a-trigger-contracts` | Workflow Engine | 1.0-1.5 days | Phase 4 complete | Trigger/wait contracts compile with deterministic defaults |
| 2 | `kafka-p5b-trigger-runtime` | Platform Runtime | 1.5-2.0 days | PR1 | Exactly one workflow start for one matching event |
| 3 | `kafka-p5c-wait-runtime` | Workflow Engine + Server Runtime | 2.0-2.5 days | PR2 | Exactly one resume for one matching callback; server/browser parity |
| 4 | `kafka-p5d-hardening` | Server Runtime + Observability | 1.5-2.0 days | PR3 | Duplicate/replay safe; no stale waits; diagnosable terminal outcomes |

Recommended ownership split:

- Workflow Engine: trigger/wait contract modeling, runner-facing lifecycle behavior, contract tests.
- Platform Runtime: trigger subscribe/filter/start path and execution metadata persistence.
- Server Runtime: correlation API parity, idempotent resume handling, restart/reconnect cleanup.
- Observability: outcome classification, log/history diagnostics, parity traceability.

### PR kickoff checklist (Phase 5)

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p5a-trigger-contracts` | `feature/kafka-p5a-trigger-contracts` | `npx vitest run src/features/workflow/engine/graphRunnerTriggerHandlers.test.ts` | trigger/wait contracts compile with deterministic defaults |
| `kafka-p5b-trigger-runtime` | `feature/kafka-p5b-trigger-runtime` | `npx vitest run src/features/workflow/engine/graphRunnerTriggerHandlers.test.ts` and `npx vitest run src-server/webhook-server.test.ts` | matching event starts one run; non-matching events ignored |
| `kafka-p5c-wait-runtime` | `feature/kafka-p5c-wait-runtime` | `npx vitest run src/features/workflow/engine/graphRunnerCorrelationWaitHandler.test.ts` (create this file as part of 5C), `npx vitest run src/features/workflow/engine/correlationWaitHelpers.test.ts`, `npx vitest run src-server/correlation-handler.test.ts`, and `npx vitest run src-server/executeWorkflow.test.ts` | matching callback resumes once; `executeWorkflow.ts` correlation store no longer `undefined`; server/browser parity proven |
| `kafka-p5d-hardening` | `feature/kafka-p5d-hardening` | `npx vitest run src-server/correlation-handler.test.ts`, `npx vitest run src-server/webhook-server.test.ts`, and `npx vitest run src-server/executeWorkflow.test.ts` | duplicate/replay idempotency, stale cleanup, and diagnosable outcomes verified |

Phase 5 PR readiness sequence:

1. Create `feature/*` branch for the slice from latest `develop`.
2. Run `npx tsc --noEmit` and the slice minimum test set.
3. Validate run-history/log classification for changed wait/trigger outcomes.
4. Include test evidence and scenario proof in PR body before review.

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

### Re-evaluation delta (2026-05-30)

Phase 6 direction remains correct, but this re-review identifies a contract boundary risk: current runner and result contracts are HTTP-shaped and must be extended carefully to avoid regressions in mixed suites.

Primary design adjustments from this re-review:

1. Add Kafka runner actions through explicit action typing first; avoid overloading existing HTTP-only scenario fields.
2. Preserve backward compatibility for existing HTTP scenarios while adding Kafka-specific request/result metadata.
3. Keep parameterized execution parity: row interpolation and row-level failure attribution must work identically for Kafka actions.
4. Add explicit non-HTTP rendering semantics in results so Kafka outcomes are not misrepresented as HTTP failures.
5. Treat mixed-suite rendering (HTTP + Kafka in one run) as a mandatory phase exit gate.

Implementation anchors in the current codebase:

- scenario and run contracts (currently HTTP-centric fields and RequestResult shape): `src/shared/types/index.ts`
- request execution baseline (HTTP path used by runner): `src/engine/requestExecution.ts`
- runner orchestration and mode config for standard/parameterized runs: `src/features/test-runner/hooks/useRunnerOrchestration.ts`
- parameterized runner entrypoint and variant wiring: `src/features/test-runner/ParameterizedRunner.tsx`
- results dashboard grouping/filtering and mixed run rendering entrypoint: `src/features/results/ResultsDashboard.tsx`
- specific rendering sites requiring transport-aware guards (correct full paths):
  - `src/features/results/components/DataRowSummaryTable.tsx` — line 41: `r.httpStatus || 'ERR'`
  - `src/features/results/components/ResultsRequestDetailsTab.tsx` — lines 79, 84, 276, 278: method badge and httpStatus cells
  - `src/features/results/utils/reportGenerator.ts` — lines 60, 68, 186, 233: four distinct httpStatus references (see 6D checklist)

Critical contract constraints discovered during re-review:

- current scenario contracts center on HTTP method/url/body fields; Phase 6 must introduce Kafka action contracts without breaking scenario migration/loading for existing HTTP tests.
- current request-result contracts center on `httpStatus` and `responseTimeMs`; Phase 6 must define transport-aware result typing so Kafka action outcomes are diagnosable without HTTP semantic leakage.

### Sub-phases

#### Phase 6A - Scenario schema and execution model ✅ Complete (2025-06-07)

Goal: add Kafka actions to runner configuration and execution contracts.

Implementation steps:

1. Extend scenario schema for Kafka produce and consume actions.
2. Add migration/update handling for stored scenarios.
3. Define action-level result shape and metadata capture.

Outputs:

- runner schema support for Kafka actions

Detailed implementation checklist:

- define `kafkaProduce` and `kafkaConsume` scenario action contracts with deterministic defaults
- add migration-safe loading and explicit fallback behavior for older scenario payloads
- define action-level assertion contract for payload/key/header/partition/offset checks
- add compile-safe contract tests for invalid action config branches

**Implementation Notes (2025-06-07):**

- `src/shared/types/index.ts`: added `KafkaActionType`, `KafkaAssertionTarget`, `KafkaProduceActionConfig`, `KafkaConsumeActionConfig`, `KafkaResultMeta`; new `Assertion` discriminant `type: 'kafkaField'` added to union; `Scenario.method` extended with `'KAFKA'`; `Scenario` extended with `actionType?`, `kafkaProduceAction?`, `kafkaConsumeAction?`; `RequestResult` extended with `transportType?`, `kafkaResultMeta?`; `TestSummary` extended with `kafkaErrorsByCategory?`
- `src/shared/utils/kafkaScenarioDefaults.ts` (new): `makeDefaultKafkaProduceAction()`, `makeDefaultKafkaConsumeAction()`, `isKafkaScenario()`, `resolveKafkaActionType()`
- `src/shared/utils/scenarioMigration.ts`: added `normalizeScenarioActionType()` and `normalizeGroupActionTypes()` for backward-compat loading
- `src/shared/utils/kafkaScenarioContracts.test.ts` (new): 37 compile-safe tests
- 3 HTTP-only consumers guarded with `as HttpMethod` cast at `Scenario.method` assignment sites
- Gate: `npx tsc -b --noEmit` → 0 errors; 52 tests passing

#### Phase 6B - Standard runner execution ✅ Complete (2025-06-07, commit `5a97924`)

Goal: support Kafka actions in normal runner flows first.

Implementation steps:

1. Add produce execution path.
2. Add consume execution path.
3. Add assertions on message body, headers, and broker metadata.

Outputs:

- standard runner Kafka support

Detailed implementation checklist:

- [x] implement Kafka produce and bounded consume execution paths in `src/engine/kafkaExecution.ts` (new file); export `executeKafkaAction(scenario, kafkaOps, timeoutMs)` with `transportType: 'kafkaProduce'` or `'kafkaConsume'` set on result
- [x] wire into executor via `RunOpts.executeNonHttp?` generic callback (not Kafka-specific) in `requestExecution.ts`; dispatch in all three runners (`runSequential`, `runBatch`, `runPool`); wired in `executor.ts` via `kafkaOperations ? (s) => executeKafkaAction(s, kafkaOperations, timeoutMs) : undefined`
- [x] produce errors and consume errors both classified with `classifyKafkaFailure`; non-network classes prefixed `[auth]`/`[tls]`/`[timeout]`/`[validation]`
- [x] consume no-match (0 messages) sets `httpStatus=0`, `errorMessage='No messages received within timeout'`
- [x] extend `AssertionContext` with `kafkaContext?` and add `kafkaField` assertion case in `validator.ts` switch; `evaluateHeaderOp` reused for all operator evaluation (equals/contains/regex/exists)
- [x] extend `ValidationInput` with `kafkaContext?` in `validationResult.ts` and pass to `evaluateAssertions`
- [x] extend `resolveVariable` in `custom` assertion branch to resolve `kafka.key`, `kafka.offset`, `kafka.partition`, `kafka.topic`, `kafka.header.*`, `kafka.body` from `kafkaContext`/`responseHeaders`/`rawBody`
- [x] `kafkaExecution.test.ts` created: 32 tests passing

**Implementation notes (retrospective)**:
- "do NOT add Kafka logic to the HTTP file" constraint was met via `executeNonHttp?` generic callback in `RunOpts` — this is not Kafka-specific logic, just a routing hook
- The expression evaluator (`evaluateExpression`) does NOT support `===`/`!==` as operators — it is a function-call evaluator, not a JS evaluator; custom assertion tests for `kafka.*` variable resolution use `{{kafka.key}}` direct resolution and `$isEmpty({{kafka.key}})` for falsy testing
- `KafkaProduceResult.offset` is `string` from the operations interface → converted to `number` via `parseInt(..., 10)` for `KafkaResultMeta.offset: number`
- Pool runner was refactored to extract `httpPrep` before the `isNonHttp` branch to preserve the `catch` handler's access to `httpPrep?.body` for error reporting

#### Phase 6C - Parameterized runner support ✅ Complete (2025-07-25, commit 5a97924)

Goal: make Kafka actions usable with dataset-driven testing.

Implementation steps:

1. Support dataset interpolation into topic, key, headers, and body.
2. Add row-aware failure reporting.
3. Validate behavior across multiple parameter rows.

Outputs:

- parameterized Kafka scenario execution

Detailed implementation checklist:

- [x] extend `resolveScenarioFromDataRow` in `src/engine/dataSourceExpander.ts` to apply `substituteVariables` (the same function used by `applyBodyColumns`) to Kafka config string fields: `kafkaProduceAction.topic`, `.key`, `.value`, and all `.headers` values; `kafkaConsumeAction.topic`, `.filter.keyEquals`, `.filter.jsonEquals` — no new `DataSourceColumn.type` variants needed; the existing body-column variable map (`vars` built from `type === 'body'` columns) is sufficient; note that `base.body` is NOT the relevant field for Kafka scenarios — `kafkaProduceAction.value` is the message payload
- [x] extend `resolveScenarioFromDataRow` to apply `substituteVariables` to `validation.assertions[*].value` for `kafkaField` assertion entries; the expander currently builds only `expectedFields` from `validate` columns and never substitutes variables in custom assertion `.value` tokens — this must be fixed for Kafka (and is also a latent gap for HTTP custom assertions)
- [x] `dataRowId`/`dataRowLabel` row attribution is already set for all expanded scenarios in `resolveScenarioFromDataRow` (lines 238-239) and flows through to `RequestResult` for free — no Kafka-specific implementation needed; verify in parameterized tests only
- [x] retry-count parity for parameterized Kafka rows is satisfied by Phase 6B's addition of `kafkaOperations` to `RunOpts` and the per-scenario dispatch inside `runSequential`/`runBatch`/`runPool` in `src/engine/requestExecution.ts`; Phase 6C verifies this holds for parameterized expanded rows and adds mixed-valid/mixed-invalid produce+consume row tests covering both field interpolation and `dataRowId` attribution

**Implementation Notes (Phase 6C)**:

- `resolveScenarioFromDataRow` builds a `bodyVars: Record<string, string>` map from `type === 'body'` columns (identical logic to what `applyBodyColumns` uses internally) and a `hasBodyVars` guard — when no body columns exist, `kafkaProduceAction`/`kafkaConsumeAction` are returned as the same reference (no-op)
- `kafkaConsumeAction.filter.headersMatch` values are individually substituted using `Object.entries` map, consistent with how `kafkaProduceAction.headers` is handled
- `kafkaConsumeAction.filter.jsonPath` is intentionally NOT substituted — it is a JSONPath selector expression, not a user-parameterized field
- `kafkaField` assertion substitution only runs when `hasBodyVars && validation.assertions?.some(a => a.type === 'kafkaField')` — assertion array is mapped to substitute `.value` only on matching entries; non-`kafkaField` assertions are returned unchanged
- `dataRowLabel` format is `"Row N: key1=val1[, ...]"` when body columns are present — test uses `toMatch(/^Row N/)` rather than strict equality
- 26 unit tests in `src/engine/dataSourceExpander.kafka.test.ts`; all 146 `dataSourceExpander.*` tests pass

#### Phase 6D - Results rendering and mixed-suite behavior ✅ Complete (2025-07-25, commit 5a97924)

Goal: render Kafka outcomes clearly in results and mixed suites.

Implementation steps:

1. Extend result model rendering for Kafka actions.
2. Add explicit non-HTTP metrics and labels.
3. Validate mixed HTTP and Kafka suite rendering.

Detailed implementation checklist:

- [x] extend results presentation with transport-aware labels and action metadata views; guard `httpStatus`/`method-badge` rendering behind `(r.transportType ?? 'http') === 'http'` checks
- [x] specific rendering sites patched:
  - `src/features/results/components/DataRowSummaryTable.tsx` line 41: guarded — shows `PRODUCE`/`CONSUME` for Kafka results
  - `src/features/results/components/ResultsRequestDetailsTab.tsx` lines 84, 278: guarded httpStatus cells; method badge resolved naturally via `method-${r.method.toLowerCase()}` = `method-kafka`
  - `src/features/results/components/WorkflowResultsSummary.tsx` line 355: guarded httpStatus
  - `src/features/results/utils/reportGenerator.ts` — lines 60, 68, 233 guarded with `PRODUCE`/`CONSUME`; line 186 (JSON serialization) left as-is since full `results` array carries `transportType`
  - `src/features/results/utils/runBaselines.ts` line 313: guarded — Kafka results excluded from per-scenario HTTP error rate
  - `src/features/test-runner/hooks/useTestExecution.ts` lines 173, 175, 203: guarded — failed Kafka results not bucketed as HTTP errors
- [x] patched CLI reporters (`cli/reporters.ts`) — all eight httpStatus-dependent sites; `DataRowSummaryReport.failedRowDetails.status` type widened to `number | string`; JUnit uses `KafkaError` failure type; workflow JUnit uses transport-aware format
- [x] added `.method-kafka { background: #f97316aa; color: #f97316; }` to `src/styles/base.css` — Kafka method badge resolved automatically via `method-${r.method.toLowerCase()}` = `method-kafka`; no component code change needed

**Implementation Notes (Phase 6D)**:

- `RunnerPage.tsx` method badge needed no code change — `method='KAFKA'` → class `method-kafka` already; only CSS was missing
- All display-facing guards use: `(r.transportType ?? 'http') === 'http' ? <http value> : r.transportType === 'kafkaProduce' ? 'PRODUCE' : 'CONSUME'`
- Error counting guards use: `(r.transportType ?? 'http') === 'http' && (r.httpStatus >= 400 || r.httpStatus === 0)`
- 258 tests pass across 10 test files; no regressions

Gate to phase exit:

- runner users can execute, inspect, and compare Kafka actions without ambiguity in results UI

### Validation matrix (required before Phase 6 exit)

Contract and migration validation:

- scenario/action contracts load with deterministic defaults and backward-compatible migration
- invalid Kafka action configs fail with explicit, diagnosable validation messages

Runtime validation:

- standard runner executes Kafka produce/consume actions with deterministic completion semantics
- assertion outcomes integrate into existing pass/fail evaluation without HTTP regressions
- parameterized Kafka runs preserve row-level attribution and failure diagnostics

Rendering validation:

- ✅ results dashboard renders Kafka actions with transport-aware labels and metadata
- ✅ mixed suites (HTTP + Kafka) keep grouping/filtering/export behavior stable
- ✅ no HTTP-specific status assumptions misclassify Kafka action outcomes

### Execution slicing matrix (recommended)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Exit Gate |
| --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p6a-scenario-schema` | Runner Contracts | 1.0-1.5 days | Phase 4 complete | Kafka action contracts + migration-safe loading compile cleanly |
| 2 | `kafka-p6b-runner-standard` | Runner Runtime | 1.5-2.0 days | PR1 | standard runner executes produce/consume with stable pass/fail outcomes |
| 3 | `kafka-p6c-runner-parameterized` | Parameterized Runner | 1.5-2.0 days | PR2 | row interpolation and row-level failure attribution parity verified |
| 4 | `kafka-p6d-results-rendering` | Results UI | 1.5-2.0 days | PR3 | mixed-suite rendering/grouping/export remains stable and diagnosable |

### PR kickoff checklist (Phase 6)

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p6a-scenario-schema` | `feature/kafka-p6a-scenario-schema` | `npx tsc -b --noEmit` | action contracts + migration-safe load behavior validated |
| `kafka-p6b-runner-standard` | `feature/kafka-p6b-runner-standard` | `npx vitest run src/engine/requestExecution.test.ts` and runner execution tests for Kafka actions | produce/consume runtime branches and assertions pass deterministically |
| `kafka-p6c-runner-parameterized` | `feature/kafka-p6c-runner-parameterized` | parameterized runner tests covering row interpolation/failure attribution | row-level diagnostics preserved across Kafka action failures |
| `kafka-p6d-results-rendering` | `feature/kafka-p6d-results-rendering` | results dashboard/component tests for Kafka-only and mixed suites; CLI reporter tests (`npx vitest run cli/reporters.*.test.ts`) to confirm Kafka output format | no rendering/filter/export regression for mixed HTTP+Kafka runs; CLI reporters produce correct output for Kafka results |

Phase 6 PR readiness sequence:

1. Create `feature/*` branch for the slice from latest `develop`.
2. Run `npx tsc -b --noEmit` and slice minimum tests.
3. Validate mixed-suite result semantics (HTTP + Kafka) for changed paths.
4. Attach test evidence and representative result screenshots/log snippets in PR description.

### Open design decisions (resolved in 6A)

These decisions were identified during re-review and must be resolved before any 6A implementation begins:

1. **Action typing model** — extend `Scenario` in `src/shared/types/index.ts` with `actionType?: 'http' | 'kafkaProduce' | 'kafkaConsume'` (absent = `'http'` for backward compat); add optional `kafkaProduceAction?: KafkaProduceActionConfig` and `kafkaConsumeAction?: KafkaConsumeActionConfig` bags; extend `Scenario.method` union with a `'KAFKA'` sentinel so Kafka scenarios satisfy the type constraint while keeping the field meaningful for HTTP; older saved scenarios without `actionType` must be treated as `'http'` by all consumers — never crash on a missing field.

2. **Result typing model** — extend `RequestResult` with `transportType?: 'http' | 'kafkaProduce' | 'kafkaConsume'` (absent = `'http'`); add optional `kafkaResultMeta?: { topic: string; partition: number; offset: number; key?: string; headers?: Record<string, string>; matchedMessages?: number }` bag; rendering components guard before showing `httpStatus` badge: only show when `(r.transportType ?? 'http') === 'http'`.

3. **Assertion DSL boundary** — reuse existing `ValidationConfig` operators (present/absent/contains/matches/equals/jsonpath); switch evaluation target from HTTP response body to Kafka payload by adding Kafka field selectors as assertion target paths: `kafka.body`, `kafka.key`, `kafka.partition`, `kafka.offset`, `kafka.header.<name>`; no new operator types required — only new target selector strings.

4. **Summary metric policy** — Kafka `responseTimeMs` (produce/consume wall time) contributes to timing aggregates (`avgResponseTime`, `p95ResponseTime`, etc.) because it is a valid latency measure; excluded from `errorsByStatus` (HTTP-status keyed buckets, which remain HTTP-only); add `kafkaErrorsByCategory?: Record<string, number>` to `TestSummary` for Kafka-specific error classification (timeout, auth, network, assertion, etc.); mixed suites report both HTTP and Kafka error counts without conflating them.

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
  - wait-for-real
  - auto-resume
  - synthetic-inject
- Planner-level skip-dispatch policy for unsupported or intentionally skipped consume steps.
- Guardrails and UX warnings for unsafe load configs.
- Aggregated load metrics compatibility for non-HTTP actions.

### Detailed plan

1. Implement load behavior mode handling in execution planner.
2. Add UI controls with default-safe mode policy.
3. Add warnings for unbounded or nondeterministic setups.
4. Document operational recommendations by mode.

### Re-evaluation delta (2026-05-30)

Phase 7 scope remains valid, but this re-review identifies an implementation boundary mismatch: current JS load runner is profile/concurrency-based while constant-arrival execution is desktop/Rust-gated.

Primary design adjustments from this re-review:

1. Define policy at planner/config boundary first (mode admissibility + fallback rules), then enforce in runtime.
2. Make execution-mode compatibility explicit: load-profile and constant-arrival are not interchangeable paths.
3. Bind Kafka consume load-mode behavior to existing synthetic-inject/auto-resume/wait-for-real semantics where available.
4. Treat deterministic completion and backpressure visibility (`droppedRequests`, `targetRps`) as mandatory observability gates.
5. Add pre-run validation that blocks unsafe load combinations before execution starts.

Canonical mode naming for Phase 7 (authoritative):

- `wait-for-real`: real consume/wait semantics (highest realism, lowest determinism)
- `auto-resume`: immediate mock resume/consume completion (highest determinism)
- `synthetic-inject`: delayed synthetic event injection (balanced realism/determinism)
- `skip-dispatch` (planner policy): skip execution of consume step under explicit policy rules; this is a planner outcome, not a node runtime mode

Implementation anchors in the current codebase:

- load profile runtime and target concurrency behavior: `src/engine/loadProfileRunner.ts`
- execution mode dispatch and load-profile routing: `src/engine/executor.ts`
- load profile runtime tests and edge behavior: `src/engine/loadProfileRunner.test.ts`, `src/engine/loadProfileRunnerInteg.test.ts`
- runner config persistence and execution mode wiring: `src/features/test-runner/hooks/useRunnerConfig.ts`
- execution mode UI and guardrails for load/constant-arrival: `src/features/test-runner/components/RunnerExecutionConfig.tsx`
- constant-arrival capability gating and progress metrics handling: `src/features/test-runner/hooks/useTestExecution.execute.test.ts`

Critical constraints discovered during re-review:

- JS executor currently has no native constant-arrival engine file; constant-arrival behavior depends on desktop/Rust path and capability checks.
- load-policy design must avoid promising runtime behavior unsupported by the selected execution backend.

### Sub-phases

#### Phase 7A - Load behavior model ✅ Complete (2026-06-01)

Goal: explicitly model supported Kafka consume modes under load.

Implementation steps:

1. Define `wait-for-real`, `auto-resume`, and `synthetic-inject` behavior.
2. Decide default-safe policy.
3. Map unsupported combinations to warnings or blocked execution.

##### Implementation Notes (2026-06-01)

New file: `src/features/workflow/engine/kafkaLoadPolicy.ts`
New test: `src/features/workflow/engine/kafkaLoadPolicy.test.ts` (12 tests — plan required 10; added `batch+wait-for-real` and `pool+wait-for-real` passthroughs for explicit coverage; added `constant-arrival+undefined → no message` assertion)

Design decisions matching spec exactly:
- `fallbackMode` returned only when `consumeLoadMode === undefined` — never on `block` outcomes (user already configured explicitly; message tells them what to change)
- `constant-arrival + undefined` is silent (no message) — JS side cannot enforce this; advisory is at the Rust/desktop boundary
- `block` message for `workflow + wait-for-real` explicitly contains the string `'wait-for-real'` so users can trace which node setting to update

Test gate: `npx tsc -b --noEmit` → 0 errors; `npx vitest run src/features/workflow/engine/kafkaLoadPolicy.test.ts` → 12/12

Detailed implementation checklist:

- create new file `src/features/workflow/engine/kafkaLoadPolicy.ts`; import `ExecutionMode` from `'../../../shared/types'` and `KafkaConsumeLoadTestMode` from `'../types/workflow'`; export `resolveKafkaConsumeLoadPolicy(executionMode: ExecutionMode, consumeLoadMode: KafkaConsumeLoadTestMode | undefined): KafkaLoadPolicyOutcome`
- define `KafkaLoadPolicyOutcome` type: `{ decision: 'allow' | 'warn' | 'block'; fallbackMode?: KafkaConsumeLoadTestMode; message?: string }`
- define authoritative policy matrix for `ExecutionMode × KafkaConsumeLoadTestMode` with the following explicit decision cells:
  - **`'workflow'` execution mode** (the mode served by `runGraphLoad` — only mode where Phase 7B guard fires):
    - `consumeLoadMode = undefined` → `{ decision: 'allow', fallbackMode: 'auto-resume', message: 'No load test mode configured; defaulting to auto-resume for deterministic iteration behavior' }`
    - `consumeLoadMode = 'auto-resume'` → `{ decision: 'allow' }`
    - `consumeLoadMode = 'synthetic-inject'` → `{ decision: 'allow' }`
    - `consumeLoadMode = 'wait-for-real'` → `{ decision: 'block', message: "Kafka consume node has 'wait-for-real' load mode — this blocks every load-test iteration waiting for a live Kafka message; set loadTestBehavior.mode to 'auto-resume' or 'synthetic-inject' for deterministic load-test behavior" }`
  - **`'constant-arrival'` execution mode** (Rust/desktop path — policy is informational from the JS side; enforcement is at the desktop boundary; JS throws before `runGraphLoad` if Rust executor is unavailable):
    - `consumeLoadMode = undefined` → `{ decision: 'allow', fallbackMode: 'auto-resume' }`
    - `consumeLoadMode = 'auto-resume'` → `{ decision: 'allow' }`
    - `consumeLoadMode = 'synthetic-inject'` → `{ decision: 'allow' }`
    - `consumeLoadMode = 'wait-for-real'` → `{ decision: 'warn', message: "wait-for-real under constant arrival introduces non-deterministic throughput; consider auto-resume or synthetic-inject" }`
  - **all other modes** (`'sequential'`, `'batch'`, `'pool'`, `'load-profile'`): return `{ decision: 'allow' }` — Kafka consume graph nodes are not on these execution paths, so the policy guard is a no-op; `'load-profile'` mode runs `Scenario` objects (not `WorkflowNode` objects), so Kafka nodes do not exist on that path and policy is implicitly `skip-dispatch`
- set default-safe policy: when `consumeLoadMode` is `undefined` return `{ decision: 'allow', fallbackMode: 'auto-resume' }` — the current runtime default in `handleKafkaConsumeNode` is `wait-for-real` (when `loadTestBehavior` is absent), which is a load-test footgun; Phase 7A defines the policy only; applying `fallbackMode` to override the node's runtime default is a Phase 7B task
- add contract tests in `src/features/workflow/engine/kafkaLoadPolicy.test.ts` covering all of the following combinations explicitly:
  - `resolveKafkaConsumeLoadPolicy('workflow', undefined)` → `decision: 'allow'`, `fallbackMode: 'auto-resume'`, `message` present
  - `resolveKafkaConsumeLoadPolicy('workflow', 'auto-resume')` → `decision: 'allow'`, no fallbackMode
  - `resolveKafkaConsumeLoadPolicy('workflow', 'synthetic-inject')` → `decision: 'allow'`, no fallbackMode
  - `resolveKafkaConsumeLoadPolicy('workflow', 'wait-for-real')` → `decision: 'block'`, non-empty `message`
  - `resolveKafkaConsumeLoadPolicy('constant-arrival', undefined)` → `decision: 'allow'`, `fallbackMode: 'auto-resume'`
  - `resolveKafkaConsumeLoadPolicy('constant-arrival', 'auto-resume')` → `decision: 'allow'`
  - `resolveKafkaConsumeLoadPolicy('constant-arrival', 'synthetic-inject')` → `decision: 'allow'`
  - `resolveKafkaConsumeLoadPolicy('constant-arrival', 'wait-for-real')` → `decision: 'warn'`, non-empty `message`
  - `resolveKafkaConsumeLoadPolicy('load-profile', 'wait-for-real')` → `decision: 'allow'` (passthrough — no graph nodes on this path)
  - `resolveKafkaConsumeLoadPolicy('sequential', undefined)` → `decision: 'allow'` (passthrough)

#### Phase 7B - Planner and runtime enforcement

Goal: enforce deterministic load rules in execution planning.

Implementation steps:

1. Implement planner logic for each mode.
2. Ensure unsafe load configs are intercepted before run start.
3. Validate repeated runs stay reproducible.

Detailed implementation checklist:

- ~~**critical wiring**: add `kafkaOperations?: KafkaNodeOperations` to `GraphLoadRunOpts` in `graphLoadRunner.ts`; forward it as the 18th positional argument in the `runGraph(...)` call inside `runGraphLoad` (currently passed with 17 args — `kafkaOperations` is silently `undefined`, causing all Kafka nodes to fail in load mode)~~ ✅ **Fixed (2026-05-31, Phase 4C re-review)** — `kafkaOperations` added to `GraphLoadRunOpts`, destructured and forwarded in `runGraphLoad`; 2 existing tests updated; passthrough test added
- ~~**threading chain** — `kafkaOperations` is a runtime-only object and must NOT be added to `TestConfig` (which is persisted/stored); the correct chain is:~~
  ~~1. add `kafkaOperations?: KafkaNodeOperations` as an optional **9th parameter** to `runTest()` in `src/engine/executor.ts` (after `workflowResolverData`)~~
  ~~2. in `executor.ts` `runGraphLoad(workflow, {...})` call, forward `kafkaOperations` into `GraphLoadRunOpts`~~
  ~~3. in `src/features/test-runner/hooks/useTestExecution.ts`, construct `kafkaOperations` from the Kafka client at the call sites (**lines 339 and 342**) that call `runTest(..., workflowResolverData)` — add `kafkaOperations` as the new 9th arg~~
  ✅ **Fixed (2026-05-31, Phase 4C re-review)** — 9th param added to `runTest()` in `executor.ts`; forwarded into `GraphLoadRunOpts`; `buildKafkaNodeOperations()` wired at `useTestExecution.ts` lines 339 and 342 (line numbers shifted by the `kafkaOps` var declaration added at line 330); `executionWorker.ts` also updated
- add pre-run policy guard at the top of `runGraphLoad` in `graphLoadRunner.ts` (before the `runOneIteration` definition, after the correlation store setup): import `resolveKafkaConsumeLoadPolicy` from `'./kafkaLoadPolicy'` and `KafkaConsumeNodeData` from `'../types/workflow'`; filter `workflow.nodes` for `node.type === 'kafkaConsume'`; for each, call `resolveKafkaConsumeLoadPolicy('workflow', (node.data as KafkaConsumeNodeData).loadTestBehavior?.mode)`; for any `'block'` outcome, `throw new Error(outcome.message ?? 'Kafka consume load policy blocked execution')`; note: `runGraphLoad` is only ever called in `'workflow'` execution mode context (see `executor.ts`); `'constant-arrival'` guard lives at the desktop/Rust boundary
- in `src/features/workflow/engine/graphRunnerKafkaNodeHandlers.ts` line 251: change `data.loadTestBehavior ?? { mode: 'wait-for-real' as const }` to `data.loadTestBehavior ?? { mode: 'auto-resume' as const }` — aligns the runtime default with the policy `fallbackMode: 'auto-resume'` for nodes with absent `loadTestBehavior`; the pre-run guard (above) ensures any explicit `wait-for-real` is blocked before execution reaches this line, so the fallback only ever fires for the `undefined` case
- `'load-profile'` execution mode does not run workflow graph nodes; Kafka consume policy enforcement only applies to `'workflow'` and `'constant-arrival'` modes; for `'workflow'` load mode, per-iteration progress is already reported via `onProgress` and requires no new implementation — `targetRps`/`droppedRequests` metrics apply to `'constant-arrival'` only (Rust-side, out of scope)
- ~~add deterministic replay tests in `graphLoadRunner.test.ts` (or `graphLoadRunner.part2.test.ts`) for the `kafkaOperations` threading~~ ✅ **Fixed (2026-05-31, Phase 4C re-review)** — passthrough test added at `graphLoadRunner.test.ts` line 777 (`'passes kafkaOperations from opts through to runGraph'`); all existing test call sites updated with `undefined, // kafkaOperations` placeholder
- add `executor.test.ts` coverage for the `kafkaOperations` 9th parameter: call `runTest(config, scenarios, vi.fn(), undefined, workflow, undefined, undefined, undefined, mockKafkaOps)` and verify `vi.mocked(runGraphLoad)` was called with `expect.objectContaining({ kafkaOperations: mockKafkaOps })`
- add `graphLoadRunner.test.ts` tests for the policy guard: (1) a workflow with a `kafkaConsume` node where `loadTestBehavior.mode === 'wait-for-real'` should cause `runGraphLoad` to reject with an error containing the policy message; (2) a node with `loadTestBehavior.mode === 'auto-resume'` should not reject; (3) a node with absent `loadTestBehavior` should not reject (undefined → allow via policy)

#### Phase 7C - UX and operational guidance

Goal: make the constraint understandable to users before they trigger the Phase 7B runtime block.

Implementation steps:

1. Add warning banner in `WorkflowRunner.tsx` for risky Kafka consume configs.
2. Integrate with the Phase 7A policy function (`resolveKafkaConsumeLoadPolicy`) to generate messages.
3. Ensure warnings are visible before run start, not only at execution time.

Detailed implementation checklist:

- **rendering site is `WorkflowRunner.tsx`** (not `RunnerExecutionConfig`): `RunnerExecutionConfig` has no access to `selectedWorkflow.nodes` and requires no changes for Kafka warnings; render the warning banner in `WorkflowRunner.tsx` between the `<RunnerExecutionConfig>` section and the Run/Stop buttons, within the same `(!isWebhookTriggered || webhookRunMode === 'single')` guard that wraps `RunnerExecutionConfig`
- **policy integration**: for each `node` in `selectedWorkflow.nodes` where `node.type === 'kafkaConsume'`, call `resolveKafkaConsumeLoadPolicy('workflow', (node.data as KafkaConsumeNodeData).loadTestBehavior?.mode)` (import `resolveKafkaConsumeLoadPolicy` from `'../workflow/engine/kafkaLoadPolicy'` and `KafkaConsumeNodeData` from `'../workflow/types/workflow'`); collect outcomes by category: `blockOutcomes` (decision `'block'`), `warnOutcomes` (decision `'warn'`), `infoOutcomes` (decision `'allow'` with `fallbackMode` present — i.e. `undefined` loadTestBehavior case)
- **block banner** (highest priority): when any `blockOutcomes` exist, render `<div className="kafka-load-warning kafka-load-warning--block">` showing `blockOutcomes[0].message`; fires when any `kafkaConsume` node has explicit `loadTestBehavior.mode === 'wait-for-real'` in `'workflow'` execution context; the Phase 7B guard will throw at runtime — Phase 7C shows this before the user clicks Run so they know which node setting to change
- **warn banner**: when no block outcomes but any `warnOutcomes` exist, render `<div className="kafka-load-warning kafka-load-warning--warn">` showing `warnOutcomes[0].message`; reserved for `'constant-arrival'` + `wait-for-real` (decision is `'warn'` per Phase 7A policy); this path is forward-compatible for when constant-arrival workflow mode is available on desktop
- **auto-resume advisory** (lowest priority): when no block or warn outcomes but any `infoOutcomes` exist, render `<div className="kafka-load-info">` with text: "Kafka consume nodes without a load test mode configured will default to auto-resume for deterministic behavior"; fires when any `kafkaConsume` node has `loadTestBehavior === undefined`
- **constant-arrival desktop gating**: already handled by `RunnerExecutionConfig` (opacity-0.5 + tooltip "Requires desktop app (Tauri)" on the constant-arrival radio button); no additional Kafka-specific change needed in `RunnerExecutionConfig`
- **CSS classes**: add to the workflow runner stylesheet or `src/styles/base.css`:
  - `.kafka-load-warning--block { background: #fef2f2; border-left: 3px solid #ef4444; color: #b91c1c; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin: 8px 0; }`
  - `.kafka-load-warning--warn { background: #fffbeb; border-left: 3px solid #f59e0b; color: #92400e; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin: 8px 0; }`
  - `.kafka-load-info { background: #eff6ff; border-left: 3px solid #3b82f6; color: #1e40af; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin: 8px 0; }`
- **tests in `WorkflowRunner.part4.test.tsx`** (or whichever part has capacity): (1) render `WorkflowRunner` with a mock workflow containing a `kafkaConsume` node with `loadTestBehavior.mode = 'wait-for-real'`; verify the block banner renders and contains the policy message; (2) with `loadTestBehavior.mode = 'auto-resume'`; verify no warning banner; (3) with `loadTestBehavior = undefined`; verify the auto-resume advisory renders; (4) with no `kafkaConsume` nodes; verify no warning renders
- **do NOT add Kafka warning tests to `RunnerExecutionConfig.loadprofile.test.tsx`**: that component has no Kafka node awareness and requires no 7C-specific tests; run it as part of the regression check only
- **do NOT add Kafka warning tests to `useTestExecution.execute.test.ts`**: that file tests execution hook behavior (runTest dispatch, capability checks, constant-arrival Rust path); the existing `'errors when constant-arrival mode without Rust executor'` test is sufficient coverage for the capability-gating path

Gate to phase exit:

- users see the block warning before clicking Run and understand which node setting to change
- constant-arrival desktop requirement remains visible in `RunnerExecutionConfig` (existing behavior confirmed)

### Validation matrix (required before Phase 7 exit) ✅ ALL PASS (2026-06-02)

Policy validation:

- ✅ policy table resolves all supported execution mode + consume mode combinations (12 kafkaLoadPolicy contract tests)
- ✅ unsupported combinations are blocked with explicit, actionable messages (Phase 7B guard test + error message substring assertion)

Runtime validation:

- ✅ load-profile runs complete deterministically under policy-constrained consume behavior (6 deterministic simulation tests: auto-resume/synthetic-inject/undefined all complete without hanging; results bounded; no cross-iteration leakage; monotonic progress)
- ✅ constant-arrival path reports target/actual throughput and dropped requests when supported (useTestExecution.execute.test.ts: peak RPS + dropped requests tracked via Rust progress callback)
- ✅ repeated runs with same config stay within acceptable variance bounds (4 variance tests: result count identical across 3 runs; pass/fail ratio reproducible; sequential ≡ concurrent; full index coverage)

UX validation:

- ✅ execution config UI surfaces compatibility constraints before run start (WorkflowRunner.part4 tests: 5 banner tests for block/info/none/auto-resume/priority)
- ✅ warning text is visible for risky/non-deterministic combinations (block banner contains "wait-for-real" text; info advisory contains "auto-resume" text)
- ✅ desktop gating for constant-arrival is explicit and test-covered (useTestExecution: "errors when constant-arrival mode without Rust executor" + RunnerExecutionConfig existing opacity gating)

### Execution slicing matrix (recommended)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Exit Gate |
| --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p7a-load-model` | Runner Policy | 1.0-1.5 days | Phase 6 complete | policy table and compatibility contracts finalized |
| 2 | `kafka-p7b-load-enforcement` | Runner Runtime | 1.5-2.0 days | PR1 | planner/runtime enforcement blocks unsafe configs deterministically |
| 3 | `kafka-p7c-load-ux` | Runner UX | 1.0-1.5 days | PR2 | warnings/gating/help text are clear and test-covered |

### PR kickoff checklist (Phase 7)

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p7a-load-model` | `feature/kafka-p7a-load-model` | policy contract tests + `npx tsc -b --noEmit` | mode-compatibility policy resolved with deterministic defaults |
| `kafka-p7b-load-enforcement` | `feature/kafka-p7b-load-enforcement` | `npx vitest run src/engine/loadProfileRunner.test.ts`, `npx vitest run src/engine/loadProfileRunnerInteg.test.ts`, and executor mode tests | unsafe configs blocked pre-run; stable completion behavior validated |
| `kafka-p7c-load-ux` | `feature/kafka-p7c-load-ux` | `npx vitest run src/features/test-runner/WorkflowRunner.part4.test.tsx` and `npx tsc -b --noEmit` | Kafka load-policy warning banners render in `WorkflowRunner` for block/warn/info outcomes; no regressions in `RunnerExecutionConfig` or `useTestExecution` tests |

Phase 7 PR readiness sequence:

1. Create `feature/*` branch for the slice from latest `develop`.
2. Run `npx tsc -b --noEmit` and slice minimum tests.
3. Validate deterministic behavior across repeated policy-constrained runs.
4. Attach policy table evidence and run-output proof in PR description.

### Test plan

- Planner tests for each load mode.
- Load-run simulation tests for deterministic completion.
- Regression tests for existing load profile behavior.

### Risks and mitigations

- Risk: real consume mode causes flaky throughput tests.
- Mitigation: default to `auto-resume` for load unless explicitly overridden.

### Exit criteria

- Load runs are stable and reproducible across repeated executions.
- Unsafe configurations are visibly flagged before run start.

---

## Phase 8 — Results Publishing to Kafka

Estimated effort: 4-5 days (8A: 1.0–1.5 days, 8B: 1.5–2.0 days, 8C: 1.0–1.5 days)
Dependencies: Phase 6

### Scope

Publish summarized test/workflow results to configurable Kafka topic.

### Deliverables

- Optional results publishing toggle in the Test Runner configuration (`RunnerConfig`).
- Standardized results envelope for publishing.
- Retry and failure reporting policy.

### Detailed plan

1. Define publish payload schema and version field.
2. Hook publish after run completion path.
3. Add failure policy (log-only by default; optional fail-run mode later).
4. Add traceability fields (`runId`, `projectName`, `envName`, `svcName`, `executionMode`, `workflowName`) — note: `TestRun` has no `suiteName` or `suite` field; `workflowName` is the correct label for workflow runs.

### Re-evaluation delta (2026-05-31)

Phase 8 direction remains correct, but this re-review identifies a boundary risk: run completion and local persistence are already stable, while publish-to-Kafka is currently not a first-class post-run contract and must remain non-disruptive to result saving.

Primary design adjustments from this re-review:

1. Treat publishing as a post-completion side effect, never as the source of truth for run success.
2. Define a versioned summary envelope with strict required fields and forward-compatible optional extensions.
3. Keep failure policy explicit and default non-blocking; strict fail-run mode must be opt-in and deferred.
4. Add idempotency guidance keyed by run id to avoid duplicate downstream processing on retries.
5. Separate publish transport errors from run execution errors in diagnostics and logs.

Implementation anchors in the current codebase:

- run completion, summary computation, and persistence flow: `src/features/test-runner/hooks/useTestExecution.ts`
- publish config threading from UI to execution hook: `src/features/test-runner/hooks/useRunnerOrchestration.ts` (passes `kafkaResultsPublish` via `meta` to `execute()`)
- server Kafka route surface for produce operations: `src-server/routes/kafka-routes.ts`
- server Kafka produce runtime handling: `src-server/kafka/kafka-service.ts`
- **client Kafka dispatch abstraction**: `src/shared/kafka/kafkaClient.ts` (`dispatchKafkaOperation` — publish uses this to call existing produce endpoint without a new endpoint)
- **publisher module (net-new)**: `src/shared/kafka/kafkaResultsPublisher.ts` — client-side, calls `dispatchKafkaOperation('produce', ...)` directly; `useTestExecution.ts` can import it because both live under `src/`

> **Boundary constraint**: `tsconfig.app.json` includes only `src/`. Client code (`useTestExecution.ts`, publisher) cannot import from `src-server/`. Publish-specific types (`KafkaResultsPublishConfig`, `KafkaRunSummaryEnvelope`, `KafkaPublishOutcome`) must be defined in `src/shared/types/index.ts` (NOT `src-server/kafka/contracts.ts`) so both `useTestExecution.ts` and the publisher can access them.

Critical constraints discovered during re-review:

- current run persistence (`saveTestRun`) must remain successful even if publish fails.
- Phase 8 must not require a broker for core local run completion path.

### Sub-phases

#### Phase 8A - Publish contract and settings

**Status: ✅ Complete — implemented 2026-06-01, branch `feature/kafka-integration`**

Goal: define what gets published and how users enable it.

Implementation steps:

1. Define result summary schema and versioning.
2. Add config fields for enabling publish and selecting topic.
3. Add traceability fields needed downstream.

Detailed implementation checklist:

- add publish-specific types to **`src/shared/types/kafka.ts`** (NOT `src/shared/types/index.ts` directly and NOT `src-server/kafka/contracts.ts` — `kafka.ts` already contains all client-side Kafka types and is re-exported via `export * from './kafka'` at line 453 of `index.ts`, so new types become importable from `'..../shared/types'` without any change to `index.ts`; client code cannot import from `src-server/`):
  - `KafkaResultsPublishConfig`: `{ enabled: boolean; clusterId: string; topic: string }` — `clusterId` is required because `KafkaProduceRequest.clusterId` is optional but publish must always target a specific cluster
  - `KafkaRunSummaryEnvelope`: `{ schemaVersion: string; runId: string; timestamp: number; executionMode: ExecutionMode; summary: Pick<TestSummary, 'totalRequests' | 'successfulRequests' | 'failedRequests' | 'errorRate' | 'avgResponseTime' | 'p95ResponseTime' | 'p99ResponseTime' | 'totalDurationMs' | 'tps'>; projectName?: string; envName?: string; svcName?: string; workflowName?: string }` with `schemaVersion` starting at `'1.0'` — notes: (a) use `executionMode: ExecutionMode` (not `string`) to match the union type used everywhere in the codebase; (b) **do NOT include `featureGroupName?`** — `TestRun` has no `featureGroupName` field, and `TestConfig` has no `featureGroupName`/`groupName` fields either (those fields live on `RequestResult`); a single run can span multiple feature groups so no run-level group label exists; (c) `svcName?` from `testRun.svcName` and `workflowName?` from `testRun.workflowName` are the correct optional labels; (d) the `Pick` fields above cover the core metrics required by downstream consumers — do not reduce them
  - `KafkaPublishOutcome`: `{ status: 'published' | 'failed' | 'skipped'; retryCount: number; errorCode?: string; durationMs: number }` — used for diagnostics only, never surfaced as run status
- add `kafkaResultsPublish?: KafkaResultsPublishConfig` to `RunnerConfig` in `src/features/test-runner/hooks/runnerConfigDefaults.ts` (this is where `RunnerConfig` type is defined, not `useRunnerConfig.ts`)
- also add `kafkaResultsPublish?: KafkaResultsPublishConfig` to **`ResolvedConfig`** in `runnerConfigDefaults.ts` (the resolved shape returned by `resolveLoadedConfig`) and add `kafkaResultsPublish: saved.kafkaResultsPublish` to the `resolveLoadedConfig` return object — failure to update `ResolvedConfig` means the field is silently dropped when config is reloaded from storage
- add `kafkaResultsPublish` state and setter to `useRunnerConfig.ts` config persistence/restore paths: (a) `useState<KafkaResultsPublishConfig | undefined>(undefined)` initialiser, (b) `setKafkaResultsPublish(cfg.kafkaResultsPublish)` in the load `useEffect`, (c) include `kafkaResultsPublish` in the `saveRunnerConfig({...})` call in the save `useEffect`, (d) add the setter to the dependency array of the save `useEffect`, (e) return `{ kafkaResultsPublish, setKafkaResultsPublish }` from the hook and add them to `UseRunnerConfigResult`
- add envelope schema validation tests and missing/invalid field tests to **`src/shared/kafka/kafkaPublishTypes.test.ts`** (new dedicated file in the kafka dir, consistent with other kafka tests — do not add to `src/shared/types/index.test.ts` which covers general type validation, and do not add to `src-server/kafka/contracts.test.ts` since the types are client-side)
- update **`src/features/test-runner/hooks/runnerConfigDefaults.test.ts`** to cover the new field: (a) `resolveLoadedConfig` preserves a valid `kafkaResultsPublish` object from saved config; (b) `resolveLoadedConfig` passes through `undefined` when the field is absent from saved config (no default value — the field is opt-in)
- update **`src/features/test-runner/hooks/useRunnerConfig.test.ts`** to cover: (a) `kafkaResultsPublish` is restored from saved config; (b) `kafkaResultsPublish` is saved when it changes; (c) `kafkaResultsPublish` defaults to `undefined` when no saved config exists; (d) the hook exposes `kafkaResultsPublish` and `setKafkaResultsPublish` in its return value

##### Implementation Notes — Phase 8A (completed 2026-06-01, commit `616dc96`)

- **Types location**: Added to `src/shared/types/kafka.ts` (not `src/shared/types/index.ts`). The file already follows the convention of re-exporting via `export * from './kafka'` at line 453 of `index.ts`, so no change to `index.ts` was needed.
- **`executionMode` import**: Used `import('./runner-config').ExecutionMode` as an inline type import inside `kafka.ts` to avoid a circular-import path — `ExecutionMode` lives in `runner-config.ts`, which is in `src/features/`, not `src/shared/`.
- **`featureGroupName` absent by design**: `TestRun` has no `featureGroupName` field; `TestConfig` has no group label either (those live on `RequestResult`). A single run spans multiple feature groups, so no run-level group label exists. The envelope intentionally omits this field.
- **`kafkaResultsPublish` pass-through in `resolveLoadedConfig`**: No default value — the field is opt-in and `undefined` by default. `resolveLoadedConfig` passes it through unchanged from saved config (no coercion applied).
- **`ResolvedConfig` updated**: Both `RunnerConfig` and `ResolvedConfig` in `runnerConfigDefaults.ts` were extended. Failing to extend `ResolvedConfig` would silently drop the field on config reload.
- **Success Criteria** (all met):
  - [x] `KafkaResultsPublishConfig`, `KafkaRunSummaryEnvelope`, `KafkaPublishOutcome` types defined in `src/shared/types/kafka.ts`
  - [x] `kafkaResultsPublish` in `RunnerConfig`, `ResolvedConfig`, and `resolveLoadedConfig` pass-through
  - [x] `useRunnerConfig` exposes `kafkaResultsPublish` state and `setKafkaResultsPublish` setter, persists to storage
  - [x] 49 tests pass (15 new in `kafkaPublishTypes.test.ts`, 4 new in `runnerConfigDefaults.test.ts`, 5 new in `useRunnerConfig.test.ts` + 1 updated setter test)
  - [x] `npx tsc --noEmit` — 0 errors

#### Phase 8B - Publish-on-completion runtime

**Status: ✅ Complete — implemented 2026-06-01, branch `feature/kafka-integration`**

Goal: send summary events without destabilizing primary execution flows.

Implementation steps:

1. Hook publish into run completion paths.
2. Add retries and non-blocking failure behavior.
3. Record publish outcomes for diagnostics.

Detailed implementation checklist:

- create **`src/shared/kafka/kafkaResultsPublisher.ts`** (CLIENT-SIDE, in `src/shared/kafka/` alongside existing `kafkaClient.ts` — NOT `src-server/`): a dedicated publisher function that assembles `KafkaRunSummaryEnvelope` from a completed `TestRun`, serializes it to JSON, and calls **`dispatchKafkaOperation('produce', request)`** from `kafkaClient.ts` (reuses the existing client-side dispatch path — no new server endpoint needed, no server-to-self HTTP call); constructs a produce request literal matching `KafkaProduceRequest`'s shape inline (cannot import `KafkaProduceRequest` from `src-server/kafka/contracts.ts` — use the inline-type pattern established in `src/shared/kafka/buildKafkaNodeOperations.ts`); **error handling pattern**: `dispatchKafkaOperation`'s default transport (`parseEnvelope` in `kafkaClient.ts`) throws `KafkaClientError` when the server returns `!ok` — it never returns a failed envelope to the caller. Do NOT check `.ok` after awaiting; instead wrap the call in `try/catch (e)` and handle `KafkaClientError` (retryable flag on the error) and unknown errors separately. When the call succeeds, access `envelope.data` directly.
- implement bounded retry in **`kafkaResultsPublisher.ts`**: **max 3 retries**, **2 000 ms base delay** (fixed, not exponential), **10 000 ms total timeout cap**; idempotency rule: **only retry when the previous attempt threw `KafkaClientError` with `retryable: true`**; if a prior attempt completed without throwing, treat it as published and return immediately — do not re-produce based on downstream ambiguity alone
- ensure **`kafkaResultsPublisher.ts`** returns `KafkaPublishOutcome` and never throws; all caught errors (both `KafkaClientError` and generic `Error`) are returned as `{ status: 'failed', ... }`
- the exported function in `kafkaResultsPublisher.ts` is `publishRunResults(testRun: TestRun, config: KafkaResultsPublishConfig): Promise<KafkaPublishOutcome>` — import `TestRun`, `KafkaResultsPublishConfig`, `KafkaRunSummaryEnvelope`, `KafkaPublishOutcome` all from `'../types'` (the shared types re-export covers all four); the function assembles the envelope inline, serializes `JSON.stringify(envelope)` as the single message `value`, and passes `{ clusterId: config.clusterId, topic: config.topic, messages: [{ value: JSON.stringify(envelope) }] }` to `dispatchKafkaOperation('produce', ...)`
- hook publish into `useTestExecution.ts` at **all three** save call sites: (1) `saveTestRun` at line 393 in `execute()`, (2) `saveTestRun` at line 560 in `startExternalExecution().complete()`, and (3) `forceSaveTestRun` at line 442 in `confirmSavePendingRun()` — exact publish conditions: at site (1) publish only when `!saveResult.quotaError` (run was saved successfully to storage); at site (2) publish only when `!saveResult.quotaError`; at site (3) publish only when `result.ok` (force-save succeeded); `quotaError` from `saveTestRun` does not skip publishing permanently — the quota-exceeded run will be published at `confirmSavePendingRun` when the user confirms the force-save; **publish is fire-and-forget** (`void publishRunResults(...)`) — do NOT await it, as the retry loop can take up to 10 s and would block the UI state update; log failed outcomes via `.then((outcome) => { if (outcome.status === 'failed') console.warn(...) })` for diagnostics
- **`kafkaResultsPublish` access pattern — use a hook-level parameter stored in a ref, NOT `meta` threading**: add `publishConfig?: KafkaResultsPublishConfig` as an optional parameter to `useTestExecution(publishConfig?)` (currently `useTestExecution()` takes no arguments; there are exactly 2 call sites); immediately store it in a `useRef`: `const publishConfigRef = useRef(publishConfig); publishConfigRef.current = publishConfig;` — all three `useCallback` closures read `publishConfigRef.current` (always fresh) rather than capturing `publishConfig` directly (which would be stale if config changes between renders); call site changes: (a) in `useRunnerOrchestration.ts` change `useTestExecution()` → `useTestExecution(config.kafkaResultsPublish)` where `config` is from `useRunnerConfig()` state already held in that hook; (b) `WorkflowRunner.tsx` calls `useTestExecution()` with no argument — leave it unchanged, webhook/external-execution runs do not publish to Kafka in Phase 8B (the `startExternalExecution` path is exclusively used by `WorkflowRunner.tsx` which uses `useWorkflowRunnerConfig()`, not `useRunnerConfig()`, so `kafkaResultsPublish` is unavailable there — defer webhook-path publish support to a future phase if needed)
- `useRunnerOrchestration.ts` change: on line 143, change `useTestExecution()` → `useTestExecution(config.kafkaResultsPublish)` — `config` is the full object returned by `useRunnerConfig()` already assigned on the prior line; no destructuring change needed; also update `useRunnerOrchestration.test.ts`: (a) add `mockCapturedPublishConfig: { value: undefined as unknown }` to the `vi.hoisted()` block, (b) update the `vi.mock('./useTestExecution', ...)` factory to `(publishConfig?: unknown) => { mockCapturedPublishConfig.value = publishConfig; return {...}; }`, (c) add one new test: set `mockRunnerConfigOverrides.value = { kafkaResultsPublish: publishCfg }`, render hook, assert `mockCapturedPublishConfig.value` equals `publishCfg`
- ensure publish failure does not alter run status in default mode; the publish outcome is fire-and-forget and never written to `TestRun`; log failures only via `console.warn`
- add publish-path tests to `src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts` (the existing save-path test file): (a) add `vi.mock('../../../shared/kafka/kafkaResultsPublisher', ...)` to mock `publishRunResults` as a `vi.fn()` returning `{ status: 'published', retryCount: 0, durationMs: 5 }`; add `mockPublishRunResults` to the test file (NOT to the shared setup — it's only needed here); (b) add test: `publishRunResults` is called after successful `saveTestRun` in `execute()` when `publishConfig.enabled = true`; (c) add test: `publishRunResults` is NOT called when `publishConfig.enabled = false`; (d) add test: `publishRunResults` is NOT called when no `publishConfig` is passed; (e) add test: `publishRunResults` failure (`{ status: 'failed' }`) does not change `finalRun` or `error` state; (f) add test: `publishRunResults` is called after `forceSaveTestRun` succeeds in `confirmSavePendingRun()`

##### Implementation Notes — Phase 8B (completed 2026-06-01, commit `feature/kafka-integration`)

- **Publisher module**: `src/shared/kafka/kafkaResultsPublisher.ts` created with `publishRunResults(testRun, config)` — exports one function, never throws, returns `KafkaPublishOutcome`.
- **`publishConfigRef` pattern**: `publishConfig` parameter stored in `useRef` immediately on each render (`publishConfigRef.current = publishConfig`) so all `useCallback` closures read the always-fresh ref value. This avoids stale closure issues without adding `publishConfig` to every deps array.
- **Fire-and-forget**: All three publish call sites use `void publishRunResults(...).then(outcome => { if (outcome.status === 'failed') console.warn(...) })` — non-blocking, diagnostic-only logging.
- **Publish conditions**: (1) `execute()` publishes only when `!saveResult.quotaError`; (2) `startExternalExecution().complete()` publishes only when `!saveResult.quotaError`; (3) `confirmSavePendingRun()` publishes only when `result.ok`. Quota-exceeded runs are published at the confirmSave site.
- **`useRunnerOrchestration.ts`**: Changed `useTestExecution()` → `useTestExecution(config.kafkaResultsPublish)`. No destructuring change needed — `config` object is already in scope.
- **WorkflowRunner.tsx**: Left unchanged — calls `useTestExecution()` with no arg. Publish path is a no-op when `publishConfig` is `undefined`.
- **Success Criteria** (all met):
  - [x] `kafkaResultsPublisher.ts` created with bounded retry (max 3, 2 s delay, 10 s cap)
  - [x] `publishRunResults` never throws — returns `KafkaPublishOutcome` in all paths
  - [x] Publish hooked at all 3 save sites in `useTestExecution.ts` (lines 393, 442, 560)
  - [x] Fire-and-forget — does not delay UI state update
  - [x] Publish failure does not alter `finalRun` or `error` state
  - [x] `useRunnerOrchestration.ts` threads `kafkaResultsPublish` from `useRunnerConfig` to `useTestExecution`
  - [x] 11 tests pass in `useTestExecution.saveHandlers.test.ts` (7 new Kafka publish tests)
  - [x] 2 new tests pass in `useRunnerOrchestration.test.ts` (kafkaResultsPublish threading)
  - [x] `npx tsc --noEmit` — 0 errors

#### Phase 8C - Secure-profile and reporting validation

**Status: ✅ Complete — implemented 2026-06-01, branch `feature/kafka-integration`**

Goal: confirm summary publishing works across realistic cluster profiles.

Implementation steps:

1. Validate publish against plaintext local topic.
2. Validate publish against secure profile.
3. Confirm failures do not corrupt primary run completion state.

Detailed implementation checklist:

- create **`src/shared/kafka/kafkaResultsPublisher.test.ts`** (unit tests for the publisher module created in 8B): mock setup: use `vi.hoisted(() => ({ mockDispatch: vi.fn() }))` + `vi.mock('./kafkaClient', async (importOriginal) => { const actual = await importOriginal(); return { ...actual, dispatchKafkaOperation: mockDispatch }; })` so the real `KafkaClientError` class is available for constructing test errors while only `dispatchKafkaOperation` is mocked; use `makeTestRun()` from `'../../test-utils/factories'` for the test fixture; cover all tests below:
  - (a) **successful publish**: `dispatchKafkaOperation` resolves → returns `{ status: 'published', retryCount: 0, durationMs: ≥ 0 }`; verify dispatch called once with op `'produce'`, `clusterId` and `topic` from config, `messages[0].value` parses to a valid `KafkaRunSummaryEnvelope` with `schemaVersion: '1.0'`, correct `runId`, `timestamp`, `executionMode`, and all 9 `summary` fields
  - (b) **disabled config**: `config.enabled = false` → returns `{ status: 'skipped', retryCount: 0, durationMs: 0 }` without calling dispatch
  - (c) **max retries exhausted**: dispatch always throws `KafkaClientError` with `retryable: true` → dispatch is called exactly **4 times** (1 initial + 3 retries), returns `{ status: 'failed', retryCount: 3, errorCode: <code> }` — use `vi.useFakeTimers()` + `await vi.runAllTimersAsync()` to skip the 2 s delays; restore real timers in `afterEach`
  - (d) **non-retryable error stops immediately**: dispatch throws `KafkaClientError` with `retryable: false` → dispatch called exactly 1 time, returns `{ status: 'failed', retryCount: 0 }`
  - (e) **successful first attempt — no re-attempt**: dispatch resolves on first call → verify dispatch called exactly 1 time, `retryCount: 0` in outcome (idempotency)
  - (f) **total timeout cap**: use `vi.useFakeTimers()`, mock dispatch to take 3 500 ms per call via `setTimeout` (simulating slow broker); after `await vi.runAllTimersAsync()` the fake clock advances to 14 500 ms (3 500+2 000+3 500+2 000+3 500) which exceeds `TOTAL_TIMEOUT_MS`; verify `outcome.status === 'failed'`, `mockDispatch` called **3 times** (not 4 — timeout fires before MAX_RETRIES), `retryCount: 2`, `durationMs ≥ 10_000`; use `afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); })`
  - (g) **non-KafkaClientError caught**: dispatch throws a plain `Error` (not `KafkaClientError`) → returns `{ status: 'failed', retryCount: 0, errorCode: 'KAFKA_PUBLISH_UNKNOWN' }` without throwing, dispatch called once
  - (h) **optional fields in envelope**: when `testRun.projectName`, `envName`, `svcName`, `workflowName` are set, they appear in the envelope; when all are `undefined`, none of the optional keys appear in the parsed envelope
  - (i) **correct retry count in published outcome**: dispatch fails once then succeeds → `{ status: 'published', retryCount: 1 }` — use fake timers to skip the 2 s delay
- validate plaintext broker publish to `redfireforge.results.summary` (Scenario 13, 13D)
- validate publishing disabled path — no publish event emitted, local run unaffected (Scenario 13B)
- validate broker unavailable/auth-fail cases with non-blocking run completion (Scenario 13C)
- validate secure profile publish (auth/tls) and envelope parity (Scenario 13E)
- validate retry/idempotency behavior: retries bounded at 3; successful first publish is never re-attempted (Scenario 13F)
- validate publish hook fires at all three save call sites: `saveTestRun` (~line 393 in `execute()`), `saveTestRun` (~line 560 in `startExternalExecution()`), and `forceSaveTestRun` (~line 442 in `confirmSavePendingRun()`) (Scenario 13G)
- add explicit log/diagnostic assertions for publish outcome classification (Scenario 13C, 13E)
- run `npx tsc -b --noEmit` and the Phase 8C minimum test set (see PR kickoff checklist) before marking complete

Gate to phase exit:

- results publishing is optional, observable, and safe under both success and failure paths

**Implementation Notes (Phase 8C — completed 2026-06-01):**

- `src/shared/kafka/kafkaResultsPublisher.test.ts` created with **20 tests** across 9 describe groups (a)–(i).
- Mock pattern: `vi.importActual` via the `async (importOriginal)` factory keeps the real `KafkaClientError` class; only `dispatchKafkaOperation` is overridden by `mockDispatch`.
- `afterEach` calls both `vi.useRealTimers()` AND `vi.restoreAllMocks()` to cleanly reset fake-timer and spy state between tests.
- **Timeout test approach (lesson learned):** `vi.spyOn(Date, 'now')` does NOT intercept `Date.now` calls inside the module in the Node Vitest environment after `vi.useFakeTimers()` has previously run. The correct approach is to make the dispatch mock itself slow via `setTimeout` so that fake `Date.now()` (which advances with `vi.useFakeTimers()`) naturally exceeds `TOTAL_TIMEOUT_MS`. With 3 500 ms per dispatch attempt + 2 000 ms wait: total fake time = 14 500 ms → timeout fires after dispatch call 3 (retryCount=2) rather than the MAX_RETRIES-driven 4th call.
- Broker-level validation scenarios 13, 13B–13G are manual integration tests gated to the broker environment phase per original plan.
- All 20 tests pass. `npx tsc --noEmit` — 0 errors.

**Broker Scenario Implementation Notes (Phase 8C broker scenarios — implemented feature/kafka-integration):**

- Broker integration test script created at `docker/kafka/plaintext/broker-scenarios-p8c.sh`.
- Follows the same shell pattern as `docker/kafka/plaintext/smoke-test.sh` (curl, `require_prerequisites`, `request()`/`request_ok()` helpers, `--noproxy`).
- Script covers all seven broker scenarios with explicit pass/fail/skip reporting:
  - **13A** — Connects to plaintext Redpanda broker, produces a `KafkaRunSummaryEnvelope` to `redfireforge.results.summary`, consumes it back, and confirms delivery.
  - **13B** — Demonstrates the disabled-config path: no produce call is made for a disabled run-id; consume confirms no message on topic. References unit test (b) in `kafkaResultsPublisher.test.ts`.
  - **13C** — Disconnects the cluster then attempts produce; verifies the server returns `ok:false` (503/not-connected envelope). Confirms the fire-and-forget `publishRunResults` pattern returns `{ status: 'failed' }` without throwing.
  - **13D** — Produces a full envelope and parses the consumed message to assert: `schemaVersion === '1.0'`, `runId` match, `timestamp > 0`, `executionMode` present, all 9 summary fields present, optional traceability fields (`projectName`, `envName`, `svcName`) present.
  - **13E** — **Manual only — requires secure broker profile** (`docker/kafka/secure/`). Uses `KAFKA_SECURE_BROKERS` / `KAFKA_SECURE_USERNAME` / `KAFKA_SECURE_PASSWORD` env vars to connect with SASL/SCRAM-SHA-256 and verify full envelope parity on the secure profile. Validates: `state=connected` + `clusterId` match after connect; `sentCount=1` after produce; all 13D parity assertions on the consumed message (schemaVersion, runId, timestamp, executionMode, all 9 summary fields, optional traceability fields projectName + envName + svcName). Produces the same full envelope shape as `produce_summary_envelope` (including `projectName`, `envName`, `svcName`). Skipped automatically when env vars are not set. Uses SCRAM-SHA-256 without TLS (Redpanda supports SASL/SCRAM without TLS; SCRAM is used because that is what the secure init container provisions).
  - **13F** — Produces once and consumes with `maxMessages: 5` filtered by `keyEquals` to confirm exactly 1 message exists for the run-id (no duplicate publish). References unit tests (c), (d), (e), (i) for retry-logic specifics.
  - **13G** — Documents the three save-site hooks as covered by `useTestExecution.saveHandlers.test.ts`. No new broker calls needed; any successful run in the UI produces exactly one message (confirmed by 13A/13D).
- **Run command:** `./docker/kafka/plaintext/broker-scenarios-p8c.sh` (requires broker up and server running).
- **Secure scenario prerequisite:** `export KAFKA_SECURE_BROKERS=... KAFKA_SECURE_USERNAME=... KAFKA_SECURE_PASSWORD=...` before running to enable 13E.

**Phase 8C second re-evaluation notes (2026-06-02 — service layer + test coverage + svcName parity):**

A deeper second re-evaluation after the first (commit `8a8b160`) found four additional gaps:
1. **Auth error misclassification in produce()** — `kafka-service.ts` `produce()` classified SASL auth failures as `KAFKA_PRODUCE_FAILED` with `retryable:true`. Each KafkaJS producer performs its own SASL handshake, so auth errors CAN occur during produce (not only connect). Fixed: `isAuthError()` now checked in the `produce()` catch block; returns `KAFKA_AUTH_FAILED` with `retryable:false`. This prevents the publisher from wasting 3 retries (6 s) on bad credentials.
2. **Missing `failProduceAuth` mock in test-utils** — `kafka-service.test-utils.ts` had no option to simulate auth failure during `producer.send`. Added `failProduceAuth?: boolean` to the mock options interface and implementation.
3. **Missing publisher auth error test** — `kafkaResultsPublisher.test.ts` had no test confirming that `KAFKA_AUTH_FAILED` with `retryable:false` causes `publishRunResults` to stop after 1 attempt (`retryCount:0`). Added as group (j).
4. **svcName missing from 13D and 13E validation** — both scenarios validated `projectName` and `envName` but not `svcName`, even though the test envelope includes `svcName:'test-api'`. Added to both scenarios. Total: 39 → **41 PASS**.

Additional bug fixed in this re-evaluation (2026-06-02):
5. **`wait_for_broker_ready()` was fatal** — called `exit 1` if the plaintext broker wasn’t ready, preventing scenario 13E (secure profile) from running when only the secure broker is available. Fixed: now warns and returns (non-fatal) so 13E runs independently of the plaintext broker gate.
6. **Stale TLS comment in 13E** — the comment `NOTE: Redpanda requires TLS for SASL/PLAIN` was inaccurate (SCRAM-SHA-256 does not require TLS). Fixed to accurately describe why SCRAM is used.
7. **Missing "Manual only" label** — scenario 13E header and top-level script header now explicitly state "Manual only — requires secure broker profile".
8. **Group (j) inserted before (i) in publisher tests** — alphabetical ordering fix; (j) now follows (i).

Final state after both re-evaluations: **41/41 PASS** with secure broker. TypeScript: 0 errors. Unit tests: 54/54.

**Phase 8C re-evaluation notes (2026-06-02 — secure-profile publish parity):**

Thorough re-evaluation of the 13E scenario identified four gaps vs the plaintext 13D parity gate:
1. **No connection state validation** — 13E only checked `ok:true` after connect; did not verify `state=connected` or `clusterId` match (now uses `.data.status.state` / `.data.status.clusterId`, same as smoke-test S1/S2).
2. **Envelope missing optional fields** — 13E produced a minimal envelope (no `projectName`/`envName`/`svcName`); the plaintext `produce_summary_envelope` helper includes all three. Fixed: 13E now produces the same full envelope shape as plaintext.
3. **No `sentCount` check** — 13E did not verify `sentCount=1` from the produce response (13A–13D all check this). Fixed.
4. **No envelope field validation** — 13E only checked `consumed_count ≥ 1`; did not parse and validate individual fields. Fixed: 13E now runs the same full parity assertion set as 13D (schemaVersion, runId, timestamp, executionMode, all 9 summary fields, projectName, envName).

Result: 13E now has 13 PASS assertions (vs 4 before). Full suite with secure broker: **39/39 PASS**.

**Phase 8C third re-evaluation notes (2026-06-02 — full end-to-end manual validation):**

Thorough re-evaluation and manual validation of all Phase 8 broker scenarios (13A–13G) and secure-profile publish parity:
- **Code review**: Reviewed `kafkaResultsPublisher.ts` (101 lines), `broker-scenarios-p8c.sh` (878 lines), `kafkaResultsPublisher.test.ts` (369 lines), `kafkaPublishTypes.test.ts` (172 lines), `useTestExecution.saveHandlers.test.ts` — no bugs found.
- **Unit tests**: All 49 tests pass (20 publisher + 14 types + 11 save handlers + 4 additional).
- **Manual validation**: Ran `broker-scenarios-p8c.sh` with both plaintext and secure brokers live → **41/41 PASS, 0 FAIL, 0 SKIP**.
- **Retry logic**: Confirmed MAX_RETRIES=3 correctly produces 4 total dispatch calls (1 + 3 retries), TOTAL_TIMEOUT_MS=10000 caps total elapsed time.
- **Secure parity**: 13E validates all 13 assertions matching plaintext 13D — full envelope field parity confirmed.
- **Error classification**: Server → `KAFKA_AUTH_FAILED` / `KAFKA_NOT_CONNECTED` / `KAFKA_CONNECT_TIMEOUT`; client `classifyKafkaUiError` maps correctly.
- **Non-fatal broker gate**: `wait_for_broker_ready()` allows 13E (secure) to run independently of plaintext broker availability.
- **No race-boundary issues**: Fire-and-forget publish pattern isolates run completion from broker failures.
- **TypeScript**: `npx tsc -b --noEmit` — 0 errors.

### Validation matrix (required before Phase 8 exit)

Contract validation:

- publish envelope validates against versioned contract with required fields
- schema evolution path is backward compatible for at least one prior version

Runtime validation:

- enabled publish sends one summary event per completed run in normal path
- publish failures in default mode do not alter run completion/persistence status
- retries remain bounded and do not duplicate success events; idempotency enforced by retrying only on `KafkaClientError` with `retryable: true` — a prior successful publish is never re-attempted

Operational validation:

- publish diagnostics clearly distinguish transport/config/auth failures
- secure and plaintext publish paths produce equivalent envelope semantics
- downstream consumers can key deduplication by run id + schema version

### Execution slicing matrix (recommended)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Exit Gate |
| --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p8a-publish-contracts` | Contracts + Runner | 1.0-1.5 days | Phase 6 complete | versioned envelope + config contract finalized |
| 2 | `kafka-p8b-publish-runtime` | Runner Runtime + Server Kafka | 1.5-2.0 days | PR1 | publish-on-completion works with non-blocking failure semantics |
| 3 | `kafka-p8c-publish-validation` | QA + Platform | 1.0-1.5 days | PR2 | secure/plaintext parity and failure-path safety verified |

### PR kickoff checklist (Phase 8)

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p8a-publish-contracts` | `feature/kafka-p8a-publish-contracts` | `npx vitest run src/shared/kafka/kafkaPublishTypes.test.ts`, `npx vitest run src/features/test-runner/hooks/runnerConfigDefaults.test.ts`, `npx vitest run src/features/test-runner/hooks/useRunnerConfig.test.ts`, and `npx tsc -b --noEmit` | envelope and config contract validated |
| `kafka-p8b-publish-runtime` | `feature/kafka-p8b-publish-runtime` | `npx vitest run src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts`, `npx vitest run src/features/test-runner/hooks/useRunnerOrchestration.test.ts`, and `npx tsc -b --noEmit` | publish integrated without affecting run persistence |
| `kafka-p8c-publish-validation` | `feature/kafka-p8c-publish-validation` | `npx vitest run src/shared/kafka/kafkaResultsPublisher.test.ts`, `npx vitest run src/shared/kafka/kafkaPublishTypes.test.ts`, and `npx vitest run src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts` plus plaintext/secure profile integration scenarios | non-blocking safety and parity verified |

Phase 8 PR readiness sequence:

1. Create `feature/*` branch for the slice from latest `develop`.
2. Run `npx tsc -b --noEmit` and slice minimum tests.
3. Validate one-success and one-failure publish path for unchanged run completion behavior.
4. Attach envelope examples and publish outcome evidence in PR description.

### Test plan

All test coverage is specified in the per-phase implementation checklists above. Summary of test files owned by Phase 8:

- `src/shared/kafka/kafkaPublishTypes.test.ts` (new, 8A) — envelope type shape, required fields, `KafkaResultsPublishConfig` validation
- `src/features/test-runner/hooks/runnerConfigDefaults.test.ts` (updated, 8A) — `resolveLoadedConfig` preserves/passes-through `kafkaResultsPublish`
- `src/features/test-runner/hooks/useRunnerConfig.test.ts` (updated, 8A) — `kafkaResultsPublish` save/restore/default
- `src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts` (updated, 8B) — publish called after save, failure non-blocking, disabled path skips
- `src/features/test-runner/hooks/useRunnerOrchestration.test.ts` (updated, 8B) — `kafkaResultsPublish` from `useRunnerConfig` is passed to `useTestExecution` at hook initialisation
- `src/shared/kafka/kafkaResultsPublisher.test.ts` (new, 8C) — envelope assembly, skip path, retryable/non-retryable error handling, no-double-publish, 10 s cap, non-`KafkaClientError` catch

### Broker environment prerequisites

Phase 8C validation requires two broker profiles to be available:

- plaintext local broker: Docker Compose profile at `docker/kafka/plaintext/` — start with `docker compose up -d` from that directory and confirm `redfireforge.results.summary` topic is accessible before running Scenarios 13–13D and 13G
- secure profile (auth/TLS): Docker Compose secure variant at `docker/kafka/secure/` or external cluster — confirm credentials, CA cert, and topic write access before running Scenario 13E
- broker-unavailable simulation: stop the local broker post-run-start to exercise non-blocking failure path (Scenario 13C)
- idempotency check: use consumer offset tracking to confirm no duplicate events for the same `runId`; retries only fire on `KafkaClientError` with `retryable: true` so no duplicates should appear when the first publish succeeds (Scenario 13F)

### Risks and mitigations

- Risk: publish failures pollute primary execution path.
- Mitigation: non-blocking default mode with explicit opt-in strict mode later.
- Risk: broker not available in CI/CD during Phase 8C merge gate.
- Mitigation: gate real-broker scenarios to a separate integration step; keep unit/contract tests in the standard merge gate.

### Exit criteria

- Result summaries publish successfully when enabled.
- Core run completion behavior remains stable when publish fails.
- Publish hook fires at all three save call sites: `saveTestRun` in `execute()`, `saveTestRun` in `startExternalExecution()`, and `forceSaveTestRun` in `confirmSavePendingRun()` (Scenario 13G).
- Both plaintext and secure broker profiles validated in Phase 8C scenarios.

---

## Phase 9 — Tauri-native Kafka Transport (rdkafka)

Estimated effort: 8-12 days (9A: 2.0-2.5 days, 9B: 2.5-3.0 days, 9C: 2.0-2.5 days, 9D: 1.5-2.0 days, build-chain setup: 0.5-1.0 day)
Dependencies: Phases 1-8 stable in server-proxy mode

### Scope

Add native Kafka path for desktop (Tauri) mode to reduce proxy dependency and improve performance. The server-proxy path remains the primary path for browser/dev mode and acts as the permanent fallback for parity validation.

### Deliverables

- `rdkafka` Cargo dependency and native Kafka module (`src-tauri/src/kafka/`).
- Rust-side Kafka lifecycle manager (`KafkaState`) with parity to the server contract surface.
- Tauri commands for connect/disconnect/status/topics/produce/consume/subscribe/unsubscribe.
- Frontend platform utility (`isTauri`) and transport factory that routes to native commands in Tauri mode, server-proxy otherwise.
- Cross-transport contract parity tests using shared golden fixtures.

### Re-evaluation delta (2026-05-31)

Phase 9 is significantly heavier than the prior high-level outline implies. This review grounds the plan in the actual codebase state.

Architecture reality as of this review:

- `rdkafka` is not present in `src-tauri/Cargo.toml` — zero Kafka Rust code exists yet; Phase 9 is fully greenfield
- no `isTauri` transport utility or transport-switching pattern exists in the frontend; this is net-new
- the existing Tauri command/state pattern is proven (see `ExecutorState` in `src-tauri/src/commands.rs`); the Kafka lifecycle manager must follow the same shape: `tauri::State<'_, KafkaState>` with `Arc<Mutex<...>>` for the connection map
- `rdkafka` requires `librdkafka` native libraries at build time — build-chain setup (macOS arm64, CI cross-compilation) must be budgeted separately before 9A work starts

Critical constraints from this review:

- server-proxy path (`src-server/routes/kafka-routes.ts` + `src-server/kafka/kafka-service.ts`) must remain fully functional at all times; native path is additive only
- frontend must never hard-require native Tauri commands in browser/dev mode
- error mapping between rdkafka error types and the shared contract's `KafkaErrorBody` shape must be explicitly defined before 9B work starts (`KafkaErrorBody` is the actual type name in `src-server/kafka/contracts.ts` — there is no `KafkaApiError` type)
- Phase 9D golden-fixture parity tests are mandatory before any desktop release — not optional polish

Implementation anchors in the current codebase:

- existing Tauri command/state pattern: `src-tauri/src/commands.rs` (see `ExecutorState`, `#[tauri::command]`, `tauri::AppHandle`, `tauri::Emitter`)
- Cargo dependency manifest: `src-tauri/Cargo.toml` (add `rdkafka` here)
- Kafka server contract definitions: `src-server/kafka/contracts.ts` (shapes the Rust response envelope)
- Kafka server runtime: `src-server/kafka/kafka-service.ts` (behavior reference for parity)
- Kafka server route surface: `src-server/routes/kafka-routes.ts` (operation surface to mirror)
- frontend Kafka settings/cluster config: `src/features/kafka/kafkaSettingsUtils.ts`, `src/features/kafka/kafkaClusterForm.ts`
- **`isTauri()` already exists** at `src/shared/utils/platform.ts` — do NOT create a new file; import from here
- **transport-switching mechanism already implemented** in `src/shared/kafka/kafkaClient.ts`: `KafkaClientTransport` type, `setKafkaClientTransport()`, and `transportOverride ?? defaultTransport` routing — Phase 9C extends this, not a new factory file
- net-new files to create: `src-tauri/src/kafka/mod.rs`, `src-tauri/src/kafka/state.rs`, `src-tauri/src/kafka/commands.rs`, `src/shared/kafka/kafkaNativeTauriTransport.ts` (native Tauri `KafkaClientTransport` implementation)

### Sub-phases

#### Phase 9A - Build-chain setup and native contract baseline

Goal: establish the Rust Kafka foundation and mirror the proven server lifecycle contract shape.

Implementation steps:

1. Add `rdkafka` (with `cmake-build` feature) to `src-tauri/Cargo.toml`; **`tokio` and `tokio-util` are already present — do not re-add them**; verify `cargo build` succeeds on macOS arm64.
2. Create `src-tauri/src/kafka/` module with `KafkaState` (connection map, lifecycle tracking) following the `ExecutorState` pattern in `commands.rs`.
3. Implement `kafka_connect`, `kafka_disconnect`, `kafka_status`, and `kafka_topics` Tauri commands.
4. Register `KafkaState` in **`src-tauri/src/lib.rs`** alongside existing state (NOT `main.rs` — `main.rs` is a full CLI/GUI dispatcher with `clap` subcommand logic and does not contain the Tauri builder; `.manage()` and `.invoke_handler()` live in `lib.rs`).
5. Keep request/response envelope shapes strictly aligned with `src-server/kafka/contracts.ts`.

Detailed implementation checklist:

- `rdkafka` added to `src-tauri/Cargo.toml` with `cmake-build` feature flag (e.g. `rdkafka = { version = "0.37", features = ["cmake-build"] }`); `tokio` and `tokio-util` are **already present** — do not re-add them
- `cargo build` verified clean on macOS arm64
- `mod kafka;` declaration added to `src-tauri/src/lib.rs` for module visibility (crate root — NOT `main.rs`, which is a full CLI/GUI dispatcher with `clap` subcommand logic and does not contain any Tauri builder calls)
- `KafkaState` defined in `src-tauri/src/kafka/state.rs` with a connection map using `std::sync::Mutex` (following `ExecutorState`'s preference for `std::sync::Mutex` over `tokio::sync::Mutex` — this is a Tauri threading constraint); **note: `ExecutorState` manages a single connection (`Arc<Client>` + `std::sync::Mutex<Option<CancellationToken>>`); `KafkaState` manages multiple connections indexed by cluster ID and requires a different shape**: `pub inner: std::sync::Mutex<HashMap<ClusterId, ClientHandle>>` where `ClusterId = String` (cluster ID from the frontend config) and `ClientHandle` is a per-cluster wrapper struct holding the `rdkafka::producer::FutureProducer`, `rdkafka::consumer::StreamConsumer`, and a `CancellationToken` for subscription cleanup — define both types in `state.rs`
- `KafkaState` registered via `.manage(KafkaState::new())` in **`src-tauri/src/lib.rs`** (the Tauri builder location — `.manage()` and `.invoke_handler()` are both in `lib.rs`, not `main.rs`)
- `kafka_connect`, `kafka_disconnect`, `kafka_status`, `kafka_topics` commands implemented and added to the **`tauri::generate_handler![...]` list in `src-tauri/src/lib.rs`** using the path `kafka::commands::kafka_connect` etc. (matching the existing `commands::start_load_test` pattern; `mod kafka;` must be declared in `lib.rs` alongside the other module declarations at the top of the file)
- response shapes strictly aligned with `src-server/kafka/contracts.ts`
- Rust unit tests for connect/disconnect state transitions and topic list shape

##### Phase 9A Implementation Notes (completed)

**Status:** ✅ Implemented — `cargo build` clean, 17/17 Rust unit tests passing.

**Files created/modified:**
- `src-tauri/Cargo.toml` — added `rdkafka = { version = "0.37", features = ["cmake-build"] }`
- `src-tauri/src/kafka/mod.rs` — module root (`pub mod commands; pub mod state;`)
- `src-tauri/src/kafka/state.rs` — `KafkaState { inner: Mutex<HashMap<ClusterId, ClientHandle>> }`; `ClientHandle` stores `rdkafka_config: ClientConfig` for on-demand client creation (Phase 9A does NOT keep a persistent admin client open)
- `src-tauri/src/kafka/commands.rs` — all four commands + inline `#[cfg(test)] mod tests` with 17 broker-free unit tests
- `src-tauri/src/lib.rs` — added `mod kafka;`, `use kafka::state::KafkaState;`, `.manage(KafkaState::new())`, and four `kafka::commands::*` entries to `generate_handler!`
- `src-tauri/.cargo/config.toml` — `[http] proxy = ""` to bypass corporate proxy env vars during `cargo build`

**Key design decisions vs. plan:**
1. `ClientHandle` stores `rdkafka_config: ClientConfig` (not `FutureProducer`/`StreamConsumer` as suggested in Phase 9A notes) — Phase 9A only needs lifecycle commands; Phase 9B will add producer/consumer fields when it needs them. This avoids creating persistent connections that are never used.
2. Connectivity verification uses a short-lived `BaseConsumer.fetch_metadata(None, timeout)` created inside `tokio::task::spawn_blocking`. A temp `group.id = "rf-admin-connect-check"` is set on a cloned config to satisfy `BaseConsumer` requirements without polluting the stored config.
3. `isInternal` heuristic: rdkafka 0.37 `MetadataTopic` does NOT expose an `is_internal` flag. Used `name.starts_with("__")` as the heuristic (covers `__consumer_offsets`, `__transaction_state`, etc.).
4. TLS `serverName` (custom SNI override): accepted in the input struct but not forwarded to rdkafka — rdkafka 0.37 does not support custom SNI and derives it from the broker hostname. Field retained for API parity.
5. All commands return `Result<serde_json::Value, String>`. Application-level Kafka errors use `Ok(error_envelope)` (not `Err`) so Phase 9C transport layer always sees a resolved promise.
6. cmake required for `cmake-build` feature. Had to install via `brew install cmake`. See CI notes.

**CI requirements (document before Phase 9B merge):**
- macOS runners need `cmake` installed (e.g. `brew install cmake` or `actions/setup-cmake`)
- Linux runners need `cmake` + `libssl-dev` + `build-essential`

#### Phase 9B - Native operation surface

Goal: implement produce, consume, and subscription operations with consistent error mapping.

Implementation steps:

1. Implement `kafka_produce` command with error mapping to shared `KafkaErrorBody` contract shape (`KafkaErrorBody` is the actual type in `src-server/kafka/contracts.ts`; there is no `KafkaApiError` type).
2. Implement `kafka_consume_once` command with bounded message count and offset semantics (**command name is `kafka_consume_once`**, not `kafka_consume` — the contract operation is `consume-once` with a hyphen; Rust function names use underscores: `kafka_consume_once`).
3. Implement `kafka_subscribe` / `kafka_unsubscribe` commands with cleanup on drop.
4. Implement `kafka_subscriptions` command (list active subscriptions; maps to the `subscriptions` operation in `KafkaOperation` / `GET /api/kafka/subscriptions` route; returns `KafkaSubscriptionsResult`).
5. Define explicit rdkafka-to-contract error mapping table; cover all known rdkafka error variants that can surface to the UI.

Detailed implementation checklist:

- `kafka_produce`, `kafka_consume_once`, `kafka_subscribe`, `kafka_unsubscribe`, `kafka_subscriptions` commands implemented and **added to `tauri::generate_handler![...]` in `src-tauri/src/lib.rs`** using the path `kafka::commands::kafka_produce` etc. (note: Rust function is `kafka_consume_once` — the `consume-once` contract operation uses an underscore in the Rust name; do NOT name it `kafka_consume`)
- `kafka_subscribe` and `kafka_unsubscribe` implemented with a **two-phase delivery model**:
  - **Synchronous part**: `kafka_subscribe` is a normal `#[tauri::command]` that starts a background consumer task and immediately returns `KafkaSubscribeResult` (the `subscriptionId`) via the `invoke` response — this is the part `KafkaClientTransport` handles in Phase 9C
  - **Asynchronous part**: the background task emits one Tauri event per received message using `app.emit("kafka-subscription-message", payload)` where `app: tauri::AppHandle` is a parameter of `kafka_subscribe`; the payload shape must be `{ "subscriptionId": "<uuid>", "record": <KafkaConsumeRecord> }` (matching the `KafkaConsumeRecord` shape from `src-server/kafka/contracts.ts`); the frontend listens for these events using `listen()` from `@tauri-apps/api/event` — **this is separate from `KafkaClientTransport`** and must be handled explicitly in Phase 9C (not via `dispatchKafkaOperation`)
  - **Event name**: `"kafka-subscription-message"` (kebab-case, following the existing `"load-test-complete"` event pattern in `commands.rs`)
- subscription cleanup uses `CancellationToken` (from `tokio_util::sync` — `tokio-util` is **already in `Cargo.toml`**; add `use tokio_util::sync::CancellationToken;` explicitly in `src-tauri/src/kafka/commands.rs` just as it is declared in `commands.rs`) following the `ExecutorState` pattern; cancel on unsubscribe and on app-window-close event; each `ClientHandle` in `KafkaState` holds its own `CancellationToken` (distinct from the single-token `ExecutorState` pattern — multi-subscription requires one token per subscription)
- error mapping layer defined and tested for all rdkafka variants relevant to lifecycle, produce, consume
- cleanup on unsubscribe / app close verified with no dangling threads
- concurrent operation safety verified: produce does not interfere with an active subscriber on the same or different topic

##### Phase 9B Implementation Notes (completed 2026-06-04, branch `feature/kafka-integration`)

**What was implemented:**

1. **`kafka_produce`** — short-lived `FutureProducer` per invocation via `spawn_blocking` + `Handle::current().block_on()`. Accepts `KafkaProduceRequest` (topic + messages array with key/value/headers/partition). Returns `KafkaProduceResult` with per-record delivery offsets.

2. **`kafka_consume_once`** — fully async `StreamConsumer` with deadline loop. Stops when `max_messages` reached or `timeout_ms` elapsed. Returns `KafkaConsumeResult` with `timedOut` flag. Supports `filter: KafkaMessageFilter` (key, headers, jsonPath/jsonEquals).

3. **`kafka_subscribe`** — starts a long-lived `StreamConsumer` in a `tokio::spawn` background task. Returns `KafkaSubscribeResult` with `subscriptionId` immediately. Each matching message is emitted as `"kafka-subscription-message"` Tauri event with payload `{ subscriptionId, record: KafkaConsumeRecord }`. Uses `CancellationToken` for graceful shutdown.

4. **`kafka_unsubscribe`** — cancels the subscription's `CancellationToken`, removes handle from state. Returns `KafkaUnsubscribeResult`.

5. **`kafka_subscriptions`** — lists all active subscriptions for a cluster. Returns `KafkaSubscriptionsResult`.

**Key design decisions:**

- All commands return `Result<serde_json::Value, String>`. App-level errors use `Ok(error_envelope)` so the transport layer always receives a resolved value and inspects `envelope.ok`. Only Mutex poison uses `Err(String)`.
- `SubscriptionHandle` (with `cancel_token: CancellationToken`, `subscription_id`, `topic`, `group_id`, `created_at`) stored in `ClientHandle.subscriptions: HashMap<String, SubscriptionHandle>`. `subscription_count()` is now a computed method on `ClientHandle`, not a stored field.
- `kafka_subscribe` spawns the background task BEFORE inserting the handle into state. Acceptable TTRT edge case: if `kafka_disconnect` is called in the window between spawn and registration, the background task runs until the next message error or app close (not a safety issue, just an edge case).
- `kafka_produce` uses `spawn_blocking` because rdkafka's `FutureProducer.send()` is async but must be awaited from a blocking context. `tokio::runtime::Handle::current().block_on()` is the correct bridge.
- Message filter (`matches_filter`) mirrors `matchesKafkaConsumeFilter` from `src-server/kafka/kafka-service-utils.ts` exactly: keyEquals → exact key match, headersMatch → all k/v must match, jsonPath+jsonEquals → simple `$.key.subkey[0]` notation with `read_json_path()` helper.

**Error codes (all now use `KAFKA_` prefix for UI classifier parity):**
- `KAFKA_CONNECT_FAILED` / `KAFKA_CONNECT_TIMEOUT` (Phase 9A, re-applied)
- `KAFKA_NOT_CONNECTED` (Phase 9A topics + all Phase 9B ops)
- `KAFKA_TOPICS_FAILED` (Phase 9A, re-applied)
- `KAFKA_INVALID_PRODUCE`, `KAFKA_PRODUCE_FAILED`
- `KAFKA_INVALID_CONSUME_ONCE`, `KAFKA_CONSUME_ONCE_FAILED`
- `KAFKA_INVALID_SUBSCRIBE`, `KAFKA_SUBSCRIBE_FAILED`
- `KAFKA_SUBSCRIPTION_NOT_FOUND`

**Dependencies added:** `uuid = { version = "1", features = ["v4"] }` for subscription ID generation.

**Test count:** 656/656 passing (44 Kafka-specific tests covering all new types, filter logic, json-path traversal, envelope shapes, and the `connect_error_code` timeout/non-timeout variants from Phase 9A re-eval).

#### Phase 9C - Frontend transport switching and fallback

Goal: route frontend Kafka operations to native commands in Tauri mode; keep server-proxy for browser/dev mode.

Implementation steps:

1. Create `src/shared/kafka/kafkaNativeTauriTransport.ts` with two exports:
   - **`kafkaNativeTauriTransport: KafkaClientTransport`** — implements the transport using `invoke` from `@tauri-apps/api/core` (dynamic import only; no top-level static import); maps each `KafkaOperation` to the corresponding Tauri command name using the table below; must throw `KafkaClientError` on `!ok` responses (not return them as resolved envelopes) to match `defaultTransport` behavior
   - **`listenKafkaSubscriptionMessage(callback)`** — wraps `listen('kafka-subscription-message', callback)` from `@tauri-apps/api/event` (dynamic import; same guard pattern); returns the Tauri unlisten function; this is the ONLY path to receive streaming subscription messages in Tauri mode and is separate from `KafkaClientTransport` (which only handles the synchronous subscribe registration invoke)

   **`KafkaOperation` → Tauri command name mapping** (all 9 operations):
   | `KafkaOperation` | Tauri command (Rust fn name) | Note |
   |---|---|---|
   | `connect` | `kafka_connect` | |
   | `disconnect` | `kafka_disconnect` | |
   | `status` | `kafka_status` | |
   | `topics` | `kafka_topics` | |
   | `produce` | `kafka_produce` | |
   | `consume-once` | `kafka_consume_once` | hyphen → underscore; do NOT use `kafka_consume` |
   | `subscribe` | `kafka_subscribe` | synchronous invoke only — streaming via `listenKafkaSubscriptionMessage` |
   | `subscriptions` | `kafka_subscriptions` | |
   | `unsubscribe` | `kafka_unsubscribe` | |

   **Invoke args mapping** (`KafkaDispatchRequest` → `invoke` second argument):
   - POST operations (`method === 'POST'`): pass `request.body ?? {}` as the args object
   - GET operations (`method === 'GET'`): pass `request.query` as the args object (Tauri auto-converts camelCase JS keys to snake_case Rust parameter names)

2. Wire transport init in **`src/app/main.tsx`** at **module level, before `createRoot`** — NOT inside a React `useEffect` in `App.tsx` (a `useEffect` runs after mount and runs twice in StrictMode dev, risking brief server-proxy usage or double-registration). The init block is:
   ```ts
   if (isTauri()) {
     setKafkaClientTransport(kafkaNativeTauriTransport);
   }
   createRoot(document.getElementById('root')!).render(...);
   ```
   No call needed in browser/dev mode — server-proxy default stays active automatically.

3. Add `src/shared/kafka/kafkaNativeTauriTransport.test.ts` covering: native path success (each operation invokes correct command name — especially `consume-once` → `kafka_consume_once`), native path error (Rust returns `ok: false` → `KafkaClientError` is thrown, NOT resolved), `setKafkaClientTransport(null)` restores server-proxy default, `listenKafkaSubscriptionMessage` calls `listen('kafka-subscription-message', ...)` and returns unlisten function.

Note: `src/utils/platform.ts` and `src/services/kafkaTransport.ts` do NOT need to be created. `isTauri()` already exists at `src/shared/utils/platform.ts` and transport switching is already implemented in `src/shared/kafka/kafkaClient.ts`.

Detailed implementation checklist:

- **`isTauri()` already exists** in `src/shared/utils/platform.ts` — do NOT create a new file; import directly from there; `platform.test.ts` also already exists at `src/shared/utils/platform.test.ts`
- **transport switching already implemented** in `src/shared/kafka/kafkaClient.ts`: `KafkaClientTransport` type + `setKafkaClientTransport()` + `transportOverride ?? defaultTransport` routing; no new factory file needed
- create `src/shared/kafka/kafkaNativeTauriTransport.ts` with **two exports**:
  - `kafkaNativeTauriTransport: KafkaClientTransport` — use dynamic import of `@tauri-apps/api/core` inside the function body (no top-level static import); for POST ops pass `request.body ?? {}` as invoke args; for GET ops pass `request.query` as invoke args; **throw `KafkaClientError` when `envelope.ok === false`** (same behavior as `defaultTransport`/`parseEnvelope` — do NOT return the error envelope as a resolved value or all call-site error handling breaks); see command name mapping table in implementation steps above
  - `listenKafkaSubscriptionMessage(callback: (payload: { subscriptionId: string; record: KafkaConsumeRecord }) => void): Promise<() => void>` — wraps `listen('kafka-subscription-message', e => callback(e.payload))` from `@tauri-apps/api/event` (dynamic import); returns the Tauri unlisten function; this is the mechanism that delivers streaming subscription messages to the frontend in native mode — **without this export, subscription messages are never received in Tauri mode**
- wire transport init in **`src/app/main.tsx`** at module level before `createRoot` — if `isTauri()`, call `setKafkaClientTransport(kafkaNativeTauriTransport)`; this must be module-level (not inside a `useEffect`) to ensure the transport is set before any React rendering and to avoid double-registration under React StrictMode dev
- `kafkaNativeTauriTransport.ts` factory uses dynamic import of `@tauri-apps/api/core` **and** `@tauri-apps/api/event` only inside the function/handler body — no top-level static imports of either
- all Kafka call sites in `src/features/kafka/` already route through `dispatchKafkaOperation()` in `kafkaClient.ts` — no per-call-site wiring needed once `setKafkaClientTransport` is called at init; **subscription streaming listeners** (using `listenKafkaSubscriptionMessage`) must be wired up at the feature layer when a subscription is active, then torn down using the returned unlisten function on unsubscribe
- add `src/shared/kafka/kafkaNativeTauriTransport.test.ts` covering:
  - each operation invokes the correct Tauri command name (especially `consume-once` → `kafka_consume_once` and `subscriptions` → `kafka_subscriptions`)
  - POST operations pass `request.body` as invoke args; GET operations pass `request.query`
  - `ok: false` Rust response throws `KafkaClientError` (not resolves) — test both `ok: false` and thrown invoke error paths
  - `setKafkaClientTransport(null)` restores the server-proxy default
  - `listenKafkaSubscriptionMessage` calls `listen('kafka-subscription-message', ...)` and returns the unlisten function

#### Phase 9D - Cross-transport parity hardening

Goal: prove behavior equivalence between server-proxy and native transports end-to-end.

Implementation steps:

1. Define golden-fixture request/response pairs for all operations: `connect`, `disconnect`, `status`, `topics`, `produce`, `consume-once`, `subscribe`, `unsubscribe` — 8 fixtures total (the `subscriptions` list-operation does not require its own fixture since it depends on prior subscribe state; test it as part of the subscribe scenario).
2. Run the same fixture-driven tests against both server-proxy and native transports for all request/response operations.
3. Resolve any envelope drift before desktop release gate.
4. Add Playwright visual parity spec (`e2e/kafka-desktop.spec.ts`) — **note: the existing Playwright config targets `localhost:5173` (Vite dev server = browser/server-proxy mode)**; this spec validates the server-proxy transport UI flow (connect, topic browse, produce, consume-once); native Tauri command correctness is validated by `cargo test` in 9A/9B, not by Playwright; true cross-transport visual parity requires `tauri-driver` integration (out of scope for initial 9D — flag as a follow-on if needed).

Detailed implementation checklist:

- golden fixture set defined and committed to `test-data/kafka/` as JSON files with shape `{ operation, request, expectedResponse, expectedErrorShape? }` — one file per operation (`connect`, `disconnect`, `status`, `topics`, `produce`, `consume-once`, `subscribe`, `unsubscribe`); **note: fixture file for subscribe covers only the synchronous request/response (returns subscriptionId); streaming subscription message events have no server-proxy parity equivalent (server-proxy uses an in-memory ring buffer with no retrieval route), so streaming parity is not tested via golden fixtures — it is validated manually in real-broker testing**
- parity tests pass for all 8 operations on both transport paths
- error mapping equivalence verified: same input error condition → same UI-safe error message in both modes
- Playwright spec `e2e/kafka-desktop.spec.ts` added covering the server-proxy transport UI flow at minimum: connect, topic browse, produce, consume-once (this spec runs against `localhost:5173` via `npm run dev`; it does NOT test native Tauri commands)
- concurrent operation parity verified: produce + active subscriber scenario exercised on both transports

Gate to phase exit:

- desktop transport is interchangeable with server-proxy mode from the app's perspective with parity tests green

### Validation matrix (required before Phase 9 exit)

Build and dependency validation:

- `cargo build` succeeds on macOS arm64 with rdkafka and all feature flags
- `npx tsc -b --noEmit` passes with no new errors from transport factory

Contract validation:

- Rust command response shapes match server contract definitions for all operations
- rdkafka error variants map to the same `KafkaErrorBody` shapes as the server layer

Runtime validation:

- connect/disconnect/status/topics/produce/consume-once/subscribe/unsubscribe all function end-to-end via native commands against real broker
- frontend fallback to server-proxy is triggered correctly when not in Tauri mode

Parity validation:

- same golden-fixture input produces equivalent response envelope from both transports
- error conditions produce equivalent UI-safe messages in both modes

CI gate stratification:

- standard CI gate (all PRs): `cargo build`, `cargo test`, `npx tsc -b --noEmit`, vitest transport factory suite — no broker or Tauri desktop build required
- integration gate (9D merge): golden-fixture parity suite + `npx playwright test e2e/kafka-desktop.spec.ts --reporter=list` — requires Tauri desktop build and running local broker
- do NOT block standard PRs on the integration gate; run it as a separate required check on the 9D PR only

### Broker environment prerequisites

Phase 9D parity validation requires both transports to run against the same broker:

- plaintext local broker: Docker Compose at `docker/kafka/plaintext/docker-compose.yml` — start with `docker compose -f docker/kafka/plaintext/docker-compose.yml up -d` (or `cd docker/kafka/plaintext && docker compose up -d`) before parity test run
- secure profile (auth/TLS): `docker/kafka/secure/` exists as an empty placeholder (`.gitkeep` only) — files must be populated before secure-mode parity testing; **secure-mode parity is NOT required for the initial 9D merge** and may be deferred to a follow-on PR; do NOT block 9D on this
- both desktop (Tauri) and browser/dev modes must be running simultaneously or sequentially against the same broker for fixture comparison
- Tauri desktop dev build: `npm run tauri:dev` (defined in `package.json` as `"tauri:dev": "tauri dev"`) must be running for native transport tests; browser/dev server (`npm run dev`) runs in parallel for server-proxy comparison

### Execution slicing matrix (recommended)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Exit Gate |
| --- | --- | --- | --- | --- | --- |
| 0 | `kafka-p9-build-chain` | Platform/Rust | 0.5-1.0 day | Phase 8 complete | `cargo build` clean with rdkafka on macOS arm64 |
| 1 | `kafka-p9a-native-lifecycle` | Rust/Commands | 2.0-2.5 days | PR0 | connect/disconnect/status/topics commands + state tests |
| 2 | `kafka-p9b-native-ops` | Rust/Commands | 2.5-3.0 days | PR1 | produce/consume/subscribe with error mapping tests |
| 3 | `kafka-p9c-transport-switch` | Frontend | 2.0-2.5 days | PR2 | transport factory + isTauri + fallback tests |
| 4 | `kafka-p9d-parity-hardening` | QA + Platform | 1.5-2.0 days | PR3 | golden-fixture parity green + Playwright desktop smoke |

### PR kickoff checklist (Phase 9)

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p9-build-chain` | `feature/kafka-p9-build-chain` | `cargo build` + `cargo test` | clean build on macOS arm64 confirmed |
| `kafka-p9a-native-lifecycle` | `feature/kafka-p9a-native-lifecycle` | `cargo test` for kafka module + `npx tsc -b --noEmit` | lifecycle command state tests passing |
| `kafka-p9b-native-ops` | `feature/kafka-p9b-native-ops` | `cargo test` for produce/consume/subscribe + error mapping tests | all native ops tested with error variant coverage |
| `kafka-p9c-transport-switch` | `feature/kafka-p9c-transport-switch` | `npx vitest run src/shared/kafka/kafkaNativeTauriTransport.test.ts src/shared/kafka/kafkaClient.test.ts` + `npx tsc -b --noEmit` | both transport paths tested; browser fallback verified |
| `kafka-p9d-parity-hardening` | `feature/kafka-p9d-parity-hardening` | golden fixture parity suite + `npx playwright test e2e/kafka-desktop.spec.ts --reporter=list` | parity tests green on both transports |

Phase 9 PR readiness sequence:

1. Always start from latest `develop`; never from a Phase 8 feature branch.
2. Phase 0 build-chain PR must merge before any Phase 9A work begins — unblocking Rust Kafka compilation is the critical path.
3. Confirm `cargo build` clean before submitting any Rust-touching PR.
4. For Phase 9C/9D, confirm server-proxy path remains fully functional in browser/dev mode after transport switch wiring.
5. Attach broker session screenshot or log evidence in PR description for all real-broker validation steps.

### Test plan

- Rust unit tests for all Tauri command handlers (`cargo test`).
- Frontend transport factory tests (vitest) for both native and fallback paths.
- Cross-transport parity tests using golden fixtures in `test-data/kafka/`.
- Playwright desktop smoke spec (`e2e/kafka-desktop.spec.ts`).

### Risks and mitigations

- Risk: `rdkafka` build-chain complexity on macOS arm64 and CI cross-compilation.
- Mitigation: dedicate a pre-work PR (PR0) solely to build-chain validation before starting 9A; block all Rust Kafka work on this gate.
- Risk: behavior drift between kafkajs and rdkafka on edge cases (offset semantics, error codes).
- Mitigation: golden-fixture parity tests run against both transports as a mandatory Phase 9D gate.
- Risk: frontend transport switch leaks Tauri-specific imports into browser bundle.
- Mitigation: `isTauri()` guards and transport factory must import Tauri invoke lazily; no top-level static import of `@tauri-apps/api` in shared paths.
- Risk: Kafka subscription lifecycle cleanup on app close differs between server-proxy and native modes.
- Mitigation: explicit cleanup test on unsubscribe and simulated app-close event in Phase 9B.

### Exit criteria

- Desktop uses native Kafka transport for all operations in Tauri mode.
- Server-proxy path continues to function in browser/dev mode without modification.
- Cross-transport parity tests pass for all operations using shared golden fixtures.
- `cargo build` and `npx tsc -b --noEmit` both clean at Phase 9 exit.
- Playwright desktop smoke spec passing.

---

## Optional Phase 10 — Schema Registry and Advanced Payload UX

Estimated effort: 5-7 days (10A: 1.5-2.0 days, 10B: 2.0-2.5 days, 10C: 1.5-2.0 days)
Dependencies: Phase 6+ (Phase 9 not required; server-proxy path is sufficient)

### Activation gate

Phase 10 is optional and should only be activated when:
- there is a concrete user need for Avro/Protobuf schema-enforced workflows, AND
- Phase 6 is fully stable, AND
- the team accepts the additional contract extension scope in `src-server/kafka/contracts.ts`

Do not activate Phase 10 as a follow-on to Phase 9. It is an independent backlog item triggered by user demand.

### Scope

Add optional Confluent-compatible schema registry integration (Avro, Protobuf, JSON Schema) in produce and consume paths. All existing plain-JSON behavior must remain fully unaffected when schema config is absent.

### Deliverables

- `@kafkajs/confluent-schema-registry` dependency and server-side registry client.
- Optional `schemaConfig` extension to `KafkaProduceRequest` and `KafkaConsumeOnceRequest` in `src-server/kafka/contracts.ts`.
- New `KafkaSchemaConfig` type and `KafkaOperation` entries for registry operations (`schema-subjects`, `schema-versions`, `schema-fetch`).
- Server-side encode/decode helpers in the produce and consume paths.
- UI: optional schema subject/version controls in produce/consume panels — collapsed/hidden when schema registry is not configured.

### Re-evaluation delta (2026-05-31)

Phase 10 had no architecture review in prior drafts. This review grounds it in the actual contract layer.

Architecture reality as of this review:

- no schema registry library is installed — `@kafkajs/confluent-schema-registry` is fully net-new
- `KafkaProduceMessage.value` is currently typed as `string`; Avro/Protobuf encoding produces a `Buffer`, which cannot be transmitted as-is over the existing HTTP/JSON route — the contract design must serialize encoded bytes as base64 in the response or use a typed `encodedValue` field with explicit format marker
- `KafkaProduceRequest`, `KafkaConsumeRequest`, and `KafkaOperation` in `src-server/kafka/contracts.ts` are the correct and only extension points — schema config must be an additive optional field, never a required change
- the Phase 8 result publish envelope (`redfireforge.results.summary`) must remain schema-agnostic — no coupling to registry format is introduced by Phase 10
- Confluent Schema Registry requires network access to a registry endpoint; all registry operations must fail gracefully when the registry is unreachable without affecting plain-JSON produce/consume

Critical constraints from this review:

- plain JSON produce/consume must work identically when `schemaConfig` is absent — no behavioral change for existing features
- `@kafkajs/confluent-schema-registry` must be compatible with the installed `kafkajs: ^2.2.4`; verify compatibility before installing
- schema mismatch errors must surface as a distinct `KafkaErrorBody` code (e.g. `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, `REGISTRY_AUTH_FAILURE`) — not as a generic Kafka error
- test strategy must not require a live registry: encode/decode unit tests should use mocked or in-process schema registry (e.g. `@kafkajs/confluent-schema-registry`'s in-memory mock or a Testcontainers Confluent instance)
- `schemaConfig` belongs at the **request level** (`KafkaProduceRequest`, `KafkaConsumeOnceRequest`) and is applied uniformly to all messages in a batch — per-message schema config is not supported in the initial phase; this avoids inconsistent batch encoding
- wire format for encoded values is **base64 string in the existing `value` field** plus a `valueEncoding?: 'base64-avro' | 'base64-protobuf' | 'base64-json-schema' | 'plain'` field added to `KafkaProduceResult` in `contracts.ts` (signals how the stored Kafka message was encoded); `KafkaConsumeRecord` does **not** receive `valueEncoding` — the server always decodes before returning so the client always sees plain JSON in `value`; never introduce a separate `encodedValue` field to avoid a breaking contract change
- key encoding is **out of scope** for the initial phase; only `value` encoding is supported; note this explicitly in the deliverables so consumers do not expect Avro key encoding
- registry client must cache fetched schemas (by schema ID and subject/version) to avoid per-produce/consume HTTP calls to the registry
- **consume adapter boundary — binary bytes**: `kafka-adapter.ts` converts `message.value` with `.toString('utf-8')` before the service layer sees it; Avro binary bytes are not valid UTF-8 and are corrupted by this conversion; to enable schema decode, `KafkaConsumerRecord` (adapter-layer type in `kafka-adapter.ts`) must carry `rawValue?: Buffer` populated from the raw `message.value`; `kafka-service.ts` uses `record.rawValue` when `schemaConfig` is present; plain-JSON path continues to use `record.value` (the toString'd string) unchanged; `rawValue` is server-side only — it never appears in `KafkaConsumeRecord` (contract type in `contracts.ts`)
- **produce encode chain**: `registry.encode()` returns a `Buffer`; the service converts Buffer → base64 string and stores it in `message.value` before calling `adapter.send()` — `KafkaProducerMessage.value: string` in `kafka-adapter.ts` is never changed; the base64-in-`value` approach keeps the adapter boundary clean and the HTTP/JSON response serializable
- **subscribe-path schema decode is out of scope for Phase 10B**: the subscribe path (`KafkaSubscribeRequest`) also receives Avro-encoded messages but schema-aware decode for long-running subscriptions is not included in the initial phase; note this explicitly so consumers do not expect it; this is a follow-on scope item

Implementation anchors in the current codebase:

- `src-server/kafka/contracts.ts` — add `KafkaSchemaConfig`, extend `KafkaProduceRequest` with optional `schemaConfig` at request level, extend `KafkaConsumeOnceRequest` with optional `schemaConfig`, add registry operations to `KafkaOperation`
- `src-server/kafka/kafka-adapter.ts` — extend `KafkaConsumerRecord` interface with `rawValue?: Buffer`; the adapter sets this alongside `value: string` (the `.toString('utf-8')` version) so the service layer can access raw bytes for schema decode without corrupting plain-JSON paths; `rawValue` is server-side only — it is never serialized into `KafkaConsumeRecord` in `contracts.ts`
- `src-server/kafka/kafka-service.ts` — add optional encode/decode calls around produce and consume using the registry client
- `src-server/routes/kafka-routes.ts` — add route handlers for `schema-subjects`, `schema-versions`, `schema-fetch`
- `src/features/kafka/` — add optional schema config UI fields to produce/consume panels
- net-new server file: `src-server/kafka/schema-registry-client.ts` (registry client wrapper, schema cache, and encode/decode helpers)

### Sub-phases

#### Phase 10A - Registry connection contracts and configuration

Goal: define the schema registry config type, extend existing contracts minimally, establish the registry client wrapper, and wire the three registry query routes — without touching produce/consume runtime.

Implementation steps:

1. Install `@kafkajs/confluent-schema-registry` and verify compatibility with `kafkajs: ^2.2.4`. There is no `src-server/package.json`; install into the root `package.json` (all server deps live there).
2. Add `KafkaSchemaConfig` type to `src-server/kafka/contracts.ts` with fields: `registryUrl: string`, optional `auth: { username: string; password: string }`, optional `subject?: string`, optional `version?: number`, `format: 'avro' | 'protobuf' | 'json-schema'`. `subject` is **optional**: when absent, the server derives it from the produce/consume request's `topic` field using Confluent TopicNameStrategy (`{topic}-value` for value, `{topic}-key` for key — key encoding is out of scope and `{topic}-key` subjects are never requested in the initial phase). An explicit `subject` value always takes priority.
3. Add registry `KafkaOperation` entries **in `src-server/kafka/contracts.ts` only** (server-side type): `'schema-subjects'`, `'schema-versions'`, `'schema-fetch'`. Do **not** update `src/shared/kafka/kafkaClient.ts` yet — that file's `KafkaOperation` union and `OPERATION_MAP: Record<KafkaOperation, KafkaOperationSpec>` are updated together in Phase 10C when the UI gains schema controls; both must be updated in lockstep because `OPERATION_MAP` is `Record<KafkaOperation, ...>` and TypeScript will error if a union member has no map entry.
4. Create `src-server/kafka/schema-registry-client.ts` with registry connection, health check, subject listing (`listSubjects`), version fetching (`listVersions`), schema fetching (`fetchSchema`), and an in-process schema cache keyed by schema ID — no encode/decode yet.
5. Wire the three registry query routes in `src-server/routes/kafka-routes.ts` as **POST** routes: `POST /api/kafka/schema-subjects`, `POST /api/kafka/schema-versions`, `POST /api/kafka/schema-fetch`. Each route calls `requireBodyObject(req, '<op>')` first (same guard used by `produce`, `consume-once`, `subscribe`) then delegates to the registry client methods created in Step 4 and returns via `sendEnvelope(res, ...)`. Routes must be POST (not GET) because `KafkaSchemaConfig.auth` carries credentials (`username`/`password`) that must travel in the request body — query params would expose them in server logs, browser history, and referrer headers (OWASP A02). Without these routes the registry client created in Step 4 is unreachable and Phase 10A has no observable deliverable.
6. Preserve all plain-JSON behavior: zero changes to existing produce/consume code paths.

Detailed implementation checklist:

- `@kafkajs/confluent-schema-registry` installed into root `package.json` and `npx tsc -b --noEmit` clean
- `KafkaSchemaConfig` type defined in `contracts.ts` with `subject` as optional (server derives `{topic}-value` when absent)
- `KafkaOperation` in `contracts.ts` extended with `'schema-subjects'`, `'schema-versions'`, `'schema-fetch'` — `src/shared/kafka/kafkaClient.ts` (`KafkaOperation` union + `OPERATION_MAP`) is NOT updated in Phase 10A; deferred to Phase 10C with explicit note that both must be updated together
- `schema-registry-client.ts` created with connection, health check, `listSubjects`, `listVersions`, `fetchSchema`, and schema cache (keyed by schema ID)
- subject naming convention documented: `{topic}-value` (TopicNameStrategy) is the default when `subject` is absent; explicit `subject` override always takes priority; key encoding is out of scope
- `kafka-routes.ts` extended with `GET /api/kafka/schema-subjects`, `GET /api/kafka/schema-versions`, `GET /api/kafka/schema-fetch` — all three wired to registry client methods
- key encoding explicitly noted as out of scope in deliverables and contract documentation
- contract/unit tests for registry client with mocked registry
- zero changes to existing produce/consume routes or service behavior

#### Phase 10B - Runtime encode/decode integration

Goal: add schema-aware encoding in produce and decoding in consume, activated only when `schemaConfig` is present.

Implementation steps:

1. Extend `KafkaProduceRequest` with optional `schemaConfig?: KafkaSchemaConfig` at the **request level** (applied uniformly to all messages in the batch — not per-message).
2. In the produce path, when `schemaConfig` is present: resolve the effective subject as `schemaConfig.subject ?? `${request.topic}-value`` (TopicNameStrategy default), call `registry.encode(effectiveSubject, parsedValue, schemaConfig.version)` for each message, build a **new** `KafkaProducerMessage[]` array (never mutate `request.messages`) with each `value` set to `Buffer.toString('base64')`, then pass the new array to `adapter.send()`; catch registry errors (`SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, `REGISTRY_AUTH_FAILURE`) **before** the generic `catch` block so they return dedicated error codes and are never swallowed as `KAFKA_PRODUCE_FAILED`; pass `value` as-is when `schemaConfig` is absent.
3. Extend `KafkaConsumeOnceRequest` (the actual type — not `KafkaConsumeRequest`) with optional `schemaConfig?: KafkaSchemaConfig`.
4. In the consume path, when `schemaConfig` is present: resolve the effective subject as `schemaConfig.subject ?? `${request.topic}-value`` (TopicNameStrategy default), use `record.rawValue` (the raw `Buffer` set by the adapter — not `record.value` which is already `.toString('utf-8')` and corrupts Avro binary), decode via the registry client, push `{ ...record, value: JSON.stringify(decoded) }` (a new object — never mutate the adapter record) to the messages array; catch registry decode errors and return `SCHEMA_MISMATCH` or `REGISTRY_UNREACHABLE` **before** the generic `catch` block so they are not swallowed as `KAFKA_CONSUME_ONCE_FAILED`; subscribe-path schema decode is out of scope for the initial phase.
5. Add `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` as distinct error codes in `KafkaErrorBody`.

Detailed implementation checklist:

- `KafkaProduceRequest` extended with optional `schemaConfig` at request level — applied to all messages in the batch; no per-message schema override supported in initial phase
- produce encode chain: effective subject resolved as `schemaConfig.subject ?? `${request.topic}-value``; `registry.encode()` returns a `Buffer`; `kafka-service.ts` builds a **new** `KafkaProducerMessage[]` array mapping each `message.value` to `Buffer.toString('base64')` (never mutates `request.messages` — those are contract objects owned by the caller); the new array is passed to `adapter.send()`; `KafkaProducerMessage.value: string` in `kafka-adapter.ts` is never changed; wire format: base64 string in existing `value` field + `valueEncoding?: 'base64-avro' | 'base64-protobuf' | 'base64-json-schema' | 'plain'` added to `KafkaProduceResult` in `contracts.ts`; `KafkaConsumeRecord` does **not** need `valueEncoding` (server decodes transparently — client always receives plain JSON in `value`); no separate `encodedValue` field
- produce schema error handling: registry encode errors (`SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, `REGISTRY_AUTH_FAILURE`) are caught in a dedicated try/catch **before** `producer.connect()` and returned via `createKafkaErrorEnvelope('produce', { code: '...', ... })` — they must never fall through to the generic `KAFKA_PRODUCE_FAILED` catch block
- `KafkaConsumeOnceRequest` extended with optional `schemaConfig` (the actual type name — codebase uses `KafkaConsumeOnceRequest`, confirmed in `kafka-service-utils.ts` and `contracts.ts`)
- consume decode chain: effective subject resolved as `schemaConfig.subject ?? `${request.topic}-value``; `KafkaConsumerRecord` (adapter type in `kafka-adapter.ts`) extended with `rawValue?: Buffer`; adapter sets `rawValue` from raw `message.value` alongside existing `value: string` (the `.toString('utf-8')` result); `kafka-service.ts` uses `record.rawValue` (not `record.value`) to call registry decode when `schemaConfig` present; decoded result is JSON-stringified and a **new** record object `{ ...record, value: decodedJson }` is pushed (never mutates the adapter record); `rawValue` is never serialized to client
- consume schema error handling: registry decode errors (`SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, `REGISTRY_AUTH_FAILURE`) are caught inside the `consumer.run()` callback and cause `settleResult` to be called with the appropriate error envelope **before** the error propagates to the generic `KAFKA_CONSUME_ONCE_FAILED` catch block
- subscribe-path schema decode is **out of scope** for Phase 10B — only `consume-once` path supports schema-aware decode in the initial phase; note this explicitly in code and docs
- `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` error codes defined and returned on respective failure conditions
- key encoding confirmed out of scope: only message `value` is encoded/decoded in the initial phase
- phase 8 result publish path confirmed schema-agnostic (no `schemaConfig` injected)
- encode/decode unit tests use mocked registry — no live registry required for standard CI gate
- all existing produce/consume tests still pass unchanged

#### Phase 10C - UX and validation polish

Goal: surface schema subject/version controls in produce/consume UI without polluting the default experience.

Implementation steps:

1. Update `src/shared/kafka/kafkaClient.ts`: add `'schema-subjects'`, `'schema-versions'`, `'schema-fetch'` to the `KafkaOperation` union type AND add all three entries to `OPERATION_MAP` as **POST** operations with no `queryKeys` — `'schema-subjects': { method: 'POST', path: '/api/kafka/schema-subjects' }`, `'schema-versions': { method: 'POST', path: '/api/kafka/schema-versions' }`, `'schema-fetch': { method: 'POST', path: '/api/kafka/schema-fetch' }`. All three must be POST, not GET. Reason: `dispatchKafkaOperation` sets `body: spec.method === 'GET' ? undefined : request` — GET operations always have `body: undefined`. Additionally, `buildQuery` calls `toQueryValue()` which returns `null` for object values, so `auth: { username, password }` is silently dropped from GET query params with no error. Only POST operations carry the full `request` as body, which is required to transmit `auth` credentials. Both the `KafkaOperation` union and `OPERATION_MAP` must be updated in lockstep — `OPERATION_MAP` is `Record<KafkaOperation, KafkaOperationSpec>` and TypeScript will error if any union member has no map entry. Also define a frontend `KafkaSchemaConfig` interface in `kafkaClient.ts` (not imported from `src-server/` which is unreachable from the browser bundle): `{ registryUrl: string; auth?: { username: string; password: string }; subject?: string; version?: number; format: 'avro' | 'protobuf' | 'json-schema' }` — this mirrors `KafkaSchemaConfig` in `contracts.ts` and is the type used by all frontend components.
2. Extend `KafkaProduceNodeData` and `KafkaConsumeNodeData` in `src/features/workflow/types/workflow.ts` with optional `schemaConfig?: KafkaSchemaConfig` (imported from `kafkaClient.ts`). Extend `KafkaNodeOperations.produce()` and `.consume()` in `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` with optional `schemaConfig?: KafkaSchemaConfig`. Update `handleKafkaProduceNode` and the consume handler in `src/features/workflow/engine/graphRunnerKafkaNodeHandlers.ts` to pass `data.schemaConfig` through to `ops.produce()`/`ops.consume()`. Add collapsible schema config section to **`src/features/workflow/components/configs/KafkaProduceConfig.tsx`** and **`KafkaConsumeConfig.tsx`** — hidden by default, requires explicit opt-in toggle.
3. Add subject/version selectors to `KafkaProduceConfig.tsx` and `KafkaConsumeConfig.tsx`, populated lazily via `dispatchKafkaOperation('schema-subjects', ...)` and `dispatchKafkaOperation('schema-versions', ...)`.
4. Add schema fetch preview via `dispatchKafkaOperation('schema-fetch', ...)` for the selected subject/version.
5. Add clear validation messages for `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` error codes in the produce/consume result display.
6. Confirm all schema-registry UI controls are absent and non-rendering when registry is not configured.

Detailed implementation checklist:

- `KafkaOperation` in `kafkaClient.ts` extended with `'schema-subjects'`, `'schema-versions'`, `'schema-fetch'`; `OPERATION_MAP` updated with all three entries as POST operations (no `queryKeys`) in the same commit (lockstep rule); rationale: `dispatchKafkaOperation` sets `body: undefined` for GET ops and `toQueryValue()` silently drops object values (`auth`), so auth credentials can only reach the server via POST body
- frontend `KafkaSchemaConfig` interface defined in `src/shared/kafka/kafkaClient.ts` — identical shape to server-side `KafkaSchemaConfig` in `contracts.ts` but independent (frontend cannot import from `src-server/`)
- `KafkaProduceNodeData` and `KafkaConsumeNodeData` in `workflow.ts` extended with optional `schemaConfig?: KafkaSchemaConfig`
- `KafkaNodeOperations.produce()` and `.consume()` in `graphRunnerNodeHandlerContext.ts` extended with optional `schemaConfig?`; node handlers in `graphRunnerKafkaNodeHandlers.ts` pass `data.schemaConfig` through
- schema config section in `KafkaProduceConfig.tsx` and `KafkaConsumeConfig.tsx` is collapsed/hidden when no registry URL is configured
- subject and version selectors load lazily from `schema-subjects` and `schema-versions` APIs via `dispatchKafkaOperation`
- schema preview shows decoded schema fields for the selected subject/version via `schema-fetch`
- error states for `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` display as actionable inline messages
- Playwright spec covers: opt-in toggle → subject load → produce → consume → schema mismatch display
- all existing produce/consume UI tests pass unchanged

Gate to phase exit:

- schema-aware produce and consume work with explicit opt-in; all plain-JSON paths are unaffected

### Validation matrix (required before Phase 10 exit)

Dependency and contract validation:

- `@kafkajs/confluent-schema-registry` installed and compatible with `kafkajs: ^2.2.4`
- `KafkaProduceRequest` and `KafkaConsumeOnceRequest` extensions are additive and do not break existing callers
- `KafkaOperation` registry entries do not conflict with existing operations

Runtime validation:

- schema-aware produce encodes correctly for Avro format against a mocked registry
- schema-aware consume decodes correctly and surfaces `SCHEMA_MISMATCH` on type mismatch
- `REGISTRY_UNREACHABLE` is returned cleanly when registry is down; plain-JSON produce/consume proceeds normally

Backward-compatibility validation:

- all Phase 6 runner actions produce and consume plain JSON correctly with no schema config
- Phase 8 result publish envelope is not affected by schema registry configuration
- all existing Kafka tests pass unchanged after Phase 10 contract extensions

### Registry environment prerequisites

Phase 10B/10C validation requires a schema registry endpoint:

- local schema registry: Confluent Platform Docker Compose (add `cp-schema-registry` service to **`docker/kafka/plaintext/docker-compose.yml`** — the compose file lives in the `plaintext/` subdirectory, not at `docker/kafka/` root) or Redpanda with schema registry plugin enabled — update `docker/kafka/` setup docs
- mocked registry: use `@kafkajs/confluent-schema-registry`'s in-memory mock for unit/contract tests — no Docker required for standard CI gate
- standard CI gate: mocked registry only; live registry used only for Phase 10C UX integration tests

### Execution slicing matrix (recommended)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Exit Gate |
| --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p10a-registry-contracts` | Contracts + Server | 1.5-2.0 days | Phase 6 stable, activation gate met | registry client + contract extensions + `npx tsc -b --noEmit` clean |
| 2 | `kafka-p10b-registry-runtime` | Server + Runner | 2.0-2.5 days | PR1 | encode/decode integrated, plain-JSON parity verified, error codes defined |
| 3 | `kafka-p10c-registry-ux` | Frontend + QA | 1.5-2.0 days | PR2 | UX opt-in controls working, schema mismatch displayed, Playwright spec passing |

### PR kickoff checklist (Phase 10)

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p10a-registry-contracts` | `feature/kafka-p10a-registry-contracts` | contract/schema tests + `npx tsc -b --noEmit` | registry client and type extensions validated with no breakage to existing contracts |
| `kafka-p10b-registry-runtime` | `feature/kafka-p10b-registry-runtime` | `npx vitest run src-server/kafka/schema-registry-client.test.ts src-server/kafka/kafka-service.test.ts` + `npx tsc -b --noEmit` | encode/decode works with mocked registry; plain-JSON produce/consume unchanged |
| `kafka-p10c-registry-ux` | `feature/kafka-p10c-registry-ux` | `npx vitest run src/features/workflow/components/configs/KafkaProduceConfig.test.tsx src/features/workflow/components/configs/KafkaConsumeConfig.test.tsx` + `npx playwright test e2e/kafka-schema.spec.ts --reporter=list` | UX opt-in, schema mismatch display, and Playwright spec all passing |

Phase 10 PR readiness sequence:

1. Confirm activation gate criteria are met before creating any branch.
2. Base all branches from latest `develop` after Phase 6 exit criteria are confirmed.
3. Confirm `npx tsc -b --noEmit` clean and all existing Kafka tests pass before each PR review.
4. Never introduce a required dependency on schema registry for plain-JSON Kafka features.
5. Attach mocked-registry test evidence and plain-JSON regression evidence in each PR description.

### Suggested test commands

- `npx vitest run src-server/kafka/schema-registry-client.test.ts`
- `npx vitest run src-server/kafka/kafka-service.test.ts`
- `npx vitest run src-server/routes/kafka-routes.test.ts`
- `npx vitest run src/features/workflow/components/configs/KafkaProduceConfig.test.tsx src/features/workflow/components/configs/KafkaConsumeConfig.test.tsx`
- `npx tsc -b --noEmit`
- `npx playwright test e2e/kafka-schema.spec.ts --reporter=list`

### Risks and mitigations

- Risk: `@kafkajs/confluent-schema-registry` is incompatible with installed `kafkajs: ^2.2.4`.
- Mitigation: verify package compatibility in Phase 10A before any runtime work; if incompatible, evaluate `@kafkajs/confluent-schema-registry` v2+ or alternative registry client.
- Risk: Avro-encoded bytes (Buffer) from `registry.encode()` are incompatible with `KafkaProducerMessage.value: string` in `kafka-adapter.ts`.
- Mitigation: convert Buffer → base64 string in `kafka-service.ts` before calling `adapter.send()` — `KafkaProducerMessage.value: string` stays unchanged; the base64 string is transmitted in the existing `value` field; `valueEncoding?: 'base64-avro' | 'base64-protobuf' | 'base64-json-schema' | 'plain'` is added to `KafkaProduceResult` in `contracts.ts` to signal the encoding used. Never change the adapter type.
- Risk: Avro binary bytes in the consume path are corrupted by `kafka-adapter.ts` `.toString('utf-8')` before the service can decode them.
- Mitigation: extend `KafkaConsumerRecord` (adapter type) with `rawValue?: Buffer`; the adapter populates both `value` (toString'd) and `rawValue` (raw Buffer); `kafka-service.ts` uses `rawValue` for registry decode when `schemaConfig` is present; `rawValue` is server-side only and never serialized to the client.
- Risk: consumers assume subscribe-path messages are also schema-decoded after Phase 10B.
- Mitigation: document explicitly that subscribe-path schema decode is out of scope for Phase 10B initial implementation; only `consume-once` supports schema-aware decode; forward note this as a follow-on scope item.
- Risk: schema registry unavailability blocks produce/consume in default usage.
- Mitigation: `schemaConfig` is strictly optional; registry calls only made when explicitly configured; registry errors surface as distinct error codes without affecting plain-JSON path.
- Risk: schema mismatch errors are opaque and hard to debug.
- Mitigation: surface `SCHEMA_MISMATCH` with subject/version/format metadata in the `KafkaErrorBody.details` field.

### Exit criteria

- Schema-aware produce and consume work with explicit opt-in for at least Avro format.
- All plain-JSON Kafka features (Phase 6 runner, Phase 8 publish) are unaffected.
- `@kafkajs/confluent-schema-registry` installed and compatible; `npx tsc -b --noEmit` clean.
- Encode/decode tests pass using mocked registry.
- Playwright schema UX spec passing.

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

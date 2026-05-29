# Kafka Integration Tracker

> Companion execution tracker for kafka-integration-plan.md
> Source plan: docs/plan/future/kafka-integration-plan.md
> Status legend: [ ] not started, [~] in progress, [x] done

---

## Program Summary

- Target phases: 1-9 (phase 10 optional)
- Recommended total PRs: 13-18
- Suggested sequencing: A (P1-P3), B (P4-P5), C (P6-P8), D (P9)

### Active Now (Pre-filled Recommendation)

- Current active phase: Phase 1 - Kafka Core Transport Foundation
- Current active PR: PR1 (types + service skeleton + connect/disconnect)
- Immediate objective: ship a test-covered server foundation before any UI work
- Next gate to clear: kafka-service unit tests for connect/disconnect lifecycle

### Week 1 Day-by-Day Execution Plan (Pre-filled)

#### Day 1 - Contracts and scaffolding

- [ ] Add Kafka dependency and server build external entry
- [ ] Create src-server Kafka contracts module with request/response types
- [ ] Create kafka-service skeleton with explicit state model
- [ ] Add initial unit test file scaffold with mocks

#### Day 2 - Lifecycle and admin

- [ ] Implement connect/disconnect idempotency logic
- [ ] Implement status helpers and topic listing
- [ ] Add lifecycle tests (connect, reconnect, disconnect cleanup)
- [ ] Validate no leaked handles in teardown

#### Day 3 - Produce and consume-once

- [ ] Implement produce path with timing and envelope mapping
- [ ] Implement consumeOnce with timeout and maxMessages guards
- [ ] Add filtering support (key/header/jsonpath)
- [ ] Add unit tests for produce/consume success and failure paths

#### Day 4 - Subscribe/unsubscribe and routes

- [ ] Implement subscription registry and unsubscribe cleanup paths
- [ ] Add /api/kafka/* routes for connect/status/produce/consume/subscribe
- [ ] Add route-level integration tests with mocked service
- [ ] Verify route error contract consistency

#### Day 5 - Hardening and PR1/PR2 cut

- [ ] Run tsc, targeted tests, and lint for touched scope
- [ ] Resolve reliability gaps found in test runs
- [ ] Open PR1 (foundation) or PR2 (routes) based on completed scope
- [ ] Update this tracker with completed checkboxes and rollout notes

### Week 2 Day-by-Day Execution Plan (Pre-filled)

#### Day 6 - Phase 1 closeout hardening

- [ ] Run full Phase 1 validation checklist (tsc, targeted tests, lint)
- [ ] Fix edge cases from test failures (timeout race, subscription teardown)
- [ ] Confirm endpoint error envelopes are consistent across all /api/kafka routes
- [ ] Mark completed Phase 1 checkboxes and draft closeout notes

#### Day 7 - PR close and Phase 2 kickoff

- [ ] Open/merge final Phase 1 PR slice (if pending)
- [ ] Start Phase 2 transport dispatcher skeleton
- [ ] Add operation map and transport override hook
- [ ] Add initial kafkaClient unit tests for routing behavior

#### Day 8 - App state and persistence wiring

- [ ] Add app-level Kafka state (status, cluster list, last error)
- [ ] Implement load/save helpers for Kafka cluster config storage
- [ ] Wire startup load path and safe fallback defaults
- [ ] Add state transition tests (init, reconnect, error recovery)

#### Day 9 - Status refresh and resilience

- [ ] Add bounded polling plus event-driven status refresh flow
- [ ] Add backoff behavior for repeated status failures
- [ ] Ensure transport errors are surfaced as typed UI-safe states
- [ ] Expand tests for reconnect/disconnect race handling

#### Day 10 - Phase 2 stabilization and handoff

- [ ] Run Phase 2 validation checklist (tsc, tests, lint)
- [ ] Resolve any regressions in non-Kafka app paths
- [ ] Update tracker checkboxes and Week 2 summary
- [ ] Prepare Phase 3 kickoff branch/task list (settings UX)

### Week 3 Day-by-Day Execution Plan (Pre-filled)

#### Day 11 - Phase 3 shell and navigation wiring

- [ ] Add Kafka settings tab registration in app navigation
- [ ] Create KafkaSettings page shell and route rendering
- [ ] Add initial empty/loading/error states for settings page
- [ ] Add basic component tests for tab visibility and page mount

#### Day 12 - Cluster list and editor foundations

- [ ] Implement cluster list cards (name, brokers, status, actions)
- [ ] Implement add/edit cluster form shell
- [ ] Add broker list add/remove inputs with validation
- [ ] Add form validation tests (required fields, malformed broker URLs)

#### Day 13 - Auth/SSL and persistence integration

- [ ] Add auth mode fields (none/plain/scram variants)
- [ ] Add SSL section (enable, cert fields, validation)
- [ ] Wire form save/update/delete to storage layer
- [ ] Add persistence round-trip tests for create/edit/delete flows

#### Day 14 - Connection test and topic browser

- [ ] Add Test Connection action with loading/success/failure state
- [ ] Wire cluster test to kafkaClient connect/status/topics operations
- [ ] Implement topic browser list with filter/search
- [ ] Add topic browser tests (connected, empty, error)

#### Day 15 - Status polish and Phase 3 closeout

- [ ] Add AppHeader Kafka connection indicator with click-through to settings
- [ ] Add accessibility polish (aria labels, status announcements, keyboard nav)
- [ ] Run Phase 3 validation checklist (tsc, tests, lint)
- [ ] Update tracker with Phase 3 completion notes and Phase 4 kickoff tasks

### Week 4 Day-by-Day Execution Plan (Pre-filled)

#### Day 16 - Phase 4 model and defaults

- [ ] Add workflow node type enums/unions for kafkaProduce and kafkaConsume
- [ ] Add node data interfaces (config, filter, extraction, timeout, load behavior)
- [ ] Add default node data factory entries with safe defaults
- [ ] Add type/factory tests for default shape and backward compatibility

#### Day 17 - Node UI scaffolding

- [ ] Add Kafka Produce node visual component shell
- [ ] Add Kafka Consume node visual component shell
- [ ] Add form controls for cluster/topic/key/body/filter/extraction fields
- [ ] Add config panel tests for rendering and field updates

#### Day 18 - Executor integration (produce path)

- [ ] Add executor branch for Kafka Produce operation
- [ ] Add variable interpolation for topic/key/body/headers
- [ ] Map produce response metadata for extraction variables
- [ ] Add executor tests for produce success/failure/timeouts

#### Day 19 - Executor integration (consume path)

- [ ] Add executor branch for Kafka Consume operation
- [ ] Add consume filter handling (key/header/jsonpath) and timeout behavior
- [ ] Add variable extraction from consumed messages
- [ ] Add executor tests for consume success/no-match/timeout paths

#### Day 20 - Logging, integration tests, and closeout

- [ ] Add structured workflow execution logs for Kafka node operations
- [ ] Add mixed workflow integration tests (Kafka + HTTP node chains)
- [ ] Run Phase 4 validation checklist (tsc, tests, lint)
- [ ] Update tracker with Phase 4 completion notes and Phase 5 kickoff tasks

---

## Global Gates (must pass every phase)

- [ ] npx tsc -b --noEmit
- [ ] Targeted unit/integration tests for touched files
- [ ] ESLint clean for touched scope
- [ ] No regression in existing HTTP/workflow paths
- [ ] Docs/plan updates for any design drift

---

## Phase 1 - Kafka Core Transport Foundation

Window: Week 1
PR target: 2-3
Dependency: none

### Work Items

- [ ] Add Kafka runtime dependency and build externals update
- [ ] Create server Kafka contracts module (connection, produce, consume, subscribe)
- [ ] Implement kafka-service lifecycle (connect/disconnect/idempotency)
- [ ] Implement produce and consumeOnce with timeout safeguards
- [ ] Implement subscription registry and unsubscribe cleanup
- [ ] Add /api/kafka/* routes with consistent response envelope
- [ ] Add server log hooks for Kafka operations

### Validation

- [ ] kafka-service unit tests (mocked kafkajs)
- [ ] kafka-routes integration tests
- [ ] lifecycle leak test: no subscriptions after disconnect

### PR Slice Suggestion

1. PR1: types + service skeleton + connect/disconnect
2. PR2: produce/consume/subscribe routes + tests
3. PR3 (optional): cleanup and hardening

### Exit Criteria

- [ ] All Kafka server endpoints stable and test-covered
- [ ] No leaked consumers in test teardown

---

## Phase 2 - Client Transport + App-level Kafka State

Window: Week 1-2
PR target: 1-2
Dependency: Phase 1

### Work Items

- [ ] Implement kafka client dispatcher (operation-based)
- [ ] Add transport override hook for testability
- [ ] Add app-level Kafka status state
- [ ] Add Kafka config persistence load/save helpers
- [ ] Add status refresh strategy (event driven + bounded polling)

### Validation

- [ ] kafkaClient routing tests
- [ ] storage tests (save/load/migration)
- [ ] app state tests for reconnect and failure transitions

### PR Slice Suggestion

1. PR1: kafkaClient transport + tests
2. PR2 (optional): app state wiring + persistence

### Exit Criteria

- [ ] Stable state transitions for connected/disconnected/error

---

## Phase 3 - Kafka Settings UX

Window: Week 2
PR target: 2-3
Dependency: Phase 2

### Work Items

- [ ] Add Kafka settings tab registration
- [ ] Build cluster list card UI
- [ ] Build add/edit form (brokers, auth, ssl)
- [ ] Add test connection flow and status badges
- [ ] Add topic browser with filter/search
- [ ] Add header Kafka connection indicator

### Validation

- [ ] settings page component tests
- [ ] editor validation tests
- [ ] topic browser tests (loading/error/empty)

### PR Slice Suggestion

1. PR1: settings shell + tab wiring
2. PR2: editor + connect flow
3. PR3: topic browser + header indicator

### Exit Criteria

- [ ] User can configure, test, and persist clusters end to end

---

## Phase 4 - Workflow Kafka Nodes

Window: Week 3
PR target: 2-3
Dependency: Phase 3

### Work Items

- [ ] Add workflow node types: kafkaProduce, kafkaConsume
- [ ] Add node data contracts + defaults + migration safety
- [ ] Implement node visual components and config forms
- [ ] Add executor branches for produce/consume
- [ ] Add variable extraction from produce/consume results
- [ ] Add execution log entries for Kafka node activity

### Validation

- [ ] workflow type/factory tests
- [ ] executor tests (success/failure/timeout/filter)
- [ ] mixed workflow integration tests (Kafka + HTTP)

### PR Slice Suggestion

1. PR1: types/defaults/components
2. PR2: executor implementation + tests
3. PR3 (optional): extraction and log polish

### Exit Criteria

- [ ] Kafka nodes execute deterministically without affecting non-Kafka flows

---

## Phase 5 - Kafka Trigger + KafkaWait

Window: Week 4
PR target: 2-3
Dependency: Phase 4

### Work Items

- [ ] Implement Kafka-triggered workflow start path
- [ ] Implement KafkaWait wait/resume semantics
- [ ] Implement matching filters (key/header/jsonpath)
- [ ] Add timeout/cancel behavior and status transitions
- [ ] Add idempotency guard to prevent duplicate resume

### Validation

- [ ] trigger integration tests
- [ ] wait/resume race and timeout tests
- [ ] restart/disconnect resilience tests

### PR Slice Suggestion

1. PR1: trigger path
2. PR2: KafkaWait runtime
3. PR3: hardening/idempotency

### Exit Criteria

- [ ] Reliable trigger and wait behavior under timing edge cases

---

## Phase 6 - Runner Kafka Scenarios

Window: Week 5
PR target: 2-3
Dependency: Phase 4

### Work Items

- [ ] Extend scenario model for Kafka test actions
- [ ] Add standard runner Kafka execution paths
- [ ] Add parameterized runner Kafka support
- [ ] Extend result model and rendering for Kafka action outcomes
- [ ] Add assertion support for Kafka payload/metadata checks

### Validation

- [ ] runner execution tests for Kafka scenarios
- [ ] parameterized tests with Kafka templating
- [ ] results UI tests for Kafka action rendering

### PR Slice Suggestion

1. PR1: scenario schema and runner engine changes
2. PR2: result model + dashboard rendering
3. PR3: assertion support

### Exit Criteria

- [ ] Kafka actions run and report cleanly in both runner modes

---

## Phase 7 - Load-mode Policy for Kafka Consume

Window: Week 5-6
PR target: 1-2
Dependency: Phase 6

### Work Items

- [ ] Implement load behavior modes (consume-real, synthetic-message, skip)
- [ ] Set default-safe mode policy for load tests
- [ ] Add configuration warnings for nondeterministic setups
- [ ] Document operational recommendations in UI/help text

### Validation

- [ ] planner tests for each load mode
- [ ] deterministic load simulation tests
- [ ] no regression in existing load profile behavior

### PR Slice Suggestion

1. PR1: planner + behavior mode implementation
2. PR2 (optional): warning UX + docs

### Exit Criteria

- [ ] Load runs remain reproducible with Kafka consume in scope

---

## Phase 8 - Results Publishing to Kafka

Window: Week 6
PR target: 1-2
Dependency: Phase 6

### Work Items

- [ ] Define publish payload schema and versioning
- [ ] Add settings toggle and topic selection for result publishing
- [ ] Add publish-on-completion hook
- [ ] Add retry and failure policy (non-blocking default)
- [ ] Add run traceability fields (runId/project/env/suite)

### Validation

- [ ] payload schema tests
- [ ] retry/failure behavior tests
- [ ] completion path regression tests

### PR Slice Suggestion

1. PR1: payload schema + publish hook
2. PR2 (optional): settings integration + strict mode groundwork

### Exit Criteria

- [ ] Results publish works when enabled without destabilizing run completion

---

## Phase 9 - Tauri-native Kafka Transport (rdkafka)

Window: Week 7-8
PR target: 2-3
Dependency: Phases 1-8

### Work Items

- [ ] Add rdkafka dependency and rust command surface
- [ ] Implement native lifecycle/produce/consume/subscribe commands
- [ ] Add frontend transport switch for Tauri path
- [ ] Add fallback parity path to server-proxy for safety
- [ ] Add contract parity tests (kafkajs vs rdkafka response shape)

### Validation

- [ ] rust command tests
- [ ] transport switch tests
- [ ] parity contract fixture tests

### PR Slice Suggestion

1. PR1: rust command and lifecycle baseline
2. PR2: frontend transport switch + fallback
3. PR3: parity and stabilization

### Exit Criteria

- [ ] Desktop uses native Kafka transport with verified contract parity

---

## Optional Phase 10 - Schema Registry

Window: backlog
PR target: 1-2
Dependency: Phase 6+

### Work Items

- [ ] Add schema registry connection config
- [ ] Add encode/decode helpers for produce/consume
- [ ] Add subject/version UX controls
- [ ] Add advanced validation for schema mismatch

### Exit Criteria

- [ ] Schema-aware workflows and runner actions work with explicit opt-in

---

## Milestone Checklist

### Milestone A (Foundation)

- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete

### Milestone B (Workflow)

- [ ] Phase 4 complete
- [ ] Phase 5 complete

### Milestone C (Runner + Reporting)

- [ ] Phase 6 complete
- [ ] Phase 7 complete
- [ ] Phase 8 complete

### Milestone D (Native Desktop)

- [ ] Phase 9 complete

---

## Ownership and Tracking

- Engineering owner:
- QA owner:
- Product owner:
- Last updated: 2026-05-29
- Current active phase: Phase 1 - Kafka Core Transport Foundation
- Current active PR: PR1 (types + service skeleton + connect/disconnect)

### Weekly Status Notes

- Week 1: Kickoff pre-filled. Focus on server foundation only; no UI work until Phase 1 exit criteria pass.
- Week 2: Pre-filled. Close Phase 1 cleanly first, then begin Phase 2 transport/state wiring with test-first checkpoints.
- Week 3: Pre-filled. Deliver Kafka Settings UX end to end (cluster config, connection test, topic browser, status indicator).
- Week 4: Pre-filled. Deliver Kafka workflow node model + executor integration with deterministic tests before trigger/wait work.
- Week 5:
- Week 6:
- Week 7:
- Week 8:

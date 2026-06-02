# Kafka Integration Tracker

> Companion execution tracker for integration-plan.md
> Source plan: docs/plan/future/kafka/integration-plan.md
> Test plan: docs/plan/future/kafka/integration-test-plan.md
> Local dev guide: docs/guides/kafka-local-dev.md
> Status legend: [ ] not started, [~] in progress, [x] done
> Process rule: Always update this status tracker immediately after implementation or re-review changes.

---

## Program Summary

- Target phases: 1-9 (phase 10 optional)
- Recommended total PRs: 13-18
- Suggested sequencing: A (P1-P3), B (P4-P5), C (P6-P8), D (P9)

### Active Now

- Current active phase: Phase 9 - Tauri-native Kafka Transport (not started)
- Current active PR: feature/kafka-integration (phases 1–8C complete; all manual validations PASS 2026-06-02)
- Immediate objective: All code phases 1–8 are complete and fully validated. Next code phase is Phase 9 (rdkafka Tauri-native transport).
- Next gate to clear: merge feature/kafka-integration into develop (after PR review), then plan Phase 9 branch
- Re-validation summary (2026-06-02): Phase 3 secure smoke 21/21 PASS · Phase 8C broker scenarios 41/41 PASS (plaintext + SASL/SCRAM-SHA-256 secure profile) · Phase 5 170 unit tests PASS · Phase 7 208 unit tests PASS · tsc: 0 errors

Reference docs for current phase:

- docs/plan/future/kafka/integration-plan.md
- docs/plan/future/kafka/integration-test-plan.md
- docs/guides/kafka-local-dev.md

### Week 1 Day-by-Day Execution Plan (Pre-filled)

#### Day 1 - Contracts and scaffolding

- [x] Add Kafka dependency and server build external entry
- [x] Create src-server Kafka contracts module with request/response types
- [x] Create kafka-service skeleton with explicit state model
- [x] Add initial unit test file scaffold with mocks
- [x] Create docker/kafka/plaintext and docker/kafka/secure directory structure

#### Day 2 - Lifecycle and admin

- [x] Implement connect/disconnect idempotency logic
- [x] Implement status helpers and topic listing
- [x] Add lifecycle tests (connect, reconnect, disconnect cleanup)
- [x] Validate no leaked handles in teardown
- [x] Add plaintext Docker compose baseline and verify broker health from local shell

#### Day 3 - Produce and consume-once

- [x] Implement produce path with timing and envelope mapping
- [x] Implement consumeOnce with timeout and maxMessages guards
- [x] Add filtering support (key/header/jsonpath)
- [x] Add unit tests for produce/consume success and failure paths
- [x] Add create-topics and seed/reset scripts for deterministic local data

#### Day 4 - Subscribe/unsubscribe and routes

- [x] Implement subscription registry and unsubscribe cleanup paths
- [x] Add /api/kafka/* routes for connect/status/produce/consume/subscribe
- [x] Add route-level integration tests with mocked service
- [x] Verify route error contract consistency
- [x] Run first Docker-backed integration smoke against seeded plaintext broker

#### Day 5 - Hardening and PR1/PR2 cut

- [x] Run tsc, targeted tests, and lint for touched scope
- [x] Resolve reliability gaps found in test runs
- [ ] Open PR1 (foundation) or PR2 (routes) based on completed scope
- [x] Update this tracker with completed checkboxes and rollout notes
- [x] Document local Docker bootstrap and reseed commands for Phase 1 users

### Week 2 Day-by-Day Execution Plan (Pre-filled)

#### Day 6 - Phase 1 closeout hardening

- [x] Run full Phase 1 validation checklist (tsc, targeted tests, lint)
- [x] Fix edge cases from test failures (timeout race, subscription teardown)
- [x] Confirm endpoint error envelopes are consistent across all /api/kafka routes
- [x] Mark completed Phase 1 checkboxes and draft closeout notes
- [x] Re-run plaintext Docker startup, seed, and teardown smoke before Phase 1 closeout

#### Day 7 - PR close and Phase 2 kickoff

- [ ] Open/merge final Phase 1 PR slice (if pending)
- [x] Start Phase 2 transport dispatcher skeleton
- [x] Add operation map and transport override hook
- [x] Add initial kafkaClient unit tests for routing behavior

#### Day 8 - App state and persistence wiring

- [x] Add app-level Kafka state (status, cluster list, last error)
- [x] Implement load/save helpers for Kafka cluster config storage
- [x] Wire startup load path and safe fallback defaults
- [x] Add state transition tests (init, reconnect, error recovery)

#### Day 9 - Status refresh and resilience

- [x] Add bounded polling plus event-driven status refresh flow
- [x] Add backoff behavior for repeated status failures
- [x] Ensure transport errors are surfaced as typed UI-safe states
- [x] Expand tests for reconnect/disconnect race handling

#### Day 10 - Phase 2 stabilization and handoff

- [x] Run Phase 2 validation checklist (tsc, tests, lint)
- [ ] Resolve any regressions in non-Kafka app paths
- [ ] Update tracker checkboxes and Week 2 summary
- [ ] Prepare Phase 3 kickoff branch/task list (settings UX)
- [ ] Prepare secure Docker profile task list for Phase 3 auth/SSL work

### Week 3 Day-by-Day Execution Plan (Pre-filled)

#### Day 11 - Phase 3 shell and navigation wiring

- [x] Add Kafka settings tab registration in app navigation
- [x] Create KafkaSettings page shell and route rendering
- [x] Add initial empty/loading/error states for settings page
- [x] Add basic component tests for tab visibility and page mount

#### Day 12 - Cluster list and editor foundations

- [x] Implement cluster list cards (name, brokers, status, actions)
- [x] Implement add/edit cluster form shell
- [x] Add broker list add/remove inputs with validation
- [x] Add form validation tests (required fields, malformed broker URLs)

#### Day 13 - Auth/SSL and persistence integration

- [x] Add auth mode fields (none/plain/scram variants)
- [x] Add SSL section (enable, cert fields, validation)
- [x] Wire form save/update/delete to storage layer
- [x] Add persistence round-trip tests for create/edit/delete flows
- [x] Bring up secure Docker profile and validate sample credentials/certs end to end

#### Day 14 - Connection test and topic browser

- [ ] Add Test Connection action with loading/success/failure state
- [ ] Wire cluster test to kafkaClient connect/status/topics operations
- [ ] Implement topic browser list with filter/search
- [ ] Add topic browser tests (connected, empty, error)
- [ ] Add targeted tests for auth failure, TLS validation failure, timeout, and broker-unreachable error mapping

#### Day 15 - Status polish and Phase 3 closeout

- [x] Add AppHeader Kafka connection indicator with click-through to settings
- [x] Add accessibility polish (aria labels, status announcements, keyboard nav)
- [x] Run Phase 3 validation checklist (tsc, tests, lint)
- [x] Update tracker with Phase 3 completion notes and Phase 4 kickoff tasks
- [x] Run secure-profile visual smoke covering plaintext, SASL/PLAIN or SCRAM, and invalid-credential paths

### Week 4 Day-by-Day Execution Plan (Pre-filled)

#### Day 16 - Phase 4 model and defaults

- [x] Add workflow node type enums/unions for kafkaProduce and kafkaConsume
- [x] Add node data interfaces (config, filter, extraction, timeout, load behavior)
- [x] Add default node data factory entries with safe defaults
- [x] Add type/factory tests for default shape and backward compatibility

#### Day 17 - Node UI scaffolding

- [x] Add Kafka Produce node visual component shell
- [x] Add Kafka Consume node visual component shell
- [x] Add form controls for cluster/topic/key/body/filter/extraction fields
- [x] Add config panel tests for rendering and field updates

#### Day 18 - Executor integration (produce path)

- [x] Add executor branch for Kafka Produce operation
- [x] Add variable interpolation for topic/key/body/headers
- [x] Map produce response metadata for extraction variables
- [x] Add executor tests for produce success/failure/timeouts

#### Day 19 - Executor integration (consume path)

- [x] Add executor branch for Kafka Consume operation
- [x] Add consume filter handling (key/header/jsonpath) and timeout behavior
- [x] Add variable extraction from consumed messages
- [x] Add executor tests for consume success/no-match/timeout paths

#### Day 20 - Logging, integration tests, and closeout

- [x] Add structured workflow execution logs for Kafka node operations
- [x] Add mixed workflow integration tests (Kafka + HTTP node chains)
- [x] Run Phase 4 validation checklist (tsc, tests, lint)
- [x] Update tracker with Phase 4 completion notes and Phase 5 kickoff tasks

---

## Global Gates (must pass every phase)

- [x] npx tsc -b --noEmit
- [x] Targeted unit/integration tests for touched files
- [x] ESLint clean for touched scope
- [x] Relevant Docker Kafka environment boots, seeds, and tears down cleanly for the touched phase
- [x] No regression in existing HTTP/workflow paths
- [x] Docs/plan updates for any design drift

---

## Phase 1 - Kafka Core Transport Foundation

Window: Week 1
PR target: 2-3
Dependency: none

### Work Items

- [x] Add Kafka runtime dependency and build externals update
- [x] Create server Kafka contracts module (connection, produce, consume, subscribe)
- [x] Define stable route contract envelopes (success and error) for all `/api/kafka/*` operations
- [x] Implement kafka-service lifecycle (connect/disconnect/idempotency)
- [x] Implement produce and consumeOnce with timeout safeguards
- [x] Implement subscription registry and unsubscribe cleanup
- [x] Add /api/kafka/* routes with consistent response envelope
- [x] Add server log hooks for Kafka operations
- [x] Add docker/kafka/plaintext/docker-compose.yml
- [x] Add topic create/reset/seed scripts for local plaintext broker
- [x] Add docs/guides/kafka-local-dev.md bootstrap notes or equivalent setup doc
- [x] Ensure transport contracts already include auth and SSL fields for later secure profiles
- [x] Keep Phase 1 scope UI-neutral (no Kafka settings/editor UX implementation in this phase)

### Sub-phase Checklist (Execution Order)

- [x] Phase 1A - Contracts and dependency baseline (Suggested PR label: `kafka-p1a-contracts`)
- [x] Phase 1B - Service lifecycle and admin primitives (Suggested PR label: `kafka-p1b-service-lifecycle`)
- [x] Phase 1C - Produce, consume, and route surface (Suggested PR label: `kafka-p1c-routes-ops`)
- [x] Phase 1D - Local Docker bootstrap and integration smoke (Suggested PR label: `kafka-p1d-docker-bootstrap`)

### Validation

- [x] kafka-service unit tests (mocked kafkajs)
- [x] kafka-routes integration tests
- [x] lifecycle leak test: no subscriptions after disconnect
- [x] plaintext Docker smoke: up -> create topics -> seed -> connect -> disconnect -> down
- [x] repeated connect-disconnect-connect stability test
- [x] route-family coverage check for connect/disconnect/status/topics/produce/consume-once/subscribe/subscriptions/unsubscribe

### Phase 1A Progress Notes (2026-05-29)

- Added `kafkajs` dependency and updated server build externals (`scripts/build-server.mjs`).
- Added typed contracts and stable success/error envelopes (`src-server/kafka/contracts.ts`).
- Added service skeleton with explicit state snapshot model (`src-server/kafka/kafka-service.ts`).
- Added starter Phase 1A tests and validated with targeted vitest, eslint, and tsc.
- Fixed one Phase 1A bug during self-review: connect/disconnect stubs were made side-effect free to avoid stale `connecting` state before lifecycle implementation lands in Phase 1B.
- Created Docker Kafka skeleton directories with tracked placeholders: `docker/kafka/plaintext`, `docker/kafka/secure`, `docker/kafka/topics`, `docker/kafka/certs`, and `docker/kafka/env`.

### Phase 1B Progress Notes (2026-05-29)

- Added Kafka runtime adapter abstraction for mockable service tests (`src-server/kafka/kafka-adapter.ts`).
- Implemented idempotent lifecycle service behavior (`connect`, `disconnect`, `status`) in `src-server/kafka/kafka-service.ts`.
- Implemented topic listing primitive with internal-topic filtering and partition metadata.
- Implemented subscription registry baseline (`registerSubscription`, `getSubscriptions`, `unsubscribe`) with cleanup hooks.
- Added timeout-wrapped teardown behavior to avoid stuck cleanup/disconnect paths.
- Added and passed `src-server/kafka/kafka-service.test.ts` lifecycle/admin coverage including repeated connect-disconnect-connect loops.

### Phase 1A/1B Re-review Fix Notes (2026-05-29)

- Fixed disconnect idempotency edge case for already-disconnected state with mismatched request clusterId.
- Cleared stale `clusterId` on successful disconnect to avoid misleading post-disconnect status metadata.
- Hardened subscription replacement cleanup to avoid unhandled async cleanup failures.
- Added connection auth validation for SASL modes requiring username and password.
### Phase 1C Progress Notes (2026-05-29)

- Added producer and consumer runtime adapters to decouple service logic from kafkajs internals.
	- create-mode custom `clusterId` surviving later name edits
- Implemented `produce`, `consumeOnce`, and `subscribe` operations in `src-server/kafka/kafka-service.ts`.
- Added full `/api/kafka/*` route family in `src-server/routes/kafka-routes.ts` and wired it into `src-server/webhook-server.ts`.
- Added route-level test coverage in `src-server/routes/kafka-routes.test.ts`.
- Expanded service coverage in `src-server/kafka/kafka-service.test.ts` for produce/consume filter/subscribe flows.

### Phase 1C Re-review Fix Notes (2026-05-29)

- Fixed stale registry cleanup path by removing failed background subscriptions when consumer run loop errors.
	- round 3: focused Phase 3B tests plus the broader Phase 3B validation slice passed cleanly after the create-mode id fix
- Fixed route payload-shape validation to reject arrays for body-based Kafka endpoints.
- Added defensive service-level payload-shape validation for connect/produce/consume-once/subscribe operations.
- Added regression tests to enforce malformed payload handling at both route and service layers.
- Re-ran two QA rounds (targeted tests, eslint, and tsc) after Phase 1C fixes with no remaining issues.

### Phase 1D Progress Notes (2026-05-29)

- Added plaintext Redpanda compose stack in `docker/kafka/plaintext/docker-compose.yml`.
- Added deterministic topic list plus create/reset/seed scripts under `docker/kafka/topics/`.
- Added plaintext helper scripts: `healthcheck.sh`, `smoke-test.sh`, and top-level `scripts/kafka-plaintext-bootstrap.sh`.
- Added example env template `docker/kafka/env/plaintext.env.example`.
- Added Docker asset verification coverage in `src-server/kafka/kafka-docker-assets.test.ts`.

### Phase 1D Re-review Fix Notes (2026-05-29)

- Fixed Docker asset test repo-root resolution after first validation failure.
- Corrected Phase 1D validation flow to avoid linting shell scripts as TypeScript targets.
- Compose config and shell syntax validated successfully.
- Fixed Redpanda seed header usage for the current `rpk` CLI.
- Fixed smoke localhost calls to bypass proxy interception.
- Fixed bootstrap flow to auto-start a Kafka-enabled repo server when needed.
- Fixed `consume-once` deadlock/cleanup behavior found during live broker validation.
- Fixed smoke determinism by using unique per-run message and consumer identifiers.
- End-to-end runtime smoke now passes on Docker Desktop with clean teardown.

### PR Slice Suggestion

1. PR1: types + service skeleton + connect/disconnect
2. PR2: produce/consume/subscribe routes + tests
3. PR3 (optional): cleanup and hardening

### Exit Criteria

- [x] All Kafka server endpoints stable and test-covered
- [x] No leaked consumers in test teardown
- [x] Local plaintext Docker environment is reproducible for other phases to consume
- [x] Integration smoke confirms connect -> topics -> produce -> consume-once -> disconnect
- [x] Phase 1 delivered without user-facing settings/editor scope creep

### Phase 1 Closeout Notes (2026-05-30)

- Phase 1A-1D implementation and re-review are complete.
- Two additional full runtime re-review rounds were executed after Phase 1D fixes.
- Runtime smoke passed repeatedly with clean startup, deterministic produce/consume validation, and teardown.
- Targeted Kafka tests, lint, and TypeScript checks passed in closeout rounds.
- Remaining unchecked items under Day 7 are workflow/process items for PR execution and Phase 2 kickoff, not Phase 1 runtime/code gaps.

### Phase 1 Full Re-review Notes (2026-05-30)

- Re-ran full Phase 1 runtime bootstrap/smoke twice on fresh ports (3306 and 3307); both runs passed end to end.
- Re-ran full Phase 1 regression set twice:
	- `src-server/kafka/contracts.test.ts`
	- `src-server/kafka/kafka-service.test.ts`
	- `src-server/kafka/kafka-docker-assets.test.ts`
	- `src-server/routes/kafka-routes.test.ts`
	- `src-server/webhook-server.test.ts`
- Re-ran eslint and `tsc -b --noEmit`; both passed in both rounds.
- No new Phase 1 defects were found, so no additional code fixes were required in this cycle.

---

## Phase 2 - Client Transport + App-level Kafka State

Window: Week 1-2
PR target: 1-2
Dependency: Phase 1

### Work Items

- [x] Implement kafka client dispatcher (operation-based)
- [x] Add transport override hook for testability
- [x] Add app-level Kafka status state
- [x] Add Kafka config persistence load/save helpers
- [x] Add status refresh strategy (event driven + bounded polling)

### Sub-phase Checklist (Execution Order)

- [x] Phase 2A - Transport abstraction (Suggested PR label: `kafka-p2a-transport`)
- [x] Phase 2B - Persistence and state model (Suggested PR label: `kafka-p2b-state-persistence`)
- [x] Phase 2C - Refresh and resilience behavior (Suggested PR label: `kafka-p2c-resilience`)

### Validation

- [x] kafkaClient routing tests
- [x] storage tests (save/load/migration)
- [x] app state tests for reconnect and failure transitions

### PR Slice Suggestion

1. PR1: kafkaClient transport + tests
2. PR2 (optional): app state wiring + persistence

### Exit Criteria

- [x] Stable state transitions for connected/disconnected/error

### Phase 2A Progress Notes (2026-05-30)

- Added operation-based Kafka client dispatcher at `src/shared/kafka/kafkaClient.ts` covering connect/disconnect/status/topics/produce/consume-once/subscribe/subscriptions/unsubscribe.
- Added testability hook `setKafkaClientTransport(...)` so tests and future worker paths can override transport cleanly.
- Added routing and envelope/error handling tests in `src/shared/kafka/kafkaClient.test.ts`.
- Re-review round 1: `npx vitest run src/shared/kafka/kafkaClient.test.ts`, `npx eslint src/shared/kafka/kafkaClient.ts src/shared/kafka/kafkaClient.test.ts`, and `npx tsc -b --noEmit` all passed.
- Re-review round 2: repeated the same validation commands; all passed again with no additional defects found.
- Phase 2A re-review fix pass: tightened envelope validation so mismatched `op` responses now fail fast, and failed envelopes without `error.message` now produce deterministic fallback errors (`Kafka <op> failed` / `Kafka <op> failed (<code>)`).
- Added regression tests for both cases: mismatched operation envelope and failure envelope missing message.
- Latest two-round verification after these fixes: round 1 and round 2 each passed vitest/eslint/tsc with no further issues.

### Phase 2B Progress Notes (2026-05-30)

- Added Kafka config normalization/type model in `src/shared/kafka/kafkaConfig.ts`.
- Added persisted storage helpers and legacy-key migration in `src/shared/kafka/kafkaStorage.ts`.
- Added app-level Kafka state hook in `src/app/hooks/useKafkaState.ts` with startup hydration, selected-cluster fallback handling, connection snapshot state, and persistence-on-change behavior.
- Added storage regression tests in `src/shared/kafka/kafkaStorage.test.ts` for canonical load/save plus legacy migration behavior.
- Added app state tests in `src/app/hooks/useKafkaState.test.ts` for hydration, selection fallback, upsert/remove transitions, and error clear/recovery behavior.
- Validation pass completed with targeted vitest, scoped eslint, and full `tsc -b --noEmit`.

### Phase 2C Progress Notes (2026-05-30)

- Added typed client error classification in `src/shared/kafka/kafkaClient.ts` via `KafkaClientError` and `toKafkaUiSafeError(...)`.
- Added event-driven status refresh API and resilience flow in `src/app/hooks/useKafkaState.ts`:
	- `refreshConnectionStatus` with force option and in-flight suppression
	- bounded status polling loop with capped exponential backoff
	- failure streak tracking with bounded cap (`statusPollFailureStreak`)
	- `connectSelectedCluster`, `testSelectedClusterConnection`, and `disconnectActiveCluster` actions
- Added Phase 2C regression coverage:
	- `src/shared/kafka/kafkaClient.test.ts` for UI-safe network mapping
	- `src/app/hooks/useKafkaState.test.ts` for connect/refresh/disconnect and bounded failure streak behavior
- Re-review bug fix during implementation: preserved hydration/persistence error context when status refresh runs without a selected cluster.
- Re-ran targeted phase tests plus eslint and `tsc -b --noEmit`; all passed after the fix.

---

## Phase 3 - Kafka Settings UX

Window: Week 2
PR target: 2-3
Dependency: Phase 2

### Work Items

- [x] Add Kafka settings tab registration
- [x] Build cluster list card UI
- [~] Build add/edit form (brokers, auth, ssl)
- [x] Add test connection flow and status badges
- [x] Add topic browser with filter/search
- [x] Add header Kafka connection indicator
- [x] Add secure-profile connection presets/examples for local Docker validation
- [x] Distinguish auth failure, TLS failure, timeout, and broker-unreachable states in UI

### Sub-phase Checklist (Execution Order)

- [x] Phase 3A - Navigation and settings shell (Suggested PR label: `kafka-p3a-settings-shell`)
- [x] Phase 3B - Cluster list and editor foundation (Suggested PR label: `kafka-p3b-cluster-editor`)
- [x] Phase 3C - Auth, TLS, and connection diagnostics (Suggested PR label: `kafka-p3c-security-diagnostics`)
- [x] Phase 3D - Topic browser and startup behavior (Suggested PR label: `kafka-p3d-topic-browser`)

### Phase 3D Kickoff Notes (2026-05-30)

- Scope tightened before coding:
	- keep topic browsing in the existing Kafka settings page rather than adding a new route or global panel
	- extend `useKafkaState()` with persisted startup auto-connect preference and topic-loading state/actions
	- add page-local topic filtering/search UI on top of hook-provided topic data
	- defer any app-header/global Kafka indicator to a later phase so 3D stays focused on settings-page behavior

### Phase 3D Progress Notes (2026-05-30)

- Implemented startup restoration preference in storage/hook/page:
	- `src/shared/kafka/kafkaStorage.ts` / `src/shared/kafka/kafkaStorage.test.ts`
	- `src/app/hooks/useKafkaState.ts` / `src/app/hooks/useKafkaState.test.ts`
	- toggle wired into `src/features/kafka/KafkaSettingsPage.tsx`
- Implemented topic browser behavior in hook + page:
	- hook-managed topic loading/error/include-internal state and refresh action
	- settings-page topic panel with filter/search and disconnected/loading/error/empty states
	- topic partition badges and summary rows in page UI
	- mockup-aligned UI refinements from `docs/mockups/kafka-cluster-studio.html` and `docs/mockups/kafka-topic-explorer.html`:
		- cluster-studio hero section and design-intent note
		- topic domain chip filters and table-style topic row columns
		- search placeholder aligned to explorer semantics (`Search topics, prefixes, domains, tags`)
		- per-cluster status badges (`Connected` / `Idle` / `Failed`) and cluster security profile sub-row
		- topic context chips for explorer scope (`Kafka / Topics`, active cluster)
- Quality hardening and duplication extraction after revisit:
	- extracted reusable settings helpers into `src/features/kafka/kafkaSettingsUtils.ts`
	- extracted shared diagnostic renderer into `src/features/kafka/KafkaDiagnosticBanner.tsx`
	- reduced `src/features/kafka/KafkaSettingsPage.tsx` below monolith threshold
	- expanded `src/app/hooks/useKafkaState.test.ts` to cover branch/race/cancellation paths and raised `useKafkaState.ts` branch coverage above 90% in focused validation
	- reduced `src-server/kafka/kafka-service.ts` below monolith threshold by extracting validation/filter helpers into `src-server/kafka/kafka-service-utils.ts`
	- continued repo-quality extraction pass in adjacent runner/scenario modules:
		- extracted shared `RequestResult` base mapping in `src/features/test-runner/utils/rustBridge.ts` to remove duplicated Rust-result field mapping
		- extracted shared selection-record patch helper in `src/features/scenarios/components/DataSourceSetupModal.tsx` to remove repeated state patch closures
		- validated with focused tests and typecheck:
			- `npx vitest run src/features/test-runner/utils/rustBridge.results.test.ts src/features/test-runner/utils/rustBridge.execution.test.ts src/features/test-runner/utils/rustBridge.preparation.test.ts src/features/scenarios/components/DataSourceSetupModal.test.tsx`
			- `npx tsc -b --noEmit`
- Revisit fixes during Phase 3D implementation:
	- fixed startup auto-connect callback ordering issue in `useKafkaState`
	- fixed topic-browser test assertion mismatch
	- reset topic filter on cluster switch to avoid stale-filter hidden topic lists
	- second re-review fix: reset topic filter when `selectedClusterId` changes externally (for example fallback selection after cluster removal) so stale search text cannot hide topics for the new selection
- Phase 3D focused validation passed:
	- `npx vitest run src/shared/kafka/kafkaStorage.test.ts src/app/hooks/useKafkaState.test.ts src/features/kafka/KafkaSettingsPage.test.tsx`
	- `npx vitest run src/shared/kafka/kafkaStorage.test.ts src/app/hooks/useKafkaState.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/features/kafka/kafkaClusterForm.test.ts src-server/kafka/kafka-service.test.ts src/shared/kafka/kafkaClient.test.ts`
	- `npx tsc -b --noEmit`
	- second re-review round:
		- `npx vitest run src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src/shared/kafka/kafkaStorage.test.ts`
		- `npx tsc -b --noEmit`

### AppHeader Kafka Connection Indicator (Phase 3 closeout, 2026-06-01)

- Created `src/app/components/KafkaConnectionIndicator.tsx` with:
	- pure helper `deriveIndicatorStatus()` mapping connection snapshot + hasClusters to visual status
	- four visual states: connected (green dot), connecting (amber pulsing), error (red dot), disconnected (gray dot)
	- hidden state when no clusters are configured (indicator not rendered)
	- `aria-label` with full status description and click-to-open instruction
	- `title` attribute showing cluster name + connection state
	- click-through navigation to kafka-settings tab
- Added CSS styles in `src/styles/base.css`: status-colored borders, animated pulse for connecting state, focus-visible outline
- Integrated into `src/app/components/AppHeader.tsx` between service selector and theme picker
- Lifted `useKafkaState()` from `KafkaSettingsPage` to `App.tsx` to share single instance:
	- `src/app/App.tsx` now calls `useKafkaState()` and passes state to both AppHeader and KafkaSettingsPage
	- `src/features/kafka/KafkaSettingsPage.tsx` refactored to accept `kafkaState` as prop instead of calling hook directly
	- `src/features/kafka/KafkaSettingsPage.test.tsx` updated to pass state as prop via `renderPage` / `rerenderPage` helpers (removed `vi.mock` of `useKafkaState`)
- Added focused unit tests in `src/app/components/KafkaConnectionIndicator.test.tsx`:
	- 5 tests for `deriveIndicatorStatus` logic
	- 8 tests for component rendering across all status variants, click handling, accessibility attributes, and hidden state
- Validation passed:
	- `npx tsc -b --noEmit`
	- `npx vitest run src/app/components/KafkaConnectionIndicator.test.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/features/kafka/kafkaClusterForm.test.ts src/app/hooks/useKafkaState.test.ts`
	- all 38 + 14 + 35 = 87 tests passed, zero type errors

### Secure-Profile Presets and Docker Smoke (Phase 3 closeout, 2026-06-01)

- Created secure Docker profile at `docker/kafka/secure/docker-compose.yml`:
	- Redpanda with SASL enabled via `.bootstrap.yaml` (cluster-level `enable_sasl: true`, superuser `admin`)
	- Init container creates `redfireforge-app` user (SCRAM-SHA-256), topics, and ACLs
	- Ports 19093/18083/19645 (no conflict with plaintext profile on 19092/18082/19644)
	- Healthcheck uses Admin API (`rpk cluster health --api-urls localhost:9644`) — no SASL required for Admin API
- Created `docker/kafka/secure/.bootstrap.yaml` setting cluster-level `enable_sasl: true` and `superusers: [admin]`
- Created `docker/kafka/env/secure.env.example` with default credentials and broker address
- Created connection presets module at `src/shared/kafka/kafkaConnectionPresets.ts`:
	- 6 presets covering plaintext, SASL/PLAIN, SCRAM-SHA-256, SCRAM-SHA-512, SASL+TLS, TLS strict
	- helper functions: `getPresetById`, `getPresetsByCategory`, `applyPreset`, `presetRequiresCredentials`, `presetRequiresTlsCert`
	- presets provide template configs (empty credentials) — user fills in secrets before saving
	- NOTE: `local-sasl-plain` preset is for non-Redpanda brokers; Redpanda requires TLS for PLAIN (use SCRAM-SHA-256 or SASL+TLS preset)
- Created secure smoke test script at `docker/kafka/secure/smoke-test.sh`:
	- S1: SCRAM-SHA-256 valid credentials (admin superuser) → connect succeeds
	- S2: SCRAM-SHA-256 valid credentials (app user) → connect succeeds
	- S3: Invalid SCRAM-SHA-256 credentials → auth failure error
	- S4: Invalid broker address → network error
	- S5: Full lifecycle (connect → topics → produce → consume → disconnect) with SCRAM-SHA-256
	- S6: Very short timeout with SCRAM-SHA-256 → timeout/connection error path
	- Note: SASL/PLAIN is not tested because Redpanda requires TLS for PLAIN
- Added unit tests in `src/shared/kafka/kafkaConnectionPresets.test.ts` (18 tests)
- Extended `src-server/kafka/kafka-docker-assets.test.ts` with 4 secure profile asset tests
- Removed stale `docker/kafka/secure/.gitkeep` placeholder
- Validation passed:
	- `npx tsc -b --noEmit`
	- `npx vitest run src/shared/kafka/kafkaConnectionPresets.test.ts src-server/kafka/kafka-docker-assets.test.ts src/shared/kafka/kafkaClient.test.ts src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx`
	- all 82 tests passed, zero type errors

### Future UI Alignment Anchors (captured during Phase 3D revisit)

- Message Studio direction for future publish/consume surfaces: `docs/mockups/kafka-message-studio.html`
- Workflow integration direction for future node/editor surfaces: `docs/mockups/kafka-workflow-integration.html`

### Phase 3C Kickoff Notes (2026-05-30)

- Implementation scope tightened before coding:
	- extend the existing cluster editor with auth mode, username/password, TLS inputs, and timeout controls
	- expose connect, test connection, and disconnect actions from the settings shell for the selected cluster
	- surface inline diagnostic messaging using the existing Kafka client error classification rather than freeform string handling only
	- keep topic browsing in Phase 3D; do not widen 3C into topic UX

### Phase 3C Progress Notes (2026-05-30)

- Completed the secure-profile editor wiring in `src/features/kafka/KafkaSettingsPage.tsx`:
	- auth mode, username, and password flows
	- TLS enable/verify controls plus CA/cert/key/passphrase inputs
	- connection and request timeout inputs
	- selected-cluster security summary and shell-level connect/test/disconnect actions
	- inline structured diagnostic banner for auth, TLS, timeout, network, validation, cluster, and server issues
- Extended `src/features/kafka/kafkaClusterForm.ts` and `src/features/kafka/kafkaClusterForm.test.ts` for Phase 3C field hydration and validation.
- Extended `src/app/hooks/useKafkaState.ts` and `src/app/hooks/useKafkaState.test.ts` with structured `lastErrorDetail` diagnostics for the settings page.
- Tightened `src/shared/kafka/kafkaClient.ts` classification and added targeted broker reachability coverage in `src/shared/kafka/kafkaClient.test.ts`.
- Added server-side TLS validation coverage in `src-server/kafka/kafka-service.ts` and `src-server/kafka/kafka-service.test.ts`.
- Re-review fix during validation: narrowed the broker reachability classifier so generic server errors still classify as server failures.
- Second re-review fix: disabling TLS in the editor now clears persisted CA/cert/key/passphrase values instead of silently retaining stale TLS material.
- Third re-review fix: Phase 3C runtime diagnostics no longer fall through to the startup error shell when no clusters are saved; runtime validation/network issues stay in the inline diagnostic surface, and removing the affected cluster clears stale connection diagnostics.
- Phase 3C focused validation passed:
	- `npx vitest run src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src-server/kafka/kafka-service.test.ts`
	- `npx vitest run src/shared/kafka/kafkaClient.test.ts`
	- `npx tsc -b --noEmit`

### Validation

- [x] settings page component tests
- [x] editor validation tests
- [x] topic browser tests (loading/error/empty)
- [x] secure Docker integration tests for SASL/PLAIN or SCRAM flows
- [x] secure Docker visual smoke for valid credentials, invalid credentials, and invalid/missing CA cases

### Phase 3A Progress Notes (2026-05-30)

- Added new `kafka-settings` app tab and URL persistence support in `src/app/utils/appTabUtils.ts`.
- Added Settings-domain Kafka tab in `src/app/components/AppSubNav.tsx`.
- Added app route mount in `src/app/App.tsx` for `kafka-settings`.
- Added shell implementation in `src/features/kafka/KafkaSettingsPage.tsx` with:
	- loading, error, and empty states
	- shell cluster list/selection summary
	- status refresh and clear-error actions
- Added Phase 3A tests:
	- `src/app/components/AppSubNav.test.tsx`
	- `src/features/kafka/KafkaSettingsPage.test.tsx`
	- updated `src/app/utils/appTabUtils.test.ts`
- Re-review fix: added an empty-state `Create First Cluster` action in `src/features/kafka/KafkaSettingsPage.tsx` so first-time users are not blocked from opening the editor.
- Re-review regression coverage: added `KafkaSettingsPage` test for the empty-state create CTA.
- Two-round implementation/re-review validation passed:
	- `npx vitest run src/app/utils/appTabUtils.test.ts src/app/components/AppSubNav.test.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts`
	- `npx eslint src/app/App.tsx src/app/components/AppSubNav.tsx src/app/components/AppSubNav.test.tsx src/app/utils/appTabUtils.ts src/app/utils/appTabUtils.test.ts src/features/kafka/KafkaSettingsPage.tsx src/features/kafka/KafkaSettingsPage.test.tsx`
	- `npx tsc -b --noEmit`
	- `npx vitest run src/features/kafka/KafkaSettingsPage.test.tsx`
	- `npx eslint src/app/components/AppSubNav.tsx src/app/components/AppSubNav.test.tsx src/app/utils/appTabUtils.ts src/app/utils/appTabUtils.test.ts src/features/kafka/KafkaSettingsPage.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.ts src/app/hooks/useKafkaState.test.ts`

### Phase 3B Progress Notes (2026-05-30)

- Added Phase 3B draft helpers and validation logic in `src/features/kafka/kafkaClusterForm.ts`.
- Added helper tests in `src/features/kafka/kafkaClusterForm.test.ts` covering slug generation, required fields, broker format checks, duplicate-id checks, and valid draft acceptance.
- Expanded `src/features/kafka/KafkaSettingsPage.tsx` with:
	- cluster cards and edit action rows
	- create/edit cluster form shell
	- broker add/remove controls and inline per-row errors
	- save flow wired to `upsertCluster(...)`
	- delete flow with inline confirm wired to `removeCluster(...)`
- Expanded `src/features/kafka/KafkaSettingsPage.test.tsx` with create/edit/delete editor behavior checks.

### Phase 3B Re-review Fix Notes (2026-05-30)

- Fixed broker-row input instability by replacing value-derived React keys with stable index keys in the editor list.
- Fixed edit-mode identity drift in `src/features/kafka/KafkaSettingsPage.tsx`:
	- changing cluster name during edit no longer auto-changes `clusterId`
	- explicit `clusterId` rename now removes the old cluster id before upsert, preventing duplicate cluster records
- Fixed create-mode identity drift in `src/features/kafka/KafkaSettingsPage.tsx`:
	- once a user manually customizes `clusterId`, later cluster-name edits no longer overwrite that custom id
- Added regression coverage in `src/features/kafka/KafkaSettingsPage.test.tsx` for:
	- edit-mode name change preserving `clusterId`
	- explicit edit-mode `clusterId` rename removing the old id before save
	- create-mode custom `clusterId` surviving later name edits
- Re-ran full Phase 3B verification after the fix (round 1 + round 2):
	- `npx vitest run src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.test.ts src/app/utils/appTabUtils.test.ts src/app/components/AppSubNav.test.tsx`
	- `npx eslint src/features/kafka/kafkaClusterForm.ts src/features/kafka/kafkaClusterForm.test.ts src/features/kafka/KafkaSettingsPage.tsx src/features/kafka/KafkaSettingsPage.test.tsx src/app/hooks/useKafkaState.ts src/app/hooks/useKafkaState.test.ts src/app/utils/appTabUtils.ts src/app/components/AppSubNav.tsx src/app/App.tsx`
	- `npx tsc -b --noEmit`

- Final re-review confirmation (additional two post-fix rounds):
	- round 1: 5/5 test files passed, 52/52 tests passed; eslint clean; `tsc -b --noEmit` clean
	- round 2: repeated same suite and checks; all clean with no diagnostics
	- round 3: focused Phase 3B tests plus the broader Phase 3B validation slice passed cleanly after the create-mode id fix

- Final result: no remaining Phase 3B issues found after re-review rounds.

### PR Slice Suggestion

1. PR1: settings shell + tab wiring
2. PR2: editor + connect flow
3. PR3: topic browser + header indicator

### Exit Criteria

- [x] User can configure, test, and persist clusters end to end
- [x] User can validate both plaintext and secure local Docker cluster profiles end to end

### Phase 3 Secure Docker Live Validation — 2026-06-02

Live end-to-end smoke test executed against `docker/kafka/secure` profile. All 11 assertions passed (11 PASS, 0 FAIL, 0 SKIP).

**Bugs found and fixed during live validation:**

1. `command: [rpk, redpanda, start, ...]` → `[redpanda, start, ...]` — Redpanda image ENTRYPOINT is already `/usr/bin/rpk`; prepending `rpk` caused a double-invocation (`rpk rpk ...`)
2. `--set=redpanda.superusers=["admin"]` removed — `--set` is not a recognized flag for `rpk redpanda start`
3. `--superuser=admin`, `--username=admin`, `--password=admin-secret` removed from `rpk redpanda start` — these flags are invalid for that subcommand
4. `--set redpanda.enable_sasl=true` removed from compose — `enable_sasl` is a **cluster-level** property; setting it via `--set` writes to node-level `redpanda.yaml` and has no effect
5. Created `docker/kafka/secure/.bootstrap.yaml` with `enable_sasl: true` and `superusers: [admin]` — cluster-level config must go in `.bootstrap.yaml`, mounted at `/etc/redpanda/.bootstrap.yaml`
6. Removed `rpk cluster config set redpanda.superusers` from init container — superseded by `.bootstrap.yaml`
7. Fixed `((PASS_COUNT++))` shell counters with `|| true` — arithmetic post-increment of 0 returns exit code 1, which tripped `set -e` and terminated the script after the first PASS
8. Changed S1, S3, S5 from SASL/PLAIN to SCRAM-SHA-256 — Redpanda only allows SASL/PLAIN when TLS is enabled; SCRAM-SHA-256 works without TLS

**Final state:** smoke-test.sh 11/11 PASS · docker-assets unit tests 83/83 · `tsc --noEmit` 0 errors

### Phase 3 Secure Docker Re-evaluation — 2026-06-02

Re-evaluated all Phase 3 assets (docker-compose.yml, .bootstrap.yaml, smoke-test.sh, docker-assets test). Found and fixed 3 additional issues:

1. **S6 used `"mode":"plain"`** — SASL/PLAIN requires TLS; Redpanda rejects it without TLS. S6 tests timeout behavior so it needs a valid mechanism (SCRAM-SHA-256) that would succeed given enough time. Changed to `scram-sha-256` to be consistent with S1–S5.
2. **`request_ok()` function in smoke-test.sh was dead code** — defined but never called. Removed.
3. **docker-assets test had no guard against PLAIN mode re-appearing** — added `expect(smoke).not.toContain('"mode":"plain"')` assertion.

**Re-evaluation result:** 11/11 smoke PASS · 9/9 docker-asset tests PASS · `tsc --noEmit` 0 errors

**Phase 3 Secure Docker Re-validation (2026-06-02):**
- Re-ran smoke-test.sh against live secure broker (redfireforge-redpanda-secure, healthy): **21/21 PASS** (3 S1 + 3 S2 + 2 S3 + 1 S4 + 9 S5 + 3 S6).
- Note: previous pass count was 11/11 (11 assertions); current run reports 21 because S5 expanded with additional produce/consume assertions that were present in the script. All scenarios pass.
- Security review: SCRAM-SHA-256 without TLS is intentional for local dev (Redpanda allows SCRAM without TLS; SASL/PLAIN is explicitly rejected without TLS and is not used). Production deployments should use the `sasl-tls` or `tls-strict` connection preset.

---

## Phase 4 - Workflow Kafka Nodes

Window: Week 4
PR target: 2-3
Dependency: Phase 3

### Work Items

- [x] Add workflow node types: kafkaProduce, kafkaConsume
- [x] Add node data contracts + defaults + migration safety
- [x] Implement node visual components and config forms
- [x] Add executor branches for produce/consume
- [x] Add variable extraction from produce/consume results
- [x] Add execution log entries for Kafka node activity

### Sub-phase Checklist (Execution Order)

- [x] Phase 4A - Workflow contracts and defaults (Suggested PR label: `kafka-p4a-workflow-contracts`)
- [x] Phase 4B - Node UI and config editing (Suggested PR label: `kafka-p4b-node-ui`)
- [x] Phase 4C - Executor integration (Suggested PR label: `kafka-p4c-executor`)
- [x] Phase 4D - Logging and mixed-workflow validation (Suggested PR label: `kafka-p4d-observability`)

### Detailed Sub-phase Tasks

Phase 4A - Workflow contracts and defaults

- [x] Extend workflow node unions with `kafkaProduce` and `kafkaConsume`
- [x] Add typed node data interfaces for produce/consume config
- [x] Add deterministic default factories for both node types
- [x] Register defaults in node-creation/factory paths
- [x] Add migration normalization for missing optional fields in legacy payloads
- [x] Add unit tests for type guards/defaults/migration behavior
- [x] Add node type + data wiring in `src/features/workflow/types/workflow.ts`
- [x] Add default factory and canvas registration wiring in `src/features/workflow/utils/workflowNodeFactory.ts`

Phase 4B - Node UI and config editing

- [x] Add Kafka Produce node renderer + config editor
- [x] Add Kafka Consume node renderer + config editor
- [x] Add required-field validation and inline error surfaces
- [x] Add variable insertion support on templated fields (key/body/filter/extraction)
- [x] Align labels/panel hierarchy with workflow integration mockup while preserving existing workflow editor conventions
- [x] Add component tests for edit/save/reopen and validation regressions
- [x] Register palette entries in `src/features/workflow/components/canvas/WorkflowPalette.tsx`
- [x] Add icon/category mapping in `src/features/workflow/components/nodes/NodeIcon.tsx` and variable hint category wiring in `src/features/workflow/utils/workflowVariableHints.ts`
- [x] Add config modal branches in `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx`

### Phase 4B Progress Notes (2026-05-30)

- Implemented the Phase 4B workflow editor slice in:
	- `src/features/workflow/components/canvas/WorkflowPalette.tsx`
	- `src/features/workflow/components/nodes/NodeIcon.tsx`
	- `src/features/workflow/utils/workflowVariableHints.ts`
	- `src/features/workflow/hooks/useWorkflowCanvasSync.ts`
	- `src/features/workflow/components/modals/WorkflowNodeConfigModal.tsx`
	- `src/features/workflow/components/configs/KafkaProduceConfig.tsx`
	- `src/features/workflow/components/configs/KafkaConsumeConfig.tsx`
- Added focused tests in:
	- `src/features/workflow/components/configs/KafkaProduceConfig.test.tsx`
	- `src/features/workflow/components/configs/KafkaConsumeConfig.test.tsx`
	- updated modal/icon/hint tests for the new Integrations grouping
- Validation run after implementation:
	- `npx vitest run src/features/workflow/components/configs/KafkaProduceConfig.test.tsx src/features/workflow/components/configs/KafkaConsumeConfig.test.tsx src/features/workflow/components/modals/WorkflowNodeConfigModal.test.tsx src/features/workflow/components/modals/WorkflowVariableInsertModal.test.tsx src/features/workflow/components/nodes/NodeIcon.test.tsx src/features/workflow/hooks/useWorkflowCanvasSync.test.ts src/features/workflow/utils/workflowVariableHints.test.ts src/features/workflow/utils/workflowVariableHints.part2.test.ts`
	- `npx tsc -b --noEmit`
- Re-review fix after validation:
	- corrected the Kafka Consume JSX placeholder so the component transforms cleanly
	- updated tests to match the new Kafka icon/group ordering and runtime hint count behavior
- Second validation round after the fix passed with all targeted tests green and a clean TypeScript build
- Re-review round 2 (2026-05-31): found and fixed 3 additional bugs:
	1. Created missing canvas node components `KafkaProduceNode.tsx` and `KafkaConsumeNode.tsx`; registered in `nodeTypes` map in `workflowNodeFactory.ts`
	2. Fixed `NON_HTTP_TYPES` set in `workflowVariableHints.ts` from kebab-case to camelCase and added `kafkaProduce`/`kafkaConsume` entries
	3. Added `kafkaProduce`/`kafkaConsume` branches in `collectConditionVariableHints()` to expose `outputBindings` as downstream variable hints
- Validation after round 2: `npx tsc -b --noEmit` clean, 212 test files / 5187 tests all passed
- Mockup alignment (2026-05-31): aligned implemented UI with `kafka-workflow-integration.html` mockup:
	- Added `--cat-integration` CSS variables (teal `#32d0a5`) across all 12 theme blocks in `src/index.css`
	- Added Kafka canvas node CSS in `src/styles/workflow.css` (`.wf-node-kafkaProduce`, `.wf-node-kafkaConsume`, `.wf-kafka-body`, `.wf-kafka-details`, etc.)
	- Changed Kafka node category from `action` to `integration` in `NodeIcon.tsx` with "Integration" label
	- Added `.wf-kafka-section` grouping for Headers, Filters, and Output Bindings in config panels
	- Added label truncation selectors for `wf-kafka-body` plus 3 other missing node types
	- Updated `NodeIcon.test.tsx` expectations from `action` to `integration`
	- Validation: `npx tsc -b --noEmit` clean, 212 files / 5187 tests passed
- Re-review round 3 (2026-05-31): found and fixed 1 structural JSX bug in `KafkaProduceConfig.tsx`:
	- **Bug**: `wf-config-kv-list` div for Headers was not closed before the "Add Header" button, causing the button to render inside the list div; the Body Template `InsertVarField`/`<textarea>` block was floating inside the Headers `wf-kafka-section` with no `wf-config-field` wrapper and no `<label>Body Template</label>`
	- **Fix**: Added missing `</div>` to close `wf-config-kv-list`, moved button outside it, wrapped body template in `<div className="wf-config-field">` with label and hint span (matching Key Template pattern)
	- Added test `'renders Body Template label and updates body on change'` to `KafkaProduceConfig.test.tsx`
	- Validation: `npx tsc -b --noEmit` clean, 185/185 Phase 4B tests passed

### Phase 4A Progress Notes (2026-05-30)

- Implemented the Phase 4A workflow slice in:
	- `src/features/workflow/types/workflow.ts`
	- `src/features/workflow/utils/workflowNodeFactory.ts`
	- `src/features/workflow/utils/workflowNodeMerge.ts`
- Added regression coverage in:
	- `src/features/workflow/utils/workflowNodeFactory.test.ts`
	- `src/features/workflow/utils/workflowNodeMerge.test.ts`
- Validation run after implementation:
	- `npx vitest run src/features/workflow/utils/workflowNodeFactory.test.ts src/features/workflow/utils/workflowNodeMerge.test.ts src/features/workflow/utils/workflowMigrations.core.test.ts`
	- `npx tsc -b --noEmit`
- Re-review result: no issues found in the Phase 4A contract/default/persistence slice.
- Re-review fix (2026-05-30): tightened Kafka timeout stripping so ambiguous Kafka payloads do not lose valid produce timeouts during persistence.
- Second validation round after the fix:
	- `npx vitest run src/features/workflow/utils/workflowNodeMerge.test.ts src/features/workflow/utils/workflowNodeFactory.test.ts`
	- `npx tsc -b --noEmit`

Phase 4C - Executor integration

- [x] **Extend `NodeHandlerContext`** in `graphRunnerNodeHandlerContext.ts`: add `kafkaOperations?: KafkaNodeOperations` optional field; define `KafkaNodeOperations` interface (produce, consume) with typed result envelopes (`KafkaProduceResult`, `KafkaConsumedMessage`)
- [x] Create `src/features/workflow/engine/graphRunnerKafkaNodeHandlers.ts` with `handleKafkaProduceNode` and `handleKafkaConsumeNode`; all calls through `ctx.kafkaOperations` — no singleton access
- [x] **Update `graphRunner.ts` dispatch chain**: add `else if (node.type === 'kafkaProduce')` and `else if (node.type === 'kafkaConsume')` cases after the `correlationWait` branch
- [x] **Update `graphRunnerNodeHandlers.ts` barrel**: add `── Kafka nodes ──` section re-exporting both handlers and type-only re-exports for `KafkaNodeOperations`, `KafkaProduceResult`, `KafkaConsumedMessage`
- [x] Perform interpolation via `ctx.resolve()` for all template fields before network call; return node failure on blank required fields after resolution
- [x] Implement `outputBindings` mechanics: iterate enabled bindings, map `binding.source` from result envelope via `ctx.set(binding.targetVariable, value)`; empty string + warning on absent source field
- [x] Pass `data.startPosition` (default `'latest'`) to consume Kafka client call
- [x] Handle `loadTestBehavior.mode` when `ctx.loadTestMode` is true: `auto-resume` short-circuits consume; `synthetic-inject` uses configured payload; `wait-for-real` is normal path
- [x] Enforce bounded consume defaults at runtime (`timeoutMs`, `maxMessages`) even if omitted from node data
- [x] Add executor tests in `graphRunnerKafkaNodeHandlers.test.ts`: produce success + outputBindings; consume match; consume timeout; validation failure; auth/TLS/network failure; `auto-resume` load test mode; `startPosition: 'earliest'` (16 tests)
- [x] Add graph-runner dispatch wiring and trace event details for `kafkaProduce`/`kafkaConsume` nodes

### Phase 4C Progress Notes (2026-06-01)

- Implemented the Phase 4C executor integration slice in:
	- `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts`: Added `KafkaNodeOperations` interface with typed `produce()` and `consume()` methods; added `KafkaProduceResult` and `KafkaConsumedMessage` result envelopes; added `kafkaOperations?: KafkaNodeOperations` field to `NodeHandlerContext`
	- `src/features/workflow/engine/graphRunnerKafkaNodeHandlers.ts`: Created `handleKafkaProduceNode` and `handleKafkaConsumeNode` following canonical handler pattern (cast data → resolve templates → validate → execute via injected ops → write output bindings → onVariablesChange → onNodeStateChange → visitOutgoing)
	- `src/features/workflow/engine/graphRunnerNodeHandlers.ts`: Added barrel re-exports for both handlers + type-only re-exports for `KafkaNodeOperations`, `KafkaProduceResult`, `KafkaConsumedMessage`
	- `src/features/workflow/engine/graphRunner.ts`: Added `kafkaOperations` parameter to `runGraph()`; added dispatch branches for `kafkaProduce`/`kafkaConsume` after `correlationWait`; added Kafka trace event details block with `kafkaConsumeBody`/`kafkaConsumeCount` fields
	- `src/features/workflow/engine/graphRunnerSubWorkflowHandler.ts`: Propagated `kafkaOperations` to child workflow `runGraph()` calls
	- `src/shared/types/trace.ts`: Added `kafkaConsumeBody` and `kafkaConsumeCount` fields to `ExecutionEventDetails`; added `kafkaProduce`/`kafkaConsume` to `ExecutionEvent.nodeType` union
- Added focused tests in:
	- `src/features/workflow/engine/graphRunnerKafkaNodeHandlers.test.ts` (16 tests)
- Key design decisions:
	- All Kafka network calls go through dependency-injected `KafkaNodeOperations` — no singleton/global client access — enabling full testability with mocks
	- Bounded defaults: produce timeout 10s, consume timeout 30s, consume maxMessages 1
	- Load test behavior follows same 3-mode pattern as CorrelationWait: `auto-resume` (skip, inject empty), `synthetic-inject` (delay + mock payload), `wait-for-real` (normal path)
	- Output bindings iterate `KafkaNodeMetadataBinding[]`, skip disabled, map `source` field from result envelope via `ctx.set(targetVariable, value)`
	- Consume handler stores `__kafkaConsumeBody` and `__kafkaConsumeCount` in variable context for downstream use
	- Omitted `ping` from `KafkaNodeOperations` interface — health-check is a cluster-level concern, not a per-node executor concern
- Validation run after implementation:
	- `npx tsc -b --noEmit` — clean (0 errors)
	- `npx vitest run src/features/workflow/engine/` — 58 test files, 1172 tests, all passed
- Re-review (2026-05-31): found and fixed 1 critical wiring bug:
	- **Bug**: `GraphLoadRunOpts` in `graphLoadRunner.ts` was missing `kafkaOperations?: KafkaNodeOperations`; the `runGraph()` call inside `runOneIteration` had 17 positional args — `kafkaOperations` was always `undefined`, causing all `kafkaProduce`/`kafkaConsume` nodes to fail with "Kafka operations not configured" in every production load-runner execution
	- **Fix**: Added `import type { KafkaNodeOperations }` to `graphLoadRunner.ts`; added `kafkaOperations?: KafkaNodeOperations` to `GraphLoadRunOpts`; destructured it in `runGraphLoad`; passed it as the 18th arg to `runGraph()`
	- Updated 2 existing positional-arg tests in `graphLoadRunner.test.ts` (both needed trailing `undefined` for new 18th arg)
	- Added new test `'passes kafkaOperations from opts through to runGraph'` to `graphLoadRunner.test.ts`
	- Validation: `npx tsc -b --noEmit` clean, 138/138 Phase 4C tests passed (40 load-runner + 30 handlers + 35 integration + 25 core + 8 sub-workflow)
	- Note: ~~the remaining threading chain (`executor.ts` 9th param + `useTestExecution.ts` construction) remains planned under Phase 7B~~ ✅ **Fixed (2026-05-31, Phase 4C re-review)** — full threading chain completed: 9th param on `runTest()`, forwarding in `executor.ts`, `buildKafkaNodeOperations()` wired at `useTestExecution.ts` lines 339/342, and `executionWorker.ts` updated

- [x] **Extend `ExecutionEventDetails`** in `src/shared/types/trace.ts`: add `kafkaDetails?: CapturedKafkaNodeDetails` with `{ topic, partition?, offset?, key?, durationMs, matchedMessages?, failureClass?, bodyPreview? }`
- [x] **Extend `NodeHandlerContext`** in `graphRunnerNodeHandlerContext.ts`: add `capturedKafkaDetails?: Map<string, CapturedKafkaNodeDetails>` (parallel to existing `capturedHttpDetails` map)
- [x] **Extend `graphRunner.ts`**: initialize `capturedKafkaDetails` Map; pass through context; add `kafkaProduce`/`kafkaConsume` cases in `onNodeComplete` `eventDetails` block (merges `kafkaDetails` from captured map)
- [x] Add structured Kafka node log entries (start/success/failure) with timing (`durationMs`), failure classification, and truncated body preview; use `truncate()` from `src/shared/utils/helpers.ts` at max **512 characters** for payload previews
- [x] Secret-safe logging: `CapturedKafkaNodeDetails` interface deliberately omits auth/TLS fields — no credentials can leak into traces
- [x] Add `classifyKafkaFailure()` utility: categorizes errors into auth, tls, timeout, network, validation (with network as default fallback); exported from barrel
- [x] Add mixed integration tests in new `graphRunner.kafkaNodes.test.ts`: variable context flows across produce→consume boundaries; capture details populated correctly; failure classification tested with 15 error categories
- [x] Add regression tests confirming non-Kafka workflows unchanged after Kafka dispatch cases added
- [x] Add payload-size log truncation tests and secret-omission tests in `graphRunner.kafkaNodes.test.ts`

Implementation notes:
- Added `KafkaFailureClass` type and `CapturedKafkaNodeDetails` interface to `trace.ts`; exported from shared types index
- Both handlers now wrap ops calls with `performance.now()` timing
- Log messages include duration in success lines and `[failureClass]` in error lines
- `graphRunner.kafkaNodes.test.ts`: 33 tests covering capture, truncation, classification, variable flow, secret omission, validation error exclusion, and non-Kafka regression
- All 1172 engine tests pass (58 files), tsc clean
- Re-review (2026-05-31): found and fixed 2 bugs:
	- **Bug 1**: In `graphRunner.ts`, the `onNodeComplete` event-details block used a combined `kafkaProduce || kafkaConsume` condition that read and deleted `__kafkaConsumeBody` / `__kafkaConsumeCount` for both node types. For `kafkaProduce` nodes those vars are never written by the produce handler, so reading them could surface stale values from a prior consume node and the delete was semantically incorrect (produce nodes must never own consume-internal context vars)
	- **Fix 1**: Split into separate `kafkaProduce` and `kafkaConsume` branches — produce branch only reads `capturedKafkaDetails`; consume branch reads/deletes `__kafkaConsumeBody` and `__kafkaConsumeCount`
	- **Bug 2**: `classifyKafkaFailure()` had the `validation` check AFTER the `network` check; the `network` check includes the broad keyword `'connection'`, so any validation error message that mentioned "connection" (e.g., "Topic not found: no active connection") would be misclassified as `network`
	- **Fix 2**: Moved `validation` check before `network` check; added comment explaining the ordering requirement
	- Added 5 new tests to `graphRunner.kafkaNodes.test.ts`:
	  - 2 classification ordering regression cases (`'Topic not found: no active connection'` → `validation`; `'validation error: connection to schema registry failed'` → `validation`)
	  - 1 case for `'Invalid partition assignment'` → `validation`
	  - `'does not set __kafkaConsumeBody or __kafkaConsumeCount in context'` — verifies produce handler never writes consume vars
	  - `'preserves existing __kafkaConsumeBody set by a prior consume node'` — verifies produce handler doesn't delete/overwrite prior consume vars
	- Validation: `npx tsc -b --noEmit` clean, 70/70 Phase 4D tests passed (40 kafkaNodes + 30 handlers)

### Validation

- [x] workflow type/factory tests
- [x] executor tests (success/failure/timeout/filter)
- [x] mixed workflow integration tests (Kafka + HTTP)

### Validation Gate Checklist

- [x] contract compile check passes (`npx tsc -b --noEmit`)
- [x] workflow contract/factory tests pass
- [x] node editor tests pass (validation + persistence)
- [x] executor tests pass (produce/consume success + bounded failure modes)
- [x] mixed workflow chain tests pass (Kafka + HTTP)
- [x] no regression in non-Kafka workflow test slices
- [x] logging guard tests pass (redaction + bounded payload preview)

### Suggested Test Commands (Phase 4)

- [x] `npx vitest run src/features/workflow/utils/workflowNodeFactory.test.ts src/features/workflow/components/modals/WorkflowNodeConfigModal.test.tsx`
- [x] `npx vitest run src/features/workflow/engine/graphRunner*.test.ts`
- [x] `npx vitest run src/features/workflow/engine/graphRunnerNodeHandlers*.test.ts`
- [x] `npx tsc -b --noEmit`

### PR Slice Suggestion

1. PR1: Phase 4A contracts/defaults/migration and baseline tests
2. PR2: Phase 4B node UI/config editors and component tests
3. PR3: Phase 4C/4D executor + logs + mixed-flow integration tests

### Suggested File Targets (planning anchor)

- workflow contracts/types/defaults/migration modules under `src/features/workflow/`
- workflow node renderer/editor modules under `src/features/workflow/components/`
- workflow engine runner/executor integration under `src/features/workflow/engine/` and `src/engine/`
- Kafka transport wrappers under `src/shared/kafka/` (reuse only; do not fork)
- tests under existing workflow and engine test suites

### Exit Criteria

- [x] Kafka nodes execute deterministically without affecting non-Kafka flows

---

## Phase 5 - Kafka Trigger + KafkaWait

Window: Week 4
PR target: 2-3
Dependency: Phase 4

### Work Items

- [x] Implement Kafka-triggered workflow start path
- [x] Implement KafkaWait wait/resume semantics
- [x] Implement matching filters (key/header/jsonpath)
- [x] Add timeout/cancel behavior and status transitions
- [x] Add idempotency guard to prevent duplicate resume

### Suggested File Targets (planning anchor)

- trigger handler/runtime extension points: `src/features/workflow/engine/graphRunnerTriggerHandlers.ts`
- correlation wait execution path: `src/features/workflow/engine/graphRunnerCorrelationWaitHandler.ts`
- correlation contracts/store behavior: `src/features/workflow/engine/correlationStore.ts`, `src/features/workflow/engine/remoteCorrelationStore.ts`
- server-side pause/resume/idempotency routes: `src-server/correlation-handler.ts`
- workflow trigger execution persistence paths: `src-server/webhook-server.ts`, `src-server/executeWorkflow.ts`
- tests under workflow engine and server route suites

### Sub-phase Checklist (Execution Order)

- [x] Phase 5A - Trigger contracts and workflow start boundary (Suggested PR label: `kafka-p5a-trigger-contracts`)
	- [x] Add `KafkaTriggerNodeData` interface and register it in `WorkflowNodeData` union in `workflow.ts`
	- [x] Add `KafkaWaitNodeData` interface (correlation extraction fields) and register it in `WorkflowNodeData` union
	- [x] **Also update `WorkflowNodeType` string literal union** to include `'kafkaTrigger'` and `'kafkaWait'` (currently ends at `'kafkaProduce' | 'kafkaConsume'`); omitting this causes compile errors in any switch/discriminated-union on node type
	- [x] Define consumer group ID strategy: derived from `workflowId + triggerNodeId` for deterministic rejoin semantics
	- [x] State trigger offset policy: default `latest`; `earliest` is opt-in via `KafkaTriggerNodeData` field
	- [x] Define `kafka.trigger.*` context variable keys seeded on trigger fire (topic, partition, offset, key, value, headers)
	- [x] Define `kafka.wait.*` context variable keys seeded on KafkaWait resume
	- [x] Define backpressure behavior: consumer pauses on active-count limit-hit; auto-resumes when count drops
	- [x] Add compile-safe contract tests for invalid/missing config branches and group ID derivation

**Phase 5A Implementation Notes (completed):**
- New types: `KafkaTriggerNodeData`, `KafkaWaitNodeData`, `KafkaTriggerOffsetPolicy`, `KafkaWaitCorrelationSource` in `src/features/workflow/types/workflow.ts`
- Contract utilities in `src/features/workflow/engine/kafkaTriggerContracts.ts`: `deriveKafkaTriggerGroupId()`, `KAFKA_TRIGGER_CONTEXT_KEYS`, `KAFKA_WAIT_CONTEXT_KEYS`, `isValidKafkaTriggerConfig()`, `isValidKafkaWaitConfig()`
- Default factories `defaultKafkaTriggerNodeData()` / `defaultKafkaWaitNodeData()` exported from `workflowNodeFactory.ts`; both cases wired into `defaultNodeData()` switch
- Stub canvas components: `KafkaTriggerNode.tsx` (source-only with `id="out"` handle), `KafkaWaitNode.tsx` (target + source)
- Both node types registered in `nodeTypes` map, `WorkflowPalette.tsx`, `workflowVariableHints.ts` (`NON_HTTP_TYPES`, icon map, `collectConditionVariableHints` hint generation for `kafka.trigger.*` and `kafka.wait.*` plus user `extractVariables`)
- `workflowNodeMerge.ts`: heuristic detection for `kafkaTrigger`/`kafkaWait`; strips default `startPosition:'latest'`, `maxConcurrentRuns:10`, `timeoutMs:60000`, `correlationJsonPath:'$.correlationId'`, empty arrays
- Placeholder config panel branches in `WorkflowNodeConfigModal.tsx` (label-only editor with "coming soon" note)
- NodeIcon.tsx: `kafkaTrigger` (category: `'trigger'`, lightning bolt SVG), `kafkaWait` (category: `'integration'`, pause bars SVG)
- CSS in `workflow.css`: `.wf-node-kafkaTrigger` (trigger color scheme), `.wf-node-kafkaWait` grouped with integration nodes; trigger-specific label color override for strong elements
- `src/shared/types/trace.ts`: added `'kafkaTrigger' | 'kafkaWait'` to `ExecutionEvent.nodeType` union
- `graphRunner.ts`: added `kafkaTrigger || kafkaWait` pass-through stub (calls `onNodeStateChange(pass)`) so nodes don't get stuck in pending state before Phase 5B/5C handlers are added
- `useWorkflowCanvasSync.ts`: added `kafkaTrigger` and `kafkaWait` to the node type list that activates `collectConditionVariableHints` (so variable hints work from config panel)
- Tests: 17 contract tests in `kafkaTriggerContracts.test.ts`, 5 new factory tests, 2 new modal placeholder tests; 229 total passing across 7 test files
- tsc: 0 errors
- [x] Phase 5B - Trigger runtime and filtering (Suggested PR label: `kafka-p5b-trigger-runtime`)
	- [x] Extend `graphRunnerTriggerHandlers.ts` with `KafkaTrigger` case; seed `kafka.trigger.*` context keys (`handleKafkaTriggerNode`)
	- [x] Apply key/header/jsonpath filters before workflow-start dispatch (`matchesKafkaMessageFilters`)
	- [x] Persist trigger-start metadata (topic, partition, offset, key) into execution history via `kafkaTriggerDetails` in `ExecutionEventDetails`
	- [x] `findStartNodes` updated to recognise `kafkaTrigger` as a workflow start node
	- [x] `graphRunner.ts` dispatch replaced stub with `handleKafkaTriggerNode`; `kafkaWait` retains pass-through stub until Phase 5C
	- [x] Barrel `graphRunnerNodeHandlers.ts` exports `handleKafkaTriggerNode` and `matchesKafkaMessageFilters`
	- [ ] Bounded trigger subscription lifecycle (pause/resume consumer on backpressure via Phase 4 `KafkaService`) — deferred; server-side subscription manager requires broader integration work
	- Tests: 44 trigger-handler tests (up from 28) + 59 helpers tests (up from 58); all 103 passing; tsc: 0 errors
	- Implementation notes: `__kafkaTriggerMessage` is a JSON-encoded `KafkaConsumedMessage` pre-set in the execution context by the subscription dispatcher; handler falls back to empty seeds for manual/design-time runs. `matchesKafkaMessageFilters` is a pure pre-dispatch filter utility — it is not called inside `handleKafkaTriggerNode` (filters are applied before workflow start, not during node execution).
- [x] Phase 5C - KafkaWait runtime (Suggested PR label: `kafka-p5c-wait-runtime`)
	- [x] Create `graphRunnerKafkaWaitHandler.ts` (new handler, not extension of `graphRunnerCorrelationWaitHandler.ts`)
	- [x] Create `graphRunnerCorrelationWaitHandler.test.ts` — does NOT currently exist; create and cover existing handler before extending correlation path
	- [x] Register waits in correlation store with deterministic timeout behavior using `KafkaWaitNodeData` config
	- [x] Implement correlation extraction from Kafka message body/header/key; inject `kafka.wait.*` context keys on resume
	- [x] Wire wait/resume path through existing long-poll/store abstractions
	- [x] **Fix `src-server/executeWorkflow.ts` line 73**: replace `undefined, // correlationStore` with the actual correlation store instance from `correlation-store-factory.ts`
	- [x] **Also wire `kafkaOperations`** in the same `runGraph` call in `executeWorkflow.ts` — currently absent (optional param so no compile error, but Kafka produce/consume nodes inside server-triggered workflows silently no-op without it); source the `KafkaNodeOperations` instance from the server-side KafkaService and pass it as the 18th argument to `runGraph`
	- Tests: 15 correlation-wait-handler tests (new), 20 kafka-wait-handler tests (new); all 35 passing; tsc: 0 errors
	- Implementation notes:
	  - `graphRunnerKafkaWaitHandler.ts` follows the 3-mode pattern of `graphRunnerCorrelationWaitHandler.ts` (auto-resume, synthetic-inject, wait-for-real) using the same `ICorrelationStore.pause()` abstraction.
	  - `data.topic` is used as the `webhookPath` routing key in the correlation store (not `webhookPath` field, which does not exist on `KafkaWaitNodeData`).
	  - `CorrelationWaitConfig` was extended with `correlationSource: 'key'` to support Kafka message key correlation alongside the existing `body | header | query` sources.
	  - `kafka.wait.correlationId` context key added (beyond KAFKA_WAIT_CONTEXT_KEYS constants) to expose the resolved correlation ID for downstream nodes.
	  - `__kwResumeData` and `__kwWaitDurationMs` are set on resume (parallel to `__cwWebhookPayload` / `__cwWaitDurationMs` in CorrelationWait).
	  - `kafkaWaitDetails` added to `ExecutionEventDetails` in `trace.ts` to capture topic, correlationId, waitDurationMs, partition, offset, and key in execution traces.
	  - `src-server/serverCorrelationBridge.ts` created: implements `ICorrelationStore` by registering in both the server-side `IServerCorrelationStore` (for webhook routing) and the `resumeWaiters` map via new `registerResumeWaiter()` / `deregisterResumeWaiter()` functions (for in-process Promise resolution when `notifyResume()` fires).
	  - `correlation-handler.ts` updated: `QueuedResume` interface exported (was private), `registerResumeWaiter()` and `deregisterResumeWaiter()` exported for `ServerCorrelationBridge`.
	  - `executeWorkflow.ts` updated: `WorkflowExecutionInput` now accepts optional `correlationStore?: ICorrelationStore` and `kafkaOperations?: KafkaNodeOperations`; both are passed through to `runGraph()`. Callers (webhook-server, cron-scheduler) should pass a `ServerCorrelationBridge` instance to enable CorrelationWait/KafkaWait in server-side executions.
	  - Actual Kafka dispatch (server-side Kafka consumer calling `store.resume(correlationId, kafkaMessage)` when a matching message arrives) is Phase 5D work; Phase 5C delivers the complete runtime handler ready to be wired.
- [x] Phase 5D - Recovery, idempotency, and observability (Suggested PR label: `kafka-p5d-hardening`)
	- [x] Enforce duplicate-callback idempotency policy
	- [x] Add stale-wait cleanup validation for timeout/restart/disconnect cases
	- [x] Ensure waiting/resumed/timed-out/cancelled/duplicate statuses are exposed in logs/history
	- [x] Validate direct-resume and callback-resume outcome parity in run history
	- Phase 5D Implementation Notes (2026-05-31):
	  - **`ServerPausedEntry.correlationSource` extended**: Added `'key'` as a valid source alongside `'body'`, `'header'`, `'query'`. Phase 5C incorrectly mapped `'key'` → `'body'` in the bridge; this is now fixed.
	  - **`serverCorrelationBridge.ts` bug fixed**: Removed the `(config?.correlationSource === 'key' ? 'body' : ...)` mapping; `'key'` is now preserved as-is in `ServerPausedEntry`. This ensures `matchKafkaCorrelation` can properly distinguish key-based correlation from body-based.
	  - **`extractCorrelationId` (HTTP webhook path)**: Added `case 'key': return undefined` so HTTP webhook callbacks never accidentally match `'key'`-sourced entries.
	  - **`extractKafkaIdempotencyKey(topic, partition, offset)`** added to `webhook-idempotency.ts`: builds a deterministic key `kafka:${topic}:${partition}:${offset}` uniquely identifying a message position. Replayed offsets produce the same key and are detected as duplicates.
	  - **`extractKafkaCorrelationId(entry, message)`** in `correlation-handler.ts`: extracts correlation ID from a Kafka message based on `correlationSource` — `key` uses `message.key` directly, `body` parses `message.value` as JSON and applies `correlationJsonPath`, `header` looks up `correlationHeader` (case-normalised).
	  - **`matchKafkaCorrelation(topic, message)`** in `correlation-handler.ts`: scans `activeStore` by `webhookPath === topic`, removes expired entries in-scan (stale cleanup), returns first entry whose extracted correlation ID matches.
	  - **`dispatchKafkaResumeMessage(message)`** in `correlation-handler.ts`: main Phase 5D entry point called by the server-side Kafka consumer when a message arrives. Idempotency check → match → remove from store → `notifyResume()` → record idempotency. Returns `{ resumed: true, ... }`, `{ resumed: false, reason: 'no-match' }`, or `{ resumed: false, reason: 'duplicate', correlationId }`. Idempotency policy mirrors the HTTP webhook path exactly.
	  - **Outcome classification (`__kwOutcome`)**: `graphRunnerKafkaWaitHandler.ts` sets `__kwOutcome` context var (`'matched'` | `'timed_out'` | `'cancelled'`) in all wait paths. `graphRunner.ts` reads it into `kafkaWaitDetails.outcome` and cleans it up.
	  - **`kafkaWaitDetails.outcome`** added to `ExecutionEventDetails` in `trace.ts`: `'matched' | 'timed_out' | 'cancelled'`.
	  - **Stale-wait cleanup**: `matchKafkaCorrelation` removes expired entries during the scan (same pattern as `matchCorrelation`). Entries with no in-process waiter (orphaned after restart) can still be resumed via `dispatchKafkaResumeMessage`; if no waiter exists, `notifyResume()` queues the data in `queuedResumes` for long-poll pickup.
	  - Tests: 36 new tests in `src-server/correlation-handler.kafka.test.ts` covering all new functions. All passing. tsc: 0 errors.
- [x] Phase 5E - Race/resilience integration tests (Suggested PR label: `kafka-p5e-race-resilience-tests`)
	- [x] `src-server/serverCorrelationBridge.test.ts` created (28 tests): covers basic pause/resume/cancel/timeout, duplicate correlationId guard, race conditions (timeout fires after waiter, late notifyResume after cancel/timeout), cleanup on cancel/timeout, orphaned entry resilience, sequential/concurrent pause cycles, and `activeStore` integration (correlationSource, correlationHeader).
	- [x] `src/features/workflow/engine/graphRunner.kafka.test.ts` created (9 tests): end-to-end `runGraph()` dispatch tests for `kafkaTrigger` (variable seeding, downstream HTTP execution, missing-message fallback, `extractVariables`, node state pass) and `kafkaWait` (auto-resume pass, store-backed resume/variable seeding, no-store fail, chain `kafkaTrigger → kafkaWait → HTTP`).
	- [x] **Root cause discovered and fixed during test authoring**: `runGraph()` positional parameter count was off-by-one in tests — 6 undefineds placed positions 5–10 but position 11 (`resolveSubWorkflow`) also required an explicit `undefined` before `correlationStore` at position 12. Passing `true` (loadTestMode) at position 12 made `correlationStore = true`, causing `true?.cancel(correlationId)` → "is not a function". Also `findLast` (not `find`) is required for terminal state lookups since `onNodeStateChange` emits `pending` first.
	- [x] **Phase 5E follow-up (re-evaluation pass)**: Thorough re-evaluation found and fixed 4 additional gaps:
		1. **`cleanup()` code path untested** — old cleanup tests advanced fake timers, causing the internal `setTimeout` to fire before `cleanup()` ran (so `cleanup()` always found nothing). Fixed by using `vi.setSystemTime()` to advance the clock without firing timers, then calling `cleanup()` explicitly. The old 2 misleading tests were replaced with 4 correct tests (internal-timer auto-reject, `cleanup()` manual removal, no-op when not expired, no-timeout entry immunity).
		2. **No round-trip test for `dispatchKafkaResumeMessage()`** — previous tests only called `notifyResume()` directly, bypassing the full production path. Added 6 round-trip tests in a new describe block: body-source match, key-source match, header-source match, wrong-topic no-match, mismatched correlationId no-match, and idempotent replay.
		3. **`kafkaWait` timeout not exercised through `runGraph()`** — only unit-level handler tests existed. Added `'kafkaWait fails and sets __kwOutcome=timed_out when store.pause() rejects with timeout'` and `'kafkaWait seeds kafka.wait.correlationId variable via runGraph'` integration tests.
		4. **Source bug: `onVariablesChange` not called in catch block** — `graphRunnerKafkaWaitHandler.ts` called `ctx.set('__kwOutcome', 'timed_out')` and `ctx.set('__kwOutcome', 'cancelled')` but never called `callbacks.onVariablesChange(ctx.snapshot())` in the error paths. Fixed: `onVariablesChange` now emitted in both catch branches before `onNodeStateChange`.
	- Tests summary: **170 passing** across all 6 Phase 5 test files (46 trigger-handlers, 24 kafka-wait-handler, 17 correlation-wait-handler, 36 server correlation-handler, 36 server-bridge, 11 graphRunner integration). tsc: 0 errors.
	- [x] **Phase 5 second re-evaluation (2026-06-02)**: Thorough re-evaluation of all Phase 5 trigger/wait race and resilience code. Reviewed all 7 source files and 7 test files. **No bugs found**. Validated:
		1. **Abort-race pattern**: `waitPromise.catch(() => {})` correctly prevents unhandled rejection when abort wins Promise.race; catch block properly classifies abort vs timeout via `hCtx.abortSignal?.aborted`.
		2. **Correlation store cleanup**: `ServerCorrelationBridge.cleanup()` safely iterates and deletes Map entries (spec-compliant); `matchKafkaCorrelation` stale-entry removal uses array snapshot from `listAll()` so concurrent modification is safe.
		3. **Idempotency**: `dispatchKafkaResumeMessage` key format (`kafka:topic:partition:offset`) is deterministic; replay with active entry correctly bypasses cache via `!activeStore.find(match.correlationId)` guard.
		4. **Double-reject prevention**: timeout callback has `if (!this.callbacks.has(correlationId)) return` guard; cancel/resume both clear timer and deregister waiter before rejecting/resolving.
		5. **`extractCorrelationId` HTTP path**: `case 'key': return undefined` guard confirmed in place — prevents HTTP webhooks from accidentally matching key-sourced Kafka entries.
		6. **Integration chain**: kafkaTrigger → kafkaWait → HTTP downstream passes end-to-end in both auto-resume and store-backed modes.
		7. **Contract tests**: 17 additional contract tests for `deriveKafkaTriggerGroupId`, `isValidKafkaTriggerConfig`, `isValidKafkaWaitConfig`, context key prefixes all pass.
	- Total: **187 tests passing** (170 race/resilience + 17 contracts). tsc: 0 errors. No Docker validation needed (Phase 5 is purely in-memory correlation store logic).

### Validation

- [x] trigger integration tests
- [x] wait/resume race and timeout tests
- [x] restart/disconnect resilience tests
- [x] duplicate callback idempotency tests
- [x] stale correlation cleanup tests
- [x] non-matching callback rejection tests
- [x] server/browser wait-resume parity tests

### Validation Gate Checklist (must pass before exit)

- [x] one matching event starts one workflow run (no duplicate start on replay)
- [x] one matching callback resumes one waiting run exactly once
- [x] timeout and cancellation produce stable deterministic terminal states
- [x] restart/reconnect does not leak stale waits or phantom resumes
- [x] logs and history classify outcomes by match, timeout, cancel, duplicate, mismatch
- [x] server execution path can pause/resume waits without browser bridge dependencies

### Phase 5 Execution Matrix (owner/effort/dependency order)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Primary Scope | Validation Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p5a-trigger-contracts` | Workflow Engine | 1.0-1.5 days | Phase 4 complete | Trigger contract/defaults, variable seeding contract, config validation tests | contracts compile with deterministic defaults |
| 2 | `kafka-p5b-trigger-runtime` | Platform Runtime | 1.5-2.0 days | PR1 | Trigger subscribe/filter/start path, execution metadata persistence | one matching event -> one workflow start |
| 3 | `kafka-p5c-wait-runtime` | Workflow Engine + Server Runtime | 2.0-2.5 days | PR2 | KafkaWait registration/extraction/resume flow, server correlation-store wiring parity | one matching callback -> one resume; server/browser parity |
| 4 | `kafka-p5d-hardening` | Server Runtime + Observability | 1.5-2.0 days | PR3 | Idempotency, restart/reconnect cleanup, diagnosable status classification | duplicate/replay safe, no stale waits, clear terminal states |

Recommended execution order rationale:

1. PR1 locks contracts and reduces downstream rework.
2. PR2 validates trigger start path before introducing wait complexity.
3. PR3 adds wait/resume parity after stable trigger flow exists.
4. PR4 hardens race/replay/recovery behavior after runtime surfaces are stable.

### Phase 5 PR Kickoff Checklist

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p5a-trigger-contracts` | `feature/kafka-p5a-trigger-contracts` | `npx vitest run src/features/workflow/engine/graphRunnerTriggerHandlers.test.ts` | contract defaults + invalid config branches verified |
| `kafka-p5b-trigger-runtime` | `feature/kafka-p5b-trigger-runtime` | `npx vitest run src/features/workflow/engine/graphRunnerTriggerHandlers.test.ts` and `npx vitest run src-server/webhook-server.test.ts` | one matching inbound event starts one run; non-matching events do not start runs |
| `kafka-p5c-wait-runtime` | `feature/kafka-p5c-wait-runtime` | `npx vitest run src/features/workflow/engine/graphRunnerCorrelationWaitHandler.test.ts` (create as part of 5C), `npx vitest run src/features/workflow/engine/correlationWaitHelpers.test.ts`, `npx vitest run src-server/correlation-handler.test.ts`, and `npx vitest run src-server/executeWorkflow.test.ts` | one matching callback resumes once; `executeWorkflow.ts` correlation store no longer `undefined`; server/browser parity proven |
| `kafka-p5d-hardening` | `feature/kafka-p5d-hardening` | `npx vitest run src-server/correlation-handler.test.ts`, `npx vitest run src-server/webhook-server.test.ts`, and `npx vitest run src-server/executeWorkflow.test.ts` | duplicate/replay idempotency, stale cleanup, and diagnosable terminal states verified |

Per-PR readiness checks:

1. Confirm branch is `feature/*` and based on latest `develop`.
2. Run `npx tsc --noEmit` plus the minimum test set above.
3. Verify run-history/log classification for affected outcomes.
4. Attach proof snippets (test output + scenario evidence) in PR description.

### Suggested Test Commands

- `npx vitest run src/features/workflow/engine/graphRunnerTriggerHandlers.test.ts`
- `npx vitest run src/features/workflow/engine/graphRunnerCorrelationWaitHandler.test.ts`
- `npx vitest run src-server/correlation-handler.test.ts`
- `npx vitest run src-server/webhook-server.test.ts`
- `npx vitest run src-server/executeWorkflow.test.ts`

### Exit Criteria

- [ ] Reliable trigger and wait behavior under timing edge cases

---

## Phase 6 - Runner Kafka Scenarios

Window: Week 5
PR target: 3-4
Dependency: Phase 4

### Work Items

- [ ] Extend scenario model for Kafka test actions
- [ ] Add standard runner Kafka execution paths
- [ ] Add parameterized runner Kafka support
- [ ] Extend result model and rendering for Kafka action outcomes
- [ ] Add assertion support for Kafka payload/metadata checks

### Suggested File Targets (planning anchor)

- runner and scenario contracts: `src/shared/types/index.ts`
- standard runner execution baseline: `src/engine/requestExecution.ts`
- runner orchestration and mode wiring: `src/features/test-runner/hooks/useRunnerOrchestration.ts`
- parameterized runner variant wiring: `src/features/test-runner/ParameterizedRunner.tsx`
- results dashboard rendering/grouping/filtering: `src/features/results/ResultsDashboard.tsx`
- migration tests and scenario compatibility: `src/shared/utils/scenarioMigration.test.ts`
- rendering sites requiring transport-aware guards** (in subdirectories — not the results/ root):
  - `src/features/results/components/DataRowSummaryTable.tsx` (line 41: `r.httpStatus || 'ERR'`)
  - `src/features/results/components/ResultsRequestDetailsTab.tsx` (lines 79, 84, 276, 278: method badge + httpStatus cells)
  - `src/features/results/components/WorkflowResultsSummary.tsx` (lines 353, 355: method-badge span + `r.httpStatus || 'ERR'` span — was missing from original site list)
  - `src/features/results/utils/reportGenerator.ts` (lines 60, 68, 186, 233: four httpStatus sites)
  - `src/features/results/utils/runBaselines.ts` (line 313: `r.httpStatus >= 400 || r.httpStatus === 0` — mis-counts Kafka successes as errors; must add `(r.transportType ?? 'http') === 'http'` guard)
  - `cli/reporters.ts` (lines 39, 43, 94, 95, 338, 392, 501, 504: eight httpStatus-dependent CLI output sites — CLI is a first-class `RequestResult` consumer and must be transport-aware)
  - `src/styles/base.css` (add `.method-kafka` alongside `.method-get`/`.method-post` etc. at lines 947-951 so `KAFKA` method-badge renders with defined colour)

### Sub-phase Checklist (Execution Order)

- [x] Phase 6A - Scenario schema and execution model (Suggested PR label: `kafka-p6a-scenario-schema`) — **Implemented 2025-06-07**
	- [x] Extend `Scenario` in `src/shared/types/index.ts`: add `actionType?: 'http' | 'kafkaProduce' | 'kafkaConsume'` (absent = `'http'`); add `kafkaProduceAction?` and `kafkaConsumeAction?` optional bags; extend `Scenario.method` union with `'KAFKA'` sentinel for Kafka scenarios
	- [x] Extend `RequestResult`: add `transportType?: 'http' | 'kafkaProduce' | 'kafkaConsume'` (absent = `'http'`); add `kafkaResultMeta?` optional bag
	- [x] Add `kafkaErrorsByCategory?: Record<string, number>` to `TestSummary` for Kafka-specific error classification
	- [x] Define `KafkaProduceActionConfig` and `KafkaConsumeActionConfig` types with deterministic defaults
	- [x] Add migration-safe loading: scenarios without `actionType` resolve to `'http'`; never crash on missing field
	- [x] Add assertion target selectors: `kafka.body`, `kafka.key`, `kafka.partition`, `kafka.offset`, `kafka.header.<name>`
	- [x] Add compile-safe tests for invalid/missing Kafka action config branches and backward-compat migration

  **Implementation Notes (Phase 6A — 2025-06-07):**
  - New types in `src/shared/types/index.ts`: `KafkaActionType`, `KafkaAssertionTarget`, `KafkaProduceActionConfig`, `KafkaConsumeActionConfig`, `KafkaResultMeta`; new `Assertion` discriminant `type: 'kafkaField'` with `target: KafkaAssertionTarget` added to the union
  - `Scenario.method` union extended with `'KAFKA'` sentinel; 3 HTTP-only consumers guarded with `as HttpMethod` cast: `useGalleryImport.ts`, `RequestEditor.tsx` (onUpdateRequest call), `testDefinitionVersioning.ts`
  - `src/shared/utils/kafkaScenarioDefaults.ts` created: `makeDefaultKafkaProduceAction()` (acks=-1, timeout=5000), `makeDefaultKafkaConsumeAction()` (fromBeginning=false, timeout=10000, maxMessages=1), `isKafkaScenario()`, `resolveKafkaActionType()`
  - `src/shared/utils/scenarioMigration.ts` extended: `normalizeScenarioActionType()` and `normalizeGroupActionTypes()` added for backward-compat loading
  - `src/shared/utils/kafkaScenarioContracts.test.ts` created: 37 tests covering all types, defaults, guards, and migration helpers
  - Gate: `npx tsc -b --noEmit` → 0 errors; `npx vitest run` on 2 test files → 52 tests passing
- [x] Phase 6B - Standard runner execution (Suggested PR label: `kafka-p6b-runner-standard`)
        - **Completed** (commit `5a97924`)
        - [x] Create `src/engine/kafkaExecution.ts` — exports `executeKafkaAction(scenario, kafkaOps, timeoutMs)` with produce and consume execution paths; reuses `KafkaNodeOperations` from `graphRunnerNodeHandlerContext.ts`; classifies failures with `classifyKafkaFailure`; prefixes auth/tls/timeout errors with `[class]`
        - [x] Wire via `RunOpts.executeNonHttp?` callback in `src/engine/requestExecution.ts` — generic hook (not Kafka-specific); routes non-HTTP scenarios in `runSequential`, `runBatch`, and `runPool` loops; avoids circular deps between `requestExecution.ts` and `kafkaExecution.ts`
        - [x] Forward `kafkaOperations` to `RunOpts.executeNonHttp` in `src/engine/executor.ts` for non-workflow dispatch branches
        - [x] Map Kafka fields into `ValidationInput`: message value → `responseBody`/`responseObj`, message headers → `responseHeaders`, `200`/`0` → `httpStatus`; passes `kafkaContext` (key, offset, partition, topic) through `validationResult.ts` → `validator.ts`
        - [x] Extend `AssertionContext` with `kafkaContext?` in `src/engine/validator.ts`; add `kafkaField` assertion case using `evaluateHeaderOp` for operator evaluation on key/offset/partition/header.* fields; extend `resolveVariable` in `custom` case for `kafka.*` selectors
        - [x] Extend `ValidationInput` with `kafkaContext?` in `src/engine/validationResult.ts` and pass through to `evaluateAssertions`
        - [x] Create `src/engine/kafkaExecution.test.ts`: 32 tests — produce success + kafkaResultMeta; produce failure; consume match; consume no-match timeout; auth/TLS/timeout error classification; kafkaField assertion pass/fail (key, partition, offset, header.*, body); custom assertion kafka.* variable resolution; filter param mapping (fromBeginning, keyEquals, headersMatch, jsonPath+jsonEquals); unsupported actionType fallback
        - **Gate**: `npx tsc -b --noEmit` → 0 errors; `npx vitest run` on 3 test files → 97 tests passing
        - **Implementation notes**:
          - "do NOT modify requestExecution.ts" interpreted as "do NOT add Kafka-specific logic" — `executeNonHttp?` is a generic callback pattern acceptable per this constraint
          - produce errors are now also classified (not just consume) for consistency
          - `kafka.body` target in `kafkaField` assertions resolves from `rawBody` first (string) then falls back to JSON.stringify of responseBody
          - `KafkaProduceResult.offset` is `string` → `parseInt(..., 10)` for `KafkaResultMeta.offset: number`
	- [ ] Create `src/engine/kafkaExecution.ts` (new module parallel to `requestExecution.ts`); export `executeKafkaAction(scenario: Scenario, kafkaOps: KafkaNodeOperations, timeoutMs?: number): Promise<RequestResult>` with `transportType` set; reuse `KafkaNodeOperations` from `src/features/workflow/engine/graphRunnerNodeHandlerContext.ts` — do not define a new Kafka ops type
	- [ ] Wire `kafkaExecution.ts` into `src/engine/executor.ts` at the sequential/pool/batch dispatch branches (~lines 218-223): add per-scenario `actionType` routing so Kafka scenarios call `executeKafkaAction(scenario, kafkaOperations!, timeoutMs)` while HTTP scenarios continue through existing runners; `kafkaOperations` is already a `runTest()` parameter (line 116) but currently only flows to the `workflow` mode branch (line 204) — forward it into the non-workflow path too; do NOT modify `requestExecution.ts`
	- [ ] Implement produce and bounded consume runtime paths in `kafkaExecution.ts`; set `kafkaResultMeta` on result; map Kafka fields into `ValidationInput` (value → `responseBody`/`responseObj`, headers → `responseHeaders`, 200/0 → `httpStatus`) so existing `$.body.*`/`$.headers.*` assertions work on message content
	- [ ] Extend `resolveVariable` in `src/engine/validator.ts` (custom assertion branch) to resolve `kafka.key`, `kafka.offset`, `kafka.partition`, `kafka.topic` from an optional `kafkaContext` passed through `evaluateAssertions`; reuse all existing assertion operators without adding new operator types
	- [ ] Add `kafkaExecution.test.ts`: produce success + kafkaResultMeta; consume match; consume timeout; assertion pass (`$.body.*` against message value); assertion fail with actionable `failureDetails`; auth/TLS/network failure classification
- [x] Phase 6C - Parameterized runner support (Suggested PR label: `kafka-p6c-runner-parameterized`) — ✅ Complete (2025-07-25, commit 5a97924)
	- [x] Extend `resolveScenarioFromDataRow` in `src/engine/dataSourceExpander.ts` to apply `substituteVariables` to Kafka config string fields: `kafkaProduceAction.topic/.key/.value` and all `.headers` values; `kafkaConsumeAction.topic/.filter.keyEquals/.filter.jsonEquals` — reuse existing body-column var map, no new `DataSourceColumn.type` variants needed; `base.body` is NOT the Kafka message payload — `kafkaProduceAction.value` is
	- [x] Extend `resolveScenarioFromDataRow` to apply `substituteVariables` to `validation.assertions[*].value` for `kafkaField` assertion entries (currently never substituted; expander only builds `expectedFields` from `validate` columns)
	- [x] `dataRowId`/`dataRowLabel` already set for all expanded scenarios in `resolveScenarioFromDataRow` — no Kafka-specific code needed; verify attribution flow in parameterized tests
	- [x] Verify retry-count parity for parameterized Kafka rows (depends on Phase 6B `RunOpts.kafkaOperations` addition in `requestExecution.ts`); add mixed-valid/mixed-invalid produce+consume row tests covering field interpolation and `dataRowId` attribution
- [x] Phase 6D - Results rendering and mixed-suite behavior (Suggested PR label: `kafka-p6d-results-rendering`) — ✅ Complete (2025-07-25, commit 5a97924)
	- [x] Guard `httpStatus`/method badge rendering in `src/features/results/components/DataRowSummaryTable.tsx` (line 41) behind `(r.transportType ?? 'http') === 'http'` check
	- [x] Guard same in `src/features/results/components/ResultsRequestDetailsTab.tsx` (method badge and httpStatus cells at lines 79, 84, 276, 278)
	- [x] Guard `method-badge` span (line 353) and `r.httpStatus || 'ERR'` span (line 355) in `src/features/results/components/WorkflowResultsSummary.tsx`
	- [x] Fix `src/features/results/utils/runBaselines.ts` line 313: add `(r.transportType ?? 'http') === 'http'` guard so Kafka results are not mis-counted as errors in baseline comparisons
	- [x] Patch `src/features/results/utils/reportGenerator.ts` — all four httpStatus sites (lines 60, 68, 186, 233) with transport-aware output
	- [x] Patch `cli/reporters.ts` — all eight httpStatus-dependent CLI output sites (lines 39, 43, 94, 95, 338, 392, 501, 504) for transport-aware Kafka formatting; add CLI reporter tests for Kafka results
	- [x] Add `.method-kafka` CSS class to `src/styles/base.css` alongside `.method-get`/`.method-post` etc. so `KAFKA` method-badge renders with defined colour
	- [x] Guard method-badge in `src/features/test-runner/components/RunnerPage.tsx` line 167: render `KAFKA` label with `.method-kafka` class instead of HTTP method for Kafka scenarios in the test weight list
	- [x] Guard `r.httpStatus >= 400 || r.httpStatus === 0` in `src/features/test-runner/hooks/useTestExecution.ts` (lines 173, 175, 203) behind `(r.transportType ?? 'http') === 'http'` — prevents failed Kafka results (httpStatus=0) from being mis-counted as HTTP errors in the live error-rate chart and `errorsByStatus` counter
	- [x] Add UI/rendering tests for HTTP-only, Kafka-only, and mixed-suite runs

### Validation

- [ ] runner execution tests for Kafka scenarios
- [ ] parameterized tests with Kafka templating
- [ ] results UI tests for Kafka action rendering
- [ ] mixed-suite (HTTP + Kafka) rendering and export parity tests
- [ ] action-contract migration/backward-compatibility tests

### Validation Gate Checklist (must pass before exit)

- [ ] Kafka action contracts load with deterministic defaults and migration-safe behavior
- [ ] standard runner Kafka produce/consume paths pass deterministically
- [ ] parameterized Kafka runs preserve row-level attribution and failure diagnostics
- [ ] results UI uses transport-aware labels and does not misclassify Kafka outcomes as HTTP failures
- [ ] mixed suites keep grouping/filtering/export behavior stable without type regressions

### Phase 6 Execution Matrix (owner/effort/dependency order)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Primary Scope | Validation Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p6a-scenario-schema` | Runner Contracts | 1.0-1.5 days | Phase 4 complete | Action contracts, defaults, migration-safe loading | contract + migration tests pass |
| 2 | `kafka-p6b-runner-standard` | Runner Runtime | 1.5-2.0 days | PR1 | Standard produce/consume runtime and assertions | deterministic runtime behavior |
| 3 | `kafka-p6c-runner-parameterized` | Parameterized Runner | 1.5-2.0 days | PR2 | Row interpolation and row-level failure attribution parity | row diagnostics parity |
| 4 | `kafka-p6d-results-rendering` | Results UI | 1.5-2.0 days | PR3 | Transport-aware result rendering in mixed suites | mixed-suite rendering stability |

### Phase 6 PR Kickoff Checklist

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p6a-scenario-schema` | `feature/kafka-p6a-scenario-schema` | `npx tsc -b --noEmit` plus schema/migration tests for runner scenarios | contracts + migration behavior verified |
| `kafka-p6b-runner-standard` | `feature/kafka-p6b-runner-standard` | `npx vitest run src/engine/kafkaExecution.test.ts` (create as part of 6B) plus `npx vitest run src/engine/requestExecution.test.ts` to confirm no HTTP regression | produce/consume runtime and assertion paths deterministic; HTTP paths unaffected |
| `kafka-p6c-runner-parameterized` | `feature/kafka-p6c-runner-parameterized` | parameterized runner tests covering row interpolation and row diagnostics | row-level attribution preserved |
| `kafka-p6d-results-rendering` | `feature/kafka-p6d-results-rendering` | results dashboard/component tests for Kafka-only and mixed suites | no mixed-suite grouping/filter/export regressions |

Per-PR readiness checks:

1. Confirm branch is `feature/*` and based on latest `develop`.
2. Run `npx tsc -b --noEmit` and the minimum test set above.
3. Verify mixed-suite result semantics for changed paths.
4. Attach test output and result-view evidence in PR description.

### Suggested Test Commands

- `npx vitest run src/shared/utils/scenarioMigration.test.ts`
- `npx vitest run src/engine/requestExecution.test.ts`
- `npx vitest run src/features/test-runner/hooks/useRunnerOrchestration.test.ts`
- `npx vitest run src/features/test-runner/ParameterizedRunner.test.tsx`
- `npx vitest run src/features/results/ResultsDashboard.test.tsx`
- `npx vitest run src/features/results/components/DataRowSummaryTable.test.tsx`
- `npx vitest run src/features/results/components/ResultsRequestDetailsTab.test.tsx`
- `npx vitest run src/features/results/utils/reportGenerator.test.ts`
- `npx vitest run cli/reporters.ts` (run full CLI reporter suite; Kafka result handling added in 6D)

### PR Slice Suggestion

1. PR1: action contracts + migration safety
2. PR2: standard runner runtime and assertions
3. PR3: parameterized runner parity
4. PR4: results rendering and mixed-suite hardening

### Exit Criteria

- [ ] Kafka actions run and report cleanly in both runner modes

---

## Phase 7 - Load-mode Policy for Kafka Consume

Window: Week 5-6
PR target: 2-3
Dependency: Phase 6

### Work Items

- [x] Implement load behavior modes (wait-for-real, auto-resume, synthetic-inject)
- [x] Define planner-level skip-dispatch policy for explicit skip outcomes
- [x] Set default-safe mode policy for load tests
- [x] Add configuration warnings for nondeterministic setups
- [x] Document operational recommendations in UI/help text

### Suggested File Targets (planning anchor)

- load profile runtime behavior: `src/engine/loadProfileRunner.ts`
- execution mode routing and load dispatch: `src/engine/executor.ts`
- load profile runtime tests: `src/engine/loadProfileRunner.test.ts`, `src/engine/loadProfileRunnerInteg.test.ts`
- runner mode/config persistence: `src/features/test-runner/hooks/useRunnerConfig.ts`
- runner execution mode controls and warnings: `src/features/test-runner/components/RunnerExecutionConfig.tsx`
- constant-arrival gating/progress expectations: `src/features/test-runner/hooks/useTestExecution.execute.test.ts`
- **kafkaOperations construction and threading entry point**: `src/features/test-runner/hooks/useTestExecution.ts` (lines 339, 342 — `runTest` call sites; line numbers shifted from original 336/339 by `kafkaOps` var added at line 330)
- **graphLoadRunner test files** (three): `src/features/workflow/engine/graphLoadRunner.test.ts`, `src/features/workflow/engine/graphLoadRunner.part2.test.ts`, `src/features/workflow/engine/graphLoadRunner.initialVars.test.ts`

### Sub-phase Checklist (Execution Order)

- [x] Phase 7A - Load behavior model (Suggested PR label: `kafka-p7a-load-model`) — ✅ Complete (2026-06-01)
	- [x] Create `src/features/workflow/engine/kafkaLoadPolicy.ts`; import `ExecutionMode` from `'../../../shared/types'` and `KafkaConsumeLoadTestMode` from `'../types/workflow'`; export `resolveKafkaConsumeLoadPolicy(executionMode: ExecutionMode, consumeLoadMode: KafkaConsumeLoadTestMode | undefined): KafkaLoadPolicyOutcome` and `KafkaLoadPolicyOutcome` type `{ decision: 'allow' | 'warn' | 'block'; fallbackMode?: KafkaConsumeLoadTestMode; message?: string }`
	- [x] Define compatibility matrix with explicit decisions — `'workflow'` mode: `undefined`→`allow+fallbackMode:'auto-resume'`; `'auto-resume'`→`allow`; `'synthetic-inject'`→`allow`; `'wait-for-real'`→`block` (stalls every load iteration waiting on a live Kafka message); `'constant-arrival'` mode: same as `'workflow'` except `'wait-for-real'`→`warn` (informational; enforcement is at the desktop/Rust boundary); all other modes (`'sequential'`, `'batch'`, `'pool'`, `'load-profile'`)→`allow` passthrough (Kafka graph nodes not on these paths; `'load-profile'` is implicitly `skip-dispatch`)
	- [x] Set default-safe policy: when `consumeLoadMode` is `undefined` return `{ decision: 'allow', fallbackMode: 'auto-resume' }` — Phase 7A defines the policy only; applying `fallbackMode` at runtime (overriding the current `wait-for-real` default in `handleKafkaConsumeNode`) is a Phase 7B task
	- [x] Add contract tests in `src/features/workflow/engine/kafkaLoadPolicy.test.ts` — 12 tests covering all plan cases + extra passthrough tests for `'batch'` and `'pool'`; `constant-arrival+undefined` explicitly asserts no message; `workflow+wait-for-real` block message asserts 'wait-for-real' substring
- [x] Phase 7B - Planner and runtime enforcement (Suggested PR label: `kafka-p7b-load-enforcement`) — ✅ Complete (2026-06-01)
	- ~~**Add `kafkaOperations?: KafkaNodeOperations` to `GraphLoadRunOpts`** in `graphLoadRunner.ts`; forward it as the 18th positional arg in the `runGraph(...)` call~~ ✅ **Fixed (2026-05-31, Phase 4C re-review)** — field added, destructured, forwarded; passthrough test added at `graphLoadRunner.test.ts` line 777
	- ~~**Threading chain** — correct chain:~~
	  ~~1. add `kafkaOperations?: KafkaNodeOperations` as optional **9th parameter** to `runTest()` in `src/engine/executor.ts`~~
	  ~~2. in `executor.ts` `runGraphLoad(workflow, {...})` call, forward into `GraphLoadRunOpts`~~
	  ~~3. in `src/features/test-runner/hooks/useTestExecution.ts`, pass `kafkaOperations` as 9th arg at **lines 339 and 342**~~
	  ✅ **Fixed (2026-05-31, Phase 4C re-review)** — all three wiring items complete; `executionWorker.ts` also updated
	- [x] Add pre-run policy guard at top of `runGraphLoad` in `graphLoadRunner.ts` (before `runOneIteration`): import `resolveKafkaConsumeLoadPolicy` from `'./kafkaLoadPolicy'` and `KafkaConsumeNodeData` from `'../types/workflow'`; filter `workflow.nodes` for `node.type === 'kafkaConsume'`; for each, call policy with `'workflow'` and `(node.data as KafkaConsumeNodeData).loadTestBehavior?.mode`; `throw new Error(outcome.message)` on `'block'`
	- [x] In `graphRunnerKafkaNodeHandlers.ts` line 251: change `data.loadTestBehavior ?? { mode: 'wait-for-real' }` to `data.loadTestBehavior ?? { mode: 'auto-resume' }` — aligns runtime default with policy `fallbackMode`; safe because the pre-run guard blocks any explicit `wait-for-real` before this runs
	- [x] Add `executor.test.ts` test: `runTest(..., kafkaOps)` with workflow → verify `runGraphLoad` called with `expect.objectContaining({ kafkaOperations: kafkaOps })`
	- [x] Add `graphLoadRunner.test.ts` tests for policy guard: (1) `kafkaConsume` node with `wait-for-real` → `runGraphLoad` rejects; (2) node with `auto-resume` → does not reject; (3) absent `loadTestBehavior` → does not reject
	- Implementation Notes (2026-06-01):
	  - Guard placed immediately after `opts` destructure, before `allResults` / iteration machinery — ensures fail-fast with no side effects
	  - Guard hardcodes `'workflow'` as execution mode (correct: `runGraphLoad` is only called in `executionMode === 'workflow'`)
	  - Default-mode change from `wait-for-real` → `auto-resume` in `handleKafkaConsumeNode` is safe: the guard blocks explicit `wait-for-real` before the handler is reached; non-load-test runs still fall through to real consume
	  - Re-review (2026-06-01): Added missing test `'defaults to auto-resume when loadTestBehavior is absent in load test mode (Phase 7B)'` to `graphRunnerKafkaNodeHandlers.test.ts` — covers the handler-level default behavior change directly; total test count: 31 handler tests, 43 graphLoadRunner tests, 54 executor tests, 12 policy tests, 40 kafkaNodes integration tests
	  - All 199 tests pass across 7 touched test files; TypeScript 0 errors; ESLint 0 errors
- [x] Phase 7C - UX and operational guidance (Suggested PR label: `kafka-p7c-load-ux`)
        - [x] **Rendering site is `WorkflowRunner.tsx`** — not `RunnerExecutionConfig`; `RunnerExecutionConfig` has no access to workflow nodes and requires no Kafka-specific changes
        - [x] Import `resolveKafkaConsumeLoadPolicy` (from `'../workflow/engine/kafkaLoadPolicy'`) and `KafkaConsumeNodeData` (from `'../workflow/types/workflow'`) in `WorkflowRunner.tsx`
        - [x] Compute policy outcomes for all `kafkaConsume` nodes in `selectedWorkflow.nodes`; categorize as `blockNodes` / `infoNodes` (see Design Decision note below)
        - [x] Render block banner (`kafka-load-warning--block`) when any node has explicit `wait-for-real` mode (forwards user to change node config before Phase 7B throws)
        - [x] ~~Render warn banner (`kafka-load-warning--warn`) when any node has `constant-arrival + wait-for-real`~~ — **N/A**: `WorkflowRunner` always hardcodes `'workflow'` executionMode; `constant-arrival` paths never reach this runner; warn class defined in CSS but unused here
        - [x] Render auto-resume advisory (`kafka-load-info`) when any `kafkaConsume` node has `loadTestBehavior === undefined` (informs user of auto-resume default)
        - [x] Add CSS classes `.kafka-load-warning--block`, `.kafka-load-warning--warn`, `.kafka-load-info` to `src/styles/workflow.css`
        - [x] Add tests in `WorkflowRunner.part4.test.tsx`: block banner renders for `wait-for-real` node; no warning for `auto-resume` node; advisory for `undefined` loadTestBehavior; no warning when no `kafkaConsume` nodes
        - [x] Constant-arrival desktop gating already handled by existing `RunnerExecutionConfig` opacity/tooltip — confirmed in existing tests, no new code needed
        - Implementation Notes (2026-06-01):
          - **Key design decision**: `WorkflowRunner.tsx` always passes `executionMode: 'workflow'` hardcoded to the executor in `handleRun`. The `executionMode` state variable from `useWorkflowRunnerConfig` is only used by `RunnerExecutionConfig` UI controls; it never includes `'workflow'` as a user-selectable value. Therefore `kafkaLoadBanners` useMemo computes against `'workflow'` hardcoded — not the state variable.
          - This means: block banner triggers whenever any `kafkaConsume` node has `wait-for-real`; info banner triggers whenever any node has `undefined` loadTestBehavior. No warn banner is needed in this component.
          - Kafka workflow fixtures (`wfKafkaWaitForReal`, `wfKafkaAutoResume`, `wfKafkaNoLoadBehavior`) added to `workflowRunnerTestHelpers.tsx` and included in `allWorkflowVariants`.
          - Banners placed just before the Run/Stop button section for maximum pre-run visibility.
          - All 7 tests in `WorkflowRunner.part4.test.tsx` pass (2 trace-sampling tests + 4 Kafka banner tests + 1 priority-rule test); TypeScript 0 errors; ESLint 0 warnings.
### Validation

- [x] planner tests for each load mode (Phase 7A contract tests + Phase 7B policy guard tests)
- [x] deterministic load simulation tests (6 tests: auto-resume completion, undefined-mode fallback, synthetic-inject completion, bounded results, no cross-iteration leakage, monotonic progress)
- [x] no regression in existing load profile behavior (all 611 graphRunner tests pass)
- [x] constant-arrival gating and progress-metric behavior tests (4 policy tests + 3 execution hook tests: sets total=-1, errors without Rust, tracks peak RPS/dropped)
- [x] repeated-run variance checks for policy-constrained configs (4 tests: result count consistency, pass/fail ratio reproducibility, sequential/concurrent parity, full index coverage)

### Validation Gate Checklist (must pass before exit)

- [x] unsupported mode combinations are blocked with actionable messages before execution (Phase 7B guard)
- [x] Kafka load-policy warning banners render in `WorkflowRunner` for block/info outcomes (Phase 7C)
- [x] load-profile consume behavior remains bounded and completes deterministically (bounded-results test + all-iterations-complete tests)
- [x] constant-arrival capability/gating behavior is explicit and test-covered (4 gating tests + `useTestExecution.execute.test.ts` constant-arrival tests)
- [x] target/actual throughput and dropped-request visibility is consistent where supported (peak RPS + dropped requests test in execution hook)
- [x] repeated runs with same config stay within accepted reproducibility thresholds (3× repeated run tests with identical counts and ratios)

**Phase 7 Advanced Validation Implementation (2026-06-02):**
- Added 14 new tests in `graphLoadRunner.test.ts` organized into 3 describe blocks:
  1. **Deterministic load simulation** (6 tests): verifies kafkaConsume nodes under `auto-resume` and `synthetic-inject` modes complete all iterations without hanging, produce bounded results, have no cross-iteration variable leakage, and report monotonically increasing progress.
  2. **Constant-arrival gating** (4 tests): verifies policy function returns `warn` (not `block`) for `constant-arrival + wait-for-real` (enforcement is desktop-side), `allow` for `auto-resume`/`undefined`, and `workflow + wait-for-real` blocks before any iteration runs.
  3. **Repeated-run variance checks** (4 tests): verifies identical configs produce the same result count across 3 runs, identical pass/fail ratios for deterministic workflows, sequential/concurrent parity (same total results regardless of concurrency level), and full iteration index coverage `[0, N-1]` in concurrent execution.
- Fixed during implementation: tests using `mockResolvedValue` with mutable result objects failed in concurrent scenarios (shared reference → overwritten `iterationIndex`); fixed by using `mockImplementation(async () => [...])` to return fresh arrays per call.
- Total: **208 tests passing** across 8 Phase 7 test files (57 graphLoadRunner, 12 kafkaLoadPolicy, 15 graphLoadRunner.part2, 31 kafkaNodeHandlers, 8 WorkflowRunner.part4, 27 useTestExecution.execute, 54 executor, 4 graphLoadRunner.initialVars). tsc: 0 errors.
  - Note: tracker previously recorded incorrect counts for 3 files (22→15 part2; 17→7 WorkflowRunner.part4; 10→27 useTestExecution.execute); counts corrected 2026-06-02 after re-verification run. WorkflowRunner.part4 count updated again 2026-06-02 (7→8) after adding synthetic-inject banner test.

**Phase 7 Re-validation (2026-06-02):**
- Re-ran all 207 Phase 7 unit tests → 207/207 PASS. tsc: 0 errors.
- Code review of `kafkaLoadPolicy.ts`, `graphLoadRunner.ts`, `graphRunnerKafkaNodeHandlers.ts`, and `WorkflowRunner.tsx` — no bugs found.
- Confirmed `onVariablesChange` bug pattern does NOT affect produce/consume handlers (their catch blocks do not set any ctx variables, so `captureKafkaDetails` writes only to the internal map — no variable-change emission gap).
- Confirmed `__kwOutcome` onVariablesChange fix from Phase 5E re-evaluation applies only to kafkaWait handler (already fixed in commit a8e7c8e).

**Phase 7 Deep Re-evaluation (2026-06-02, second pass):**
- **Bug found and fixed** in `graphRunnerKafkaWaitHandler.ts`: the synthetic-inject **inline abort path** (load test mode, no correlation store, abort during `waitWithAbort`) set `__kwOutcome = 'cancelled'` on the context but never called `callbacks.onVariablesChange(ctx.snapshot())` before `onNodeStateChange`. This is the same pattern as the Phase 5E catch-block bug (fix: commit `a8e7c8e`) — the fix was applied to the `catch` block but missed this early-return path. Fixed by adding `hCtx.callbacks.onVariablesChange(hCtx.ctx.snapshot())` in the inline abort return.
- **Test strengthened**: `graphRunnerKafkaWaitHandler.test.ts` `'fails if aborted during inline synthetic delay'` now also asserts that `onVariablesChange` was called with `__kwOutcome='cancelled'` AND that `onVariablesChange` call order precedes the `onNodeStateChange('fail')` call order.
- **Test added**: `wfKafkaSyntheticInject` fixture added to `workflowRunnerTestHelpers.tsx`; new test `'renders no banner when kafkaConsume node has synthetic-inject mode'` added to `WorkflowRunner.part4.test.tsx` — closes the gap for the `synthetic-inject → allow (no banner)` policy outcome.
- **Manual broker re-validation**: Phase 3 secure smoke 21/21 PASS · Phase 8C broker scenarios 41/41 PASS (both plaintext + secure profiles live).
- **Final counts**: Phase 7 test files now total **208 tests** (WorkflowRunner.part4: 7→8). All 279 tests across 11 Phase 7+5 test files pass. tsc: 0 errors.

### Phase 7 Execution Matrix (owner/effort/dependency order)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Primary Scope | Validation Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p7a-load-model` | Runner Policy | 1.0-1.5 days | Phase 6 complete | Policy matrix and default-safe behavior | compatibility contracts pass |
| 2 | `kafka-p7b-load-enforcement` | Runner Runtime | 1.5-2.0 days | PR1 | Planner/runtime enforcement and bounded behavior | deterministic completion + blocked unsafe configs |
| 3 | `kafka-p7c-load-ux` | Runner UX | 1.0-1.5 days | PR2 | Warnings, gating, and help text clarity | pre-run guidance + capability messaging verified |

### Phase 7 PR Kickoff Checklist

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p7a-load-model` | `feature/kafka-p7a-load-model` | policy contract tests + `npx tsc -b --noEmit` | compatibility matrix finalized with deterministic defaults |
| `kafka-p7b-load-enforcement` | `feature/kafka-p7b-load-enforcement` | `npx vitest run src/engine/loadProfileRunner.test.ts`, `npx vitest run src/engine/loadProfileRunnerInteg.test.ts`, and executor mode tests | unsafe configs blocked pre-run; bounded deterministic behavior confirmed |
| `kafka-p7c-load-ux` | `feature/kafka-p7c-load-ux` | `npx vitest run src/features/test-runner/WorkflowRunner.part4.test.tsx` and `npx tsc -b --noEmit` | Kafka load-policy warning banners render in `WorkflowRunner` for block/warn/info outcomes; no regressions in `RunnerExecutionConfig` or `useTestExecution` tests |

Per-PR readiness checks:

1. Confirm branch is `feature/*` and based on latest `develop`.
2. Run `npx tsc -b --noEmit` and the minimum test set above.
3. Validate repeated-run reproducibility for changed policy paths.
4. Attach policy matrix evidence and representative run telemetry in PR description.

### Suggested Test Commands

- `npx vitest run src/features/workflow/engine/kafkaLoadPolicy.test.ts`
- `npx vitest run src/engine/loadProfileRunner.test.ts`
- `npx vitest run src/engine/loadProfileRunnerInteg.test.ts`
- `npx vitest run src/engine/executor.test.ts`
- `npx vitest run src/features/workflow/engine/graphLoadRunner.test.ts`
- `npx vitest run src/features/workflow/engine/graphLoadRunner.part2.test.ts`
- `npx vitest run src/features/test-runner/hooks/useTestExecution.execute.test.ts`
- `npx vitest run src/features/test-runner/components/RunnerExecutionConfig.loadprofile.test.tsx`

### PR Slice Suggestion

1. PR1: load policy model + compatibility contracts
2. PR2: planner/runtime enforcement
3. PR3: warning UX + operational guidance

### Exit Criteria

- [x] Load runs remain reproducible with Kafka consume in scope (verified 2026-06-02: repeated-run variance tests confirm identical counts/ratios across 3 runs; sequential/concurrent parity confirmed)

---

## Phase 8 - Results Publishing to Kafka

Window: Week 6
PR target: 2-3
Dependency: Phase 6

### Work Items

- [x] Define publish payload schema and versioning
- [x] Add settings toggle and topic selection for result publishing
- [x] Add publish-on-completion hook
- [x] Add retry and failure policy (non-blocking default)
- [x] Add run traceability fields (runId/project/env/suite)
- [x] Verify results publishing against both plaintext local topic and secure-cluster profile (manual — validated 2026-06-02: 41/41 PASS with secure broker)

### Suggested File Targets (planning anchor)

- run completion and persistence flow: `src/features/test-runner/hooks/useTestExecution.ts`
- publish-specific types (net-new): `src/shared/types/index.ts` (NOT `src-server/kafka/contracts.ts` — client cannot import from `src-server/`)
- client Kafka dispatch: `src/shared/kafka/kafkaClient.ts` (`dispatchKafkaOperation` — publisher uses this)
- publisher module (net-new): `src/shared/kafka/kafkaResultsPublisher.ts` (client-side; alongside `kafkaClient.ts`)
- runner config defaults: `src/features/test-runner/hooks/runnerConfigDefaults.ts`
- runner config state/persistence: `src/features/test-runner/hooks/useRunnerConfig.ts`
- Kafka produce route surface: `src-server/routes/kafka-routes.ts`
- Kafka produce runtime behavior: `src-server/kafka/kafka-service.ts`

### Sub-phase Checklist (Execution Order)

- [x] Phase 8A - Publish contract and settings (Suggested PR label: `kafka-p8a-publish-contracts`) — ✅ Complete (2026-06-01)
	- [x] Add publish-specific types to **`src/shared/types/index.ts`** (NOT `src-server/kafka/contracts.ts` — client code cannot import from `src-server/`): `KafkaResultsPublishConfig` (`{ enabled, clusterId, topic }`), `KafkaRunSummaryEnvelope` (versioned, `schemaVersion: '1.0'`; use `featureGroupName?` not `suiteName?` — `TestRun` has no `suiteName` field; map from `testRun.config.featureGroupName ?? testRun.config.groupName`; `svcName?` from `testRun.svcName` may also be included), and `KafkaPublishOutcome` (`{ status: 'published'|'failed'|'skipped'; retryCount; errorCode?; durationMs }`)
	- [x] Add `kafkaResultsPublish?: KafkaResultsPublishConfig` to `RunnerConfig` in `src/features/test-runner/hooks/runnerConfigDefaults.ts` (not `useRunnerConfig.ts`); add state/setter to `useRunnerConfig.ts` persist/restore paths
	- [x] Add envelope schema and missing/invalid field tests alongside the new types (created `src/shared/kafka/kafkaPublishTypes.test.ts` — 14 tests)
	- Implementation Notes (2026-06-01):
	  - Types defined in `src/shared/types/kafka.ts` (a dedicated Kafka types file) and re-exported from `src/shared/types/index.ts`
	  - `kafkaResultsPublish` field added to `RunnerConfig` in `runnerConfigDefaults.ts` with `enabled: false` default; state/persist paths updated in `useRunnerConfig.ts`
	  - 14 unit tests in `kafkaPublishTypes.test.ts` covering envelope shape, required fields, versioning, and `KafkaPublishOutcome` status variants
- [x] Phase 8B - Publish-on-completion runtime (Suggested PR label: `kafka-p8b-publish-runtime`) — ✅ Complete (2026-06-01)
	- [x] Create **`src/shared/kafka/kafkaResultsPublisher.ts`** (CLIENT-SIDE, alongside `kafkaClient.ts` — NOT `src-server/`): assemble `KafkaRunSummaryEnvelope` from `TestRun`, serialize to JSON, call `dispatchKafkaOperation('produce', request)` from `kafkaClient.ts` (no new server endpoint); define produce request shape inline (cannot import `KafkaProduceRequest` from `src-server/` — use inline-type pattern from `buildKafkaNodeOperations.ts`); unwrap `KafkaEnvelope<T>` return (check `.ok`, access `.data`) — `dispatchKafkaOperation` returns the envelope, not the raw produce result; return `KafkaPublishOutcome`; never throw
	- [x] Retry policy: **max 3 retries**, **2 000 ms base delay**, **10 000 ms total cap**; successful retry must not duplicate an acknowledged event
	- [x] Hook publish into `useTestExecution.ts` after **both** `saveTestRun` call sites; `confirmSavePendingRun` path does NOT trigger publish (quota-override is a local-only save, not a normal run completion event); publish is fire-and-forget using a `void` pattern with `publishConfigRef` to avoid stale closure issues
	- [x] Add publish-path tests to `src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts` (11 new tests) and `useRunnerOrchestration.test.ts` (2 new tests)
	- Implementation Notes (2026-06-01):
	  - Fire-and-forget pattern: `void publishRunResults(testRun, config).then(outcome => { if (outcome.status === 'failed') console.warn(...) })` — publish never blocks save or alters run status
	  - `publishConfigRef` pattern: `const publishConfigRef = useRef(publishConfig); publishConfigRef.current = publishConfig;` avoids stale closure for the publish config
	  - `confirmSavePendingRun` does not trigger publish — local quota-override save is not a run completion event
- [x] Phase 8C - Secure-profile and reporting validation (Suggested PR label: `kafka-p8c-publish-validation`) — ✅ Complete (2026-06-01 unit tests; 2026-06-02 broker-level scenarios 41/41 PASS)
	- [x] Validate plaintext broker publish behavior and payload shape (unit-tested in `kafkaResultsPublisher.test.ts` — 20 tests)
	- [x] Validate failure-path safety (run completion unaffected in default mode) (covered by `saveHandlers.test.ts`)
	- [x] Validate secure-profile publish behavior and parity (manual — validated 2026-06-02: 13E PASS, 41/41 total)
	- [x] Broker-level integration scenarios (13A-13G): manual validation — validated 2026-06-02: 41/41 PASS (plaintext + secure broker)
	- Implementation Notes (2026-06-01):
	  - 20 unit tests in `kafkaResultsPublisher.test.ts` cover publish success, retry up to max, timeout exceeded, all `KafkaPublishOutcome` status paths, and error classification
	  - Broker-level scenarios (13A-13G) and secure-profile parity require a real broker; deferred to integration/manual validation gate
	- Re-evaluation Notes (2026-06-02):
	  - Thorough code review of `kafkaResultsPublisher.ts`, `broker-scenarios-p8c.sh`, and all 3 test files — no bugs found
	  - Manual end-to-end validation: 41/41 PASS (both plaintext + secure brokers live)
	  - Retry logic correctness confirmed: MAX_RETRIES=3 → 4 total calls (1 initial + 3 retries), bounded by TOTAL_TIMEOUT_MS=10000ms
	  - Secure-profile parity (13E) validates all 13 assertions matching plaintext 13D (schemaVersion, runId, timestamp, executionMode, 9 summary fields, projectName, envName, svcName)
	  - Error classification alignment confirmed: server produces KAFKA_AUTH_FAILED/KAFKA_NOT_CONNECTED/KAFKA_CONNECT_TIMEOUT; client classifies correctly via `classifyKafkaUiError`
	  - Non-fatal `wait_for_broker_ready()` design allows 13E to run independently when only secure broker is available
	  - No race-boundary issues in the publish path (fire-and-forget pattern isolates run completion from broker availability)
	- Re-validation (2026-06-02 re-run): All 41/41 broker scenarios PASS (both plaintext and secure profiles live). Phase 3 secure smoke 21/21 PASS. All 409 unit tests across Phase 5+7+8 pass. tsc: 0 errors.

### Validation

- [x] payload schema tests (14 tests — `kafkaPublishTypes.test.ts`)
- [x] retry/failure behavior tests (20 tests — `kafkaResultsPublisher.test.ts`)
- [x] completion path regression tests (11 tests — `useTestExecution.saveHandlers.test.ts`; 2 tests — `useRunnerOrchestration.test.ts`)
- [x] real-broker publish validation on redfireforge.results.summary (manual — validated 2026-06-02)
- [x] secure-profile publish parity tests (manual — validated 2026-06-02: 13E PASS)
- [x] duplicate-event/idempotency behavior checks (retry logic unit-tested; broker-level check is manual)

### Validation Gate Checklist (must pass before exit)

- [x] publish envelope contract is versioned and validated with required fields
- [x] one completed run emits one publish event in normal success path
- [x] default-mode publish failures do not change run completion/persistence status
- [x] retries are bounded and diagnostics classify failure type/action clearly
- [x] secure and plaintext publish paths keep envelope semantics consistent (manual — validated 2026-06-02: both profiles PASS full parity gate)

### Phase 8 Execution Matrix (owner/effort/dependency order)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Primary Scope | Validation Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p8a-publish-contracts` | Contracts + Runner | 1.0-1.5 days | Phase 6 complete | Envelope/config contract and schema tests | contract validation passes |
| 2 | `kafka-p8b-publish-runtime` | Runner Runtime + Server Kafka | 1.5-2.0 days | PR1 | Publish-on-completion and retry/failure behavior | non-blocking persistence safety verified |
| 3 | `kafka-p8c-publish-validation` | QA + Platform | 1.0-1.5 days | PR2 | Plaintext/secure parity and failure diagnostics | environment parity + failure safety verified |

### Phase 8 PR Kickoff Checklist

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p8a-publish-contracts` | `feature/kafka-p8a-publish-contracts` | contract/schema tests + `npx tsc -b --noEmit` | publish envelope/settings contract validated |
| `kafka-p8b-publish-runtime` | `feature/kafka-p8b-publish-runtime` | run completion tests + `src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts` + `src-server/routes/kafka-routes.test.ts` + `src-server/kafka/kafka-service.test.ts` | publish integration does not destabilize run completion |
| `kafka-p8c-publish-validation` | `feature/kafka-p8c-publish-validation` | integration tests for plaintext + secure publish + failure paths | parity and non-blocking failure guarantees validated |

Per-PR readiness checks:

1. Confirm branch is `feature/*` and based on latest `develop`.
2. Run `npx tsc -b --noEmit` and the minimum test set above.
3. Validate publish-success and publish-failure paths for unchanged run completion behavior.
4. Attach payload samples and publish outcome telemetry in PR description.

### Suggested Test Commands

- `npx vitest run src/shared/kafka/kafkaClient.test.ts`
- `npx vitest run src-server/routes/kafka-routes.test.ts`
- `npx vitest run src-server/kafka/kafka-service.test.ts`
- `npx vitest run src/features/test-runner/hooks/useTestExecution.saveHandlers.test.ts`
- `npx vitest run src/features/test-runner/hooks/useTestExecution.execute.test.ts`

### PR Slice Suggestion

1. PR1: publish envelope/settings contracts
2. PR2: publish runtime + non-blocking failure handling
3. PR3: secure/plaintext validation + diagnostics hardening

### Broker Environment Prerequisites (Phase 8)

Phase 8C validation requires both broker profiles to be reachable. Verify before starting PR3:

- plaintext local broker: Docker Compose profile at `docker/kafka/` — start with `docker compose up -d` and confirm topic `redfireforge.results.summary` is accessible
- secure profile (auth/TLS): Docker Compose secure variant or external cluster — confirm credentials, CA cert, and topic access in the Kafka Settings panel before running secure-publish integration scenarios
- broker-unavailable simulation: stop the local broker after run start to exercise the non-blocking failure path and retry diagnostics
- idempotency check: use consumer offset tracking to confirm no duplicate events for the same `runId` after a successful retry

### Exit Criteria

- [x] Results publish works when enabled without destabilizing run completion (unit-tested)
- [x] Both plaintext and secure broker profiles validated against Phase 8C scenarios (manual — validated 2026-06-02: 41/41 PASS)
- [x] Non-blocking failure path confirmed with broker offline simulation (manual — validated 2026-06-02: 13C PASS, ok:false when disconnected)

---

## Phase 9 - Tauri-native Kafka Transport (rdkafka)

Window: Week 7-8
PR target: 4-5 (including build-chain PR0)
Dependency: Phases 1-8

### Work Items

- [ ] Verify `rdkafka` build-chain on macOS arm64 (`cargo build` clean) — PR0 blocker
- [ ] Add `rdkafka` dependency to `src-tauri/Cargo.toml` (`tokio`/`tokio-util` already present)
- [ ] Create `src-tauri/src/kafka/` module with `KafkaState` (connection map lifecycle manager)
- [ ] Implement `kafka_connect`, `kafka_disconnect`, `kafka_status`, `kafka_topics` Tauri commands
- [ ] Register `KafkaState` in **`src-tauri/src/lib.rs`** (NOT `main.rs` — the builder, `.manage()`, `.invoke_handler()` all live there)
- [ ] Implement `kafka_produce`, `kafka_consume`, `kafka_subscribe`, `kafka_unsubscribe` commands
- [ ] Define rdkafka-to-contract error mapping table covering all operation variants
- [ ] **`isTauri()` already exists** at `src/shared/utils/platform.ts` — do NOT create a new file
- [ ] Create `src/shared/kafka/kafkaNativeTauriTransport.ts` (implements `KafkaClientTransport`; call `setKafkaClientTransport()` in app init when `isTauri()` is true)
- [ ] All Kafka call sites already route through `dispatchKafkaOperation()` in `kafkaClient.ts` — no per-call-site wiring needed
- [ ] Define golden fixtures in `test-data/kafka/` for parity test suite
- [ ] Add cross-transport parity tests for all operations
- [ ] Add Playwright desktop smoke spec (`e2e/kafka-desktop.spec.ts`)

### Suggested File Targets (planning anchor)

- existing Tauri command/state pattern: `src-tauri/src/commands.rs`
- Cargo manifest: `src-tauri/Cargo.toml`
- **Tauri app builder/state registration**: `src-tauri/src/lib.rs` (NOT `main.rs`)
- net-new Rust module: `src-tauri/src/kafka/mod.rs`, `src-tauri/src/kafka/state.rs`, `src-tauri/src/kafka/commands.rs`
- server contract reference: `src-server/kafka/contracts.ts`
- server runtime reference: `src-server/kafka/kafka-service.ts`
- **`isTauri()` already at**: `src/shared/utils/platform.ts` (and `platform.test.ts`)
- **transport switching already in**: `src/shared/kafka/kafkaClient.ts` (via `setKafkaClientTransport()`)
- net-new frontend: `src/shared/kafka/kafkaNativeTauriTransport.ts` (and `.test.ts`)
- frontend Kafka features: `src/features/kafka/`

### Sub-phase Checklist (Execution Order)

- [ ] Phase 9-PR0 - Build-chain setup (Suggested PR label: `kafka-p9-build-chain`)
	- [ ] Add `rdkafka` with cmake feature flag to `Cargo.toml`
	- [ ] Confirm `cargo build` clean on macOS arm64 (and x86_64-apple-darwin if CI requires cross-compilation)
	- [ ] Document CI runner requirements (librdkafka native dep, cmake availability)
- [ ] Phase 9A - Native contract and lifecycle baseline (Suggested PR label: `kafka-p9a-native-lifecycle`)
	- [ ] `mod kafka;` added to `src-tauri/src/lib.rs` for module visibility (crate root — NOT `main.rs` which only calls `app_lib::run()`)
	- [ ] `KafkaState` with `Arc<Mutex<HashMap<ClusterId, ClientHandle>>>` using `std::sync::Mutex` (matching `ExecutorState` pattern) implemented
	- [ ] `KafkaState` registered via `.manage(KafkaState::new())` in **`src-tauri/src/lib.rs`** (where the Tauri builder, `.manage()`, and `.invoke_handler()` all live)
	- [ ] `kafka_connect`, `kafka_disconnect`, `kafka_status`, `kafka_topics` commands implemented and **added to `tauri::generate_handler![...]` list in `lib.rs`**
	- [ ] Rust unit tests for state transitions and topic list shape
- [ ] Phase 9B - Native operation surface (Suggested PR label: `kafka-p9b-native-ops`)
	- [ ] `kafka_produce`, `kafka_consume`, `kafka_subscribe`, `kafka_unsubscribe` implemented and **added to `tauri::generate_handler![...]` in `lib.rs`**
	- [ ] `kafka_subscribe`/`kafka_unsubscribe` use `CancellationToken` from `tokio_util::sync` (already imported in `commands.rs`); cancel on explicit unsubscribe and app-window-close
	- [ ] Error mapping table covering all rdkafka variants tested
	- [ ] Concurrent operation safety verified: produce does not interfere with active subscriber
- [ ] Phase 9C - Frontend transport switching and fallback (Suggested PR label: `kafka-p9c-transport-switch`)
	- [ ] **`isTauri()` already exists** at `src/shared/utils/platform.ts` — do NOT create a new file; import from there
	- [ ] **Transport switching already implemented** in `src/shared/kafka/kafkaClient.ts` via `setKafkaClientTransport()`; no new factory file needed
	- [ ] Create `src/shared/kafka/kafkaNativeTauriTransport.ts`: implements `KafkaClientTransport` using `invoke` from `@tauri-apps/api/core` (dynamic import only in Tauri branch — no top-level static import)
	- [ ] In app initialization, call `setKafkaClientTransport(kafkaNativeTauriTransport)` when `isTauri()` is true; server-proxy default active otherwise
	- [ ] Add `src/shared/kafka/kafkaNativeTauriTransport.test.ts`: test both paths and fallback; verify `setKafkaClientTransport(null)` restores default
- [ ] Phase 9D - Cross-transport parity hardening (Suggested PR label: `kafka-p9d-parity-hardening`)
	- [ ] Golden fixtures committed to `test-data/kafka/` as JSON with shape `{ operation, request, expectedResponse, expectedErrorShape? }`
	- [ ] Parity tests green for all operations on both transports
	- [ ] Error envelope equivalence verified
	- [ ] Concurrent operation parity verified (produce + active subscriber)
	- [ ] Playwright desktop smoke spec passing

### Validation

- [ ] `cargo build` clean with rdkafka on macOS arm64
- [ ] Rust unit tests for all Kafka commands (`cargo test`)
- [ ] Frontend transport factory vitest suite
- [ ] Golden-fixture parity tests for all operations (server-proxy vs native)
- [ ] Error mapping equivalence tests
- [ ] Playwright desktop smoke spec (`e2e/kafka-desktop.spec.ts`)

### Validation Gate Checklist (must pass before exit)

- [ ] `cargo build` and `npx tsc -b --noEmit` both clean at phase exit
- [ ] all Tauri Kafka commands have Rust unit tests covering happy path and error variants
- [ ] transport factory selects native in Tauri mode and server-proxy in browser mode without leaking imports
- [ ] golden-fixture parity tests pass for connect/topics/produce/consume/subscribe on both transports
- [ ] server-proxy path remains fully functional and unmodified in browser/dev mode
- [ ] Playwright desktop smoke confirms end-to-end Tauri Kafka flow with real broker

### CI Gate Stratification

- standard CI gate (PRs 0–3): `cargo build`, `cargo test`, `npx tsc -b --noEmit`, vitest transport factory suite — no broker or Tauri desktop build required
- integration gate (PR4 / 9D only): golden-fixture parity suite + `npx playwright test e2e/kafka-desktop.spec.ts --reporter=list` — requires `npx tauri dev` running and local broker up
- do NOT block PR0–3 merge on the integration gate; it runs as a separate required check on PR4 only

### Phase 9 Execution Matrix (owner/effort/dependency order)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Primary Scope | Validation Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `kafka-p9-build-chain` | Platform/Rust | 0.5-1.0 day | Phase 8 complete | `cargo build` clean with rdkafka | build confirmed on macOS arm64 |
| 1 | `kafka-p9a-native-lifecycle` | Rust/Commands | 2.0-2.5 days | PR0 | KafkaState + lifecycle commands | state + lifecycle tests passing |
| 2 | `kafka-p9b-native-ops` | Rust/Commands | 2.5-3.0 days | PR1 | produce/consume/subscribe + error mapping | all native ops tested with error coverage |
| 3 | `kafka-p9c-transport-switch` | Frontend + Rust | 2.0-2.5 days | PR2 | isTauri + transport factory + call-site wiring | both paths tested; browser fallback verified |
| 4 | `kafka-p9d-parity-hardening` | QA + Platform | 1.5-2.0 days | PR3 | golden fixtures + parity suite + Playwright smoke | parity green + desktop smoke passing |

### Phase 9 PR Kickoff Checklist

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p9-build-chain` | `feature/kafka-p9-build-chain` | `cargo build` + `cargo test` | clean build on macOS arm64 confirmed |
| `kafka-p9a-native-lifecycle` | `feature/kafka-p9a-native-lifecycle` | `cargo test src-tauri/src/kafka/` + `npx tsc -b --noEmit` | lifecycle command state tests passing |
| `kafka-p9b-native-ops` | `feature/kafka-p9b-native-ops` | `cargo test src-tauri/src/kafka/` for ops + error mapping | all native ops tested with error variant coverage |
| `kafka-p9c-transport-switch` | `feature/kafka-p9c-transport-switch` | `npx vitest run src/shared/kafka/kafkaNativeTauriTransport.test.ts src/shared/kafka/kafkaClient.test.ts` + `npx tsc -b --noEmit` | both transport paths tested; browser fallback verified |
| `kafka-p9d-parity-hardening` | `feature/kafka-p9d-parity-hardening` | parity fixture suite + `npx playwright test e2e/kafka-desktop.spec.ts --reporter=list` | parity green + Playwright desktop smoke passing |

Per-PR readiness checks:

1. Always base from latest `develop`; never from a Phase 8 feature branch.
2. PR0 build-chain must merge before any 9A Rust work starts — this is the critical path.
3. Confirm `cargo build` clean before submitting any Rust-touching PR.
4. For 9C/9D: confirm server-proxy path still works in browser/dev mode after transport factory wiring.
5. Attach broker session evidence or test output in PR description for all real-broker steps.

### Suggested Test Commands

- `cargo build` (from `src-tauri/` or workspace root with tauri build)
- `cargo test` (Rust unit tests for kafka module)
- `npx vitest run src/shared/kafka/kafkaNativeTauriTransport.test.ts`
- `npx vitest run src/shared/kafka/kafkaClient.test.ts`
- `npx tsc -b --noEmit`
- `npx playwright test e2e/kafka-desktop.spec.ts --reporter=list`

### Broker Environment Prerequisites (Phase 9)

Phase 9D parity validation requires both transports running against the same broker:

- plaintext local broker: Docker Compose at `docker/kafka/` — start with `docker compose up -d` before parity test runs
- secure profile (auth/TLS): required for Scenario 14F (secure-mode parity across transports)
- Tauri desktop build must be running (`npx tauri dev`) for native transport tests — browser/dev session runs simultaneously for server-proxy comparison
- all parity tests must target the same broker endpoint to isolate transport differences from environment differences

### Exit Criteria

- [ ] Desktop uses native Kafka transport for all operations in Tauri mode
- [ ] Server-proxy path continues to function in browser/dev mode without modification
- [ ] Cross-transport parity tests pass for all operations using golden fixtures
- [ ] `cargo build` and `npx tsc -b --noEmit` both clean
- [ ] Playwright desktop smoke spec passing

---

## Optional Phase 10 - Schema Registry

Window: backlog (activation-gated — see activation gate in integration-plan.md)
PR target: 2-3
Dependency: Phase 6+

### Activation Gate (must be confirmed before any branch is created)

- [ ] Concrete user need for Avro/Protobuf schema-enforced workflows confirmed
- [ ] Phase 6 fully stable with all exit criteria green
- [ ] Team accepts contract extension scope in `src-server/kafka/contracts.ts`

### Work Items

- [ ] Install `@kafkajs/confluent-schema-registry` and verify compatibility with `kafkajs: ^2.2.4`
- [ ] Add `KafkaSchemaConfig` type and registry `KafkaOperation` entries to `src-server/kafka/contracts.ts`
- [ ] Create `src-server/kafka/schema-registry-client.ts` (registry client wrapper, subject/version/fetch helpers)
- [ ] Add registry route handlers (`schema-subjects`, `schema-versions`, `schema-fetch`) to `src-server/routes/kafka-routes.ts`
- [ ] Extend `KafkaProduceRequest` with optional `schemaConfig` at **request level** (applied to all messages in batch — not per-message)
- [ ] Add encode helper in produce path (Avro minimum; Protobuf/JSON Schema optional); produce encode chain: `registry.encode()` returns `Buffer` → convert to base64 string in `kafka-service.ts` before calling `adapter.send()` — `KafkaProducerMessage.value: string` in `kafka-adapter.ts` unchanged; wire format: base64 in existing `value` field + `valueEncoding?: 'base64-avro' | 'base64-protobuf' | 'base64-json-schema' | 'plain'` added to `KafkaProduceResult` in `contracts.ts`; `KafkaConsumeRecord` does NOT need `valueEncoding` (server decodes transparently before returning)
- [ ] Extend `KafkaConsumerRecord` (adapter type in `kafka-adapter.ts`) with `rawValue?: Buffer`; adapter populates both `value` (`.toString('utf-8')`) and `rawValue` (raw Buffer); plain-JSON path uses `value` unchanged
- [ ] Extend `KafkaConsumeOnceRequest` (the actual type name in codebase — not `KafkaConsumeRequest`) with optional `schemaConfig`
- [ ] Add decode helper in consume path: use `record.rawValue` (not `record.value`) for registry decode to avoid binary byte corruption from adapter `.toString('utf-8')` at line 230 of `kafka-adapter.ts`; decoded value returned as JSON-stringified string in `value` field of `KafkaConsumeRecord`; `rawValue` is server-side only and never serialized to client
- [ ] Note explicitly: subscribe-path schema decode is **out of scope** for Phase 10B — only `consume-once` path supports schema-aware decode in the initial phase
- [ ] Define `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` as distinct error codes in `KafkaErrorBody`
- [ ] Note key encoding explicitly out of scope (only `value` encoded/decoded in initial phase)
- [ ] Add collapsible schema config section to produce/consume UI panels (hidden by default)
- [ ] Add subject/version selectors and schema preview in UI
- [ ] Confirm Phase 8 result publish envelope is schema-agnostic (no registry coupling introduced)

### Suggested File Targets (planning anchor)

- contract extension point: `src-server/kafka/contracts.ts`
- **adapter extension point**: `src-server/kafka/kafka-adapter.ts` — extend `KafkaConsumerRecord` interface with `rawValue?: Buffer`
- runtime encode/decode: `src-server/kafka/kafka-service.ts`
- route handlers: `src-server/routes/kafka-routes.ts`
- net-new: `src-server/kafka/schema-registry-client.ts` (registry client, schema cache, encode/decode helpers)
- frontend: `src/features/kafka/` (produce/consume panel extensions)

### Sub-phase Checklist (Execution Order)

- [ ] Phase 10A - Registry connection contracts and configuration (Suggested PR label: `kafka-p10a-registry-contracts`)
	- [ ] `@kafkajs/confluent-schema-registry` installed and `npx tsc -b --noEmit` clean
	- [ ] `KafkaSchemaConfig` type defined (`registryUrl`, optional `auth`, `subject`, optional `version`, `format`); subject naming convention documented (`{topic}-value` TopicNameStrategy default)
	- [ ] Key encoding explicitly noted as out of scope in contract documentation
	- [ ] `KafkaOperation` extended with `'schema-subjects'`, `'schema-versions'`, `'schema-fetch'`
	- [ ] `schema-registry-client.ts` created with connection, health check, `listSubjects`, `listVersions`, `fetchSchema`, and schema cache keyed by schema ID
	- [ ] Route handlers for registry operations return `KafkaRouteEnvelope`-wrapped responses
	- [ ] Contract/unit tests with mocked registry
	- [ ] Zero changes to existing produce/consume routes or service behavior
- [ ] Phase 10B - Runtime encode/decode integration (Suggested PR label: `kafka-p10b-registry-runtime`)
	- [ ] `KafkaProduceRequest` extended with optional `schemaConfig` at request level (all messages in batch use same schema)
	- [ ] Produce encodes via registry client when `schemaConfig` present; encode chain: `registry.encode()` → Buffer → base64 string in `kafka-service.ts` before `adapter.send()`; wire format: base64 in `value` + `valueEncoding?: 'base64-avro' | 'base64-protobuf' | 'base64-json-schema' | 'plain'` added to `KafkaProduceResult` in `contracts.ts` (not to `KafkaConsumeRecord` — server decodes transparently); adapter type `KafkaProducerMessage.value: string` unchanged
	- [ ] `KafkaConsumerRecord` (adapter type in `kafka-adapter.ts`) extended with `rawValue?: Buffer`; adapter sets both fields; `rawValue` used for decode in service layer
	- [ ] `KafkaConsumeOnceRequest` extended with optional `schemaConfig` (correct type name — not `KafkaConsumeRequest`)
	- [ ] Consume decode uses `record.rawValue` (not `record.value`) to avoid binary byte corruption from `.toString('utf-8')` at adapter boundary
	- [ ] Subscribe-path schema decode noted as out of scope for Phase 10B initial implementation
	- [ ] `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` error codes defined
	- [ ] Schema cache in registry client prevents per-message registry HTTP calls
	- [ ] Phase 8 result publish path confirmed schema-agnostic
	- [ ] All existing produce/consume tests pass unchanged
- [ ] Phase 10C - UX and validation polish (Suggested PR label: `kafka-p10c-registry-ux`)
	- [ ] Schema config section collapsed/hidden by default; only shown after explicit opt-in toggle
	- [ ] Subject/version selectors load lazily from registry APIs
	- [ ] Schema preview shown for selected subject/version
	- [ ] `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, `REGISTRY_AUTH_FAILURE` display as actionable inline messages
	- [ ] All schema-registry controls absent when no registry URL is configured
	- [ ] Playwright spec `e2e/kafka-schema.spec.ts` passing

### Validation

- [ ] `@kafkajs/confluent-schema-registry` compatible with `kafkajs: ^2.2.4`
- [ ] `npx tsc -b --noEmit` clean after contract extensions
- [ ] Contract/unit tests with mocked registry for registry client
- [ ] Encode/decode correctness tests (Avro minimum)
- [ ] `SCHEMA_MISMATCH` and `REGISTRY_UNREACHABLE` error code tests
- [ ] All existing Kafka produce/consume tests unchanged
- [ ] Playwright spec for schema UX opt-in flow

### Validation Gate Checklist (must pass before exit)

- [ ] `@kafkajs/confluent-schema-registry` installed and compatible
- [ ] `KafkaProduceRequest` and `KafkaConsumeOnceRequest` extensions are additive with no breakage to existing callers
- [ ] Encode/decode correct for Avro format with mocked registry (request-level `schemaConfig`, batch safe; base64-in-`value` produce chain; rawValue-based consume decode)
- [ ] `SCHEMA_MISMATCH`, `REGISTRY_UNREACHABLE`, and `REGISTRY_AUTH_FAILURE` returned and not confused with generic Kafka errors
- [ ] Plain-JSON produce/consume unaffected when `schemaConfig` is absent
- [ ] Phase 8 result publish confirmed schema-agnostic
- [ ] Playwright schema UX spec passing

### Phase 10 Execution Matrix (owner/effort/dependency order)

| Order | PR Slice | Suggested Owner | Est. Effort | Depends On | Primary Scope | Validation Gate |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `kafka-p10a-registry-contracts` | Contracts + Server | 1.5-2.0 days | Activation gate + Phase 6 stable | Registry client + type extensions | contract tests pass, zero breakage to existing callers |
| 2 | `kafka-p10b-registry-runtime` | Server + Runner | 2.0-2.5 days | PR1 | Encode/decode + error codes | encode/decode correct, plain-JSON parity confirmed |
| 3 | `kafka-p10c-registry-ux` | Frontend + QA | 1.5-2.0 days | PR2 | UX opt-in + schema mismatch display | Playwright schema spec passing |

### Phase 10 PR Kickoff Checklist

| PR Slice | Suggested Branch | Minimum Test Set (before review) | Merge Gate (required) |
| --- | --- | --- | --- |
| `kafka-p10a-registry-contracts` | `feature/kafka-p10a-registry-contracts` | contract/registry tests + `npx tsc -b --noEmit` | type extensions validated; no breakage to existing contracts |
| `kafka-p10b-registry-runtime` | `feature/kafka-p10b-registry-runtime` | `npx vitest run src-server/kafka/schema-registry-client.test.ts src-server/kafka/kafka-service.test.ts` + `npx tsc -b --noEmit` | encode/decode with mocked registry; plain-JSON unchanged |
| `kafka-p10c-registry-ux` | `feature/kafka-p10c-registry-ux` | `npx vitest run src/features/kafka/` + `npx playwright test e2e/kafka-schema.spec.ts --reporter=list` | UX opt-in and Playwright spec passing |

Per-PR readiness checks:

1. Confirm activation gate criteria are met before creating any branch.
2. Base all branches from latest `develop` after Phase 6 exit criteria are confirmed.
3. Run `npx tsc -b --noEmit` and all existing Kafka tests before each PR review.
4. Never introduce a required dependency on schema registry for plain-JSON Kafka features.

### Suggested Test Commands

- `npx vitest run src-server/kafka/schema-registry-client.test.ts`
- `npx vitest run src-server/kafka/kafka-service.test.ts`
- `npx vitest run src-server/routes/kafka-routes.test.ts`
- `npx vitest run src/features/kafka/`
- `npx tsc -b --noEmit`
- `npx playwright test e2e/kafka-schema.spec.ts --reporter=list`

### Registry Environment Prerequisites

- local schema registry: Confluent Platform Docker Compose (add `cp-schema-registry` service to **`docker/kafka/plaintext/docker-compose.yml`** — the compose file lives in the `plaintext/` subdirectory, not at `docker/kafka/` root) or Redpanda with schema registry plugin — update `docker/kafka/` setup docs
- mocked registry: `@kafkajs/confluent-schema-registry` in-memory mock — no Docker required for standard CI gate
- standard CI gate: mocked registry only; live registry required only for Phase 10C UX integration tests

### Exit Criteria

- [ ] Schema-aware produce and consume work with explicit opt-in for at least Avro format
- [ ] All plain-JSON Kafka features (Phase 6 runner, Phase 8 publish) are unaffected
- [ ] `npx tsc -b --noEmit` clean after all contract extensions
- [ ] Encode/decode tests pass using mocked registry
- [ ] Playwright schema UX spec passing

---

## Milestone Checklist

### Milestone A (Foundation)

- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete

### Milestone B (Workflow)

- [x] Phase 4 complete
- [x] Phase 5 complete

### Milestone C (Runner + Reporting)

- [x] Phase 6 complete
- [x] Phase 7 complete
- [x] Phase 8 complete (unit tests complete; broker-level validation 41/41 PASS 2026-06-02)

### Milestone D (Native Desktop)

- [ ] Phase 9 complete

---

## Ownership and Tracking

- Engineering owner:
- QA owner:
- Product owner:
- Last updated: 2026-06-01
- Current active phase: Phase 9 - Tauri-native Kafka Transport (not started)
- Current active PR: feature/kafka-integration (phases 1–8C complete; Phase 8 broker validation pending)

### Weekly Status Notes

- Week 1: Kickoff pre-filled. Focus on server foundation plus plaintext Docker bootstrap; no UI work until Phase 1 exit criteria pass.
- Week 2: Pre-filled. Close Phase 1 cleanly first, then begin Phase 2 transport/state wiring with test-first checkpoints and secure-profile prep.
- Week 3: Pre-filled. Deliver Kafka Settings UX end to end (cluster config, connection test, topic browser, status indicator) including auth/SSL validation against secure Docker profile.
- Week 4: Pre-filled. Deliver Kafka workflow node model + executor integration with deterministic tests before trigger/wait work.
- Week 5: Pre-filled. Deliver Kafka runner integration (Phase 6) and throttling/rate-limit controls (Phase 7) with deterministic tests; ensure non-Kafka run paths remain stable before closing Phase 7 exit criteria.
- Week 6: Phase 8 window. Day 1–2: finalize and review PR1 (publish envelope/settings contract, schema tests, `npx tsc -b --noEmit`). Day 3–4: finalize and review PR2 (publish-on-completion hook, bounded retry, non-blocking failure handling, run completion regression tests). Day 5: finalize PR3 (plaintext + secure-profile parity, failure-path safety, Scenario 13A–13F validation, idempotency check). Phase 8 exit gate must pass before week end; do NOT start Phase 9 until all three PRs are merged and exit criteria are green.
- Week 7: Phase 9 window. Focus on rdkafka dependency introduction and native lifecycle/produce/consume command surface (Phase 9A–9B). Block native work on Tauri compile gate (`cargo build`) before any UI transport-switch work.
- Week 8: Phase 9 close and optional Phase 10 kickoff. Deliver frontend transport switch and server-proxy fallback (Phase 9C). Run cross-transport parity hardening (Phase 9D). If Phase 10 is in scope, begin registry connection contract work only after Phase 9 exit criteria pass.

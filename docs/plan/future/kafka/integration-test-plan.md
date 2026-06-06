# Kafka Integration Test Plan

Feature: Kafka connection management, topic browsing, publish/consume tools, workflow nodes, trigger/wait flow, runner integration, and results publishing
Primary plan: docs/plan/future/kafka/integration-plan.md
Execution tracker: docs/plan/future/kafka/integration-tracker.md
Reference mockups:

- docs/mockups/kafka-cluster-studio.html
- docs/mockups/kafka-topic-explorer.html
- docs/mockups/kafka-message-studio.html
- docs/mockups/kafka-workflow-integration.html

Status: Future test plan (not yet executed)
Last updated: 2026-05-31

## 1. Purpose

This document defines how Kafka must be tested in RedfireForge with real broker integration and visual product validation, not only mocks.

The test strategy is intentionally split into four layers:

1. Unit tests for deterministic business logic and contracts.
2. Integration tests against a real Kafka broker in local automation.
3. Visual end-to-end app tests in the browser with a real Kafka-backed environment.
4. Staging validation against a secure Kafka cluster before production-grade rollout.

## 2. Test Environments

### Environment A - Local real broker, browser/dev path

Purpose: default integration and visual UI test bed.

- Single-node Kafka-compatible broker for deterministic local runs.
- Plaintext connection for fast execution.
- RedfireForge app running in browser/dev mode.
- Server proxy path enabled through /api/kafka/*.

Recommended stack:

- Redpanda or Kafka in Docker.
- One seeded topic set used by all UI and workflow scenarios.
- Automated seed/reset script so every run starts from the same broker state.

### Environment B - Local secure broker

Purpose: validate auth and SSL UX, error handling, and certificate flows.

- SASL/PLAIN or SCRAM enabled.
- SSL enabled.
- Intentionally include one invalid-credential and one invalid-cert scenario.

### Environment C - Shared staging cluster

Purpose: verify that the app works against a realistic multi-broker cluster.

- At least 2 brokers.
- Real topic metadata and realistic latency.
- Read/write topic set reserved for RedfireForge validation.
- Read-only cluster profile for safety checks.

### Environment D - Desktop parity, later phase

Purpose: contract parity validation for the future Tauri-native transport.

- Same topic/data set as Environment A.
- Validate browser/dev transport and native transport return equivalent envelopes.

## 3. Required Test Data

Create and reseed these topics before every real integration run:

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

Seed message requirements:

- Messages with repeated keys such as customer-123 and customer-456.
- Headers including traceId, source, env.
- JSON bodies with fields used by workflow extraction and JSONPath filters.
- At least one invalid or non-matching payload for negative filtering tests.
- At least one delayed message scenario for KafkaWait timeout coverage.

Suggested canonical payload families:

1. Order created payload with orderId, customerId, status.
2. Payment authorized payload correlated by orderId.
3. Failure payload for dead-letter and warning scenarios.
4. Results summary payload for run publication validation.

## 4. Global Gates

These must pass for every Kafka phase before the phase can be considered stable:

- npx tsc -b --noEmit
- Targeted Vitest coverage for touched Kafka files
- Targeted ESLint for touched Kafka scope
- Playwright visual/integration suite for touched Kafka UI flows
- No regression in existing non-Kafka workflows, runner flows, or Results screens
- Docs/plan/tracker updated for any design drift

## 5. Automation Split

### Unit tests

Purpose: validate isolated logic without a real broker.

- kafka-service lifecycle state transitions
- request/response contracts
- frontend state reducers and storage persistence
- workflow-node config parsing and variable mapping
- runner Kafka assertion logic

### Real broker integration tests

Purpose: validate behavior against an actual Kafka system.

- connect/disconnect against a live broker
- topic listing and metadata retrieval
- produce and consume-once behavior
- subscribe/unsubscribe lifecycle and cleanup
- real filter behavior for key/header/JSON body matching
- timeout and no-match handling

### Visual Playwright tests

Purpose: validate that the user can actually use Kafka features through the UI.

- settings page forms and connection states
- topic explorer browse/filter flows
- publish and consume screens
- workflow editor Kafka node configuration
- workflow run history for trigger/wait states
- results publishing visibility where applicable

### Staging validation

Purpose: catch auth, latency, and topology behavior not visible in local single-node runs.

- secure cluster connection flows
- multi-broker metadata display
- recovery from broker restart or transient failure
- read-only safety behavior

## 6. Visual Test Suites to Add

Recommended Playwright specs:

- e2e/kafka-settings.spec.ts
- e2e/kafka-topic-explorer.spec.ts
- e2e/kafka-message-studio.spec.ts
- e2e/kafka-workflow-nodes.spec.ts
- e2e/kafka-trigger-wait.spec.ts
- e2e/kafka-runner-integration.spec.ts
- e2e/kafka-results-publishing.spec.ts

Recommended integration/unit suites:

- src-server/kafka/kafka-service.test.ts
- src-server/routes/kafka-routes.test.ts
- src/features/kafka/state/kafkaStore.test.ts
- src/features/kafka/components/KafkaSettings.test.tsx
- src/features/kafka/components/KafkaTopicExplorer.test.tsx
- src/features/kafka/components/KafkaMessageStudio.test.tsx
- src/features/workflow/kafkaNodes.test.ts
- src/features/runner/kafkaScenarioExecution.test.ts

## 7. Phase-by-Phase Test Plan

## Phase 1 - Core Transport Foundation

Goal: prove that RedfireForge can safely connect to Kafka, produce, consume, subscribe, and clean up resources.

Automated validation:

- Mocked unit tests for connect, reconnect, disconnect, produce, consumeOnce, subscribe, unsubscribe.
- Route tests for every /api/kafka/* endpoint success and failure path.
- Real broker integration test for connect -> list topics -> produce -> consume -> disconnect.
- Leak test confirming disconnect tears down active subscriptions.

Critical negative cases:

- broker unavailable
- timeout while consuming
- subscribe failure after partial setup
- disconnect during active consume
- malformed filter payload

Exit checks:

- no orphan subscriptions after disconnect
- consistent error envelope across routes
- no unhandled promise rejection in test output

## Phase 2 - Client Transport and App State

Goal: verify the app can route Kafka operations correctly and surface stable state to the UI.

Automated validation:

- transport dispatcher tests for browser/dev mode
- storage load/save/migration tests for cluster definitions
- reconnect/error/recovery state tests
- real integration test: app startup -> load saved cluster -> test connection -> refresh state

Visual checks:

- app header or settings entry reflects disconnected, testing, connected, and error states
- stale error state clears after successful reconnect

## Phase 3 - Cluster Management and Topic Browser

Goal: validate the user-facing cluster setup and topic browse experience shown in the mockups.

Visual integration scenarios:

### Scenario 1: Add a plaintext cluster and connect successfully

Steps:

1. Open Kafka settings.
2. Add a cluster named Local Dev Kafka.
3. Enter 1 or more bootstrap brokers.
4. Select no authentication / plaintext mode.
5. Click Test Connection.
6. Save the cluster.

Expected:

- status changes from idle to testing to connected
- topic preview panel loads real topics from the broker
- saved cluster appears in the cluster list after refresh/reopen

### Scenario 2: Invalid broker or invalid credentials show targeted failure

Steps:

1. Add or edit a cluster with a bad broker address or bad credentials.
2. Click Test Connection.

Expected:

- user sees targeted error state, not a generic crash
- cluster remains editable after failure
- previous valid cluster selection is not corrupted

### Scenario 3: Auth and SSL combinations validate correctly

Steps:

1. Switch between no auth, SASL, and SSL-enabled modes.
2. Try saving incomplete combinations.
3. Test with a valid secure cluster profile.

Expected:

- missing required security fields are blocked locally
- valid secure profile connects successfully
- invalid cert or invalid password surfaces readable errors

### Scenario 4: Topic list search and detail state

Steps:

1. Connect to a seeded cluster.
2. Search for orders.
3. Open orders.created detail.
4. Search for a non-existent topic.

Expected:

- topic list filters in real time or on apply
- selected topic detail uses live metadata
- empty state appears for no matches

## Phase 4 - Workflow Kafka Nodes

Goal: verify Kafka Produce and Kafka Consume nodes execute deterministically in workflows.

Phase 4 re-evaluation focus (2026-05-30):

- test full workflow integration surfaces, not only isolated Kafka calls
- verify variable insert and config-save behavior in node modals
- verify log safety constraints (credential redaction and payload preview truncation)
- verify non-Kafka workflow paths remain unchanged

Visual integration scenarios:

### Scenario 5: Kafka Produce node publishes a real message

Steps:

1. Create a workflow with Kafka Produce.
2. Map topic, key, headers, and body from fixed values or workflow variables.
3. Run the workflow.
4. Consume the target topic separately to confirm delivery.

Expected:

- workflow run succeeds
- execution log shows produced partition/offset metadata
- consumed message body and headers match expected values

### Scenario 6: Kafka Consume node captures a matching message

Steps:

1. Seed a known message into a topic.
2. Configure Kafka Consume with key/header/body filters.
3. Run the workflow.

Expected:

- workflow consumes only matching payloads
- extracted variables are visible in downstream steps or logs
- timeout case is handled deterministically when no match exists

### Scenario 6B: Kafka node config persistence and variable insertion parity

Steps:

1. Add Kafka Produce and Kafka Consume nodes to canvas from the workflow palette.
2. Configure templated fields using Insert Variable actions.
3. Save, close the modal, reopen, and confirm all config values persist.
4. Save workflow, reload editor, and re-open both node configs.

Expected:

- variable insertion is available on all templated Kafka fields
- all edited values persist through close/reopen and workflow reload
- validation blocks save only on required fields, with actionable inline errors

### Scenario 6C: Mixed workflow chain remains deterministic

Steps:

1. Build chain: HTTP -> Kafka Produce -> Kafka Consume -> HTTP.
2. Seed topic so consume path has one deterministic match.
3. Run workflow with retries disabled, then rerun with continue-on-error enabled.

Expected:

- downstream HTTP step receives extracted Kafka variables in both runs
- failure classification remains stable across reruns (validation/auth/tls/timeout/network)
- continue-on-error and retry semantics match existing non-Kafka node behavior

### Scenario 6D: Kafka node logs are observable and safe

Steps:

1. Execute Kafka Produce and Kafka Consume with representative headers/payload.
2. Trigger one auth/credential failure and one timeout path.
3. Review node logs in workflow logs tab.

Expected:

- log lines include node lifecycle status (start/success/failure), topic, and timing
- sensitive fields (auth credentials, TLS material, protected headers) are redacted
- large payload previews are truncated to bounded length
- logs remain actionable without exposing raw secrets

### Scenario 6E: Output bindings propagate produce/consume metadata to downstream nodes

Steps:

1. Configure a Kafka Produce node with `outputBindings`: bind `partition` → `producedPartition` and `offset` → `producedOffset`.
2. Add a downstream HTTP node that uses `{{producedPartition}}` and `{{producedOffset}}` in its URL.
3. Run the workflow.

Expected:

- produce result `partition` and `offset` are written to `producedPartition` and `producedOffset` in variable context
- downstream HTTP node receives interpolated values in its URL (not the literal placeholder strings)
- disabled bindings are skipped and do not overwrite existing variables of the same name

### Scenario 6F: Consume with `startPosition: 'earliest'` replays existing messages

Steps:

1. Seed 3 messages into a topic.
2. Configure a Kafka Consume node with `startPosition: 'earliest'` and `maxMessages: 3`.
3. Run the workflow from a fresh consumer.

Expected:

- consumer reads from the beginning of the topic and matches the 3 seeded messages
- consumer does not stop at `latest` offset (no empty-result timeout)
- result envelope reflects `startPosition: 'earliest'` in the execution log

### Scenario 6G: Consume load test behavior `auto-resume` short-circuits real consume

Steps:

1. Configure a Kafka Consume node with `loadTestBehavior.mode: 'auto-resume'`.
2. Run the workflow under load test mode (N iterations).
3. Confirm no real broker consume calls are made.

Expected:

- each iteration resumes immediately with a synthetic empty result; no Kafka network call occurs
- workflow continues to downstream nodes without blocking on broker availability
- log indicates the auto-resume path was taken (not a genuine consume match)

### Scenario 6H: Kafka node execution trace details appear in Results Explorer

Steps:

1. Run a workflow containing a Kafka Produce node and a Kafka Consume node with full trace capture enabled.
2. Open the Results Explorer or workflow trace detail view for the completed run.
3. Expand the Kafka Produce and Kafka Consume node entries.

Expected:

- Kafka Produce entry shows `topic`, `partition`, `offset`, and `durationMs` from `kafkaDetails`
- Kafka Consume entry shows `topic`, `matchedMessages`, and `durationMs` from `kafkaDetails`
- log lines for each Kafka node (start / outcome / summary) are visible at debug trace level
- no auth credentials, TLS key/cert material, or full raw message payloads appear in any log line; payload previews are truncated at 512 characters

### Scenario 6I: Kafka node failure in mixed chain respects `continueOnError` flag

Steps:

1. Build a chain: HTTP → Kafka Produce (configured to fail, e.g., bad topic) → HTTP.
2. Run the chain first with `continueOnError: false` (default).
3. Rerun with `continueOnError: true` on the Kafka Produce node.

Expected:

- `continueOnError: false`: workflow stops at the Kafka Produce failure; downstream HTTP node does not execute
- `continueOnError: true`: workflow records the Kafka Produce failure and continues to the downstream HTTP node
- failure class (`'validation'` / `'network'` / etc.) is visible in the node's execution trace `kafkaDetails.failureClass`

## Phase 5 - Kafka Trigger and KafkaWait

Goal: validate event-driven workflow start and correlation-based resume.

Phase 5 re-evaluation focus (2026-05-30):

- verify trigger/wait lifecycle parity across browser-bridge and server-owned execution paths
- verify duplicate callback idempotency and stale-wait cleanup behavior
- verify mismatch handling for correlation extraction sources (body/header/query)
- verify restart/reconnect resilience for in-flight waits

Visual integration scenarios:

### Scenario 7: Kafka Trigger starts a workflow from a real message

Steps:

1. Save a workflow with Kafka Trigger on orders.created.
2. Publish a matching real message.
3. Observe workflow start.

Expected:

- exactly one workflow run is created for the matching message
- run metadata shows trigger topic, partition, offset, and extracted variables
- non-matching messages do not start the workflow

### Scenario 8: KafkaWait resumes when correlated message arrives

Steps:

1. Start a workflow that pauses on KafkaWait for payments.authorized.
2. Publish a non-matching payment message.
3. Publish the matching correlated payment message.

Expected:

- workflow remains waiting after the non-matching message
- workflow resumes only after the correlated message arrives
- run history clearly shows waiting, resumed, and timeout states

### Scenario 9: KafkaWait timeout is visible and stable

Steps:

1. Start a workflow with a short wait timeout.
2. Do not publish a matching message.

Expected:

- workflow ends in a timeout state without hanging resources
- UI exposes timeout clearly in run history/logs

### Scenario 9B: Duplicate callback delivery is idempotent

Steps:

1. Start a workflow paused on KafkaWait with a known correlation id.
2. Deliver a matching callback twice (same correlation id and same payload).
3. Inspect execution/run history.

Expected:

- exactly one resume is applied
- duplicate callback is classified explicitly as duplicate/ignored
- no second workflow completion path is emitted

### Scenario 9C: Correlation extraction mismatch handling (body/header/query)

Steps:

1. Configure one wait using body extraction, one using header extraction, and one using query extraction.
2. Send callbacks with only partial/mismatched correlation data.
3. Send a fully matching callback for each configuration.

Expected:

- mismatched callbacks are rejected without resuming waits
- matching callback resumes the correct wait exactly once
- logs classify mismatch reason clearly

### Scenario 9D: Restart/reconnect recovery for in-flight waits

Steps:

1. Pause a workflow on KafkaWait.
2. Restart the server or force reconnect cycle before callback arrival.
3. Send the matching callback after restart.

Expected:

- no orphaned or duplicated wait entries remain after restart/reconnect
- resumed workflow continues from paused node with preserved context
- stale wait entries are cleaned up on timeout/cancel paths

### Scenario 9E: Resume-path parity (direct resume vs callback endpoint)

Steps:

1. Resume one paused wait through direct resume endpoint.
2. Resume another paused wait through callback endpoint path.
3. Compare run-history outcomes.

Expected:

- both pathways produce equivalent wait/resume state transitions
- metadata indicates resume source channel for diagnosis
- neither path bypasses idempotency or timeout safeguards

### Scenario 9F: Trigger consumer offset policy — latest by default

Steps:

1. Produce 3 messages to `orders.created` before a Kafka Trigger workflow is registered.
2. Register the Kafka Trigger workflow (subscribe).
3. Produce 1 message after the subscription is active.

Expected:

- only the post-subscription message starts a workflow run (offset policy `latest`)
- the 3 pre-subscription messages are not replayed as trigger events
- consumer group ID is derived from `workflowId + triggerNodeId` and is stable across reconnect

### Scenario 9G: Backpressure — trigger consumer pauses at active-run limit

Steps:

1. Configure a Kafka Trigger with the active-run limit set to 2.
2. Publish 5 messages in rapid succession.
3. Observe workflow start behavior and consumer state.

Expected:

- at most 2 trigger-started runs execute concurrently
- consumer is paused (not disconnected) when the limit is reached
- consumer auto-resumes and processes remaining messages once active count drops below the limit
- no messages are silently dropped while consumer is paused (they remain in broker)

### Scenario 9H: KafkaWait consumer cleanup on timeout

Steps:

1. Start a workflow paused on KafkaWait with a 3-second timeout.
2. Do not send a matching message.
3. After timeout, inspect active Kafka consumer subscriptions.

Expected:

- KafkaWait times out cleanly with a diagnosable terminal status
- no lingering Kafka subscription remains after timeout expiry
- correlation store entry is cleaned up; no stale wait entry persists

### Scenario 9I: Kafka context variable seeding from trigger and wait

Steps:

1. Fire a Kafka Trigger with a known topic, key, headers, and JSON body.
2. Inspect the workflow variable context immediately after trigger fires.
3. Resume a KafkaWait node with a correlated message; inspect variables after resume.

Expected:

- trigger seeds: `kafka.trigger.topic`, `kafka.trigger.partition`, `kafka.trigger.offset`, `kafka.trigger.key`, `kafka.trigger.value`, and each header as `kafka.trigger.header.<name>`
- wait resume seeds: `kafka.wait.topic`, `kafka.wait.partition`, `kafka.wait.offset`, `kafka.wait.key`, `kafka.wait.value`, and each header as `kafka.wait.header.<name>`
- no `webhook.*` keys are populated by Kafka trigger/wait paths (no cross-contamination with webhook context)

## Phase 6 - Runner Kafka Scenarios

Goal: validate Kafka as a first-class test target in standard and parameterized runner modes.

Phase 6 re-evaluation focus (2026-05-30):

- validate action-contract migration safety for existing HTTP scenarios
- validate parameterized row-level attribution parity for Kafka actions
- validate mixed-suite (HTTP + Kafka) rendering/grouping/filter/export stability
- validate transport-aware outcome semantics (no HTTP-status misclassification for Kafka actions)

Integration scenarios:

### Scenario 10: Standard runner publishes and asserts message metadata

Steps:

1. Configure a standard runner scenario with kafkaProduce action and metadata assertions.
2. Execute the run against a real/local test broker.
3. Inspect runner and results details for produced message metadata.

Expected:

- runner can publish to Kafka
- result model records topic, partition, offset, and timing
- assertions can validate payload and metadata

### Scenario 11: Parameterized runner maps dataset fields into Kafka actions

Steps:

1. Configure a parameterized Kafka scenario with dataset mappings for topic/key/headers/body.
2. Execute the parameterized run with multiple rows.
3. Inspect per-row results in runner and results dashboard.

Expected:

- dataset values interpolate into topic, key, headers, and body
- failures identify the parameter row that broke
- Results UI renders Kafka action outcomes clearly

### Scenario 11B: Action-contract migration safety

Steps:

1. Import or load an existing HTTP-only runner scenario set saved before Kafka action support.
2. Open, run, and re-save the scenario set.
3. Re-open and compare saved structure.

Expected:

- HTTP scenarios remain runnable without schema breakage
- Kafka action defaults are applied only where action type requires them
- no silent contract mutation corrupts older scenario payloads

### Scenario 11C: Parameterized row-level failure attribution parity

Steps:

1. Configure parameterized Kafka actions with at least one intentionally failing row.
2. Execute parameterized run.
3. Inspect run results and row-level diagnostics.

Expected:

- failures identify the exact row by row id/label
- successful rows remain correctly attributed
- retry/failure reporting preserves row association

### Scenario 11D: Mixed-suite rendering parity (HTTP + Kafka)

Steps:

1. Build a run containing both HTTP scenarios and Kafka action scenarios.
2. Execute run and open Results Dashboard.
3. Apply grouping, filtering, search, and export workflows.

Expected:

- both action types render without UI errors or dropped entries
- grouping and filtering behave consistently across both action types
- exported results preserve action-type-specific metadata

### Scenario 11E: Transport-aware outcome classification

Steps:

1. Run Kafka scenarios that include success, assertion-fail, and timeout/error branches.
2. Inspect result status labels, details, and summary metrics.

Expected:

- Kafka outcomes are classified with transport-aware semantics
- UI does not treat Kafka outcomes as malformed HTTP status failures by default
- failure details remain actionable for payload/metadata assertions

### Scenario 11F: Report/export parity for mixed suites

Steps:

1. Execute a mixed-suite run containing both HTTP and Kafka actions.
2. Export results as JSON/CSV/report formats supported by the dashboard.
3. Re-open exported artifacts and compare with on-screen grouped results.

Expected:

- exported artifacts preserve Kafka action metadata and outcome semantics
- mixed-suite totals and grouping are consistent between UI and exports
- no action type is dropped or transformed into incompatible HTTP-only fields

### Scenario 11G: Kafka metadata field assertions pass and fail correctly

Steps:

1. Configure a standard runner kafkaProduce scenario with assertions on `kafka.partition` (expected: any non-negative integer) and `kafka.header.correlationId` (expected: equals `"order-123"`).
2. Run the scenario with a message that has `correlationId: "order-123"` in headers.
3. Rerun with a message whose header is `correlationId: "wrong-id"`.

Expected:

- first run: both assertions pass; `passed: true` on the result
- second run: header assertion fails; `failureDetails` identifies the `kafka.header.correlationId` field mismatch with the expected and actual values
- HTTP assertion operators (status code, response body) are not evaluated for Kafka actions

### Scenario 11H: Backward-compatible load of HTTP scenarios after `actionType` field is added

Steps:

1. Load a saved scenario set that was created before Phase 6 (no `actionType` field on any scenario).
2. Run the scenario set without editing.
3. Save and reload.

Expected:

- all scenarios without `actionType` are treated as `'http'` by the runner and results layer
- no migration error is thrown; no default mutation is written unless the user edits and re-saves
- `httpStatus`, `method-badge`, and HTTP-specific result columns render normally for these scenarios (no regression)

## Phase 7 - Load-mode Policy

Goal: keep Kafka consume behavior bounded and reproducible in load scenarios.

Phase 7 re-evaluation focus (2026-05-31):

- validate execution-mode compatibility matrix for consume load modes
- validate deterministic completion and reproducibility under constrained load policies
- validate constant-arrival backend capability gating and user-visible messaging
- validate backpressure/throughput observability (target, actual, dropped)

Integration scenarios:

### Scenario 12: Load mode enforces bounded consume policy

Steps:

1. Configure load mode with consume settings that should be blocked by policy.
2. Attempt run start and capture pre-run validation output.
3. Reconfigure to a supported policy mode and run again.

Expected:

- load mode blocks or constrains unsafe streaming consume behavior
- configuration explains the restriction to the user
- repeated runs remain reproducible with the same seeded data

### Scenario 12B: Compatibility matrix enforcement

Steps:

1. Evaluate each supported execution mode against consume load modes (`wait-for-real`, `auto-resume`, `synthetic-inject`) and planner-level `skip-dispatch` outcomes.
2. Record which combinations are allowed, warned, or blocked.

Expected:

- each combination has deterministic planner outcome (allow/warn/block)
- blocked combinations provide actionable remediation guidance
- allowed combinations do not silently downgrade behavior without explicit notice

### Scenario 12C: Deterministic replay under constrained policy

Steps:

1. Run the same policy-constrained load config at least three times.
2. Compare completion status and high-level throughput/error characteristics.

Expected:

- runs complete without unbounded waiting/hanging
- variance stays within agreed reproducibility envelope
- no stale consume state leaks across runs

### Scenario 12D: Constant-arrival capability gating

Steps:

1. Attempt constant-arrival run in environment/backend that does not support required executor path.
2. Attempt same run in supported desktop/backend path.

Expected:

- unsupported environment is blocked with explicit capability message
- supported environment runs and reports time-based progress correctly
- guidance is visible before run execution begins

### Scenario 12E: Backpressure observability and telemetry

Steps:

1. Execute high-pressure load config designed to trigger backpressure.
2. Observe live and final run metrics.

Expected:

- target throughput, achieved throughput, and dropped-request signals are visible where supported
- telemetry remains internally consistent across progress and final summary views
- operators can diagnose whether throttling is policy-driven vs runtime saturation

### Scenario 12F: `kafkaOperations` threading in workflow-load mode

Steps:

1. Build a workflow containing a Kafka Consume node configured with `loadTestBehavior.mode: 'auto-resume'`.
2. Run the workflow in `'workflow'` execution mode with N > 1 iterations and M > 1 concurrency.
3. Observe per-iteration results.

Expected:

- all iterations complete without a "Kafka operations not available" / "kafkaOperations undefined" failure
- each iteration respects the `auto-resume` load behavior (no real broker call per iteration)
- the `graphLoadRunner.ts` load path correctly forwards `kafkaOperations` into each `runGraph` call

### Scenario 12G: Policy blocks unsupported execution mode × consume mode combination

Steps:

1. Configure a workflow with a Kafka Consume node that has no explicit `loadTestBehavior` (defaults to `wait-for-real`).
2. Attempt to start a `'constant-arrival'` load run without the Tauri desktop backend.

Expected:

- the run is rejected **before** any iteration starts with an actionable policy error (e.g. "Kafka Consume node 'X' with wait-for-real behavior is not supported in constant-arrival mode without the desktop backend")
- no partial iteration results are emitted
- switching to `auto-resume` mode allows the run to proceed

### Scenario 12H: `'load-profile'` execution mode is not affected by Kafka policy

Steps:

1. Configure a `'load-profile'` run (scenario-based, no workflow graph).
2. Start the run.

Expected:

- the run starts without any Kafka policy pre-run validation errors
- no `kafkaLoadPolicy` check is invoked (Kafka graph nodes do not exist in the `'load-profile'` path)

## Phase 8 - Results Publishing to Kafka

Goal: validate optional publication of test/workflow summaries to Kafka.

Phase 8 re-evaluation focus (2026-05-31):

- validate publish envelope versioning and required field guarantees
- validate post-run publish side effect does not alter run completion outcome
- validate non-blocking failure behavior with bounded retry semantics
- validate plaintext and secure profile publish parity

Integration scenarios:

### Scenario 13: Run summary is published to Kafka after execution

Steps:

1. Enable results publishing.
2. Run a known test or workflow.
3. Consume from redfireforge.results.summary.

Expected:

- one summary payload is produced per run
- summary shape matches the contract
- failures to publish do not corrupt the primary run result

### Scenario 13B: Publishing disabled path

Steps:

1. Disable results publishing in settings.
2. Execute a known test/workflow run.
3. Inspect broker topic and local run history.

Expected:

- no publish event is emitted to summary topic
- local run completion and persistence are unchanged
- UI diagnostics clearly indicate publishing is disabled (not failed)

### Scenario 13C: Publish failure is non-blocking by default

Steps:

1. Enable publishing and run with broker unavailable or invalid publish credentials.
2. Execute run and inspect final run status plus publish diagnostics.

Expected:

- run is recorded with normal completion status based on test/workflow outcome
- publish diagnostics classify failure reason and retry behavior
- failure does not flip run status to publish-failed in default mode

### Scenario 13D: Envelope versioning and required fields

Steps:

1. Capture published summary payload for a completed run.
2. Validate payload against expected schema version contract.

Expected:

- payload includes required fields (`schemaVersion`, `runId`, timestamp, mode, summary metrics)
- optional fields are additive and do not break existing consumer parsing
- consumers can deduplicate by run id + schema version

### Scenario 13E: Secure-profile parity

Steps:

1. Publish in plaintext local broker profile.
2. Publish in secure auth/tls profile with equivalent run shape.
3. Compare envelope semantics and diagnostics.

Expected:

- envelope semantics match across plaintext and secure profiles
- auth/tls failures are clearly classified when present
- successful secure publish produces same contract-compliant payload shape

### Scenario 13F: Retry/idempotency behavior for publish events

Steps:

1. Enable publishing and induce a transient publish failure that later recovers.
2. Capture emitted summary events and compare run identifiers.

Expected:

- retries remain bounded (max 3 attempts, 10 s total cap) per policy
- successful publish does not produce ambiguous duplicate events without idempotency signals
- downstream dedupe using run id + schema version remains deterministic

### Scenario 13G: Publish hook fires at all three run completion paths

Steps:

1. Run a scenario-based test (path 1: `saveTestRun` at ~line 393 of `useTestExecution.ts` in `execute()`).
2. Run a workflow-mode test (path 2: `saveTestRun` at ~line 560 of `useTestExecution.ts` in `startExternalExecution()`).
3. Trigger a quota-override save (path 3: `forceSaveTestRun` at ~line 442 of `useTestExecution.ts` in `confirmSavePendingRun()`) by filling storage to quota, running a test, then accepting the force-save prompt.
4. In each case observe whether a publish event is emitted to the results topic.

Expected:

- one publish event is emitted per run for all three completion paths when publishing is enabled
- the `KafkaPublishOutcome` status (`published`/`failed`/`skipped`) is independently tracked per run and not mixed across the three paths
- a `quotaError` from `saveTestRun` does not suppress the publish attempt on either of the first two paths
- the force-save path (path 3) also triggers publish, ensuring no silent coverage gap for quota-override saves

## Phase 9 - Tauri-native Transport

Goal: prove native Tauri transport behavior is functionally equivalent to the server-proxy path for all Kafka operations in desktop mode, and that the server-proxy path remains fully unaffected in browser/dev mode.

Phase 9 re-evaluation focus (2026-05-31):

- validate native lifecycle commands (connect/disconnect/status/topics) produce contract-aligned response shapes
- validate native operation commands (produce/consume/subscribe/unsubscribe) with error mapping coverage
- validate transport factory routing: native path in Tauri, server-proxy in browser/dev
- validate golden-fixture parity across both transports for all operations
- validate subscription cleanup and no dangling threads on unsubscribe or app close

Integration scenarios:

### Scenario 14: Native transport contract parity (lifecycle)

Steps:

1. Run the Tauri desktop app in development mode.
2. Connect to a plaintext local broker using the Kafka Settings panel.
3. Retrieve topic list and cluster status via native commands.

Expected:

- connect/status/topics responses match the server contract shapes defined in `src-server/kafka/contracts.ts`
- equivalent errors (bad host, wrong port) map to the same UI-safe error messages as the server-proxy path
- no browser-mode regressions observed when running the same operations in browser/dev

### Scenario 14B: Native produce and consume operations

Steps:

1. In desktop (Tauri) mode, publish a message to a known topic using the native transport.
2. Consume the same message from the topic using native bounded consume.

Expected:

- message appears in consumer with correct key, headers, value, offset, and partition
- native produce returns broker-confirmed metadata consistent with server-proxy produce response shape
- bounded consume stops at configured limit

### Scenario 14C: Native subscription lifecycle and cleanup

Steps:

1. Subscribe to a topic in desktop mode.
2. Verify messages are received via Tauri event emission.
3. Unsubscribe and verify cleanup behavior.
4. Simulate app close while subscription is active.

Expected:

- subscription receives messages via `tauri::Emitter` events
- unsubscribe terminates the subscription cleanly with no dangling threads
- app close cleans up all active Kafka connections and subscriptions without error

### Scenario 14D: Transport factory routing

Steps:

1. Load the app in browser/dev mode (no Tauri runtime).
2. Trigger a Kafka connect operation.
3. Repeat the same operation in desktop (Tauri) mode.

Expected:

- browser/dev mode routes through server-proxy HTTP client exclusively (`transportOverride` is null; `defaultTransport` in `kafkaClient.ts` is used)
- Tauri mode routes through native `invoke`-based client exclusively (app initialization called `setKafkaClientTransport(kafkaNativeTauriTransport)`)
- no Tauri-specific imports are executed in browser mode (dynamic import of `@tauri-apps/api/core` is not triggered)
- transport selection is transparent to the calling feature code; all call sites use `dispatchKafkaOperation()` unchanged

### Scenario 14D-init: Transport registration at app initialization

Steps:

1. Launch the desktop app (Tauri mode).
2. Inspect whether `setKafkaClientTransport` is called with the native transport during initialization.
3. Launch in browser/dev mode and confirm `setKafkaClientTransport` is NOT called.

Expected:

- in Tauri mode: `kafkaNativeTauriTransport` is registered as the active transport at startup; all subsequent `dispatchKafkaOperation()` calls use the native path
- in browser/dev mode: no transport override is set; `kafkaClient.ts` uses `defaultTransport` (server-proxy HTTP) unchanged
- calling `setKafkaClientTransport(null)` restores the server-proxy default in both environments

### Scenario 14E: Cross-transport golden-fixture parity

Steps:

1. Execute each operation (connect, topics, produce, consume) using golden fixture inputs against both server-proxy and native transports.
2. Compare response envelopes.

Expected:

- success envelope shape is identical across both transports for all operations
- error envelope shape is identical for equivalent failure conditions (bad credentials, broker unavailable)
- downstream consumers (UI rendering, run results) behave identically regardless of transport

### Scenario 14F: Secure-profile parity across transports

Steps:

1. Connect to a secure (auth/TLS) broker profile in browser/dev mode via server-proxy.
2. Connect to the same profile in desktop mode via native transport.
3. Compare connection success/failure behavior and error messages.

Expected:

- auth/TLS errors produce equivalent UI-safe messages in both modes
- successful secure connection allows the same topic browse/produce/consume operations in both modes

### Scenario 14G: Concurrent operations — produce while subscriber active

Steps:

1. Subscribe to a topic in desktop (Tauri) mode.
2. While the subscription is active, publish a message to the same topic.
3. Confirm the subscription receives the message and both operations complete without interference.

Expected:

- produce command completes successfully and returns broker metadata
- active subscriber receives the produced message via `tauri::Emitter` event without dropped or duplicated events
- no race conditions or panics in Rust command handlers
- repeat the same test in browser/dev mode via server-proxy to confirm equivalent behavior

### Scenario 14H: Broker reconnect with active native subscription

Steps:

1. Subscribe to a topic in desktop mode.
2. Stop and restart the local broker while the subscription is active.
3. Observe native transport and subscription state behavior.

Expected:

- subscription disconnect is surfaced clearly (not silently dropped)
- after broker restart, re-subscribing succeeds without requiring app restart
- behavior is consistent with how the server-proxy handles broker reconnect (Scenario in section 8 cross-cutting scenarios)

## Phase 10 - Schema Registry (Optional)

Goal: validate that schema-aware produce and consume work correctly with explicit opt-in, and that all plain-JSON Kafka behavior is entirely unaffected when schema config is absent.

Phase 10 re-evaluation focus (2026-05-31):

- validate registry connection, subject listing, and version fetching
- validate Avro encode in produce and decode in consume with mocked registry
- validate `SCHEMA_MISMATCH` and `REGISTRY_UNREACHABLE` error codes are distinct and actionable
- validate that plain-JSON produce/consume paths are completely unaffected
- validate Phase 8 result publish envelope remains schema-agnostic

Integration scenarios:

### Scenario 15: Registry connection and subject listing

Steps:

1. Configure a schema registry URL in Kafka Settings.
2. Open the schema registry subject browser.
3. List available subjects and select one.

Expected:

- subject list populates from the registry `schema-subjects` API
- version list for the selected subject loads from `schema-versions` API
- schema preview for the selected version displays decoded field definitions
- if registry is unreachable, `REGISTRY_UNREACHABLE` is displayed as an actionable inline error (not a generic Kafka error)

### Scenario 15B: Schema-aware produce (Avro encoding)

Steps:

1. Enable schema config in the produce panel and select an Avro subject/version.
2. Publish a payload that matches the selected schema.
3. Confirm the message reaches the broker.

Expected:

- payload is encoded to Avro bytes via the registry client before sending; encoding happens in `kafka-service.ts`: `registry.encode()` returns a `Buffer`, which is converted to a base64 string stored in the `value` field before `adapter.send()` is called — `KafkaProducerMessage.value: string` in the adapter layer is never changed
- the produce response `valueEncoding` marker indicates `'base64-avro'`; existing plain-JSON produce responses show `'plain'`
- encoded message is readable by a schema-aware consumer with the same subject/version

### Scenario 15C: Schema-aware consume (Avro decoding)

Steps:

1. Consume messages from a topic where messages were Avro-encoded.
2. Enable schema config in the consume panel with the matching subject/version.

Expected:

- consumed message bytes are decoded to human-readable JSON form; decode uses the raw binary `rawValue` from the adapter, not the `.toString('utf-8')` version (which would corrupt Avro bytes)
- decoded value displays field names and values from the Avro schema
- consuming without schema config displays raw encoded bytes without error (`.toString('utf-8')` passthrough)
- the `rawValue` field is never visible in the HTTP response to the client; only the decoded `value` string appears in `KafkaConsumeRecord`
- **subscribe-path schema decode is out of scope for Phase 10B**: messages received through the subscribe (`KafkaSubscribeRequest`) path are NOT schema-decoded in the initial phase; subscribing to an Avro-encoded topic without schema config returns the raw bytes as a string (same as plain-JSON baseline)

### Scenario 15D: Schema mismatch failure handling

Steps:

1. Attempt to produce a payload that does not match the selected Avro schema.
2. Attempt to consume an Avro-encoded message using an incompatible schema version.

Expected:

- produce mismatch returns `SCHEMA_MISMATCH` error code with subject/version/format metadata in details
- consume mismatch returns `SCHEMA_MISMATCH` with enough detail to diagnose the incompatible field
- neither mismatch error is surfaced as a generic Kafka broker error

### Scenario 15E: Plain-JSON path unaffected when schema config is absent

Steps:

1. Produce and consume without enabling any schema config.
2. Confirm behavior is identical to Phase 6 baseline.

Expected:

- produce sends `value` as plain string — no encoding applied
- consume returns raw message value as plain string — no decoding attempted
- all Phase 6 runner actions continue to work without change
- Phase 8 result publish envelope is not affected

### Scenario 15F: Registry authentication failure

Steps:

1. Configure a registry URL with incorrect credentials.
2. Attempt to list subjects or produce with schema config enabled.

Expected:

- `REGISTRY_AUTH_FAILURE` error code returned (defined in 10B runtime checklist, distinct from `REGISTRY_UNREACHABLE` and `SCHEMA_MISMATCH`)
- plain-JSON produce/consume continues to work while registry auth is failing
- UI displays actionable error message prompting credentials review

### Scenario 15G: Registry unavailable at produce/consume time

Steps:

1. Configure schema registry and select a subject/version.
2. Take the registry offline.
3. Attempt a schema-aware produce.

Expected:

- `REGISTRY_UNREACHABLE` returned; produce does not fall back silently to unencoded produce
- error is clear and actionable: registry is required when `schemaConfig` is present and encode is expected
- existing plain-JSON produce (no `schemaConfig`) still succeeds with the registry offline

### Scenario 15H: Batch produce with request-level schema config

Steps:

1. Configure a valid schema registry and select an Avro subject.
2. Produce a batch of 3 messages (different `value` payloads) using the same `schemaConfig` at request level.

Expected:

- all 3 messages are encoded with the same schema; no per-message schema override attempted
- all 3 messages arrive at the broker Avro-encoded; a schema-aware consumer can decode each one
- if any message value fails schema validation, the entire batch is rejected with `SCHEMA_MISMATCH` (no partial produce)

### Scenario 15I: Schema ID caching reduces registry round-trips

Steps:

1. Produce 5 messages to the same topic with the same `schemaConfig.subject`.
2. Monitor server-side HTTP calls to the registry during the 5 produces.

Expected:

- registry is contacted **once** to resolve the schema ID on the first produce
- subsequent 4 produces reuse the cached schema ID without additional registry HTTP calls
- cache hit confirmed via server debug log or test spy on registry client `fetchSchema`

These must be covered at least once with a real broker:

- broker restart during active session
- broker disconnect during consume or wait
- stale cluster config loaded from storage after schema changes
- duplicate subscription attempt
- rapid connect/disconnect/connect sequence
- large payload near configured size limit
- invalid JSON body in publish screen
- non-JSON payload display fallback
- read-only cluster preventing write actions

## 9. Visual Acceptance Checklist

Before Kafka UI work is considered done, verify these manually or through Playwright-backed screenshots:

- Cluster cards show correct status colors and action availability
- Security sections expand/collapse and validate correctly
- Topic list filtering is readable and responsive
- Message detail shows key, headers, body, offset, partition, timestamp
- Publish success UI shows actual broker metadata
- Consume results remain bounded and stop at configured limits
- Workflow canvas shows Kafka nodes with stable labels and config persistence
- Run history clearly differentiates waiting, resumed, timeout, failed

## 10. Recommended Execution Order

Run validation in this order to keep failures local and diagnosable:

1. Unit tests for the touched Kafka slice.
2. Real broker integration tests for that slice.
3. Playwright visual/integration tests for the touched UI flow.
4. TypeScript + ESLint validation.
5. Shared staging validation before merge to long-lived branches.

## 11. Smoke Commands

Use these command groups once Kafka implementation exists:

1. TypeScript
   - npx tsc -b --noEmit
2. Targeted unit/integration tests
   - npx vitest run src-server/kafka src/features/kafka src/features/workflow
3. Visual/integration tests
   - npx playwright test e2e/kafka-settings.spec.ts e2e/kafka-topic-explorer.spec.ts e2e/kafka-message-studio.spec.ts e2e/kafka-workflow-nodes.spec.ts e2e/kafka-trigger-wait.spec.ts --reporter=list
4. Staging verification
   - run the same Playwright Kafka specs against the staging-configured environment

## 12. Definition of Done for Kafka Testing

Kafka support is not done when the transport works in isolation. It is done only when:

- the app can connect to a real broker from the actual UI
- users can browse topics and inspect real messages visually
- users can publish and consume real messages through the app
- workflows can produce, consume, trigger, and wait with real Kafka data
- runner flows can execute Kafka actions and render results correctly
- secure cluster scenarios have been exercised
- browser/dev and later desktop transport are both validated
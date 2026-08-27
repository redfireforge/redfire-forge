# Kafka Local Development Guide

Status: active (plaintext assets implemented and runtime smoke validated)
Last updated: 2026-05-29

## Purpose

This guide defines the local Kafka development environment expected by the future Kafka integration work.

The goal is not just to run a broker once. The goal is to have a repeatable local environment that supports:

- backend integration testing
- browser UI testing
- Playwright visual testing
- workflow Kafka feature validation
- runner Kafka scenario validation
- security validation with auth and TLS

## Local Environment Strategy

RedfireForge should support two local Docker-backed Kafka profiles:

1. Plaintext profile for fast day-to-day development and most automated integration checks.
2. Secure profile for SASL and TLS validation.

Recommended default local broker:

- Redpanda in Docker

Reasoning:

- simpler local bootstrap than a heavier Kafka stack
- fast startup for repeated local testing
- sufficient Kafka-compatible behavior for early RedfireForge integration work

If a later compatibility issue appears, Apache Kafka in Docker can be added as a second validation target. It should not replace the simpler default local developer setup unless required.

## Planned Repository Layout

Planned local infra files:

- docker/kafka/plaintext/docker-compose.yml
- docker/kafka/secure/docker-compose.yml
- docker/kafka/topics/create-topics.sh
- docker/kafka/topics/reset-topics.sh
- docker/kafka/topics/seed-messages.sh
- docker/kafka/certs/
- docker/kafka/env/

Current repository status (2026-05-29):

- Directory skeleton created for all paths above.
- Plaintext compose file implemented.
- Topic create/reset/seed scripts implemented.
- Healthcheck and smoke-test scripts implemented.
- Bootstrap helper implemented at `scripts/kafka-plaintext-bootstrap.sh`.
- Plaintext bootstrap and runtime smoke now pass against Docker Desktop with a real local Redpanda broker and the repo's Kafka-enabled server.

Notes:

- sample env templates may be committed
- real local secrets must stay in ignored env files
- cert material used only for local testing should be clearly separated from any real environment credentials

## Local Topics

The local Docker environment should create and seed these topics at minimum:

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

## Seed Message Requirements

Seed data should include:

- repeated message keys such as customer-123 and customer-456
- headers such as traceId, source, env
- JSON payloads suitable for JSONPath and correlation matching
- at least one negative or non-matching payload
- at least one delayed-message scenario for wait-timeout testing

Suggested payload families:

1. Order created event
2. Payment authorized event
3. Failure or dead-letter style event
4. Results summary event

## Plaintext Profile

Purpose:

- default developer environment
- most backend integration checks
- most Playwright UI and workflow tests

Expected characteristics:

- single-node broker
- no auth
- no TLS
- seeded topics available immediately after bootstrap
- quick reset and reseed cycle

Minimum validation flow:

1. Bring up Docker environment.
2. Verify broker health.
3. Create topics.
4. Seed messages.
5. Connect from RedfireForge server integration.
6. List topics.
7. Produce a message.
8. Consume a message.
9. Tear environment down cleanly.

Implemented local commands:

1. Start + full plaintext bootstrap:
	- `./scripts/kafka-plaintext-bootstrap.sh`
2. Start only the broker stack:
	- `docker compose -f docker/kafka/plaintext/docker-compose.yml up -d`
3. Healthcheck only:
	- `./docker/kafka/plaintext/healthcheck.sh`
4. Create topics:
	- `./docker/kafka/topics/create-topics.sh`
5. Reset topics:
	- `./docker/kafka/topics/reset-topics.sh`
6. Seed messages:
	- `./docker/kafka/topics/seed-messages.sh`
7. API smoke flow only:
	- `./docker/kafka/plaintext/smoke-test.sh`
8. Stop stack:
	- `docker compose -f docker/kafka/plaintext/docker-compose.yml down --remove-orphans`

Validation status in this workspace:

- `bash -n` passed for all plaintext/topic/bootstrap shell scripts.
- `docker compose -f docker/kafka/plaintext/docker-compose.yml config -q` passed.
- Asset verification tests passed.
- End-to-end Docker runtime smoke passed: bootstrap -> healthcheck -> topic create -> seed -> connect -> topics -> produce -> consume-once -> disconnect -> teardown.

Phase 1D runtime fixes applied after live validation:

- `seed-messages.sh` now uses Redpanda `rpk topic produce` header syntax compatible with the current image (`-H key:value`), instead of unsupported `--headers`.
- `smoke-test.sh` now bypasses corporate/system HTTP proxies for localhost traffic.
- `smoke-test.sh` now verifies the target base URL exposes `/api/kafka/status` before attempting connect.
- `scripts/kafka-plaintext-bootstrap.sh` now auto-starts a Kafka-enabled local server from this repo on an isolated port when needed.
- `consume-once` server logic was hardened so response settlement is not blocked indefinitely by KafkaJS consumer cleanup.
- Smoke produce/consume now uses a unique per-run key, trace id, and group id so each run validates the fresh message it just produced.

## Secure Profile

Purpose:

- validate actual security configuration behavior through the product UI and transport layer
- verify auth and TLS error handling is readable and actionable

Initial security coverage:

- SASL/PLAIN
- SASL/SCRAM
- TLS server verification
- optional client certificate and key inputs for clusters that require mTLS-like behavior later

Expected validation matrix:

1. Valid SASL/PLAIN credentials
2. Valid SCRAM credentials
3. Invalid username or password
4. TLS enabled with valid CA
5. TLS enabled with invalid or missing CA
6. Read-only style cluster connection that allows browse but blocks publish

Minimum validation flow:

1. Bring up secure Docker environment.
2. Load secure cluster profile in RedfireForge.
3. Verify plaintext fields are hidden or disabled where not applicable.
4. Test connection with valid credentials.
5. Test connection with invalid credentials.
6. Test connection with valid CA.
7. Test connection with invalid or missing CA.
8. Confirm topic browsing works when connected.
9. Confirm publish is blocked or fails clearly on read-only profile.

## UI Validation Expectations

Local Kafka development is not complete if only API-level tests pass.

For user-facing Kafka work, local validation should also cover:

- settings form state transitions
- topic browser search and detail rendering
- publish success metadata display
- consume filter behavior and bounded result count
- workflow Kafka node configuration and execution visibility
- Kafka trigger and KafkaWait run-history states

## Playwright Expectations

Once Kafka UI work exists, add or maintain Playwright coverage for:

- e2e/kafka-settings.spec.ts
- e2e/kafka-topic-explorer.spec.ts
- e2e/kafka-message-studio.spec.ts
- e2e/kafka-workflow-nodes.spec.ts
- e2e/kafka-trigger-wait.spec.ts
- e2e/kafka-runner-integration.spec.ts
- e2e/kafka-results-publishing.spec.ts

These tests should run against the plaintext Docker profile by default, with a smaller secure-profile smoke suite for auth and TLS paths.

## Backend and Integration Expectations

At minimum, local Kafka backend validation should cover:

- connect and disconnect
- topic listing
- produce
- consume once
- subscribe and unsubscribe cleanup
- timeout handling
- filter handling by key, headers, and JSON body
- no leaked consumers after disconnect

## Day-to-Day Workflow

Planned developer workflow:

1. Start plaintext Kafka Docker profile.
2. Seed or reset topics.
3. Run targeted backend and UI tests.
4. Run Playwright Kafka flows when touching user-facing behavior.
5. Switch to secure profile when touching auth, TLS, or connection-state UX.
6. Tear down and reset the environment when done.

## Staging Follow-up

Local Docker validation is required but not sufficient.

Before Kafka work is considered production-ready, the same feature slice should also be validated against a shared staging Kafka cluster with:

- realistic latency
- multiple brokers
- secure connection settings
- reserved RedfireForge test topics
- at least one read-only validation profile

## Draft Follow-up Work

This guide now reflects the implemented plaintext local assets. Secure profile assets remain pending.

Next implementation steps:

1. Add secure Docker compose file.
2. Add secure env templates and ignored local secret files.
3. Keep rerunning plaintext runtime bootstrap as the default local Phase 1 regression path.
4. Add a real broker integration test command/script for CI or local verification.
5. Extend guide with secure-profile startup and failure-path examples.

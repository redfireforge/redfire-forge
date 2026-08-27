# Kafka E2E Test Scripts

End-to-end test scripts for validating Kafka integration across all Docker profiles.

## Quick Start

```bash
# One command to start everything, seed data, and run all smoke tests:
./run-all-smoke.sh

# Just start Docker and seed data (no smoke tests) — then manually test the UI:
./run-all-smoke.sh --seed-only

# Run only one profile:
./run-all-smoke.sh plaintext
./run-all-smoke.sh secure
./run-all-smoke.sh schema-registry

# Skip Docker start (containers already running):
./run-all-smoke.sh --skip-docker
```

## Scripts

| Script | Purpose |
|---|---|
| `ui-test-seed.sh` | Creates 16 topics + seeds 20+ messages needed by the test-scenario MD files. Uses `rpk` inside Docker — no local tools needed. |
| `run-all-smoke.sh` | One-command wrapper: starts Docker, seeds data, runs all profile smoke tests (plaintext, secure, schema-registry). |

## Profiles

| Profile | Broker Port | Auth | Extra |
|---|---|---|---|
| Plaintext | 19092 | None | Basic Kafka operations |
| Secure | 19093 | SASL/SCRAM-SHA-256 | Auth validation, error classification |
| Schema Registry | 19094 | None | Avro encode/decode round-trip |

## For Manual UI Testing

1. Run `./run-all-smoke.sh --seed-only` to start Docker and seed data
2. Start the server: `npm run server`
3. Start the web UI: `npm run dev`
4. Open http://localhost:5173
5. Exercise Kafka Studio against the seeded plaintext broker (127.0.0.1:19092)

## Prerequisites

- Docker Desktop running
- `jq` installed (`brew install jq`)
- Local server running (`npm run server`) — for smoke tests only

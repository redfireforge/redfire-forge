# gRPC Phase 13A - SLO Baseline Harness

Phase 13A introduces the first executable SLO baseline loop for gRPC Studio control-plane routes.

## Scope (initial)

This baseline harness currently measures fast, dependency-light control-plane APIs that do not require an external gRPC target:

- GET `/api/grpc/describe/usage`
- GET `/api/grpc/k8s-port-forward/status?scopeId=phase13a-baseline`

Why this subset first:

- It lets us wire measurement and CI gate plumbing now.
- It avoids flaky external service dependencies while we establish reliable threshold enforcement.
- Data-plane SLOs for unary/streaming traffic will be expanded in Phase 13B with fixture-backed probes.

## Commands

Capture baseline report:

```bash
npm run grpc:phase13a:baseline
```

Run SLO gate with thresholds:

```bash
npm run grpc:phase13a:gate
```

Run fixture-backed Phase 13B probe capture (requires local gRPC fixture on `127.0.0.1:50051`):

```bash
npm run grpc:phase13b:baseline
```

Run fixture-backed Phase 13B gate:

```bash
npm run grpc:phase13b:gate
```

Run fixture-backed Phase 13B CI orchestration locally (starts fixture + API, runs strict gate, tears down):

```bash
npm run grpc:phase13b:ci
```

Run Phase 13C failure drills (route resilience matrix):

```bash
npm run grpc:phase13c:drills
```

Run strict Phase 13C gate (requires a live API server):

```bash
npm run grpc:phase13c:gate
```

Run Phase 13D recovery/degradation drills:

```bash
npm run grpc:phase13d:drills
```

Run strict Phase 13D gate (requires a live API server):

```bash
npm run grpc:phase13d:gate
```

Run Phase 13E accessibility/virtualization checks:

```bash
npm run grpc:phase13e:a11y
```

Run strict Phase 13E gate (a11y checks + focused schema diff panel tests):

```bash
npm run grpc:phase13e:gate
```

Run Phase 13F observability + redaction static audit:

```bash
npm run grpc:phase13f:observability
```

Run strict Phase 13F gate (observability audit + focused redaction/telemetry tests):

```bash
npm run grpc:phase13f:gate
```

Run Phase 13H operational rollback drill checks:

```bash
npm run grpc:phase13h:rollback
```

Run strict Phase 13H gate (runbook/CI checks + live rollback drill):

```bash
npm run grpc:phase13h:gate
```

Run Phase 13I final GA sign-off checks:

```bash
npm run grpc:phase13i:signoff
```

Run strict Phase 13I gate:

```bash
npm run grpc:phase13i:gate
```

Optional flags (direct script usage):

```bash
node scripts/grpc-phase13-baseline.mjs \
  --base-url=http://127.0.0.1:3001 \
  --samples=15 \
  --timeout-ms=3500 \
  --max-p95-ms=450 \
  --max-avg-ms=250 \
  --max-error-rate=0.05 \
  --probe-grpc-target=127.0.0.1:50051 \
  --probe-samples=3 \
  --require-data-plane \
  --out=artifacts/grpc-phase13a-baseline.json \
  --require-live
```

## Output

Default output file:

- `artifacts/grpc-phase13a-baseline.json`

Report includes:

- per-route latency summary (`avg`, `p95`, `min`, `max`)
- route error rate
- total probe success/failure
- threshold values used for gate evaluation
- server-side route performance telemetry snapshot (`GET /api/grpc/perf/snapshot`)
- optional data-plane probe summary (`/api/grpc/call`, `/api/grpc/stream/start|send|end`)

## CI behavior

The CI workflow starts the server, waits for readiness, then runs:

```bash
npm run grpc:phase13a:gate -- --require-live
```

If thresholds are exceeded, the job fails.

## Next expansion (Phase 13B)

Planned additions:

1. fixture-backed unary route latency probes (`/api/grpc/call`)
2. stream start/send/end lifecycle latency probes
3. trend comparison against prior baseline artifact history

Current progress (2026-07-03):

- ✅ server-side route performance telemetry is now captured in gRPC routes
- ✅ baseline output now embeds route telemetry snapshot data
- ✅ optional fixture-backed unary + stream lifecycle probes are available via `--probe-grpc-target`
- ✅ CI now includes a dedicated fixture-backed Phase 13B probe gate (`grpc-phase13b-slo`) and uploads `artifacts/grpc-phase13b-baseline.ci.json`
- ✅ Phase 13C failure drill harness added (`scripts/grpc-phase13c-drills.mjs`) with deterministic error-path checks
- ✅ CI now includes a dedicated Phase 13C drill gate (`grpc-phase13c-drills`) and uploads `artifacts/grpc-phase13c-drills.json`
- ✅ Phase 13D recovery drill harness added (`scripts/grpc-phase13d-recovery.mjs`) for graceful-degradation checks
- ✅ CI now includes a dedicated Phase 13D recovery gate (`grpc-phase13d-recovery`) and uploads `artifacts/grpc-phase13d-recovery.json`
- ✅ Phase 13E schema-diff list virtualization and accessibility semantics landed in `GrpcSchemaDiffPanel.tsx`
- ✅ Phase 13E static a11y gate added (`scripts/grpc-phase13e-a11y.mjs`) with focused panel test gate wiring
- ✅ Phase 13F observability taxonomy module landed (`src-server/grpc/grpcObservabilityTaxonomy.ts`) and route telemetry now uses centralized route IDs
- ✅ Phase 13F redaction/observability audit gate added (`scripts/grpc-phase13f-observability.mjs`) with CI wiring
- ✅ Phase 13H operational runbook added (`docs/guides/grpc-phase13h-operations-runbook.md`)
- ✅ Phase 13H rollback drill gate added (`scripts/grpc-phase13h-rollback-drill.mjs`) with CI wiring
- ✅ Phase 13I final GA sign-off gate added (`scripts/grpc-phase13i-ga-signoff.mjs`) with CI wiring (`grpc-phase13i-ga-signoff`)

## Phase 13E scope (initial)

- schema-diff list virtualization for large result sets
- explicit list/listitem semantics and status live-region support
- CI-safe static a11y contract checks + focused component tests

## Phase 13F scope (initial)

- centralized route telemetry taxonomy for gRPC route IDs and surface classification
- static gate that verifies telemetry route IDs are taxonomy-backed and redaction primitives remain present
- focused tests for taxonomy integrity and redaction/telemetry behavior

## Phase 13H scope (initial)

- operational runbook covering incident triage, rollback decision matrix, and post-rollback verification
- executable rollback drill gate validating runbook completeness and CI phase-chain integrity
- optional live drill path (`--require-live`) to verify recovery after controlled unreachable status probe

## Phase 13I scope (initial)

- aggregate upstream phase artifacts (13C/13D/13E/13F/13H) into one GA sign-off report
- validate CI phase chain and pull-request guard through `grpc-phase13i-ga-signoff`
- validate package gate script availability for 13A..13I checkpoints

## Phase 13C failure matrix (initial)

The current drill harness validates six high-signal failure paths:

- invalid request body on reflect (`POST /api/grpc/reflect` with array payload) -> `HTTP 400` + `GRPC_INVALID_REQUEST`
- send against missing stream (`POST /api/grpc/stream/:id/send`) -> `HTTP 404` + `GRPC_REQUEST_NOT_FOUND`
- unreachable status probe (`GET /api/grpc/status` for `127.0.0.1:1`) -> controlled envelope (`HTTP 200` + `reachable=false`) or explicit `HTTP 503` + `GRPC_UNREACHABLE`
- descriptor lookup for unknown key (`POST /api/grpc/descriptor/lookup`) -> controlled descriptor error (`HTTP 404` + `GRPC_REQUEST_NOT_FOUND` or `HTTP 400` + `GRPC_INVALID_DESCRIPTOR`)
- invalid request body on k8s port-forward start (`POST /api/grpc/k8s-port-forward/start`) -> `HTTP 400` + `GRPC_INVALID_REQUEST`
- invalid request body on k8s port-forward stop (`POST /api/grpc/k8s-port-forward/stop`) -> `HTTP 400` + `GRPC_INVALID_REQUEST`

These checks are intentionally deterministic and CI-safe, and provide a regression tripwire for route envelope/status mapping.

## Phase 13D recovery matrix (expanded)

Each scenario intentionally triggers a controlled failure path, then immediately verifies control-plane recovery via `GET /api/grpc/describe/usage`.

- invalid reflect payload -> service remains responsive
- missing stream send -> service remains responsive
- unreachable status probe -> service remains responsive
- invalid call payload (`POST /api/grpc/call`) -> service remains responsive
- unknown descriptor lookup (`POST /api/grpc/descriptor/lookup`) -> service remains responsive
- invalid k8s port-forward start payload (`POST /api/grpc/k8s-port-forward/start`) -> service remains responsive

This focuses on graceful degradation and immediate post-failure recoverability without requiring external fixture dependencies.

Latest validation (2026-07-03):

- ✅ `npm run grpc:phase13a:gate -- --require-live --base-url=http://127.0.0.1:3002 --samples=6 --timeout-ms=3500 --out=artifacts/grpc-phase13a-gate.validation.json`
- ✅ Gate passed with zero probe failures and embedded `routePerformanceSnapshot`
- ✅ Probe-enabled baseline run validated with graceful skip when fixture target is unavailable
- ✅ `npm run grpc:phase13b:gate -- --base-url=http://127.0.0.1:3002 --samples=4 --timeout-ms=3500 --out=artifacts/grpc-phase13b-gate.validation.json` passed after fixing stream probe `tabId` handling
- ✅ Additional review round: strict gate pass path (`artifacts/grpc-phase13b-gate.review-pass.json`) and expected strict-failure path with missing fixture target (`artifacts/grpc-phase13b-gate.review-missing-fixture.json`) both validated
- ✅ Logging prefix normalized to `[grpc-phase13]` for shared 13A/13B harness output
- ✅ CI promotion landed: `.github/workflows/ci.yml` now runs `npm run grpc:phase13b:ci` (docker fixture + strict `--require-data-plane` gate)
- ✅ `npm run grpc:phase13c:gate -- --base-url=http://127.0.0.1:3002 --out=artifacts/grpc-phase13c-drills.validation.json` passed with 3/3 drills
- ✅ `npm run grpc:phase13i:gate` passed with 19/19 checks (`artifacts/grpc-phase13i-ga-signoff.json`)
- ℹ️ Local `127.0.0.1:3001` may be occupied in some environments; use `--base-url` override for deterministic local validation.

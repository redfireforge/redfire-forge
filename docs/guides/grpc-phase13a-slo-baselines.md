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

Latest validation (2026-07-03):

- ✅ `npm run grpc:phase13a:gate -- --require-live --base-url=http://127.0.0.1:3002 --samples=6 --timeout-ms=3500 --out=artifacts/grpc-phase13a-gate.validation.json`
- ✅ Gate passed with zero probe failures and embedded `routePerformanceSnapshot`
- ✅ Probe-enabled baseline run validated with graceful skip when fixture target is unavailable
- ✅ `npm run grpc:phase13b:gate -- --base-url=http://127.0.0.1:3002 --samples=4 --timeout-ms=3500 --out=artifacts/grpc-phase13b-gate.validation.json` passed after fixing stream probe `tabId` handling
- ✅ Additional review round: strict gate pass path (`artifacts/grpc-phase13b-gate.review-pass.json`) and expected strict-failure path with missing fixture target (`artifacts/grpc-phase13b-gate.review-missing-fixture.json`) both validated
- ✅ Logging prefix normalized to `[grpc-phase13]` for shared 13A/13B harness output
- ✅ CI promotion landed: `.github/workflows/ci.yml` now runs `npm run grpc:phase13b:ci` (docker fixture + strict `--require-data-plane` gate)
- ℹ️ Local `127.0.0.1:3001` may be occupied in some environments; use `--base-url` override for deterministic local validation.

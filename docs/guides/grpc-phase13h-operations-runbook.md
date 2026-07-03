# gRPC Phase 13H - Operational Runbook and Rollback Drills

Phase 13H defines operational response steps and executable rollback drills for the Phase 13 gRPC hardening gates.

## Commands

Run static 13H rollback drill checks (runbook + CI chain):

```bash
npm run grpc:phase13h:rollback
```

Run strict 13H gate with live API verification:

```bash
npm run grpc:phase13h:gate
```

Direct script invocation with explicit base URL:

```bash
node scripts/grpc-phase13h-rollback-drill.mjs \
  --base-url=http://127.0.0.1:3001 \
  --timeout-ms=3500 \
  --require-live \
  --out=artifacts/grpc-phase13h-rollback-drill.json
```

## Incident Triage

1. Confirm failing phase and artifact in CI (`grpc-phase13a-slo` through `grpc-phase13h-rollback`).
2. Reproduce locally using the same gate command and base URL.
3. Classify failure as one of:
- route contract failure
- environment/readiness failure
- static policy failure (taxonomy/runbook/CI chain)
4. Capture evidence:
- command output
- gate artifact JSON under `artifacts/`
- relevant server log excerpt

## Rollback Decision Matrix

| Condition | Action |
|---|---|
| Gate fails due to deterministic product regression | Revert offending change set and re-run affected phase gate(s) |
| Gate fails due to CI wiring regression | Restore last known-good workflow gate chain and re-run CI |
| Gate fails due to transient local environment issue | Keep code, re-run with validated live base URL and readiness |
| Multiple adjacent phase gates fail | Roll back to last commit where 13A-13F all pass, then re-apply incrementally |

## Immediate Rollback Procedure

1. Identify the latest known-good commit for the phase chain.
2. Revert the minimal offending commit(s) on the feature branch.
3. Re-run the nearest strict gate first, then forward-check dependent gates.
4. Restore forward progress by re-introducing changes behind passing checks.

Recommended gate order after rollback:

```bash
npm run grpc:phase13e:gate
npm run grpc:phase13f:gate
npm run grpc:phase13h:gate
npx tsc -b --noEmit
```

## Verification After Rollback

A rollback is considered complete only when:

1. The previously failing gate passes.
2. Adjacent dependency gates pass.
3. TypeScript build is clean.
4. Updated artifact JSON is produced for the rerun phase.

## Artifact Checklist

Expected artifacts for current hardening stages:

- `artifacts/grpc-phase13a-baseline.json`
- `artifacts/grpc-phase13b-baseline.ci.json`
- `artifacts/grpc-phase13c-drills.json`
- `artifacts/grpc-phase13d-recovery.json`
- `artifacts/grpc-phase13e-a11y.json`
- `artifacts/grpc-phase13f-observability.json`
- `artifacts/grpc-phase13h-rollback-drill.json`

## Operational Notes

- For localhost readiness in CI and local shell environments with proxies, use `curl --noproxy '*'`.
- Keep rollback steps branch-local; do not merge rollback commits until the full target gate set is green.

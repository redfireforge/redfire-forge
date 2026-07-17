#!/usr/bin/env bash
# Phase 11B - Load-test scheduler core gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11B gate: load-test scheduler core ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcLoadTestSchedulerCore.ts
  src/shared/grpc/grpcPhase11bAcceptance.test.ts
  scripts/test-grpc-phase11b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11B deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11b' >&2
  exit 1
fi

if ! grep -q 'startGrpcLoadTestSchedulerRun' "$ROOT/src/shared/grpc/grpcLoadTestSchedulerCore.ts"; then
  echo 'Missing scheduler entrypoint in grpcLoadTestSchedulerCore' >&2
  exit 1
fi
if ! grep -q 'assertGrpcLoadTestRunSnapshot' "$ROOT/src/shared/grpc/grpcLoadTestSchedulerCore.ts"; then
  echo 'Missing run snapshot validation in grpcLoadTestSchedulerCore' >&2
  exit 1
fi

if ! grep -q 'requestGrpcAdvancedOperationCancellation' "$ROOT/src/shared/grpc/grpcLoadTestSchedulerCore.ts"; then
  echo 'Missing 11A cancellation wiring in grpcLoadTestSchedulerCore' >&2
  exit 1
fi

if ! grep -q 'enforceDurationStop' "$ROOT/src/shared/grpc/grpcLoadTestSchedulerCore.ts"; then
  echo 'Missing duration deadline enforcement in grpcLoadTestSchedulerCore' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase11bAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 27 ]]; then
  echo "Expected at least 27 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11B acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11bAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 11A regression ---"
grpc_gate_run_regression "Phase phase11a" test:grpc:phase11a
echo ""

echo "=== Phase 11B gate: PASSED ==="
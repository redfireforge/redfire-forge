#!/usr/bin/env bash
# Phase 11C - Load-test metrics pipeline and export gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11C gate: load-test metrics pipeline and export ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcLoadTestMetrics.ts
  src/shared/grpc/grpcLoadTestMetrics.test.ts
  scripts/test-grpc-phase11c.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11C deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11c"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11c' >&2
  exit 1
fi

if ! grep -q 'buildGrpcLoadTestRunSummaryExport' "$ROOT/src/shared/grpc/grpcLoadTestMetrics.ts"; then
  echo 'Missing summary export builder in grpcLoadTestMetrics' >&2
  exit 1
fi
if ! grep -q 'serializeGrpcLoadTestRunSummaryCsv' "$ROOT/src/shared/grpc/grpcLoadTestMetrics.ts"; then
  echo 'Missing CSV serializer in grpcLoadTestMetrics' >&2
  exit 1
fi

if ! grep -q 'countAttemptOutcomes' "$ROOT/src/shared/grpc/grpcLoadTestMetrics.ts"; then
  echo 'Missing measured outcome aggregation in grpcLoadTestMetrics' >&2
  exit 1
fi
if ! grep -q 'serializeGrpcLoadTestRunSummaryJson' "$ROOT/src/shared/grpc/grpcLoadTestMetrics.ts"; then
  echo 'Missing JSON serializer in grpcLoadTestMetrics' >&2
  exit 1
fi

if ! grep -q 'formatStatusCodeDistributionKeys' "$ROOT/src/shared/grpc/grpcLoadTestMetrics.ts"; then
  echo 'Missing deterministic status-code formatting in grpcLoadTestMetrics' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcLoadTestMetrics.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 21 ]]; then
  echo "Expected at least 21 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11C metrics tests ---"
npx vitest run \
  src/shared/grpc/grpcLoadTestMetrics.test.ts
echo ""

echo "--- Step 3: Phase 11B regression ---"
grpc_gate_run_regression "Phase phase11b" test:grpc:phase11b
echo ""

echo "=== Phase 11C gate: PASSED ==="

#!/usr/bin/env bash
# Phase 8D — gRPC harness assertion engine gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8D: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcHarnessAssertPath.ts
  src/shared/grpc/grpcHarnessAssertPath.test.ts
  src/shared/grpc/grpcHarnessNumericCompare.ts
  src/shared/grpc/grpcHarnessNumericCompare.test.ts
  src/shared/grpc/grpcHarnessAssertEngine.ts
  src/shared/grpc/grpcHarnessAssertEngine.test.ts
  src/shared/grpc/grpcPhase8dAcceptance.test.ts
  src/engine/grpcExecution.ts
  scripts/test-grpc-phase8d.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8D deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8d"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8d' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcHarnessAssertPath.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessNumericCompare.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessAssertEngine.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8dAcceptance.test.ts" \
  "$ROOT/src/engine/grpcExecution.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 20 ]]; then
  echo "Expected at least 20 Phase 8D tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 8D: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8D: Harness assertion tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessAssertPath.test.ts \
  src/shared/grpc/grpcHarnessNumericCompare.test.ts \
  src/shared/grpc/grpcHarnessAssertEngine.test.ts \
  src/shared/grpc/grpcPhase8dAcceptance.test.ts \
  src/engine/grpcExecution.test.ts

echo "== Phase 8D: Phase 8C regression =="
grpc_gate_run_regression "Phase phase8c" test:grpc:phase8c

echo ""
echo "Phase 8D gate: ALL PASSED"

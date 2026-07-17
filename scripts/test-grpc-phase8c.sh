#!/usr/bin/env bash
# Phase 8C — gRPC harness execution handlers gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8C: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcHarnessRuntimeContext.ts
  src/shared/grpc/grpcHarnessRuntimeContext.test.ts
  src/shared/grpc/grpcHarnessUnaryExecutor.ts
  src/shared/grpc/grpcHarnessStreamCollector.ts
  src/shared/grpc/grpcHarnessExecutor.ts
  src/shared/grpc/buildGrpcHarnessOperations.ts
  src/engine/grpcExecution.ts
  src/shared/grpc/grpcHarnessUnaryExecutor.test.ts
  src/shared/grpc/grpcHarnessStreamCollector.test.ts
  src/shared/grpc/grpcHarnessExecutor.test.ts
  src/engine/grpcExecution.test.ts
  src/shared/grpc/grpcPhase8cAcceptance.test.ts
  scripts/test-grpc-phase8c.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8C deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8c"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8c' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcHarnessRuntimeContext.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessUnaryExecutor.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessStreamCollector.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessExecutor.test.ts" \
  "$ROOT/src/engine/grpcExecution.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8cAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 24 ]]; then
  echo "Expected at least 24 Phase 8C tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 8C: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8C: Harness execution tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessRuntimeContext.test.ts \
  src/shared/grpc/grpcHarnessUnaryExecutor.test.ts \
  src/shared/grpc/grpcHarnessStreamCollector.test.ts \
  src/shared/grpc/grpcHarnessExecutor.test.ts \
  src/engine/grpcExecution.test.ts \
  src/shared/grpc/grpcPhase8cAcceptance.test.ts \
  src/shared/grpc/buildGrpcHarnessOperations.test.ts

echo "== Phase 8C: Phase 8B regression =="
grpc_gate_run_regression "Phase phase8b" test:grpc:phase8b

echo "== Phase 8C: Phase 8A regression =="
grpc_gate_run_regression "Phase phase8a" test:grpc:phase8a

echo ""
echo "Phase 8C gate: ALL PASSED"

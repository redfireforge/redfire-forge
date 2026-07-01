#!/usr/bin/env bash
# Phase 8G — gRPC harness result model publication gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8G: Deliverable files =="
DELIVERABLES=(
  src/shared/types/grpc-harness-result.ts
  src/shared/grpc/grpcHarnessResultBuilder.ts
  src/shared/grpc/grpcHarnessResultBuilder.test.ts
  src/shared/grpc/grpcPhase8gAcceptance.test.ts
  src/shared/grpc/grpcHarnessAssertEngine.ts
  src/engine/grpcExecution.ts
  scripts/test-grpc-phase8g.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8G deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8g"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8g' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcHarnessResultBuilder.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8gAcceptance.test.ts" \
  "$ROOT/src/engine/grpcExecution.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 8G-related tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 8G: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8G: Harness result model tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessResultBuilder.test.ts \
  src/shared/grpc/grpcPhase8gAcceptance.test.ts \
  src/engine/grpcExecution.test.ts

echo "== Phase 8G: Phase 8F regression =="
grpc_gate_run_regression "Phase phase8f" test:grpc:phase8f

echo ""
echo "Phase 8G gate: ALL PASSED"

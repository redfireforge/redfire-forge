#!/usr/bin/env bash
# Phase 8E — gRPC harness numeric/trailer hardening gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8E: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcHarnessNumericCompare.ts
  src/shared/grpc/grpcHarnessNumericCompare.test.ts
  src/shared/grpc/grpcHarnessNumericCompare.coverage-gaps.test.ts
  src/shared/grpc/grpcHarnessTrailerNormalize.ts
  src/shared/grpc/grpcHarnessTrailerNormalize.test.ts
  src/shared/grpc/grpcHarnessAssertEngine.ts
  src/shared/grpc/grpcPhase8eAcceptance.test.ts
  scripts/test-grpc-phase8e.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8E deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8e"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8e' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcHarnessNumericCompare.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessNumericCompare.coverage-gaps.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessTrailerNormalize.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8eAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 8E tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} Phase 8E tests declared)"

echo "== Phase 8E: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8E: Numeric + trailer hardening tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessNumericCompare.test.ts \
  src/shared/grpc/grpcHarnessNumericCompare.coverage-gaps.test.ts \
  src/shared/grpc/grpcHarnessTrailerNormalize.test.ts \
  src/shared/grpc/grpcPhase8eAcceptance.test.ts

echo "== Phase 8E: Phase 8D regression =="
grpc_gate_run_regression "Phase phase8d" test:grpc:phase8d

echo ""
echo "Phase 8E gate: ALL PASSED"

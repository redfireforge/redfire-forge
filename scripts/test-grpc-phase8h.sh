#!/usr/bin/env bash
# Phase 8H — gRPC harness export/redaction gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8H: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcHarnessExport.ts
  src/shared/grpc/grpcHarnessExport.test.ts
  src/shared/grpc/grpcPhase8hAcceptance.test.ts
  src/features/results/utils/reportGenerator.ts
  src/shared/utils/export.ts
  scripts/test-grpc-phase8h.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8H deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8h"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8h' >&2
  exit 1
fi
if ! grep -q 'harness_result_export' "$ROOT/src/shared/grpc/grpcSecretPolicy.ts"; then
  echo 'Missing harness_result_export in grpcSecretPolicy.ts' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcHarnessExport.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8hAcceptance.test.ts" \
  "$ROOT/src/features/results/utils/reportGenerator.test.ts" \
  "$ROOT/src/shared/utils/export.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 10 ]]; then
  echo "Expected at least 10 Phase 8H-related tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 8H: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8H: Harness export redaction tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessExport.test.ts \
  src/shared/grpc/grpcPhase8hAcceptance.test.ts \
  src/features/results/utils/reportGenerator.test.ts \
  src/shared/utils/export.test.ts

echo "== Phase 8H: Phase 8G regression =="
grpc_gate_run_regression "Phase phase8g" test:grpc:phase8g

echo ""
echo "Phase 8H gate: ALL PASSED"

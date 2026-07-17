#!/usr/bin/env bash
# Phase 8A — gRPC harness scenario contracts + validation gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8A: Deliverable files =="
DELIVERABLES=(
  src/shared/types/grpc-harness.ts
  src/shared/utils/grpcHarnessScenarioContracts.ts
  src/shared/utils/grpcHarnessScenarioContracts.test.ts
  src/shared/grpc/grpcPhase8aAcceptance.test.ts
  scripts/test-grpc-phase8a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8a' >&2
  exit 1
fi
if ! grep -q "grpcCallAction" "$ROOT/src/shared/types/index.ts"; then
  echo 'Scenario type must include grpcCallAction (Phase 8A)' >&2
  exit 1
fi
if ! grep -q "grpcCall" "$ROOT/src/shared/types/grpc-harness.ts"; then
  echo 'GrpcHarnessActionType must include grpcCall (Phase 8A)' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/utils/grpcHarnessScenarioContracts.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8aAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 8A tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 8A: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8A: Harness scenario validation tests =="
npx vitest run \
  src/shared/utils/grpcHarnessScenarioContracts.test.ts \
  src/shared/grpc/grpcPhase8aAcceptance.test.ts
npx vitest run src/engine/executor.test.ts -t "grpc harness"

echo ""
echo "Phase 8A gate: ALL PASSED"

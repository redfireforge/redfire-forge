#!/usr/bin/env bash
# Phase 9E — gRPC interpolation cycle detection + diagnostic safety gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9E: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcInterpolationCycleDetector.ts
  src/shared/grpc/grpcInterpolationDiagnostics.ts
  src/shared/grpc/grpcInterpolationError.ts
  src/shared/grpc/grpcInterpolationCycleDetector.test.ts
  src/shared/grpc/grpcInterpolationDiagnostics.test.ts
  src/shared/grpc/grpcInterpolationError.test.ts
  src/shared/grpc/grpcPhase9eAcceptance.test.ts
  scripts/test-grpc-phase9e.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9E deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9e"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9e' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcInterpolationCycleDetector.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationDiagnostics.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationError.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9eAcceptance.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationEnvSnapshot.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationCycleParity.test.ts" \
  "$ROOT/src/features/grpc/hooks/useGrpcTargetValidation.test.ts" \
  "$ROOT/src/engine/grpcExecution.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessRuntimeContext.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 9E tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9E: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9E: Cycle detection + diagnostic safety tests =="
npx vitest run \
  src/shared/grpc/grpcInterpolationCycleDetector.test.ts \
  src/shared/grpc/grpcInterpolationDiagnostics.test.ts \
  src/shared/grpc/grpcInterpolationError.test.ts \
  src/shared/grpc/grpcPhase9eAcceptance.test.ts \
  src/shared/grpc/grpcInterpolationEnvSnapshot.test.ts \
  src/shared/grpc/grpcInterpolationCycleParity.test.ts

echo "== Phase 9E: Harness cycle serialization parity =="
npx vitest run \
  src/engine/grpcExecution.test.ts \
  src/shared/grpc/grpcHarnessRuntimeContext.test.ts

echo "== Phase 9E: Replay resolver cycle wiring =="
npx vitest run src/features/grpc/utils/grpcReplayResolver.test.ts -t "Phase 9E"

echo "== Phase 9E: Studio target validation cycle parity =="
npx vitest run src/features/grpc/hooks/useGrpcTargetValidation.test.ts

echo "== Phase 9E: Session helper cycle wiring =="
npx vitest run src/features/grpc/hooks/grpcStudioSessionHelpers.coverage-gaps.test.ts

echo "== Phase 9E: Studio execute snapshot cycle wiring =="
npx vitest run src/features/grpc/hooks/grpcStudioUnaryCommands.coverage-gaps.test.ts

echo "== Phase 9E: Workflow runtime cycle wiring =="
npx vitest run src/features/workflow/utils/grpcWorkflowRuntimeContext.coverage-gaps.test.ts

echo "== Phase 9E: Phase 9D regression =="
grpc_gate_run_regression "Phase phase9d" test:grpc:phase9d

echo ""
echo "Phase 9E gate: ALL PASSED"

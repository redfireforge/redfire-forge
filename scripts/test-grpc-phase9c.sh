#!/usr/bin/env bash
# Phase 9C — gRPC precedence + env snapshot binding gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9C: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcInterpolationPrecedence.ts
  src/shared/grpc/grpcInterpolationEnvSnapshot.ts
  src/shared/grpc/grpcWorkflowInterpolationResolver.ts
  src/shared/grpc/grpcInterpolationPrecedence.test.ts
  src/shared/grpc/grpcInterpolationEnvSnapshot.test.ts
  src/shared/grpc/grpcWorkflowInterpolationResolver.test.ts
  src/shared/grpc/grpcPhase9cAcceptance.test.ts
  scripts/test-grpc-phase9c.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9C deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9c"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9c' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcInterpolationPrecedence.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationEnvSnapshot.test.ts" \
  "$ROOT/src/shared/grpc/grpcWorkflowInterpolationResolver.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9cAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 9C tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9C: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9C: Precedence + snapshot + workflow bridge tests =="
npx vitest run \
  src/shared/grpc/grpcInterpolationPrecedence.test.ts \
  src/shared/grpc/grpcInterpolationEnvSnapshot.test.ts \
  src/shared/grpc/grpcWorkflowInterpolationResolver.test.ts \
  src/shared/grpc/grpcPhase9cAcceptance.test.ts

echo "== Phase 9C: Studio session in-flight insulation regression =="
npx vitest run src/features/grpc/hooks/useGrpcStudioSessionCore.coverage-gaps.test.ts

echo "== Phase 9C: Harness runtime + snapshot builder regression =="
npx vitest run \
  src/shared/grpc/grpcHarnessRuntimeContext.test.ts \
  src/shared/grpc/grpcHarnessSnapshotBuilder.test.ts

echo "== Phase 9C: Workflow runtime regression =="
npx vitest run src/features/workflow/utils/grpcWorkflowRuntimeContext.coverage-gaps.test.ts

echo "== Phase 9C: Phase 9B regression =="
grpc_gate_run_regression "Phase phase9b" test:grpc:phase9b

echo ""
echo "Phase 9C gate: ALL PASSED"

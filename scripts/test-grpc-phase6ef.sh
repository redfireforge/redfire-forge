#!/usr/bin/env bash
# Phase 6E+6F — gRPC workflow assert engine + output namespace gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 6E+6F: Deliverable files =="
DELIVERABLES=(
  src/features/workflow/utils/grpcWorkflowStepResultStore.ts
  src/features/workflow/utils/grpcWorkflowAssertPath.ts
  src/features/workflow/utils/grpcWorkflowAssertEngine.ts
  src/features/workflow/utils/grpcWorkflowOutputRegistry.ts
  src/features/workflow/utils/grpcWorkflowStepOutput.ts
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts
  src/shared/grpc/grpcPhase6efAcceptance.test.ts
  scripts/test-grpc-phase6ef.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 6E+6F deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase6ef"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase6ef' >&2
  exit 1
fi

echo "== Phase 6E+6F: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 6E+6F: Assert + namespace + handler tests =="
npx vitest run \
  src/features/workflow/utils/grpcWorkflowStepResultStore.test.ts \
  src/features/workflow/utils/grpcWorkflowAssertPath.test.ts \
  src/features/workflow/utils/grpcWorkflowAssertEngine.test.ts \
  src/features/workflow/utils/grpcWorkflowOutputRegistry.test.ts \
  src/features/workflow/utils/grpcWorkflowStepOutput.test.ts \
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.test.ts \
  src/features/workflow/engine/graphRunner.grpc.test.ts \
  src/shared/grpc/grpcPhase6efAcceptance.test.ts

echo "== Phase 6E+6F: Phase 6C+6D regression =="
grpc_gate_run_regression "Phase phase6cd" test:grpc:phase6cd

echo ""
echo "Phase 6E+6F gate: ALL PASSED"

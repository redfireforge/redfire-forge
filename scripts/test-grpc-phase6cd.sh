#!/usr/bin/env bash
# Phase 6C+6D — gRPC workflow unary executor + server-stream collector gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 6C+6D: Deliverable files =="
DELIVERABLES=(
  src/features/workflow/utils/grpcWorkflowRetryPolicy.ts
  src/features/workflow/utils/grpcWorkflowUnaryExecutor.ts
  src/features/workflow/utils/grpcWorkflowUntilExpression.ts
  src/features/workflow/utils/grpcWorkflowStreamCollector.ts
  src/features/workflow/utils/grpcWorkflowRuntimeContext.ts
  src/features/workflow/utils/grpcWorkflowStepOutput.ts
  src/features/workflow/utils/grpcWorkflowStepOutput.test.ts
  src/shared/grpc/buildGrpcNodeOperations.ts
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts
  src/shared/grpc/grpcPhase6cdAcceptance.test.ts
  scripts/test-grpc-phase6cd.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 6C+6D deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase6cd"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase6cd' >&2
  exit 1
fi

echo "== Phase 6C+6D: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 6C+6D: Executor + collector + handler tests =="
npx vitest run \
  src/features/workflow/utils/grpcWorkflowRetryPolicy.test.ts \
  src/features/workflow/utils/grpcWorkflowUntilExpression.test.ts \
  src/features/workflow/utils/grpcWorkflowUnaryExecutor.test.ts \
  src/features/workflow/utils/grpcWorkflowStreamCollector.test.ts \
  src/features/workflow/utils/grpcWorkflowStepOutput.test.ts \
  src/shared/grpc/buildGrpcNodeOperations.test.ts \
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.test.ts \
  src/features/workflow/engine/graphRunner.grpc.test.ts \
  src/features/workflow/engine/traceCollector.test.ts \
  src/shared/grpc/grpcPhase6cdAcceptance.test.ts

echo "== Phase 6C+6D: Phase 6B regression =="
grpc_gate_run_regression "Phase phase6b" test:grpc:phase6b

echo ""
echo "Phase 6C+6D gate: ALL PASSED"

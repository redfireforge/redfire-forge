#!/usr/bin/env bash
# Phase 6A — gRPC workflow node contracts + graph validation gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 6A: Deliverable files =="
DELIVERABLES=(
  src/features/workflow/types/workflow/node-grpc.ts
  src/features/workflow/utils/grpcWorkflowNodeValidation.ts
  src/features/workflow/utils/validateGrpcWorkflowGraph.ts
  src/features/workflow/utils/workflowNodeFactory.ts
  src/shared/grpc/grpcPhase6Acceptance.test.ts
  scripts/test-grpc-phase6a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 6A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase6a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase6a' >&2
  exit 1
fi

echo "== Phase 6A: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 6A: Node + graph validation tests =="
npx vitest run \
  src/features/workflow/utils/grpcWorkflowNodeValidation.test.ts \
  src/features/workflow/hooks/useWorkflowExecution.test.ts \
  src/shared/grpc/grpcPhase6Acceptance.test.ts

echo ""
echo "Phase 6A gate: ALL PASSED"

#!/usr/bin/env bash
# Phase 6G+6H — gRPC workflow results UI adapter + cross-protocol harness gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 6G+6H: Deliverable files =="
DELIVERABLES=(
  src/features/workflow/types/workflow/node-grpc.ts
  src/features/workflow/types/workflow/model-core.ts
  src/features/workflow/utils/grpcWorkflowOutputAdapter.ts
  src/features/workflow/utils/workflowRunErrors.ts
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.ts
  src/features/workflow/components/configs/NodeConfigOutputTab.tsx
  src/shared/types/trace.ts
  src/features/workflow/engine/graphRunner.ts
  src/shared/grpc/grpcPhase6ghAcceptance.test.ts
  scripts/test-grpc-phase6gh.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 6G+6H deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase6gh"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase6gh' >&2
  exit 1
fi

echo "== Phase 6G+6H: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 6G+6H: Adapter + UI + handler + acceptance tests =="
npx vitest run \
  src/features/workflow/utils/grpcWorkflowOutputAdapter.test.ts \
  src/features/workflow/components/configs/NodeConfigOutputTab.test.tsx \
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.test.ts \
  src/features/workflow/engine/graphRunner.grpc.test.ts \
  src/shared/grpc/grpcPhase6ghAcceptance.test.ts

echo "== Phase 6G+6H: Phase 6E+6F regression =="
grpc_gate_run_regression "Phase phase6ef" test:grpc:phase6ef

echo ""
echo "Phase 6G+6H gate: ALL PASSED"

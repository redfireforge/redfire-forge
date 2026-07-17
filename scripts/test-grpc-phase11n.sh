#!/usr/bin/env bash
# Phase 11N — Cross-surface integration gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11N gate: Cross-surface integration ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/features/workflow/types/workflow/node-grpc-advanced.ts
  src/features/workflow/engine/graphRunnerGrpcAdvancedNodeHandlers.ts
  src/features/workflow/utils/grpcWorkflowAdvancedNodeValidation.ts
  src/shared/grpc/buildGrpcNodeOperations.ts
  src/shared/grpc/grpcWorkflowDescriptorResolver.ts
  src/shared/grpc/grpcHarnessAdvancedPromotion.ts
  src/features/grpc/utils/grpcCollectionSchemaDiffActions.ts
  src/shared/grpc/grpcPhase11nAcceptance.test.ts
  scripts/test-grpc-phase11n.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11N deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11n"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11n' >&2
  exit 1
fi
echo "✓ Deliverables present"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11N acceptance + unit tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11nAcceptance.test.ts \
  src/shared/grpc/grpcHarnessAdvancedPromotion.test.ts \
  src/shared/grpc/grpcWorkflowDescriptorResolver.test.ts \
  src/shared/grpc/buildGrpcNodeOperations.test.ts \
  src/features/grpc/utils/grpcCollectionSchemaDiffActions.test.ts \
  src/features/workflow/engine/graphRunnerGrpcAdvancedNodeHandlers.test.ts \
  src/features/workflow/utils/grpcWorkflowOutputRegistry.test.ts
echo ""

echo "--- Step 3: Phase 11M regression ---"
grpc_gate_run_regression "Phase 11M" test:grpc:phase11m
echo ""

echo "--- Step 4: Phase 6I spot regression ---"
grpc_gate_run_regression "Phase 6I" test:grpc:phase6i
echo ""

echo "--- Step 5: Phase 8I spot regression ---"
grpc_gate_run_regression "Phase 8I" test:grpc:phase8i
echo ""

echo "=== Phase 11N gate: PASSED ==="

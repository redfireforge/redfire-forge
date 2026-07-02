#!/usr/bin/env bash
# Phase 11L — Mock rule visual builder gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11L gate: Mock rule visual builder ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/features/grpc/utils/grpcMockRuleBuilderModel.ts
  src/features/grpc/components/GrpcMockRuleBuilderPanel.tsx
  src/features/grpc/components/GrpcMockServerPanel.tsx
  src/shared/grpc/grpcPhase11lAcceptance.test.ts
  scripts/test-grpc-phase11l.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11L deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11l"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11l' >&2
  exit 1
fi
if ! grep -q 'checklist-1:' "$ROOT/src/shared/grpc/grpcPhase11lAcceptance.test.ts"; then
  echo 'Missing checklist-1 block in grpcPhase11lAcceptance' >&2
  exit 1
fi
if ! grep -q 'checklist-6:' "$ROOT/src/shared/grpc/grpcPhase11lAcceptance.test.ts"; then
  echo 'Missing checklist-6 block in grpcPhase11lAcceptance' >&2
  exit 1
fi
echo "✓ Deliverables present"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11L unit tests ---"
npx vitest run \
  src/features/grpc/utils/grpcMockRuleBuilderModel.test.ts \
  src/features/grpc/utils/grpcStudioAdvancedModel.test.ts \
  src/shared/grpc/grpcPhase11lAcceptance.test.ts \
  src/features/grpc/components/GrpcAdvancedPanels.coverage-gaps.test.tsx \
  src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx
echo ""

echo "--- Step 3: Phase 11E regression ---"
grpc_gate_run_regression "Phase 11E" test:grpc:phase11e
echo ""

echo "=== Phase 11L gate: PASSED ==="

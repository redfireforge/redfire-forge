#!/usr/bin/env bash
# Phase 11G - Advanced feature UI surfaces gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11G gate: advanced feature UI surfaces ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/features/grpc/grpcStudioAdvancedTypes.ts
  src/features/grpc/utils/grpcStudioAdvancedModel.ts
  src/features/grpc/utils/grpcStudioAdvancedCommands.ts
  src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts
  src/features/grpc/components/GrpcAdvancedFeaturesShell.tsx
  src/features/grpc/components/GrpcLoadTestPanel.tsx
  src/features/grpc/components/GrpcMockServerPanel.tsx
  src/features/grpc/components/GrpcSchemaDiffPanel.tsx
  src/features/grpc/utils/grpcStudioAdvancedModel.test.ts
  src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx
  scripts/test-grpc-phase11g.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11G deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11g"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11g' >&2
  exit 1
fi

if ! grep -q 'useGrpcStudioAdvancedFeatures' "$ROOT/src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts"; then
  echo 'Missing advanced features hook' >&2
  exit 1
fi
if ! grep -q 'grpc-sub-nav-advanced' "$ROOT/src/features/grpc/components/GrpcStudioSubNav.tsx"; then
  echo 'Missing Advanced sub-nav tab' >&2
  exit 1
fi
if ! grep -q 'GRPC_SCHEMA_DIFF_UI_LIST_CAP' "$ROOT/src/features/grpc/grpcStudioAdvancedTypes.ts"; then
  echo 'Missing schema diff UI list cap constant' >&2
  exit 1
fi

MODEL_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/features/grpc/utils/grpcStudioAdvancedModel.test.ts")
PANEL_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx")
ACCEPTANCE_TEST_COUNT=$((MODEL_TEST_COUNT + PANEL_TEST_COUNT))
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 30 ]]; then
  echo "Expected at least 30 Phase 11G tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11G unit tests ---"
npx vitest run src/features/grpc/utils/grpcStudioAdvancedModel.test.ts src/features/grpc/components/GrpcAdvancedFeaturesPanels.test.tsx
echo ""

echo "--- Step 3: Phase 11F regression ---"
grpc_gate_run_regression "Phase phase11f" test:grpc:phase11f
echo ""
echo "Phase 11G gate: PASSED"

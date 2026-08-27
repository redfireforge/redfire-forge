#!/usr/bin/env bash
# Phase 11H - Cross-surface integration and export safety gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11H gate: advanced export safety ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcAdvancedFeatureExport.ts
  src/shared/grpc/grpcAdvancedFeatureExport.test.ts
  src/shared/grpc/grpcAdvancedFeatureExport.coverage-gaps.test.ts
  src/shared/grpc/grpcPhase11hAcceptance.test.ts
  scripts/test-grpc-phase11h.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11H deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11h"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11h' >&2
  exit 1
fi
if ! grep -q 'grpc_load_test_export' "$ROOT/src/shared/grpc/grpcSecretPolicy.ts"; then
  echo 'Missing grpc_load_test_export in grpcSecretPolicy.ts' >&2
  exit 1
fi
if ! grep -q 'serializeGrpcLoadTestRunSummaryExportSafeJson' "$ROOT/src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts"; then
  echo 'Missing safe load-test export wiring in advanced features hook' >&2
  exit 1
fi

EXPORT_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcAdvancedFeatureExport.test.ts")
GAP_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcAdvancedFeatureExport.coverage-gaps.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcPhase11hAcceptance.test.ts")
TOTAL_TEST_COUNT=$((EXPORT_TEST_COUNT + GAP_TEST_COUNT + ACCEPTANCE_TEST_COUNT))
if [[ "${TOTAL_TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 11H tests, found ${TOTAL_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${TOTAL_TEST_COUNT} tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11H unit tests ---"
npx vitest run \
  src/shared/grpc/grpcAdvancedFeatureExport.test.ts \
  src/shared/grpc/grpcAdvancedFeatureExport.coverage-gaps.test.ts \
  src/shared/grpc/grpcPhase11hAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 11G regression ---"
grpc_gate_run_regression "Phase phase11g" test:grpc:phase11g
echo ""
echo "Phase 11H gate: PASSED"

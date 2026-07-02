#!/usr/bin/env bash
# Phase 11K — RPC Statistics tab gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11K gate: RPC Statistics tab ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcRpcSessionStats.ts
  src/features/grpc/hooks/useGrpcRpcSessionStats.ts
  src/features/grpc/components/GrpcRpcStatisticsPanel.tsx
  src/features/grpc/utils/grpcStudioRpcStatsCapture.ts
  src/shared/grpc/grpcPhase11kAcceptance.test.ts
  scripts/test-grpc-phase11k.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11K deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11k"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11k' >&2
  exit 1
fi
if ! grep -q 'checklist-1:' "$ROOT/src/shared/grpc/grpcPhase11kAcceptance.test.ts"; then
  echo 'Missing checklist-1 block in grpcPhase11kAcceptance' >&2
  exit 1
fi
if ! grep -q 'checklist-6:' "$ROOT/src/shared/grpc/grpcPhase11kAcceptance.test.ts"; then
  echo 'Missing checklist-6 block in grpcPhase11kAcceptance' >&2
  exit 1
fi
echo "✓ Deliverables present"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11K unit tests ---"
npx vitest run \
  src/shared/grpc/grpcRpcSessionStats.test.ts \
  src/features/grpc/utils/grpcStudioRpcStatsCapture.test.ts \
  src/features/grpc/hooks/useGrpcRpcSessionStats.test.ts \
  src/shared/grpc/grpcPhase11kAcceptance.test.ts \
  src/features/grpc/utils/grpcStudioCallHistoryCapture.test.ts \
  src/features/grpc/components/GrpcAdvancedPanels.coverage-gaps.test.tsx
echo ""

echo "--- Step 3: Phase 11J regression ---"
grpc_gate_run_regression "Phase 11J" test:grpc:phase11j
echo ""

echo "=== Phase 11K gate: PASSED ==="

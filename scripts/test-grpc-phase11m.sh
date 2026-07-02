#!/usr/bin/env bash
# Phase 11M — Network gRPC mock listener gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11M gate: Network gRPC mock listener ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcMockListenerContracts.ts
  src-server/grpc/grpcMockNetworkListener.ts
  src-server/grpc/grpcMockServerPool.ts
  src-server/routes/grpc/grpc-mock-routes.ts
  src/features/grpc/utils/grpcMockListenerClient.ts
  src/shared/grpc/grpcPhase11mAcceptance.test.ts
  scripts/test-grpc-phase11m.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11M deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11m"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11m' >&2
  exit 1
fi
echo "✓ Deliverables present"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11M unit + integration tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11mAcceptance.test.ts \
  src-server/routes/grpc/grpc-mock-routes.test.ts \
  src-server/grpc/grpcMockServerPool.integration.test.ts \
  src/features/grpc/utils/grpcMockListenerClient.test.ts \
  src/features/grpc/components/GrpcAdvancedPanels.coverage-gaps.test.tsx
echo ""

echo "--- Step 3: Phase 11E regression ---"
grpc_gate_run_regression "Phase 11E" test:grpc:phase11e
echo ""

echo "=== Phase 11M gate: PASSED ==="

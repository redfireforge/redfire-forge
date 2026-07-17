#!/usr/bin/env bash
# Phase 11J — Studio UX closure gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11J gate: Studio UX closure ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/features/grpc/data/grpcLoadTestProfileRepository.ts
  src/features/grpc/utils/grpcSchemaDiffAck.ts
  src/shared/grpc/grpcMockRuleSetExport.ts
  src/shared/grpc/grpcPhase11jAcceptance.test.ts
  scripts/test-grpc-phase11j.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11J deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11j"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11j' >&2
  exit 1
fi
if ! grep -q 'checklist-1:' "$ROOT/src/shared/grpc/grpcPhase11jAcceptance.test.ts"; then
  echo 'Missing checklist-1 block in grpcPhase11jAcceptance' >&2
  exit 1
fi
if ! grep -q 'checklist-6:' "$ROOT/src/shared/grpc/grpcPhase11jAcceptance.test.ts"; then
  echo 'Missing checklist-6 block in grpcPhase11jAcceptance' >&2
  exit 1
fi
echo "✓ Deliverables present"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11J unit tests ---"
npx vitest run \
  src/features/grpc/data/grpcLoadTestProfileRepository.test.ts \
  src/features/grpc/utils/grpcSchemaDiffAck.test.ts \
  src/shared/grpc/grpcMockRuleSetExport.test.ts \
  src/shared/grpc/grpcPhase11jAcceptance.test.ts \
  src/features/grpc/hooks/useGrpcStudioReplayActions.test.ts
echo ""

echo "--- Step 3: Phase 11I regression ---"
grpc_gate_run_regression "Phase 11I" test:grpc:phase11i
echo ""

echo "=== Phase 11J gate: PASSED ==="

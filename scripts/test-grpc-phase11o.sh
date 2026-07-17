#!/usr/bin/env bash
# Phase 11O — Server-streaming load testing gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11O gate: Server-streaming load testing ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcLoadTestStreamScheduler.ts
  src/shared/grpc/grpcAdvancedFeatureContracts.ts
  src/features/grpc/utils/grpcStudioAdvancedCommands.ts
  src/features/grpc/components/GrpcLoadTestPanel.tsx
  src/shared/grpc/grpcPhase11oAcceptance.test.ts
  scripts/test-grpc-phase11o.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11O deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11o"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11o' >&2
  exit 1
fi
if ! grep -q 'server_streaming' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing server_streaming validation in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'grpc-load-test-call-type-badge' "$ROOT/src/features/grpc/components/GrpcLoadTestPanel.tsx"; then
  echo 'Missing call-type badge in GrpcLoadTestPanel' >&2
  exit 1
fi
if ! grep -q 'grpc-load-test-max-messages-per-stream' "$ROOT/src/features/grpc/components/GrpcLoadTestPanel.tsx"; then
  echo 'Missing max messages per stream field in GrpcLoadTestPanel' >&2
  exit 1
fi
if ! grep -q 'transportMode: frozenTransportMode' "$ROOT/src/features/grpc/utils/grpcStudioAdvancedCommands.ts"; then
  echo 'Missing frozen transportMode forwarding in server-streaming load test dispatch' >&2
  exit 1
fi
if ! grep -q "validateLoadTestPreconditions('server_streaming'" "$ROOT/src/features/grpc/utils/grpcStudioAdvancedCommands.ts"; then
  echo 'Missing dispatch-time transport guard in startGrpcStudioLoadTestRun' >&2
  exit 1
fi
if ! grep -q 'resolveGrpcStudioTabTransportMode(studio.activeTab)' "$ROOT/src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts"; then
  echo 'Missing resolved transport in load-test validation hook' >&2
  exit 1
fi
if ! grep -q 'postSnapshotValidationError' "$ROOT/src/features/grpc/hooks/useGrpcStudioAdvancedFeatures.ts"; then
  echo 'Missing post-snapshot load-test validation in hook' >&2
  exit 1
fi
if ! grep -q 'resolveFrozenLoadTestTransportMode' "$ROOT/src/features/grpc/utils/grpcStudioAdvancedCommands.ts"; then
  echo 'Missing frozen transport resolver in startGrpcStudioLoadTestRun' >&2
  exit 1
fi
echo "✓ Deliverables present"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11O acceptance + unit tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11oAcceptance.test.ts \
  src/shared/grpc/grpcLoadTestStreamScheduler.test.ts \
  src/features/grpc/utils/grpcStudioAdvancedModel.test.ts \
  src/features/grpc/utils/grpcStudioAdvancedCommands.coverage-gaps.test.ts
echo ""

echo "--- Step 3: Phase 11B regression ---"
grpc_gate_run_regression "Phase 11B" test:grpc:phase11b
echo ""

echo "--- Step 4: Phase 11C regression ---"
grpc_gate_run_regression "Phase 11C" test:grpc:phase11c
echo ""

echo "--- Step 5: Stream collector spot regression ---"
npx vitest run src/features/workflow/utils/grpcWorkflowStreamCollector.test.ts
echo ""

echo "=== Phase 11O gate: PASSED ==="

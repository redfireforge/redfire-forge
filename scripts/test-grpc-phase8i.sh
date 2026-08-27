#!/usr/bin/env bash
# Phase 8I — gRPC harness hardening gate (acceptance + regression + 8A→8H chain).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 8I gate: gRPC harness hardening ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcPhase8iAcceptance.test.ts
  scripts/test-grpc-phase8i.sh
  scripts/test-grpc-phase8.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8i' >&2
  exit 1
fi
if ! grep -q '"test:grpc:phase8"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase8iAcceptance.test.ts")
CHECKLIST_DESCRIBE_COUNT=$(grep -cE "checklist-[1-6]:" "$ROOT/src/shared/grpc/grpcPhase8iAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 25 ]]; then
  echo "Expected at least 25 Phase 8I acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${CHECKLIST_DESCRIBE_COUNT:-0}" -lt 6 ]]; then
  echo "Expected 6 checklist describe blocks, found ${CHECKLIST_DESCRIBE_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests declared)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 2: Phase 8I acceptance checklist ---"
npx vitest run src/shared/grpc/grpcPhase8iAcceptance.test.ts
echo ""

echo "--- Step 3: Harness regression bundle ---"
npx vitest run \
  src/shared/grpc/grpcPhase8aAcceptance.test.ts \
  src/shared/grpc/grpcPhase8bAcceptance.test.ts \
  src/shared/grpc/grpcPhase8cAcceptance.test.ts \
  src/shared/grpc/grpcPhase8dAcceptance.test.ts \
  src/shared/grpc/grpcPhase8eAcceptance.test.ts \
  src/shared/grpc/grpcPhase8fAcceptance.test.ts \
  src/shared/grpc/grpcPhase8gAcceptance.test.ts \
  src/shared/grpc/grpcPhase8hAcceptance.test.ts \
  src/shared/utils/grpcHarnessScenarioContracts.test.ts \
  src/shared/grpc/grpcHarnessTemplateResolver.test.ts \
  src/shared/grpc/grpcHarnessSnapshotBuilder.test.ts \
  src/shared/grpc/grpcHarnessAttemptLifecycle.test.ts \
  src/shared/grpc/grpcHarnessTransportAdapter.test.ts \
  src/shared/grpc/grpcHarnessRuntimeContext.test.ts \
  src/shared/grpc/grpcHarnessUnaryExecutor.test.ts \
  src/shared/grpc/grpcHarnessExecutor.test.ts \
  src/shared/grpc/grpcHarnessStreamCollector.test.ts \
  src/shared/grpc/grpcHarnessAssertPath.test.ts \
  src/shared/grpc/grpcHarnessAssertEngine.test.ts \
  src/shared/grpc/grpcHarnessNumericCompare.test.ts \
  src/shared/grpc/grpcHarnessTrailerNormalize.test.ts \
  src/shared/grpc/grpcHarnessDataSourceInterpolation.test.ts \
  src/shared/grpc/grpcHarnessAssertionTemplates.test.ts \
  src/shared/grpc/grpcHarnessRowIdentity.test.ts \
  src/shared/grpc/grpcHarnessResultBuilder.test.ts \
  src/shared/grpc/grpcHarnessExport.test.ts \
  src/shared/utils/export.test.ts \
  src/features/results/utils/reportGenerator.test.ts \
  src/engine/dataSourceExpander.grpc.test.ts \
  src/shared/grpc/buildGrpcHarnessOperations.test.ts \
  src/engine/grpcExecution.test.ts \
  src/engine/executor.test.ts
echo ""

echo "--- Step 4: Phase 8H regression (8A→8H chain) ---"
grpc_gate_run_regression "Phase phase8h" test:grpc:phase8h
echo ""

echo "=== Phase 8I gate: PASSED ==="

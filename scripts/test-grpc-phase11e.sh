#!/usr/bin/env bash
# Phase 11E - Mock runtime lifecycle and hot-update gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11E gate: mock runtime lifecycle and hot-update ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcMockConfigResolution.ts
  src/shared/grpc/grpcMockLatencySimulation.ts
  src/shared/grpc/grpcMockRuntimeCore.ts
  src/shared/grpc/grpcMockRuntimeRegistry.ts
  src/shared/grpc/grpcPhase11eAcceptance.test.ts
  scripts/test-grpc-phase11e.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11E deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11e"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11e' >&2
  exit 1
fi

if ! grep -q 'createGrpcMockRuntimeManager' "$ROOT/src/shared/grpc/grpcMockRuntimeCore.ts"; then
  echo 'Missing runtime manager factory in grpcMockRuntimeCore' >&2
  exit 1
fi
if ! grep -q 'commitRuleSet' "$ROOT/src/shared/grpc/grpcMockRuntimeCore.ts"; then
  echo 'Missing hot-swap commitRuleSet in grpcMockRuntimeCore' >&2
  exit 1
fi
if ! grep -q 'pinnedCommit' "$ROOT/src/shared/grpc/grpcMockRuntimeCore.ts"; then
  echo 'Missing in-flight pinnedCommit in grpcMockRuntimeCore' >&2
  exit 1
fi
if ! grep -q 'resolveGrpcTabMockConfig' "$ROOT/src/shared/grpc/grpcMockConfigResolution.ts"; then
  echo 'Missing tab mock config resolver in grpcMockConfigResolution' >&2
  exit 1
fi
if ! grep -q 'resolveGrpcMockLatencyMs' "$ROOT/src/shared/grpc/grpcMockLatencySimulation.ts"; then
  echo 'Missing latency resolver in grpcMockLatencySimulation' >&2
  exit 1
fi
if ! grep -q 'createGrpcMockRuntimeRegistry' "$ROOT/src/shared/grpc/grpcMockRuntimeRegistry.ts"; then
  echo 'Missing tab registry in grpcMockRuntimeRegistry' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcPhase11eAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 45 ]]; then
  echo "Expected at least 45 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11E acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11eAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 11D regression ---"
grpc_gate_run_regression "Phase phase11d" test:grpc:phase11d
echo ""

echo "=== Phase 11E gate: PASSED ==="

#!/usr/bin/env bash
# Phase 11F - Schema diff engine and severity classification gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11F gate: schema diff engine and severity classification ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcSchemaDiffContracts.ts
  src/shared/grpc/grpcSchemaDiffEngine.ts
  src/shared/grpc/grpcSchemaDiffExport.ts
  src/shared/grpc/grpcPhase11fAcceptance.test.ts
  scripts/test-grpc-phase11f.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11F deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11f"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11f' >&2
  exit 1
fi

if ! grep -q 'computeGrpcSchemaDiff' "$ROOT/src/shared/grpc/grpcSchemaDiffEngine.ts"; then
  echo 'Missing schema diff engine entry point in grpcSchemaDiffEngine' >&2
  exit 1
fi
if ! grep -q 'sortGrpcSchemaDiffChanges' "$ROOT/src/shared/grpc/grpcSchemaDiffContracts.ts"; then
  echo 'Missing sort helper in grpcSchemaDiffContracts' >&2
  exit 1
fi
if ! grep -q 'serializeGrpcSchemaDiffReportJson' "$ROOT/src/shared/grpc/grpcSchemaDiffExport.ts"; then
  echo 'Missing JSON export serializer in grpcSchemaDiffExport' >&2
  exit 1
fi
if ! grep -q 'breaking' "$ROOT/src/shared/grpc/grpcSchemaDiffContracts.ts"; then
  echo 'Missing severity constants in grpcSchemaDiffContracts' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcPhase11fAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 40 ]]; then
  echo "Expected at least 40 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11F acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11fAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 11E regression ---"
grpc_gate_run_regression "Phase phase11e" test:grpc:phase11e
echo ""

echo "=== Phase 11F gate: PASSED ==="

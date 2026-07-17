#!/usr/bin/env bash
# Phase 10A — gRPC-Web transport contracts and capability matrix gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10A gate: gRPC-Web transport contracts ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcWebTransportContracts.ts
  src/shared/grpc/grpcWebTransportContracts.test.ts
  src/shared/grpc/grpcPhase10aAcceptance.test.ts
  scripts/test-grpc-phase10a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10a' >&2
  exit 1
fi

CONTRACT_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcWebTransportContracts.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10aAcceptance.test.ts")
CHECKLIST_DESCRIBE_COUNT=$(grep -cE "checklist-[1-3]:" "$ROOT/src/shared/grpc/grpcPhase10aAcceptance.test.ts")
if [[ "${CONTRACT_TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 contract tests, found ${CONTRACT_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 8 ]]; then
  echo "Expected at least 8 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${CHECKLIST_DESCRIBE_COUNT:-0}" -lt 3 ]]; then
  echo "Expected 3 checklist describe blocks, found ${CHECKLIST_DESCRIBE_COUNT:-0}" >&2
  exit 1
fi
if ! grep -q 'GRPC_WEB_TRANSPORT_SCHEMA_VERSION = 1' "$ROOT/src/shared/grpc/grpcWebTransportContracts.ts"; then
  echo 'Missing GRPC_WEB_TRANSPORT_SCHEMA_VERSION = 1' >&2
  exit 1
fi
if ! grep -q 'spring-servlet' "$ROOT/src/shared/grpc/grpcWebTransportContracts.ts"; then
  echo 'Missing spring-servlet transport mode in contracts' >&2
  exit 1
fi
echo "✓ Deliverables present (${CONTRACT_TEST_COUNT} contract + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Transport contract + capability matrix tests ---"
npx vitest run \
  src/shared/grpc/grpcWebTransportContracts.test.ts \
  src/shared/grpc/grpcPhase10aAcceptance.test.ts
echo ""

echo "--- Step 3: Execute snapshot transport field regression ---"
npx vitest run \
  src/features/grpc/grpcStudioTypes.test.ts \
  src/features/grpc/hooks/grpcStudioUnaryCommands.phase10a.test.ts \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/shared/grpc/grpcStreamClient.test.ts \
  -t "transport|Phase 10A|preflight|browser-direct|dispatch guard|dispatch"
echo ""

echo "--- Step 4: Phase 9I regression (Phase 10 entry gate) ---"
grpc_gate_run_regression "Phase phase9i" test:grpc:phase9i
echo ""

echo "=== Phase 10A gate: PASSED ==="

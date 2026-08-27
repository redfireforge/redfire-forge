#!/usr/bin/env bash
# Phase 9I — gRPC interpolation hardening gate (acceptance + regression + 9H chain).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 9I gate: gRPC interpolation hardening ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcStudioExecuteInterpolation.ts
  src/features/grpc/hooks/grpcStreamSessionHelpers.ts
  src/shared/grpc/grpcPhase9iAcceptance.test.ts
  scripts/test-grpc-phase9i.sh
  scripts/test-grpc-phase9.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9i' >&2
  exit 1
fi
if ! grep -q '"test:grpc:phase9"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase9iAcceptance.test.ts")
CHECKLIST_DESCRIBE_COUNT=$(grep -cE "checklist-[1-6]:" "$ROOT/src/shared/grpc/grpcPhase9iAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 19 ]]; then
  echo "Expected at least 19 Phase 9I acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${CHECKLIST_DESCRIBE_COUNT:-0}" -lt 6 ]]; then
  echo "Expected 6 checklist describe blocks, found ${CHECKLIST_DESCRIBE_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests declared)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 9I acceptance checklist ---"
npx vitest run src/shared/grpc/grpcPhase9iAcceptance.test.ts
echo ""

echo "--- Step 3: Stream send interpolation + execute resolver ---"
npx vitest run \
  src/shared/grpc/grpcStudioExecuteInterpolation.test.ts \
  src/shared/grpc/grpcStudioExecuteInterpolation.coverage-gaps.test.ts \
  src/features/grpc/hooks/grpcStreamSessionHelpers.test.ts
npx vitest run src/features/grpc/hooks/useGrpcStreamSession.coverage-gaps.test.ts -t "sendStreamMessageCall|Phase 9I"
echo ""

echo "--- Step 4: Phase 9H regression ---"
grpc_gate_run_regression "Phase phase9h" test:grpc:phase9h
echo ""

echo "=== Phase 9I gate: PASSED ==="

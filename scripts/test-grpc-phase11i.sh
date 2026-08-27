#!/usr/bin/env bash
# Phase 11I — Hardening gate before Phase 12.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11I gate: hardening gate before Phase 12 ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Mode: fast local cycle (GRPC_SKIP_REGRESSION=1, chained regressions skipped) ---"
else
  echo "--- Mode: full regression gate (chained regressions enabled) ---"
fi
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcPhase11iAcceptance.test.ts
  scripts/test-grpc-phase11i.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11I deliverable: $deliverable" >&2
    exit 1
  fi
done
for script_name in test:grpc:phase11i test:grpc:phase11i:fast test:grpc:phase11i:full; do
  if ! grep -q "\"${script_name}\"" "$ROOT/package.json"; then
    echo "Missing package.json script: ${script_name}" >&2
    exit 1
  fi
done
if ! grep -q 'checklist-1:' "$ROOT/src/shared/grpc/grpcPhase11iAcceptance.test.ts"; then
  echo 'Missing checklist-1 block in grpcPhase11iAcceptance' >&2
  exit 1
fi
if ! grep -q 'checklist-5:' "$ROOT/src/shared/grpc/grpcPhase11iAcceptance.test.ts"; then
  echo 'Missing checklist-5 block in grpcPhase11iAcceptance' >&2
  exit 1
fi
if ! grep -q 'grpc_gate_run_regression' "$ROOT/scripts/test-grpc-phase11i.sh"; then
  echo 'Phase 11I gate must use grpc_gate_run_regression for chained regressions' >&2
  exit 1
fi
if ! grep -q 'grpc_gate_run_regression' "$ROOT/scripts/test-grpc-phase11h.sh"; then
  echo 'Phase 11H gate must use grpc_gate_run_regression for chained regressions' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcPhase11iAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 4 ]]; then
  echo "Expected at least 4 Phase 11I acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11I acceptance tests ---"
npx vitest run src/shared/grpc/grpcPhase11iAcceptance.test.ts
echo ""

echo "--- Step 2b: Phase 11C load-test metrics contract regression ---"
npx vitest run src/shared/grpc/grpcLoadTestMetrics.test.ts
echo ""

echo "--- Step 3: Phase 11H regression ---"
grpc_gate_run_regression "Phase 11H" test:grpc:phase11h
echo ""

echo "=== Phase 11I gate: PASSED ==="

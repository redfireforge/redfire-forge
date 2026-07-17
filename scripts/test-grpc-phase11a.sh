#!/usr/bin/env bash
# Phase 11A - Feature contracts and shared runtime boundaries.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11A gate: advanced-feature contract boundaries ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcAdvancedFeatureContracts.ts
  src/shared/grpc/grpcPhase11aAcceptance.test.ts
  scripts/test-grpc-phase11a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11a' >&2
  exit 1
fi

# Key content checks
if ! grep -q 'GRPC_ADVANCED_FEATURE_NAMESPACES' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing namespace contract in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'canTransitionGrpcAdvancedOperationStatus' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing status transition guard in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'requestGrpcAdvancedOperationCancellation' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing cancellation API in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'validateGrpcLoadTestConfig' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing load-test validator in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'validateGrpcTabExecuteSnapshot' "$ROOT/src/shared/grpc/requestValidation.ts"; then
  echo 'Missing execute snapshot validator in requestValidation' >&2
  exit 1
fi
if ! grep -q 'assertGrpcLoadTestRunSnapshot' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing run snapshot assert helper in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'captureGrpcLoadTestExecuteSnapshot' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing load-test snapshot capture helper in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'GrpcAdvancedOperationTransitionError' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing typed transition error in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'minDurationMs' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing minDurationMs safety limit in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'rampUpMs must not exceed durationMs' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing rampUpMs vs durationMs guard in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'Advanced operation validation failed' "$ROOT/src/shared/grpc/grpcAdvancedFeatureContracts.ts"; then
  echo 'Missing validating-phase default failure message in grpcAdvancedFeatureContracts' >&2
  exit 1
fi
if ! grep -q 'Phase 11A' "$ROOT/src/shared/grpc/grpcPhase11aAcceptance.test.ts"; then
  echo 'Missing Phase 11A label in grpcPhase11aAcceptance' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase11aAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 25 ]]; then
  echo "Expected at least 25 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11A acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11aAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 10I regression ---"
grpc_gate_run_regression "Phase phase10i" test:grpc:phase10i
echo ""

echo "=== Phase 11A gate: PASSED ==="

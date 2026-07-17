#!/usr/bin/env bash
# Phase 11D - Mock rule model and evaluator engine gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 11D gate: mock rule model and evaluator engine ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcMockRuleContracts.ts
  src/shared/grpc/grpcMockPredicateSandbox.ts
  src/shared/grpc/grpcMockRuleEvaluatorCore.ts
  src/shared/grpc/grpcPhase11dAcceptance.test.ts
  scripts/test-grpc-phase11d.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 11D deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase11d"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase11d' >&2
  exit 1
fi

if ! grep -q 'evaluateGrpcMockRuleSet' "$ROOT/src/shared/grpc/grpcMockRuleEvaluatorCore.ts"; then
  echo 'Missing rule evaluator entrypoint in grpcMockRuleEvaluatorCore' >&2
  exit 1
fi
if ! grep -q 'parseGrpcMockPredicateExpression' "$ROOT/src/shared/grpc/grpcMockPredicateSandbox.ts"; then
  echo 'Missing sandbox expression parser in grpcMockPredicateSandbox' >&2
  exit 1
fi
if ! grep -q 'GRPC_MOCK_FORBIDDEN_EXPRESSION_PATTERNS' "$ROOT/src/shared/grpc/grpcMockPredicateSandbox.ts"; then
  echo 'Missing forbidden expression patterns in grpcMockPredicateSandbox' >&2
  exit 1
fi
if ! grep -q 'fallthrough' "$ROOT/src/shared/grpc/grpcMockRuleEvaluatorCore.ts"; then
  echo 'Missing fallthrough handling in grpcMockRuleEvaluatorCore' >&2
  exit 1
fi
if ! grep -q 'validateGrpcMockRuleSet' "$ROOT/src/shared/grpc/grpcMockRuleContracts.ts"; then
  echo 'Missing rule-set validator in grpcMockRuleContracts' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE '^\s*it(\.each)?\(' "$ROOT/src/shared/grpc/grpcPhase11dAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 50 ]]; then
  echo "Expected at least 50 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 11D acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase11dAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 11C regression ---"
grpc_gate_run_regression "Phase phase11c" test:grpc:phase11c
echo ""

echo "=== Phase 11D gate: PASSED ==="

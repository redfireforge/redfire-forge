#!/usr/bin/env bash
# Phase 9A — gRPC interpolation contracts + token grammar gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9A: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcInterpolationConstants.ts
  src/shared/grpc/grpcInterpolationGrammar.ts
  src/shared/grpc/grpcInterpolationContracts.ts
  src/shared/grpc/grpcInterpolationGrammar.test.ts
  src/shared/grpc/grpcInterpolationContracts.test.ts
  src/shared/grpc/grpcPhase9aAcceptance.test.ts
  src/shared/grpc/grpcInterpolationLegacyParity.test.ts
  scripts/test-grpc-phase9a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9a' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcInterpolationGrammar.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationContracts.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9aAcceptance.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationLegacyParity.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 9A tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9A: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9A: Interpolation contract + grammar tests =="
npx vitest run \
  src/shared/grpc/grpcInterpolationGrammar.test.ts \
  src/shared/grpc/grpcInterpolationContracts.test.ts \
  src/shared/grpc/grpcPhase9aAcceptance.test.ts \
  src/shared/grpc/grpcInterpolationLegacyParity.test.ts

echo ""
echo "Phase 9A gate: ALL PASSED"

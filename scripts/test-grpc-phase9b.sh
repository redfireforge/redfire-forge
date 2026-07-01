#!/usr/bin/env bash
# Phase 9B — gRPC shared interpolation resolver gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9B: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcInterpolationResolver.ts
  src/shared/grpc/grpcInterpolationDeepResolver.ts
  src/shared/grpc/grpcStudioTargetPreview.ts
  src/shared/grpc/grpcInterpolationResolver.test.ts
  src/shared/grpc/grpcInterpolationDeepResolver.test.ts
  src/shared/grpc/grpcStudioTargetPreview.test.ts
  src/shared/grpc/grpcInterpolationConsumerParity.test.ts
  src/shared/grpc/grpcPhase9bAcceptance.test.ts
  scripts/test-grpc-phase9b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9B deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9b' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcInterpolationResolver.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationDeepResolver.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationConsumerParity.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9bAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 20 ]]; then
  echo "Expected at least 20 Phase 9B tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9B: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9B: Shared resolver + parity tests =="
npx vitest run \
  src/shared/grpc/grpcInterpolationResolver.test.ts \
  src/shared/grpc/grpcInterpolationDeepResolver.test.ts \
  src/shared/grpc/grpcInterpolationConsumerParity.test.ts \
  src/shared/grpc/grpcPhase9bAcceptance.test.ts

echo "== Phase 9B: Harness template resolver regression =="
npx vitest run src/shared/grpc/grpcHarnessTemplateResolver.test.ts

echo "== Phase 9B: Harness runtime + data-source regression =="
npx vitest run \
  src/shared/grpc/grpcHarnessRuntimeContext.test.ts \
  src/shared/grpc/grpcHarnessDataSourceInterpolation.test.ts

echo "== Phase 9B: Studio target validation regression =="
npx vitest run src/features/grpc/hooks/useGrpcTargetValidation.test.ts

echo "== Phase 9B: Studio header preview regression =="
npx vitest run src/shared/grpc/grpcStudioTargetPreview.test.ts

echo "== Phase 9B: Harness snapshot builder regression =="
npx vitest run src/shared/grpc/grpcHarnessSnapshotBuilder.test.ts

echo "== Phase 9B: Phase 9A regression =="
grpc_gate_run_regression "Phase phase9a" test:grpc:phase9a

echo ""
echo "Phase 9B gate: ALL PASSED"

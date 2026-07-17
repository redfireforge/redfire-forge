#!/usr/bin/env bash
# Phase 9H — gRPC cross-surface interpolation parity gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9H: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcStudioExecuteInterpolation.ts
  src/shared/grpc/grpcStudioExecuteInterpolation.test.ts
  src/shared/grpc/grpcInterpolationCrossSurface.ts
  src/shared/grpc/grpcInterpolationCrossSurface.test.ts
  src/shared/grpc/grpcPhase9hAcceptance.test.ts
  scripts/test-grpc-phase9h.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9H deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9h"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9h' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcStudioExecuteInterpolation.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationCrossSurface.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9hAcceptance.test.ts" \
  "$ROOT/src/shared/grpc/grpcInterpolationConsumerParity.test.ts" \
  "$ROOT/src/features/grpc/hooks/grpcStudioUnaryCommands.coverage-gaps.test.ts" \
  "$ROOT/src/features/grpc/utils/grpcReplayResolver.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 9H tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9H: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9H: Studio execute interpolation + cross-surface matrix =="
npx vitest run \
  src/shared/grpc/grpcStudioExecuteInterpolation.test.ts \
  src/shared/grpc/grpcInterpolationCrossSurface.test.ts \
  src/shared/grpc/grpcPhase9hAcceptance.test.ts

echo "== Phase 9H: Phase 9B consumer parity regression =="
npx vitest run src/shared/grpc/grpcInterpolationConsumerParity.test.ts

echo "== Phase 9H: Studio execute + replay wiring regression =="
npx vitest run \
  src/features/grpc/hooks/grpcStudioUnaryCommands.coverage-gaps.test.ts \
  src/features/grpc/utils/grpcReplayResolver.test.ts -t "env vars|Phase 9F|template"

echo "== Phase 9H: Phase 9G regression =="
grpc_gate_run_regression "Phase phase9g" test:grpc:phase9g

echo ""
echo "Phase 9H gate: ALL PASSED"

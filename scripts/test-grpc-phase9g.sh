#!/usr/bin/env bash
# Phase 9G — gRPC interpolation preview + error UX gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9G: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcInterpolationPreviewModel.ts
  src/shared/grpc/grpcInterpolationPreviewModel.test.ts
  src/features/grpc/components/GrpcInterpolationPreviewStrip.tsx
  src/features/grpc/components/GrpcInterpolationPreviewStrip.test.tsx
  src/features/grpc/components/GrpcInterpolationErrorBanner.tsx
  src/features/grpc/components/GrpcInterpolationErrorBanner.test.tsx
  src/shared/grpc/grpcPhase9gAcceptance.test.ts
  scripts/test-grpc-phase9g.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9G deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9g"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9g' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcInterpolationPreviewModel.test.ts" \
  "$ROOT/src/features/grpc/components/GrpcInterpolationPreviewStrip.test.tsx" \
  "$ROOT/src/features/grpc/components/GrpcInterpolationErrorBanner.test.tsx" \
  "$ROOT/src/shared/grpc/grpcPhase9gAcceptance.test.ts" \
  "$ROOT/src/features/grpc/components/GrpcTargetPanel.test.tsx" \
  "$ROOT/src/features/grpc/hooks/useGrpcTargetValidation.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 9G tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9G: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9G: Preview model + UI component tests =="
npx vitest run \
  src/shared/grpc/grpcInterpolationPreviewModel.test.ts \
  src/features/grpc/components/GrpcInterpolationPreviewStrip.test.tsx \
  src/features/grpc/components/GrpcInterpolationErrorBanner.test.tsx \
  src/shared/grpc/grpcPhase9gAcceptance.test.ts

echo "== Phase 9G: Target validation + panel wiring =="
npx vitest run \
  src/features/grpc/hooks/useGrpcTargetValidation.test.ts \
  src/features/grpc/components/GrpcTargetPanel.test.tsx

echo "== Phase 9G: Phase 9E diagnostic regression =="
npx vitest run src/shared/grpc/grpcInterpolationDiagnostics.test.ts

echo "== Phase 9G: Header preview grammar regression =="
npx vitest run src/shared/grpc/grpcStudioTargetPreview.test.ts

echo "== Phase 9G: Phase 9F regression =="
grpc_gate_run_regression "Phase phase9f" test:grpc:phase9f

echo ""
echo "Phase 9G gate: ALL PASSED"

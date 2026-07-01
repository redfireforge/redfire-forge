#!/usr/bin/env bash
# Phase 9F — gRPC template persistence + replay compatibility gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 9F: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcInterpolationPersistGuard.ts
  src/shared/grpc/grpcInterpolationPersistGuard.test.ts
  src/shared/grpc/grpcReplayTemplateCompatibility.ts
  src/shared/grpc/grpcReplayTemplateCompatibility.test.ts
  src/shared/grpc/grpcPhase9fAcceptance.test.ts
  scripts/test-grpc-phase9f.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 9F deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase9f"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase9f' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" \
  "$ROOT/src/shared/grpc/grpcInterpolationPersistGuard.test.ts" \
  "$ROOT/src/shared/grpc/grpcReplayTemplateCompatibility.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase9fAcceptance.test.ts" \
  "$ROOT/src/shared/grpc/grpcSavedRequest.test.ts" \
  "$ROOT/src/shared/grpc/grpcPersistRedactionMiddleware.test.ts" \
  "$ROOT/src/features/grpc/utils/grpcCrossFeatureExport.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 9F tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 9F: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 9F: Template persist guard + replay compatibility tests =="
npx vitest run \
  src/shared/grpc/grpcInterpolationPersistGuard.test.ts \
  src/shared/grpc/grpcReplayTemplateCompatibility.test.ts \
  src/shared/grpc/grpcPhase9fAcceptance.test.ts

echo "== Phase 9F: Saved request + middleware regression =="
npx vitest run \
  src/shared/grpc/grpcSavedRequest.test.ts \
  src/shared/grpc/grpcSavedRequest.coverage-gaps.test.ts \
  src/shared/grpc/grpcPersistRedactionMiddleware.test.ts

echo "== Phase 9F: Export bundle template persist =="
npx vitest run src/features/grpc/utils/grpcCrossFeatureExport.test.ts

echo "== Phase 9F: Replay resolver portability =="
npx vitest run src/features/grpc/utils/grpcReplayResolver.test.ts -t "env vars|Phase 9E|Phase 9F"

echo "== Phase 9F: Phase 5 replay binding regression =="
npx vitest run src/shared/grpc/grpcPhase5Acceptance.test.ts -t "history replay|saved request replay"

echo "== Phase 9F: History replay template portability =="
npx vitest run src/features/grpc/utils/grpcReplayBinding.test.ts -t "Phase 9F"

echo "== Phase 9F: Phase 9E regression =="
grpc_gate_run_regression "Phase phase9e" test:grpc:phase9e

echo ""
echo "Phase 9F gate: ALL PASSED"

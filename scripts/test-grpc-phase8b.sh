#!/usr/bin/env bash
# Phase 8B — gRPC harness snapshot builder + transport adapter gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8B: Deliverable files =="
DELIVERABLES=(
  src/shared/types/grpc-harness-snapshot.ts
  src/shared/grpc/grpcHarnessTemplateResolver.ts
  src/shared/grpc/grpcHarnessSnapshotBuilder.ts
  src/shared/grpc/grpcHarnessTransportAdapter.ts
  src/shared/grpc/grpcHarnessAttemptLifecycle.ts
  src/shared/grpc/grpcHarnessSnapshotBuilder.test.ts
  src/shared/grpc/grpcHarnessSnapshotBuilder.coverage-gaps.test.ts
  src/shared/grpc/grpcHarnessTransportAdapter.test.ts
  src/shared/grpc/grpcHarnessTransportAdapter.coverage-gaps.test.ts
  src/shared/grpc/grpcHarnessAttemptLifecycle.test.ts
  src/shared/grpc/grpcPhase8bAcceptance.test.ts
  scripts/test-grpc-phase8b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8B deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8b' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcHarnessSnapshotBuilder.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessSnapshotBuilder.coverage-gaps.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessTransportAdapter.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessTransportAdapter.coverage-gaps.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessAttemptLifecycle.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessTemplateResolver.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8bAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 8B tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} tests declared)"

echo "== Phase 8B: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8B: Harness snapshot + adapter tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessTemplateResolver.test.ts \
  src/shared/grpc/grpcHarnessSnapshotBuilder.test.ts \
  src/shared/grpc/grpcHarnessSnapshotBuilder.coverage-gaps.test.ts \
  src/shared/grpc/grpcHarnessTransportAdapter.test.ts \
  src/shared/grpc/grpcHarnessTransportAdapter.coverage-gaps.test.ts \
  src/shared/grpc/grpcHarnessAttemptLifecycle.test.ts \
  src/shared/grpc/grpcPhase8bAcceptance.test.ts

echo "== Phase 8B: Cross-feature export bridge =="
npx vitest run src/features/grpc/utils/grpcCrossFeatureExport.test.ts -t "prepareGrpcHarnessExecuteSnapshotExport"

echo "== Phase 8B: Phase 8A regression =="
grpc_gate_run_regression "Phase phase8a" test:grpc:phase8a

echo ""
echo "Phase 8B gate: ALL PASSED"

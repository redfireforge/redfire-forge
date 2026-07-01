#!/usr/bin/env bash
# Phase 8F — gRPC harness data-source expansion gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 8F: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcHarnessDataSourceInterpolation.ts
  src/shared/grpc/grpcHarnessDataSourceInterpolation.test.ts
  src/shared/grpc/grpcHarnessAssertionTemplates.ts
  src/shared/grpc/grpcHarnessAssertionTemplates.test.ts
  src/shared/grpc/grpcHarnessRowIdentity.ts
  src/shared/grpc/grpcHarnessRowIdentity.test.ts
  src/engine/dataSourceExpander.grpc.test.ts
  src/shared/grpc/grpcPhase8fAcceptance.test.ts
  src/engine/dataSourceExpander.ts
  src/engine/grpcExecution.ts
  src/shared/grpc/grpcHarnessSnapshotBuilder.ts
  src/shared/grpc/grpcHarnessTemplateResolver.ts
  scripts/test-grpc-phase8f.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 8F deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase8f"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase8f' >&2
  exit 1
fi

TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcHarnessDataSourceInterpolation.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessAssertionTemplates.test.ts" \
  "$ROOT/src/shared/grpc/grpcHarnessRowIdentity.test.ts" \
  "$ROOT/src/engine/dataSourceExpander.grpc.test.ts" \
  "$ROOT/src/shared/grpc/grpcPhase8fAcceptance.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TEST_COUNT:-0}" -lt 12 ]]; then
  echo "Expected at least 12 Phase 8F tests, found ${TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TEST_COUNT} Phase 8F tests declared)"

echo "== Phase 8F: TypeScript =="
grpc_gate_run_tsc plain

echo "== Phase 8F: Data-source expansion tests =="
npx vitest run \
  src/shared/grpc/grpcHarnessDataSourceInterpolation.test.ts \
  src/shared/grpc/grpcHarnessAssertionTemplates.test.ts \
  src/shared/grpc/grpcHarnessRowIdentity.test.ts \
  src/engine/dataSourceExpander.grpc.test.ts \
  src/shared/grpc/grpcPhase8fAcceptance.test.ts

echo "== Phase 8F: Phase 8E regression =="
grpc_gate_run_regression "Phase phase8e" test:grpc:phase8e

echo ""
echo "Phase 8F gate: ALL PASSED"

#!/usr/bin/env bash
# scripts/test-grpc-phase7e.sh — Phase 7E gate
# Verifies Studio + workflow transport facade wiring and tab routing safety.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7E gate: gRPC Studio transport facade wiring ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcTransportFacade.ts
  src/features/grpc/hooks/grpcStudioTabLifecycle.ts
  src/features/grpc/hooks/useGrpcStudio.ts
  src/features/grpc/hooks/grpcStudioUnaryCommands.ts
  src/shared/grpc/buildGrpcNodeOperations.ts
  src/shared/grpc/grpcTauriEventAdapter.ts
  src/features/grpc/hooks/grpcStudioTabLifecycle.test.ts
  scripts/test-grpc-phase7e.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7E deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7e"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7e' >&2
  exit 1
fi
if ! grep -q 'mountGrpcStudioNativeTransport' "$ROOT/src/features/grpc/hooks/useGrpcStudio.ts"; then
  echo 'useGrpcStudio must mount native transport (Phase 7E)' >&2
  exit 1
fi
if ! grep -q 'invokeGrpcUnary' "$ROOT/src/features/grpc/hooks/grpcStudioUnaryCommands.ts"; then
  echo 'grpcStudioUnaryCommands must route through invokeGrpcUnary (Phase 7E)' >&2
  exit 1
fi
if ! grep -q 'retainGrpcNativeTransport' "$ROOT/src/shared/grpc/buildGrpcNodeOperations.ts"; then
  echo 'buildGrpcNodeOperations must retain native transport (Phase 7E)' >&2
  exit 1
fi
if ! grep -q 'cancelGrpcUnary' "$ROOT/src/features/grpc/hooks/grpcStudioSessionHelpers.ts"; then
  echo 'grpcStudioSessionHelpers must route abort/release through cancelGrpcUnary (Phase 7E)' >&2
  exit 1
fi
if ! grep -q 'expectedRequestId' "$ROOT/src/features/grpc/hooks/useGrpcStreamSession.ts"; then
  echo 'useGrpcStreamSession must pass expectedRequestId to openGrpcStreamEvents (Phase 7E)' >&2
  exit 1
fi
if ! grep -q 'event.tabId !== tabId' "$ROOT/src/features/grpc/hooks/useGrpcStreamSession.ts"; then
  echo 'useGrpcStreamSession must reject mismatched event.tabId in applyStreamEvent (Phase 7E)' >&2
  exit 1
fi
TS_TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcTransportFacade.test.ts" \
  "$ROOT/src/features/grpc/hooks/grpcStudioTabLifecycle.test.ts" \
  "$ROOT/src/shared/grpc/grpcTauriEventAdapter.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TS_TEST_COUNT:-0}" -lt 14 ]]; then
  echo "Expected at least 14 Phase 7E-focused TS tests, found ${TS_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TS_TEST_COUNT} Phase 7E-focused TS tests declared)"
echo ""

echo "--- Step 1: TypeScript unit tests (7E scope) ---"
npx vitest run \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/shared/grpc/grpcTauriEventAdapter.test.ts \
  src/features/grpc/hooks/grpcStudioTabLifecycle.test.ts \
  src/shared/grpc/buildGrpcNodeOperations.test.ts \
  src/features/grpc/GrpcStudioPage.test.tsx \
  src/features/workflow/utils/grpcWorkflowStreamCollector.test.ts \
  src/shared/grpc/grpcStreamClient.test.ts \
  src/shared/grpc/buildGrpcNodeOperations.coverage-gaps.test.ts \
  src/features/grpc/hooks/useGrpcStreamSession.coverage-gaps.test.ts
echo ""

echo "--- Step 2: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 3: Phase 7D regression ---"
grpc_gate_run_regression "Phase phase7d" test:grpc:phase7d
echo ""

echo "=== Phase 7E gate: PASSED ==="

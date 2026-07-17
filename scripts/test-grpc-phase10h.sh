#!/usr/bin/env bash
# Phase 10H — Cross-surface result envelope parity gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10H gate: cross-surface result envelope parity ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcWebTrailerNormalize.ts
  src/shared/grpc/grpcHarnessTrailerNormalize.ts
  src/shared/grpc/grpcGrpcWebUnaryClient.ts
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts
  src/shared/grpc/grpcBrowserTransportAdapters.ts
  src/shared/grpc/grpcStreamClient.ts
  src/shared/grpc/grpcPhase10hAcceptance.test.ts
  scripts/test-grpc-phase10h.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10H deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10h"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10h' >&2
  exit 1
fi
# Key content checks
if ! grep -q 'normalizeGrpcWebUnaryResponse' "$ROOT/src/shared/grpc/grpcWebTrailerNormalize.ts"; then
  echo 'Missing normalizeGrpcWebUnaryResponse in grpcWebTrailerNormalize' >&2
  exit 1
fi
if ! grep -q "transportUsed: 'grpc-web'" "$ROOT/src/shared/grpc/grpcGrpcWebUnaryClient.ts"; then
  echo "Missing transportUsed: 'grpc-web' in grpcGrpcWebUnaryClient" >&2
  exit 1
fi
if ! grep -q "transportUsed: 'spring-servlet'" "$ROOT/src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts"; then
  echo "Missing transportUsed: 'spring-servlet' in grpcGrpcSpringServletUnaryClient" >&2
  exit 1
fi
if ! grep -q 'normalizeGrpcHarnessTrailers' "$ROOT/src/shared/grpc/grpcHarnessTrailerNormalize.ts"; then
  echo 'Missing normalizeGrpcHarnessTrailers in grpcHarnessTrailerNormalize' >&2
  exit 1
fi
if ! grep -q "dispatchReady: true" "$ROOT/src/shared/grpc/grpcBrowserTransportAdapters.ts"; then
  echo 'Missing dispatchReady: true in grpcBrowserTransportAdapters' >&2
  exit 1
fi
SPRING_DISPATCH_READY=$(awk "/mode: 'spring-servlet'/{found=1} found && /dispatchReady: true/{print; exit}" "$ROOT/src/shared/grpc/grpcBrowserTransportAdapters.ts")
if [[ -z "${SPRING_DISPATCH_READY:-}" ]]; then
  echo "Missing dispatchReady: true on spring-servlet adapter" >&2
  exit 1
fi
GRPC_WEB_DISPATCH_READY=$(awk "/mode: 'grpc-web'/{found=1} found && /dispatchReady: true/{print; exit}" "$ROOT/src/shared/grpc/grpcBrowserTransportAdapters.ts")
if [[ -z "${GRPC_WEB_DISPATCH_READY:-}" ]]; then
  echo "Missing dispatchReady: true on grpc-web adapter" >&2
  exit 1
fi
if ! grep -q 'grpcHarnessAssertEngine.ts resolves grpcTrailer assertions via resolveGrpcHarnessTrailerValue' "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts"; then
  echo 'Missing harness assert engine parity test in grpcPhase10hAcceptance' >&2
  exit 1
fi
if ! grep -q 'Phase 10H acceptance checklist' "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts"; then
  echo 'Missing Phase 10H acceptance checklist in grpcPhase10hAcceptance' >&2
  exit 1
fi
if ! grep -q 'Phase 10H' "$ROOT/src/shared/grpc/grpcStreamClient.ts"; then
  echo 'Missing Phase 10H boundary guards in grpcStreamClient' >&2
  exit 1
fi
if ! grep -q 'grpcWorkflowOutputAdapter.ts consumes grpc status fields without transport-specific branching' "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts"; then
  echo 'Missing workflow output adapter parity test in grpcPhase10hAcceptance' >&2
  exit 1
fi
if ! grep -q 'workflow grpcTrailer assertions resolve normalized browser transport trailer keys' "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts"; then
  echo 'Missing workflow trailer parity integration test in grpcPhase10hAcceptance' >&2
  exit 1
fi
if ! grep -q 'grpc-web adapter omits startStream' "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts"; then
  echo 'Missing grpc-web startStream boundary test in grpcPhase10hAcceptance' >&2
  exit 1
fi
if ! grep -q 'grpcWorkflowAssertEngine.ts resolves grpcTrailer assertions via resolveGrpcHarnessTrailerValue' "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts"; then
  echo 'Missing workflow assert engine shared trailer resolver test in grpcPhase10hAcceptance' >&2
  exit 1
fi
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10hAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 40 ]]; then
  echo "Expected at least 40 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 10H acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase10hAcceptance.test.ts
echo ""

echo "--- Step 3: Stream boundary regression (Phase 10H behavioral) ---"
npx vitest run \
  src/shared/grpc/grpcStreamClient.test.ts \
  -t "startGrpcStream transport dispatch"
echo ""

echo "--- Step 4: Phase 10G regression ---"
grpc_gate_run_regression "Phase phase10g" test:grpc:phase10g
echo ""

echo "=== Phase 10H gate: PASSED ==="

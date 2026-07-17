#!/usr/bin/env bash
# Phase 10D — Spring Servlet path resolver and unary adapter gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10D gate: Spring Servlet path + unary adapter ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcSpringServletPathResolver.ts
  src/shared/grpc/grpcSpringServletTransportContracts.ts
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts
  src/shared/grpc/grpcSpringServletPathResolver.test.ts
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.test.ts
  src/shared/grpc/grpcPhase10dAcceptance.test.ts
  scripts/test-grpc-phase10d.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10D deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10d"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10d' >&2
  exit 1
fi

PATH_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcSpringServletPathResolver.test.ts")
CLIENT_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcGrpcSpringServletUnaryClient.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10dAcceptance.test.ts")
if [[ "${PATH_TEST_COUNT:-0}" -lt 5 ]]; then
  echo "Expected at least 5 path resolver tests, found ${PATH_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 5 ]]; then
  echo "Expected at least 5 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if ! grep -q 'function createSpringServletAdapter' "$ROOT/src/shared/grpc/grpcBrowserTransportAdapters.ts"; then
  echo 'Missing createSpringServletAdapter in adapters' >&2
  exit 1
fi
if ! grep -A25 'function createSpringServletAdapter' "$ROOT/src/shared/grpc/grpcBrowserTransportAdapters.ts" | grep -q 'dispatchReady: true'; then
  echo 'Missing spring-servlet dispatchReady: true in createSpringServletAdapter' >&2
  exit 1
fi
echo "✓ Deliverables present (${PATH_TEST_COUNT}+${CLIENT_TEST_COUNT} path/client + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Path resolver + client + acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcSpringServletPathResolver.test.ts \
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.test.ts \
  src/shared/grpc/grpcPhase10dAcceptance.test.ts
echo ""

echo "--- Step 3: Adapter dispatch regression ---"
npx vitest run \
  src/shared/grpc/grpcBrowserTransportRouter.test.ts \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/features/grpc/components/GrpcTransportPanel.test.tsx \
  src/features/grpc/hooks/grpcStudioUnaryCommands.phase10a.test.ts \
  -t "spring-servlet|dispatch|browser-direct|Phase 10"
echo ""

echo "--- Step 4: Phase 10C regression ---"
grpc_gate_run_regression "Phase phase10c" test:grpc:phase10c
echo ""

echo "=== Phase 10D gate: PASSED ==="

#!/usr/bin/env bash
# Phase 10E — Browser transport error taxonomy and UX hints gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10E gate: browser transport error taxonomy ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcBrowserTransportErrorMapper.ts
  src/shared/grpc/grpcBrowserTransportErrorMapper.test.ts
  src/shared/grpc/grpcBrowserTransportErrorMapper.coverage-gaps.test.ts
  src/shared/grpc/grpcPhase10eAcceptance.test.ts
  scripts/test-grpc-phase10e.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10E deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10e"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10e' >&2
  exit 1
fi
if ! grep -q 'mapBrowserTransportFetchFailure' "$ROOT/src/shared/grpc/grpcGrpcWebUnaryClient.ts"; then
  echo 'Missing mapper wiring in grpcGrpcWebUnaryClient' >&2
  exit 1
fi
if ! grep -q 'mapBrowserTransportFetchFailure' "$ROOT/src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts"; then
  echo 'Missing mapper wiring in grpcGrpcSpringServletUnaryClient' >&2
  exit 1
fi
if ! grep -q 'grpcApiErrorToBrowserExpressFallbackBody' "$ROOT/src/features/grpc/hooks/useGrpcStreamSession.ts"; then
  echo 'Missing browser Express fallback in useGrpcStreamSession' >&2
  exit 1
fi
if ! grep -q 'grpcApiErrorToBrowserExpressFallbackBody' "$ROOT/src/features/grpc/hooks/grpcStudioUnaryCommands.ts"; then
  echo 'Missing browser Express fallback in grpcStudioUnaryCommands' >&2
  exit 1
fi
MAPPER_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcBrowserTransportErrorMapper.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10eAcceptance.test.ts")
if [[ "${MAPPER_TEST_COUNT:-0}" -lt 8 ]]; then
  echo "Expected at least 8 mapper tests, found ${MAPPER_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 5 ]]; then
  echo "Expected at least 5 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${MAPPER_TEST_COUNT} mapper + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Mapper + acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcBrowserTransportErrorMapper.test.ts \
  src/shared/grpc/grpcBrowserTransportErrorMapper.coverage-gaps.test.ts \
  src/shared/grpc/grpcPhase10eAcceptance.test.ts
echo ""

echo "--- Step 3: UI hint + client regression ---"
npx vitest run \
  src/features/grpc/components/GrpcResponsePanel.test.tsx \
  src/features/grpc/components/GrpcCallPanel.test.tsx \
  src/shared/grpc/grpcGrpcWebUnaryClient.test.ts \
  src/shared/grpc/grpcGrpcSpringServletUnaryClient.test.ts \
  src/features/grpc/hooks/grpcStudioUnaryCommands.transport.test.ts \
  src/features/grpc/hooks/useGrpcStreamSession.transport.test.ts \
  -t "browser|transport|Express|timeout|CORS|Phase 10"
echo ""

echo "--- Step 4: Phase 10D regression ---"
grpc_gate_run_regression "Phase phase10d" test:grpc:phase10d
echo ""

echo "=== Phase 10E gate: PASSED ==="

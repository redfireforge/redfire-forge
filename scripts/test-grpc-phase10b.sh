#!/usr/bin/env bash
# Phase 10B — gRPC browser transport adapter and mode routing gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10B gate: browser transport router ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcBrowserTransportAdapter.ts
  src/shared/grpc/grpcBrowserTransportAdapters.ts
  src/shared/grpc/grpcBrowserTransportRouter.ts
  src/shared/grpc/grpcExpressProxyJsonTransport.ts
  src/shared/grpc/grpcBrowserTransportRouter.test.ts
  src/shared/grpc/grpcPhase10bAcceptance.test.ts
  scripts/test-grpc-phase10b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10B deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10b' >&2
  exit 1
fi

ROUTER_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcBrowserTransportRouter.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10bAcceptance.test.ts")
CHECKLIST_DESCRIBE_COUNT=$(grep -cE "checklist-[1-3]:" "$ROOT/src/shared/grpc/grpcPhase10bAcceptance.test.ts")
if [[ "${ROUTER_TEST_COUNT:-0}" -lt 5 ]]; then
  echo "Expected at least 5 router tests, found ${ROUTER_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 6 ]]; then
  echo "Expected at least 6 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${CHECKLIST_DESCRIBE_COUNT:-0}" -lt 3 ]]; then
  echo "Expected 3 checklist describe blocks, found ${CHECKLIST_DESCRIBE_COUNT:-0}" >&2
  exit 1
fi
if ! grep -q 'dispatchReady' "$ROOT/src/shared/grpc/grpcBrowserTransportAdapter.ts"; then
  echo 'Missing dispatchReady on adapter interface' >&2
  exit 1
fi
echo "✓ Deliverables present (${ROUTER_TEST_COUNT} router + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Router + acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcBrowserTransportRouter.test.ts \
  src/shared/grpc/grpcPhase10bAcceptance.test.ts
echo ""

echo "--- Step 3: Facade/stream snapshot binding regression ---"
npx vitest run \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/shared/grpc/grpcStreamClient.test.ts \
  src/features/grpc/hooks/grpcStudioUnaryCommands.phase10a.test.ts \
  -t "browser-direct|snapshot|dispatch|Phase 10"
echo ""

echo "--- Step 4: Phase 10A regression ---"
grpc_gate_run_regression "Phase phase10a" test:grpc:phase10a
echo ""

echo "=== Phase 10B gate: PASSED ==="

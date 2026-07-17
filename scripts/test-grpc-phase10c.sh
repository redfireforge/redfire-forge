#!/usr/bin/env bash
# Phase 10C — gRPC-Web framing codec and unary adapter gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10C gate: grpc-web framing + unary adapter ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcWebFramingCodec.ts
  src/shared/grpc/grpcWebTrailerNormalize.ts
  src/shared/grpc/grpcWebProtoCodec.ts
  src/shared/grpc/grpcGrpcWebUnaryClient.ts
  src/shared/grpc/grpcWebFramingCodec.test.ts
  src/shared/grpc/grpcWebTrailerNormalize.test.ts
  src/shared/grpc/grpcWebProtoCodec.test.ts
  src/shared/grpc/grpcGrpcWebUnaryClient.test.ts
  src/shared/grpc/grpcPhase10cAcceptance.test.ts
  scripts/test-grpc-phase10c.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10C deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10c"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10c' >&2
  exit 1
fi

FRAMING_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcWebFramingCodec.test.ts")
TRAILER_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcWebTrailerNormalize.test.ts")
PROTO_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcWebProtoCodec.test.ts")
CLIENT_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcGrpcWebUnaryClient.test.ts")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10cAcceptance.test.ts")
if [[ "${FRAMING_TEST_COUNT:-0}" -lt 4 ]]; then
  echo "Expected at least 4 framing codec tests, found ${FRAMING_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 5 ]]; then
  echo "Expected at least 5 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if ! grep -q 'dispatchReady: true' "$ROOT/src/shared/grpc/grpcBrowserTransportAdapters.ts"; then
  echo 'Missing grpc-web dispatchReady: true in adapters' >&2
  exit 1
fi
echo "✓ Deliverables present (${FRAMING_TEST_COUNT}+${TRAILER_TEST_COUNT}+${PROTO_TEST_COUNT}+${CLIENT_TEST_COUNT} codec/client + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Framing + trailer + proto + client + acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcWebFramingCodec.test.ts \
  src/shared/grpc/grpcWebTrailerNormalize.test.ts \
  src/shared/grpc/grpcWebProtoCodec.test.ts \
  src/shared/grpc/grpcGrpcWebUnaryClient.test.ts \
  src/shared/grpc/grpcPhase10cAcceptance.test.ts
echo ""

echo "--- Step 3: Adapter dispatch regression ---"
npx vitest run \
  src/shared/grpc/grpcBrowserTransportRouter.test.ts \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/features/grpc/components/GrpcTransportPanel.test.tsx \
  -t "grpc-web|dispatch|browser-direct|Phase 10"
echo ""

echo "--- Step 4: Phase 10B regression ---"
grpc_gate_run_regression "Phase phase10b" test:grpc:phase10b
echo ""

echo "=== Phase 10C gate: PASSED ==="

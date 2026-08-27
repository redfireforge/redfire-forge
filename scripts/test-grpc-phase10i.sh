#!/usr/bin/env bash
# Phase 10I — Hardening gate before Phase 11.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10I gate: hardening gate before Phase 11 ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcWebTransportContracts.ts
  src/shared/grpc/grpcWebFramingCodec.ts
  src/shared/grpc/grpcBrowserTransportErrorMapper.ts
  src/shared/grpc/grpcSpringServletPathResolver.ts
  src/features/grpc/grpcStudioTypes.ts
  src/shared/grpc/grpcPhase10iAcceptance.test.ts
  scripts/test-grpc-phase10i.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10i' >&2
  exit 1
fi

# Key content checks
if ! grep -q 'assertGrpcTransportExecutePreflight' "$ROOT/src/shared/grpc/grpcWebTransportContracts.ts"; then
  echo 'Missing assertGrpcTransportExecutePreflight in grpcWebTransportContracts' >&2
  exit 1
fi
if ! grep -q 'classifyBrowserTransportFetchFailure' "$ROOT/src/shared/grpc/grpcBrowserTransportErrorMapper.ts"; then
  echo 'Missing classifyBrowserTransportFetchFailure in grpcBrowserTransportErrorMapper' >&2
  exit 1
fi
if ! grep -q 'canChangeGrpcTabTransportMode' "$ROOT/src/features/grpc/grpcStudioTypes.ts"; then
  echo 'Missing canChangeGrpcTabTransportMode in grpcStudioTypes' >&2
  exit 1
fi
if ! grep -q 'buildSpringServletMethodPath' "$ROOT/src/shared/grpc/grpcSpringServletPathResolver.ts"; then
  echo 'Missing buildSpringServletMethodPath in grpcSpringServletPathResolver' >&2
  exit 1
fi
if ! grep -q 'Phase 10I' "$ROOT/src/shared/grpc/grpcPhase10iAcceptance.test.ts"; then
  echo 'Missing Phase 10I label in grpcPhase10iAcceptance' >&2
  exit 1
fi
if ! grep -q 'Phase 10I acceptance checklist' "$ROOT/src/shared/grpc/grpcPhase10iAcceptance.test.ts"; then
  echo 'Missing Phase 10I acceptance checklist in grpcPhase10iAcceptance' >&2
  exit 1
fi
if ! grep -Eq 'server_streaming passes execute preflight but stream_start fails|server_streaming passes execute preflight and stream_start succeeds' "$ROOT/src/shared/grpc/grpcPhase10iAcceptance.test.ts"; then
  echo 'Missing Phase 10I browser-direct server_streaming behavioral tests in grpcPhase10iAcceptance' >&2
  exit 1
fi
if ! grep -q 'grpc-transport-stream-deferred-hint' "$ROOT/src/features/grpc/components/GrpcTransportPanel.tsx"; then
  echo 'Missing server streaming deferred hint in GrpcTransportPanel.tsx' >&2
  exit 1
fi
if ! grep -q 'buildSpringServletMethodUrls' "$ROOT/src/shared/grpc/grpcGrpcSpringServletUnaryClient.ts"; then
  echo 'Missing Spring Servlet path candidate retry in grpcGrpcSpringServletUnaryClient' >&2
  exit 1
fi
if ! grep -q 'suggestExpressProxy' "$ROOT/src/shared/grpc/grpcStreamClient.ts"; then
  echo 'Missing suggestExpressProxy on deferred stream_start errors in grpcStreamClient' >&2
  exit 1
fi
if ! grep -q 'assertBrowserDirectTransportTlsSupported' "$ROOT/src/shared/grpc/grpcWebTransportContracts.ts"; then
  echo 'Missing assertBrowserDirectTransportTlsSupported in grpcWebTransportContracts' >&2
  exit 1
fi
if ! grep -q 'grpcStudioUnaryCommands.ts wires assertGrpcTransportExecutePreflight' "$ROOT/src/shared/grpc/grpcPhase10iAcceptance.test.ts"; then
  echo 'Missing prepareExecuteSnapshot preflight source-scan in grpcPhase10iAcceptance' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10iAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 70 ]]; then
  echo "Expected at least 70 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Phase 10I acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase10iAcceptance.test.ts
echo ""

echo "--- Step 3: Phase 10H regression ---"
grpc_gate_run_regression "Phase phase10h" test:grpc:phase10h
echo ""

echo "=== Phase 10I gate: PASSED ==="

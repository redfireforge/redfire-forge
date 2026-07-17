#!/usr/bin/env bash
# scripts/test-grpc-phase7f.sh — Phase 7F gate
# Verifies per-tab transport routing, express fallback UX, and stream binding safety.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7F gate: gRPC transport fallback orchestration ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcTransportTabRouting.ts
  src/shared/grpc/grpcTransportFallback.ts
  src/features/grpc/utils/grpcStudioTransportSync.ts
  src/features/grpc/components/GrpcTransportPanel.tsx
  src/features/grpc/components/GrpcResponsePanel.tsx
  src/shared/grpc/grpcTransportFacade.ts
  src/features/grpc/hooks/useGrpcStudio.ts
  src/features/grpc/hooks/useGrpcStreamSession.ts
  src/features/grpc/components/GrpcTransportPanel.test.tsx
  scripts/test-grpc-phase7f.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7F deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7f"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7f' >&2
  exit 1
fi
if ! grep -q 'retryUnaryWithExpress' "$ROOT/src/features/grpc/hooks/useGrpcStudio.ts"; then
  echo 'useGrpcStudio must expose retryUnaryWithExpress (Phase 7F)' >&2
  exit 1
fi
if ! grep -q 'bindGrpcStreamTransportForTab' "$ROOT/src/features/grpc/hooks/useGrpcStreamSession.ts"; then
  echo 'useGrpcStreamSession must bind stream transport after stream_start (Phase 7F)' >&2
  exit 1
fi
if ! grep -q 'grpc-retry-express-btn' "$ROOT/src/features/grpc/components/GrpcResponsePanel.tsx"; then
  echo 'GrpcResponsePanel must offer Retry with Express Proxy (Phase 7F)' >&2
  exit 1
fi
if ! grep -q 'clearGrpcStreamTransportBinding' "$ROOT/src/features/grpc/hooks/grpcStreamSessionHelpers.ts"; then
  echo 'grpcStreamSessionHelpers must clear stream transport binding on abort (Phase 7F)' >&2
  exit 1
fi
if ! grep -q 'getGrpcStreamTransportBinding' "$ROOT/src/shared/grpc/grpcTransportTabRouting.ts"; then
  echo 'resolveGrpcTransportForTab must honor stream transport binding (Phase 7F)' >&2
  exit 1
fi
if ! awk '/onError: \(message\) => \{/,/^      \},/' "$ROOT/src/features/grpc/hooks/useGrpcStreamSession.ts" | grep -q 'releaseStreamTransportBinding'; then
  echo 'attachStreamEventsForTab onError must release stream transport binding (Phase 7F)' >&2
  exit 1
fi
TS_TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcTransportFacade.test.ts" \
  "$ROOT/src/shared/grpc/grpcTransportTabRouting.test.ts" \
  "$ROOT/src/shared/grpc/grpcTransportFallback.test.ts" \
  "$ROOT/src/features/grpc/components/GrpcTransportPanel.test.tsx" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TS_TEST_COUNT:-0}" -lt 18 ]]; then
  echo "Expected at least 18 Phase 7F-focused TS tests, found ${TS_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${TS_TEST_COUNT} Phase 7F-focused TS tests declared)"
echo ""

echo "--- Step 1: TypeScript unit tests (7F scope) ---"
npx vitest run \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/shared/grpc/grpcTransportTabRouting.test.ts \
  src/shared/grpc/grpcTransportFallback.test.ts \
  src/features/grpc/components/GrpcTransportPanel.test.tsx \
  src/features/grpc/components/GrpcAdvancedSettingsPanels.test.tsx \
  src/shared/grpc/buildGrpcNodeOperations.coverage-gaps.test.ts \
  src/features/grpc/hooks/useGrpcStreamSession.coverage-gaps.test.ts \
  src/features/grpc/hooks/grpcStudioUnaryCommands.transport.test.ts \
  src/features/grpc/hooks/useGrpcStreamSession.transport.test.ts \
  src/features/grpc/hooks/useGrpcStudio.coverage-gaps.test.ts \
  src/features/grpc/hooks/grpcStreamSessionHelpers.test.ts \
  src/shared/grpc/grpcTransportFallback.coverage-gaps.test.ts \
  src/features/grpc/GrpcStudioPage.test.tsx
echo ""

echo "--- Step 2: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 3: Phase 7E regression ---"
grpc_gate_run_regression "Phase phase7e" test:grpc:phase7e
echo ""

echo "=== Phase 7F gate: PASSED ==="

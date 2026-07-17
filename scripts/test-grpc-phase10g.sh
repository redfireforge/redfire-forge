#!/usr/bin/env bash
# Phase 10G — Transport selector UX, persistence, and guardrails gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 10G gate: transport selector UX, persistence, and guardrails ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/features/grpc/components/GrpcTransportPanel.tsx
  src/features/grpc/components/GrpcConnectionSettingsDrawer.tsx
  src/features/grpc/GrpcStudioPage.tsx
  src/features/grpc/components/GrpcTransportPanel.test.tsx
  src/features/grpc/components/GrpcConnectionSettingsDrawer.test.tsx
  src/shared/grpc/grpcPhase10gAcceptance.test.ts
  scripts/test-grpc-phase10g.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 10G deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase10g"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase10g' >&2
  exit 1
fi
if ! grep -q 'isGrpcTransportCallTypeSupported' "$ROOT/src/features/grpc/components/GrpcTransportPanel.tsx"; then
  echo 'Missing isGrpcTransportCallTypeSupported in GrpcTransportPanel' >&2
  exit 1
fi
if ! grep -q 'callType' "$ROOT/src/features/grpc/components/GrpcConnectionSettingsDrawer.tsx"; then
  echo 'Missing callType prop in GrpcConnectionSettingsDrawer' >&2
  exit 1
fi
if ! grep -q 'callType={tabCallTypes\[tab.id\]}' "$ROOT/src/features/grpc/GrpcStudioPage.tsx"; then
  echo 'Missing callType wiring in GrpcStudioPage' >&2
  exit 1
fi
if ! grep -q 'getModeDisabledReason' "$ROOT/src/features/grpc/components/GrpcTransportPanel.tsx"; then
  echo 'Missing getModeDisabledReason in GrpcTransportPanel' >&2
  exit 1
fi
PANEL_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/features/grpc/components/GrpcTransportPanel.test.tsx")
DRAWER_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/features/grpc/components/GrpcConnectionSettingsDrawer.test.tsx")
ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it(\.each)?\(" "$ROOT/src/shared/grpc/grpcPhase10gAcceptance.test.ts")
if ! grep -q 'transportChangeBlocked={!canChangeGrpcTabTransportMode(tab)}' "$ROOT/src/features/grpc/GrpcStudioPage.tsx"; then
  echo 'Missing in-flight transport lock wiring in GrpcStudioPage' >&2
  exit 1
fi
if ! grep -q 'streamLifecycle is ending' "$ROOT/src/shared/grpc/grpcPhase10gAcceptance.test.ts"; then
  echo 'Missing stream ending lifecycle guard test in grpcPhase10gAcceptance' >&2
  exit 1
fi
if [[ "${PANEL_TEST_COUNT:-0}" -lt 22 ]]; then
  echo "Expected at least 22 panel tests, found ${PANEL_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${DRAWER_TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 drawer tests, found ${DRAWER_TEST_COUNT:-0}" >&2
  exit 1
fi
if ! grep -q 'assertGrpcTransportExecutePreflight' "$ROOT/src/shared/grpc/grpcPhase10gAcceptance.test.ts"; then
  echo 'Missing execute preflight guard tests in grpcPhase10gAcceptance' >&2
  exit 1
fi
if ! grep -q 'canChangeGrpcTabTransportMode' "$ROOT/src/features/grpc/hooks/useGrpcStudio.ts"; then
  echo 'Missing transport change guard in useGrpcStudio' >&2
  exit 1
fi
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 32 ]]; then
  echo "Expected at least 32 acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${PANEL_TEST_COUNT} panel + ${DRAWER_TEST_COUNT} drawer + ${ACCEPTANCE_TEST_COUNT} acceptance tests)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc project
echo ""

echo "--- Step 2: Transport panel + drawer unit tests (Phase 7F + 10G) ---"
npx vitest run \
  src/features/grpc/components/GrpcTransportPanel.test.tsx \
  src/features/grpc/components/GrpcConnectionSettingsDrawer.test.tsx
echo ""

echo "--- Step 3: Acceptance tests ---"
npx vitest run \
  src/shared/grpc/grpcPhase10gAcceptance.test.ts
echo ""

echo "--- Step 4: Phase 10F regression ---"
grpc_gate_run_regression "Phase phase10f" test:grpc:phase10f
echo ""

echo "=== Phase 10G gate: PASSED ==="

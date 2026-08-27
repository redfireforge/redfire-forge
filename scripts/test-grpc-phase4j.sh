#!/usr/bin/env bash
# Phase 4J — Protocol UI/UX parity gate (4J-A through 4J-E).
# Runs full Phase 4I regression chain plus scoped 4J component/policy tests.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 4J: Deliverable files =="
DELIVERABLES=(
  scripts/test-grpc-phase4j.sh
  src/features/grpc/components/GrpcConnectionBar.tsx
  src/features/grpc/components/GrpcTlsConfigModal.tsx
  src/features/grpc/components/GrpcConnectionSettingsDrawer.tsx
  src/features/grpc/components/GrpcCompressionPanel.tsx
  src/features/grpc/components/GrpcHealthCheckPanel.tsx
  e2e/grpc-studio-tls.spec.ts
  src/shared/grpc/grpcPhase4JAcceptance.test.ts
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 4J deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase4j"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase4j' >&2
  exit 1
fi

echo "== Phase 4J: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 4J: Acceptance checklist traceability =="
npx vitest run src/shared/grpc/grpcPhase4JAcceptance.test.ts

echo "== Phase 4J: Phase 4I regression chain =="
grpc_gate_run_regression "Phase 4J" test:grpc:phase4i

echo "== Phase 4J: UI parity unit tests =="
npx vitest run \
  src/features/grpc/components/GrpcConnectionBar.test.tsx \
  src/features/grpc/components/GrpcConnectionSettingsDrawer.test.tsx \
  src/features/grpc/components/GrpcTlsPanel.test.tsx \
  src/features/grpc/components/GrpcAuthPanel.test.tsx \
  src/features/grpc/components/GrpcCallSettingsPanel.test.tsx \
  src/features/grpc/components/GrpcCompressionPanel.test.tsx \
  src/features/grpc/components/GrpcHealthCheckPanel.test.tsx \
  src/features/grpc/components/GrpcAdvancedSettingsPanels.test.tsx \
  src/features/grpc/components/GrpcCallPanel.test.tsx \
  src/features/grpc/components/GrpcCallPanel.auth.test.tsx \
  src/features/grpc/components/GrpcTargetPanel.test.tsx \
  src/features/grpc/GrpcStudioPage.test.tsx \
  src/shared/grpc/grpcCompressionPolicy.test.ts \
  src/features/grpc/utils/grpcHealthProbe.test.ts \
  src/features/grpc/utils/grpcConnectionBarUtils.test.ts \
  src/features/grpc/grpcStudioTypes.test.ts

echo ""
echo "Phase 4J gate: ALL PASSED"

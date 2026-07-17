#!/usr/bin/env bash
# Phase 5I — consolidated Phase 5 hardening gate (snapshot baseline + acceptance + 5A–5H regressions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 5I: Deliverable files =="
DELIVERABLES=(
  docs/guides/grpc-phase5-runbook.md
  docs/guides/grpc-phase5-validation-report.md
  src/features/grpc/utils/grpcResponseSnapshot.ts
  src/features/grpc/components/GrpcResponseSnapshotPanel.tsx
  src/features/grpc/components/GrpcResponseSnapshotDiffModal.tsx
  src/shared/grpc/grpcSavedRequest.ts
  e2e/grpc-studio-collections-history.spec.ts
  scripts/test-grpc-phase5i.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 5I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase5i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase5i' >&2
  exit 1
fi

echo "== Phase 5I: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 5I: Snapshot baseline + panel tests =="
npx vitest run \
  src/features/grpc/utils/grpcResponseSnapshot.test.ts \
  src/features/grpc/components/GrpcResponseSnapshotPanel.test.tsx \
  src/features/grpc/components/GrpcResponseSnapshotDiffModal.test.tsx

echo "== Phase 5I: Acceptance checklist traceability =="
npx vitest run src/shared/grpc/grpcPhase5Acceptance.test.ts

grpc_gate_run_regression_gates "Phase 5I" phase5a phase5bd phase5c phase5e phase5fg phase5h

echo ""
echo "Phase 5I gate: ALL PASSED"
echo "Optional E2E: npx playwright test e2e/grpc-studio-collections-history.spec.ts --reporter=list"

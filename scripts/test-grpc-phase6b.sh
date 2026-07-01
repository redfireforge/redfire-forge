#!/usr/bin/env bash
# Phase 6B — gRPC workflow snapshot builder + transport adapter gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 6B: Deliverable files =="
DELIVERABLES=(
  src/features/workflow/types/workflow/grpcWorkflowSnapshot.ts
  src/features/workflow/utils/grpcWorkflowTemplateResolver.ts
  src/features/workflow/utils/grpcWorkflowSnapshotBuilder.ts
  src/features/workflow/utils/grpcWorkflowTransportAdapter.ts
  src/shared/grpc/grpcPhase6bAcceptance.test.ts
  scripts/test-grpc-phase6b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 6B deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase6b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase6b' >&2
  exit 1
fi

echo "== Phase 6B: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 6B: Snapshot + adapter tests =="
npx vitest run \
  src/features/workflow/utils/grpcWorkflowTemplateResolver.test.ts \
  src/features/workflow/utils/grpcWorkflowSnapshotBuilder.test.ts \
  src/features/workflow/utils/grpcWorkflowTransportAdapter.test.ts \
  src/shared/grpc/grpcPhase6bAcceptance.test.ts

echo "== Phase 6B: Phase 6A regression =="
grpc_gate_run_regression "Phase phase6a" test:grpc:phase6a

echo ""
echo "Phase 6B gate: ALL PASSED"

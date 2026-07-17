#!/usr/bin/env bash
# Phase 6I — consolidated Phase 6 hardening gate (acceptance checklist + 6A–6H regressions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 6I: Deliverable files =="
DELIVERABLES=(
  src/shared/grpc/grpcPhase6iAcceptance.test.ts
  scripts/test-grpc-phase6i.sh
  docs/guides/grpc-phase6-runbook.md
  docs/guides/grpc-phase6-validation-report.md
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 6I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase6i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase6i' >&2
  exit 1
fi

echo "== Phase 6I: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 6I: Acceptance checklist (runGraph) =="
npx vitest run src/shared/grpc/grpcPhase6iAcceptance.test.ts

echo "== Phase 6I: Workflow integration + adapter regression =="
npx vitest run \
  src/features/workflow/engine/graphRunner.grpc.test.ts \
  src/shared/grpc/grpcPhase6ghAcceptance.test.ts \
  src/shared/grpc/grpcPhase6efAcceptance.test.ts \
  src/features/workflow/utils/grpcWorkflowOutputAdapter.test.ts \
  src/features/workflow/engine/graphRunnerGrpcNodeHandlers.test.ts \
  src/features/workflow/components/configs/NodeConfigOutputTab.test.tsx

echo "== Phase 6I regression: test:grpc:phase6gh (6A→6H chain) =="
grpc_gate_run_regression "Phase phase6gh" test:grpc:phase6gh

echo ""
echo "Phase 6I gate: ALL PASSED"

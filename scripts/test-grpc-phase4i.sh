#!/usr/bin/env bash
# Phase 4I — consolidated TLS/auth hardening gate (acceptance + 4A–4H regressions).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "== Phase 4I: Deliverable files =="
DELIVERABLES=(
  docs/guides/grpc-phase4-runbook.md
  docs/guides/grpc-phase4-security-validation.md
  docs/guides/grpc-phase4-threat-model.md
  docs/plan/future/grpc/grpc-cross-feature-matrix.md
  src/shared/grpc/grpcPhase4Acceptance.test.ts
  scripts/test-grpc-phase4i.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 4I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase4i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase4i' >&2
  exit 1
fi

echo "== Phase 4I: TypeScript =="
grpc_gate_run_tsc project

echo "== Phase 4I: Acceptance checklist traceability =="
npx vitest run src/shared/grpc/grpcPhase4Acceptance.test.ts

GATES=(phase4a phase4bc phase4d phase4e phase4f phase4g phase4h)
grpc_gate_run_regression_gates "consolidated gate" phase4a phase4bc phase4d phase4e phase4f phase4g phase4h

echo ""
echo "Phase 4I gate: ALL PASSED"

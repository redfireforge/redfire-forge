#!/usr/bin/env bash
# Phase 12A — gRPC Demo Hub lesson contract and roster gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 12A gate: gRPC lesson contract ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/types.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/roster.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/versioning.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/index.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/shell.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/coverage-gaps.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/shell.test.ts
  packages/demo-hub/src/adapters/grpcStudioAdapter.ts
  packages/demo-hub/src/adapters/grpcStudioAdapter.test.ts
  packages/demo-hub/src/adapters/adaptersImportAudit.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lessons.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-first-call.test.ts
  scripts/test-grpc-phase12a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 12A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase12a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase12a' >&2
  exit 1
fi

ROSTER_COUNT=$(grep -c "id: 'grpc-" "$ROOT/packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/roster.ts" || true)
if [[ "$ROSTER_COUNT" -lt 15 ]]; then
  echo "Expected 15 roster entries, found $ROSTER_COUNT" >&2
  exit 1
fi

echo "--- Step 1: Typecheck ---"
grpc_gate_run_tsc project

echo "--- Step 2: Contract unit tests ---"
npx vitest run \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/validate.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/coverage-gaps.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/shell.test.ts \
  packages/demo-hub/src/adapters/grpcStudioAdapter.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lessons.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-first-call.test.ts \
  packages/demo-hub/src/adapters/adaptersImportAudit.test.ts

echo ""
echo "Phase 12A gate passed."

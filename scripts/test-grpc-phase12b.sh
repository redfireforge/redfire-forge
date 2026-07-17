#!/usr/bin/env bash
# Phase 12B — gRPC Demo Hub lesson runtime engine gate.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 12B gate: gRPC lesson runtime ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/types.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/fingerprint.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/snapshots.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stepCheckpoints.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stateMachine.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/session.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/index.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/fingerprint.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/snapshots.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stateMachine.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/session.test.ts
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stepCheckpoints.test.ts
  packages/demo-hub/src/adapters/grpcLessonRuntimeAdapter.ts
  packages/demo-hub/src/adapters/grpcLessonRuntimeAdapter.test.ts
  scripts/test-grpc-phase12b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 12B deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase12b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase12b' >&2
  exit 1
fi

echo "--- Step 1: Typecheck ---"
grpc_gate_run_tsc project

echo "--- Step 2: Runtime unit tests ---"
npx vitest run \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/fingerprint.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/snapshots.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stateMachine.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/session.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-contract/runtime/stepCheckpoints.test.ts \
  packages/demo-hub/src/adapters/grpcLessonRuntimeAdapter.test.ts \
  packages/demo-hub/src/lessons/protocols/grpc-lesson-helpers.test.ts

echo "--- Step 3: Phase 12A regression ---"
grpc_gate_run_regression "Phase 12A" test:grpc:phase12a

echo ""
echo "Phase 12B gate passed."

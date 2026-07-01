#!/usr/bin/env bash
# scripts/test-grpc-phase7i.sh — Phase 7I hardening gate
# Acceptance checklist + targeted regression + full 7A→7H chain + Phase 6I subset.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7I gate: gRPC native hardening ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcPhase7iAcceptance.test.ts
  scripts/test-grpc-phase7i.sh
  scripts/test-grpc-phase7.sh
  docs/guides/grpc-phase7-runbook.md
  docs/guides/grpc-phase7-validation-report.md
  docs/guides/grpc-phase7-parity-matrix.md
  e2e/grpc-studio-native-transport.spec.ts
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7I deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7i"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7i' >&2
  exit 1
fi
if ! grep -q '"test:grpc:phase7"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7' >&2
  exit 1
fi

ACCEPTANCE_TEST_COUNT=$(grep -cE "^\s*it\(" "$ROOT/src/shared/grpc/grpcPhase7iAcceptance.test.ts")
CHECKLIST_DESCRIBE_COUNT=$(grep -cE "checklist-[1-8]:" "$ROOT/src/shared/grpc/grpcPhase7iAcceptance.test.ts")
if [[ "${ACCEPTANCE_TEST_COUNT:-0}" -lt 21 ]]; then
  echo "Expected at least 21 Phase 7I acceptance tests, found ${ACCEPTANCE_TEST_COUNT:-0}" >&2
  exit 1
fi
if [[ "${CHECKLIST_DESCRIBE_COUNT:-0}" -lt 8 ]]; then
  echo "Expected 8 checklist describe blocks, found ${CHECKLIST_DESCRIBE_COUNT:-0}" >&2
  exit 1
fi
# Verify gate Step 4 Rust spot-check names are documented in acceptance file
for rust_test in \
  reuse_on_identical_target_returns_same_pool_entry \
  fingerprint_changes_on_tls_mode \
  fingerprint_does_not_include_auth_type \
  cancel_control_is_idempotent_on_terminal_stream \
  end_control_is_idempotent_on_terminal_stream
do
  if ! grep -q "$rust_test" "$ROOT/src/shared/grpc/grpcPhase7iAcceptance.test.ts" \
     && ! grep -q "$rust_test" "$ROOT/scripts/test-grpc-phase7i.sh"; then
    echo "Missing Rust spot-check reference: $rust_test" >&2
    exit 1
  fi
done
echo "✓ Deliverables present (${ACCEPTANCE_TEST_COUNT} acceptance tests declared)"
echo ""

echo "--- Step 1: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 2: Phase 7I acceptance checklist ---"
npx vitest run src/shared/grpc/grpcPhase7iAcceptance.test.ts
echo ""

echo "--- Step 3: Targeted regression bundle ---"
npx vitest run \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/shared/grpc/grpcTransportFallback.test.ts \
  src/shared/grpc/grpcNativeTauriLifecycle.test.ts \
  src/features/grpc/hooks/grpcStudioTabLifecycle.test.ts \
  src/shared/grpc/grpcTauriEventAdapter.test.ts \
  src/shared/grpc/grpcTauriEventAdapter.coverage-gaps.test.ts \
  src/shared/grpc/buildGrpcNodeOperations.test.ts \
  src/shared/grpc/grpcTauriErrorMapping.test.ts \
  src/shared/grpc/grpcPhase7gAcceptance.test.ts \
  src/features/grpc/hooks/grpcStudioUnaryCommands.transport.test.ts \
  src/features/grpc/hooks/useGrpcStreamSession.transport.test.ts \
  src/features/workflow/utils/grpcWorkflowStreamCollector.test.ts
echo ""

echo "--- Step 4: Rust spot-checks (orphan supervisor + channel pool) ---"
(
  cd src-tauri
  cargo test -p redfireforge -- grpc::lifecycle_test 2>&1
  cargo test -p redfireforge reuse_on_identical_target_returns_same_pool_entry 2>&1
  cargo test -p redfireforge fingerprint_changes_on_tls_mode 2>&1
  cargo test -p redfireforge fingerprint_does_not_include_auth_type 2>&1
  cargo test -p redfireforge cancel_control_is_idempotent_on_terminal_stream 2>&1
  cargo test -p redfireforge end_control_is_idempotent_on_terminal_stream 2>&1
)
echo "✓ Rust spot-checks passed"
echo ""

echo "--- Step 5: Phase 7H regression (7A→7H chain) ---"
grpc_gate_run_regression "Phase phase7h" test:grpc:phase7h
echo ""

echo "--- Step 6: Phase 6I regression subset ---"
grpc_gate_run_regression "Phase phase6i" test:grpc:phase6i
echo ""

echo "=== Phase 7I gate: PASSED ==="

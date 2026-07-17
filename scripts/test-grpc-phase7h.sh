#!/usr/bin/env bash
# scripts/test-grpc-phase7h.sh — Phase 7H gate
# Verifies native tab cleanup, orphan supervisor, and lifecycle hooks.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7H gate: gRPC native lifecycle cleanup ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src-tauri/src/grpc/lifecycle.rs
  src-tauri/src/grpc/lifecycle_test.rs
  src-tauri/src/grpc/state.rs
  src/shared/grpc/grpcNativeTauriLifecycle.ts
  src/features/grpc/hooks/grpcStudioTabLifecycle.ts
  scripts/test-grpc-phase7h.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7H deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7h"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7h' >&2
  exit 1
fi
if ! grep -q 'grpc_tab_cleanup' "$ROOT/src-tauri/src/lib.rs"; then
  echo 'lib.rs must register grpc_tab_cleanup (Phase 7H)' >&2
  exit 1
fi
if ! grep -q 'start_orphan_supervisor' "$ROOT/src-tauri/src/lib.rs"; then
  echo 'lib.rs must start orphan supervisor in setup (Phase 7H)' >&2
  exit 1
fi
if ! grep -q 'cleanupGrpcTabNative' "$ROOT/src/shared/grpc/grpcTransportFacade.ts"; then
  echo 'grpcTransportFacade must export cleanupGrpcTabNative (Phase 7H)' >&2
  exit 1
fi
if ! grep -q 'invokeGrpcTabEventsAttachNative' "$ROOT/src/shared/grpc/grpcTauriEventAdapter.ts"; then
  echo 'grpcTauriEventAdapter must attach native listener tracking (Phase 7H)' >&2
  exit 1
fi
if ! grep -q 'registerGrpcStudioAppLifecycle' "$ROOT/src/features/grpc/hooks/useGrpcStudio.ts"; then
  echo 'useGrpcStudio must register app lifecycle cleanup (Phase 7H)' >&2
  exit 1
fi
RUST_TEST_COUNT=$(grep -cE '^\s*#\[test\]' "$ROOT/src-tauri/src/grpc/lifecycle_test.rs")
if [[ "${RUST_TEST_COUNT:-0}" -lt 15 ]]; then
  echo "Expected at least 15 Phase 7H Rust tests, found ${RUST_TEST_COUNT:-0}" >&2
  exit 1
fi
TS_TEST_COUNT=$(grep -cE "^\s*it\(" \
  "$ROOT/src/shared/grpc/grpcNativeTauriLifecycle.test.ts" \
  "$ROOT/src/features/grpc/hooks/grpcStudioTabLifecycle.test.ts" | awk -F: '{sum += $2} END {print sum}')
if [[ "${TS_TEST_COUNT:-0}" -lt 10 ]]; then
  echo "Expected at least 10 Phase 7H-focused TS tests, found ${TS_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${RUST_TEST_COUNT} Rust + ${TS_TEST_COUNT} TS tests declared)"
echo ""

echo "--- Step 1: Rust unit tests (7H lifecycle) ---"
cd src-tauri
cargo test -p redfireforge -- grpc::lifecycle_test 2>&1
CARGO_TEST_COUNT=$(cargo test -p redfireforge -- grpc::lifecycle_test --list 2>&1 | grep -c ': test$' || true)
if [[ "${CARGO_TEST_COUNT:-0}" -ne "${RUST_TEST_COUNT:-0}" ]]; then
  echo "Declared test count (${RUST_TEST_COUNT}) != cargo --list count (${CARGO_TEST_COUNT})" >&2
  exit 1
fi
echo "✓ Cargo test inventory matches declared count (${CARGO_TEST_COUNT})"
cd ..
echo ""

echo "--- Step 2: TypeScript unit tests (7H scope) ---"
npx vitest run \
  src/shared/grpc/grpcNativeTauriLifecycle.test.ts \
  src/features/grpc/hooks/grpcStudioTabLifecycle.test.ts \
  src/shared/grpc/grpcTauriEventAdapter.test.ts
echo ""

echo "--- Step 3: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 4: Phase 7G regression ---"
grpc_gate_run_regression "Phase phase7g" test:grpc:phase7g
echo ""

echo "=== Phase 7H gate: PASSED ==="

#!/usr/bin/env bash
# scripts/test-grpc-phase7c.sh — Phase 7C gate
# Verifies native unary command path (Rust + TS facade).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7C gate: gRPC native unary command path ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src-tauri/src/grpc/state.rs
  src-tauri/src/grpc/call_registry.rs
  src-tauri/src/grpc/envelope.rs
  src-tauri/src/grpc/auth.rs
  src-tauri/src/grpc/descriptor.rs
  src-tauri/src/grpc/unary.rs
  src-tauri/src/grpc/commands.rs
  src-tauri/src/grpc/test_echo_protoset.rs
  src/shared/grpc/grpcTauriDescriptorPayload.ts
  src/shared/grpc/grpcNativeTauriTransport.ts
  src/shared/grpc/grpcTransportFacade.ts
  src/shared/grpc/buildGrpcNodeOperations.ts
  src/shared/grpc/grpcTauriErrorMapping.ts
  scripts/test-grpc-phase7c.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7C deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7c"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7c' >&2
  exit 1
fi
if ! grep -q 'GrpcState::new' "$ROOT/src-tauri/src/lib.rs"; then
  echo 'Missing GrpcState registration in src-tauri/src/lib.rs' >&2
  exit 1
fi
if ! grep -q 'grpc_unary' "$ROOT/src-tauri/src/lib.rs"; then
  echo 'Missing grpc_unary command registration in src-tauri/src/lib.rs' >&2
  exit 1
fi
RUST_TEST_COUNT=$(grep -cE '^\s*#\[tokio::test\]|^\s*#\[test\]' \
  "$ROOT/src-tauri/src/grpc/envelope.rs" \
  "$ROOT/src-tauri/src/grpc/call_registry.rs" \
  "$ROOT/src-tauri/src/grpc/auth.rs" \
  "$ROOT/src-tauri/src/grpc/descriptor_test.rs" \
  "$ROOT/src-tauri/src/grpc/unary.rs" | awk -F: '{sum += $2} END {print sum}')
if [[ "${RUST_TEST_COUNT:-0}" -lt 25 ]]; then
  echo "Expected at least 25 Phase 7C Rust tests, found ${RUST_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${RUST_TEST_COUNT} Rust tests declared)"
echo ""

echo "--- Step 1: Rust unit tests (7C modules) ---"
cd src-tauri
cargo test -p redfireforge -- \
  grpc::envelope \
  grpc::call_registry \
  grpc::auth \
  grpc::descriptor_test \
  grpc::unary::tests \
  2>&1
CARGO_TEST_COUNT=$(cargo test -p redfireforge -- grpc::envelope grpc::call_registry grpc::auth grpc::descriptor_test grpc::unary::tests --list 2>&1 | grep -c ': test$' || true)
if [[ "${CARGO_TEST_COUNT:-0}" -ne "${RUST_TEST_COUNT:-0}" ]]; then
  echo "Declared test count (${RUST_TEST_COUNT}) != cargo --list count (${CARGO_TEST_COUNT})" >&2
  exit 1
fi
echo "✓ Cargo test inventory matches declared count (${CARGO_TEST_COUNT})"
cd ..
echo ""

echo "--- Step 2: Rust integration test (Docker echo, auto-skip) ---"
cd src-tauri
cargo test -p redfireforge -- grpc_unary_echo_round_trip_against_docker_server -- --nocapture 2>&1
cd ..
echo ""

echo "--- Step 3: TypeScript unit tests ---"
npx vitest run \
  src/shared/grpc/grpcNativeTauriTransport.test.ts \
  src/shared/grpc/grpcTransportFacade.test.ts \
  src/shared/grpc/grpcTauriDescriptorPayload.test.ts \
  src/shared/grpc/grpcTauriErrorMapping.test.ts \
  src/shared/grpc/buildGrpcNodeOperations.test.ts
echo ""

echo "--- Step 4: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 5: Phase 7A/7B regression ---"
cd "$ROOT"
grpc_gate_run_regression "Phase phase7a" test:grpc:phase7a
grpc_gate_run_regression "Phase phase7b" test:grpc:phase7b
echo ""

echo "=== Phase 7C gate: PASSED ==="

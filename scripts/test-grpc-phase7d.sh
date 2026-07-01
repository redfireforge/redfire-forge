#!/usr/bin/env bash
# scripts/test-grpc-phase7d.sh — Phase 7D gate
# Verifies native streaming command path (Rust + TS transport + event adapter).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7D gate: gRPC native streaming command path ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src-tauri/src/grpc/stream_registry.rs
  src-tauri/src/grpc/stream.rs
  src-tauri/src/grpc/events.rs
  src-tauri/src/grpc/bytes_codec.rs
  src-tauri/src/grpc/stream_integration_test.rs
  src/shared/grpc/grpcNativeTauriStreamTransport.ts
  src/shared/grpc/grpcTauriEventAdapter.ts
  src/shared/grpc/grpcTauriEventAdapter.test.ts
  src/shared/grpc/grpcNativeTauriStreamTransport.test.ts
  scripts/test-grpc-phase7d.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7D deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7d"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7d' >&2
  exit 1
fi
if ! grep -q 'stream_registry: StreamRegistry' "$ROOT/src-tauri/src/grpc/state.rs"; then
  echo 'Missing stream_registry on GrpcState in state.rs' >&2
  exit 1
fi
if ! grep -q 'grpc_stream_start' "$ROOT/src-tauri/src/lib.rs"; then
  echo 'Missing grpc_stream_start command registration in src-tauri/src/lib.rs' >&2
  exit 1
fi
if ! grep -q 'setGrpcStreamEventsOpener' "$ROOT/src/shared/grpc/grpcStreamClient.ts"; then
  echo 'Missing setGrpcStreamEventsOpener in grpcStreamClient.ts' >&2
  exit 1
fi
RUST_TEST_COUNT=$(grep -cE '^\s*#\[tokio::test\]|^\s*#\[test\]' \
  "$ROOT/src-tauri/src/grpc/stream_registry.rs" \
  "$ROOT/src-tauri/src/grpc/stream.rs" | awk -F: '{sum += $2} END {print sum}')
if [[ "${RUST_TEST_COUNT:-0}" -lt 19 ]]; then
  echo "Expected at least 19 Phase 7D Rust unit tests, found ${RUST_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${RUST_TEST_COUNT} Rust unit tests declared)"
echo ""

echo "--- Step 1: Rust unit tests (7D modules) ---"
cd src-tauri
cargo test -p redfireforge -- \
  grpc::stream_registry \
  grpc::stream::tests \
  2>&1
CARGO_TEST_COUNT=$(cargo test -p redfireforge -- grpc::stream_registry grpc::stream::tests --list 2>&1 | grep -c ': test$' || true)
if [[ "${CARGO_TEST_COUNT:-0}" -ne "${RUST_TEST_COUNT:-0}" ]]; then
  echo "Declared test count (${RUST_TEST_COUNT}) != cargo --list count (${CARGO_TEST_COUNT})" >&2
  exit 1
fi
echo "✓ Cargo test inventory matches declared count (${CARGO_TEST_COUNT})"
cd ..
echo ""

echo "--- Step 2: Rust integration tests (Docker echo, auto-skip) ---"
cd src-tauri
cargo test -p redfireforge -- grpc::stream_integration_test -- --nocapture 2>&1
cd ..
echo ""

echo "--- Step 3: TypeScript unit tests ---"
npx vitest run \
  src/shared/grpc/grpcTauriEventAdapter.test.ts \
  src/shared/grpc/grpcNativeTauriStreamTransport.test.ts
echo ""

echo "--- Step 4: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 5: Phase 7C regression ---"
cd "$ROOT"
grpc_gate_run_regression "Phase phase7c" test:grpc:phase7c
echo ""

echo "=== Phase 7D gate: PASSED ==="

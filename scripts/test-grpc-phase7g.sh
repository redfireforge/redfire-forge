#!/usr/bin/env bash
# scripts/test-grpc-phase7g.sh — Phase 7G gate
# Verifies prost-reflect dynamic codec, descriptor bridge, and native dispatch fixtures.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7G gate: gRPC descriptor-to-prost-reflect integration ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src-tauri/src/grpc/descriptor.rs
  src-tauri/src/grpc/dynamic_codec.rs
  src-tauri/src/grpc/descriptor_test.rs
  src-tauri/src/grpc/test_codec_protoset.rs
  src/shared/grpc/grpcTauriDescriptorBridge.ts
  src/shared/grpc/grpcPhase7gAcceptance.test.ts
  src/shared/grpc/contractFixtures.ts
  scripts/test-grpc-phase7g.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7G deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7g"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7g' >&2
  exit 1
fi
if ! grep -q 'FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD' "$ROOT/src/shared/grpc/contractFixtures.ts"; then
  echo 'contractFixtures.ts must define FIXTURE_CODEC_ACCEPTANCE_DESCRIPTOR_PAYLOAD' >&2
  exit 1
fi
if ! grep -q 'json_value_to_dynamic_message' "$ROOT/src-tauri/src/grpc/dynamic_codec.rs"; then
  echo 'dynamic_codec must use prost-reflect JSON mapping (Phase 7G)' >&2
  exit 1
fi
if ! grep -q 'descriptor_load_error_code' "$ROOT/src-tauri/src/grpc/descriptor.rs"; then
  echo 'descriptor.rs must export descriptor_load_error_code (Phase 7G)' >&2
  exit 1
fi
if ! grep -q 'toGrpcApiClientErrorFromDescriptorPrepare' "$ROOT/src/shared/grpc/grpcTauriErrorMapping.ts"; then
  echo 'grpcTauriErrorMapping.ts must export toGrpcApiClientErrorFromDescriptorPrepare (Phase 7G)' >&2
  exit 1
fi
if ! grep -q 'FIXTURE_ECHO_DESCRIPTOR_PAYLOAD' "$ROOT/src/shared/grpc/contractFixtures.ts"; then
  echo 'contractFixtures.ts must define FIXTURE_ECHO_DESCRIPTOR_PAYLOAD' >&2
  exit 1
fi
RUST_ECHO_SHA=$(grep -A1 'ECHO_PROTOSET_SHA256' "$ROOT/src-tauri/src/grpc/test_echo_protoset.rs" | grep -oE '[0-9a-f]{64}' | head -1)
TS_ECHO_SHA=$(grep -A1 'FIXTURE_TAURI_PROTOSET_CONTENT_SHA256' "$ROOT/src/shared/grpc/contractFixtures.ts" | grep -oE '[0-9a-f]{64}' | head -1)
if [[ "$RUST_ECHO_SHA" != "$TS_ECHO_SHA" ]]; then
  echo "Echo protoset SHA mismatch: Rust=${RUST_ECHO_SHA} TS=${TS_ECHO_SHA}" >&2
  exit 1
fi
RUST_TEST_COUNT=$(grep -cE '^\s*#\[test\]' \
  "$ROOT/src-tauri/src/grpc/descriptor_test.rs")
if [[ "${RUST_TEST_COUNT:-0}" -lt 14 ]]; then
  echo "Expected at least 14 Phase 7G Rust tests, found ${RUST_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (${RUST_TEST_COUNT} Rust codec tests declared)"
echo ""

echo "--- Step 1: Rust unit tests (7G codec) ---"
cd src-tauri
cargo test -p redfireforge -- grpc::descriptor_test 2>&1
CARGO_TEST_COUNT=$(cargo test -p redfireforge -- grpc::descriptor_test --list 2>&1 | grep -c ': test$' || true)
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

echo "--- Step 3: TypeScript unit tests (7G scope) ---"
npx vitest run \
  src/shared/grpc/grpcTauriDescriptorBridge.test.ts \
  src/shared/grpc/grpcPhase7gAcceptance.test.ts \
  src/shared/grpc/grpcTauriDescriptorPayload.test.ts \
  src/shared/grpc/grpcTauriErrorMapping.test.ts
echo ""

echo "--- Step 4: TypeScript check ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 5: Phase 7F regression ---"
grpc_gate_run_regression "Phase phase7f" test:grpc:phase7f
echo ""

echo "=== Phase 7G gate: PASSED ==="

#!/usr/bin/env bash
# scripts/test-grpc-phase7b.sh — Phase 7B gate
# Verifies gRPC channel pool, fingerprinting, and TLS connector.
#
# What this runs:
#   0. Deliverable file checks + pool capacity constant parity
#   1. Rust unit tests for grpc::fingerprint, grpc::tls, grpc::channel_pool
#   2. TypeScript type-check (0 errors required — no new TS files in 7B)
#
# Run with:
#   npm run test:grpc:phase7b
# Or directly:
#   bash scripts/test-grpc-phase7b.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7B gate: gRPC channel pool and transport fingerprinting ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src-tauri/src/grpc/channel_pool.rs
  src-tauri/src/grpc/fingerprint.rs
  src-tauri/src/grpc/tls.rs
  src-tauri/src/grpc/channel_pool_test.rs
  src-tauri/src/grpc/test_pem.rs
  scripts/test-grpc-phase7b.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7B deliverable: $deliverable" >&2
    exit 1
  fi
done
for module in channel_pool fingerprint tls; do
  if ! grep -q "pub mod ${module};" "$ROOT/src-tauri/src/grpc/mod.rs"; then
    echo "Missing src-tauri/src/grpc/mod.rs export: pub mod ${module};" >&2
    exit 1
  fi
done
if ! grep -q '"test:grpc:phase7b"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7b' >&2
  exit 1
fi
POOL_CAPACITY=$(grep -oE 'MAX_CHANNEL_POOL_CAPACITY: usize = [0-9]+' \
  "$ROOT/src-tauri/src/grpc/channel_pool.rs" | awk '{print $NF}')
if [[ "$POOL_CAPACITY" != "32" ]]; then
  echo "MAX_CHANNEL_POOL_CAPACITY must be 32, got: ${POOL_CAPACITY:-<missing>}" >&2
  exit 1
fi
if ! grep -q 'tonic = { version = "0.12"' "$ROOT/src-tauri/Cargo.toml"; then
  echo 'Missing src-tauri/Cargo.toml tonic 0.12 dependency (Phase 7B)' >&2
  exit 1
fi
if ! grep -q 'prost = "0.13"' "$ROOT/src-tauri/Cargo.toml"; then
  echo 'Missing src-tauri/Cargo.toml prost 0.13 dependency (Phase 7B)' >&2
  exit 1
fi
if ! grep -q 'prost-reflect = { version = "0.14"' "$ROOT/src-tauri/Cargo.toml"; then
  echo 'Missing src-tauri/Cargo.toml prost-reflect 0.14 dependency (Phase 7B)' >&2
  exit 1
fi
if ! grep -q 'prost-types = "0.13"' "$ROOT/src-tauri/Cargo.toml"; then
  echo 'Missing src-tauri/Cargo.toml prost-types 0.13 dependency (Phase 7B)' >&2
  exit 1
fi
RUST_TEST_COUNT=$(grep -cE '^\s*#\[tokio::test\]|^\s*#\[test\]' \
  "$ROOT/src-tauri/src/grpc/fingerprint.rs" \
  "$ROOT/src-tauri/src/grpc/tls.rs" \
  "$ROOT/src-tauri/src/grpc/channel_pool_test.rs" | awk -F: '{sum += $2} END {print sum}')
if [[ "${RUST_TEST_COUNT:-0}" -lt 49 ]]; then
  echo "Expected at least 49 Phase 7B Rust tests, found ${RUST_TEST_COUNT:-0}" >&2
  exit 1
fi
echo "✓ Deliverables present (pool capacity = 32, Cargo.toml deps OK, ${RUST_TEST_COUNT} tests declared)"
echo ""

echo "--- Step 1: Rust unit tests (fingerprint + tls + channel_pool) ---"
cd src-tauri
cargo test -p redfireforge -- \
  grpc::fingerprint \
  grpc::tls \
  grpc::channel_pool \
  2>&1
CARGO_TEST_COUNT=$(cargo test -p redfireforge -- grpc::fingerprint grpc::tls grpc::channel_pool --list 2>&1 | grep -c ': test$' || true)
if [[ "${CARGO_TEST_COUNT:-0}" -ne "${RUST_TEST_COUNT:-0}" ]]; then
  echo "Declared test count (${RUST_TEST_COUNT}) != cargo --list count (${CARGO_TEST_COUNT})" >&2
  exit 1
fi
echo "✓ Cargo test inventory matches declared count (${CARGO_TEST_COUNT})"
cd ..
echo ""

echo "--- Step 2: TypeScript check (0 errors required) ---"
grpc_gate_run_tsc plain
echo ""

echo "=== Phase 7B gate: PASSED ==="

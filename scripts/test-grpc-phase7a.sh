#!/usr/bin/env bash
# scripts/test-grpc-phase7a.sh — Phase 7A gate
# Verifies the frozen renderer↔Rust native gRPC contract (types + schema version).
#
# What this runs:
#   1. Deliverable file checks
#   2. TypeScript type-check (0 errors required)
#   3. Vitest contract tests for grpcTauriContracts.ts
#   4. Rust contract round-trip tests (grpc::contract_test only)
#
# Note: channel_pool tests (7B) are intentionally excluded here.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7A gate: gRPC Tauri native API contracts ==="
echo ""

echo "--- Step 0: Deliverable files ---"
DELIVERABLES=(
  src/shared/grpc/grpcTauriContracts.ts
  src/shared/grpc/grpcTauriContracts.test.ts
  src-tauri/src/grpc/types.rs
  src-tauri/src/grpc/mod.rs
  src-tauri/src/grpc/contract_test.rs
  scripts/test-grpc-phase7a.sh
)
for deliverable in "${DELIVERABLES[@]}"; do
  if [[ ! -f "$ROOT/$deliverable" ]]; then
    echo "Missing Phase 7A deliverable: $deliverable" >&2
    exit 1
  fi
done
if ! grep -q 'mod grpc;' "$ROOT/src-tauri/src/lib.rs"; then
  echo 'Missing src-tauri/src/lib.rs module: mod grpc;' >&2
  exit 1
fi
if ! grep -q '"test:grpc:phase7a"' "$ROOT/package.json"; then
  echo 'Missing package.json script: test:grpc:phase7a' >&2
  exit 1
fi
echo "✓ Deliverables present"

TS_SCHEMA_VERSION=$(grep -oE 'GRPC_TAURI_SCHEMA_VERSION = [0-9]+' "$ROOT/src/shared/grpc/grpcTauriContracts.ts" | awk '{print $NF}')
RS_SCHEMA_VERSION=$(grep -oE 'pub const GRPC_TAURI_SCHEMA_VERSION: u32 = [0-9]+' "$ROOT/src-tauri/src/grpc/types.rs" | awk '{print $NF}')
if [[ -z "$TS_SCHEMA_VERSION" || -z "$RS_SCHEMA_VERSION" ]]; then
  echo 'Could not read GRPC_TAURI_SCHEMA_VERSION from TS or Rust contracts' >&2
  exit 1
fi
if [[ "$TS_SCHEMA_VERSION" != "$RS_SCHEMA_VERSION" ]]; then
  echo "Schema version mismatch: TS=$TS_SCHEMA_VERSION Rust=$RS_SCHEMA_VERSION" >&2
  exit 1
fi
echo "✓ Schema version parity: $TS_SCHEMA_VERSION"
echo ""

echo "--- Step 1: TypeScript check (0 errors required) ---"
grpc_gate_run_tsc plain
echo ""

echo "--- Step 2: Contract unit tests (TS) ---"
npx vitest run src/shared/grpc/grpcTauriContracts.test.ts
echo ""

echo "--- Step 3: Contract round-trip tests (Rust) ---"
(
  cd src-tauri
  cargo test -p redfireforge grpc::contract_test
)
echo ""

echo "=== Phase 7A gate: PASSED ==="

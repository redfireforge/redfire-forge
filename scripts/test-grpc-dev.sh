#!/usr/bin/env bash
# gRPC Studio — daily dev loop (TypeScript + product-scoped unit tests).
# Does NOT run phase gate chains or E2E. Use before every commit batch.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== gRPC dev loop (scoped unit tests) ==="
echo ""

# Fresh tsc for dev — ignore stamp so edits are always type-checked.
GRPC_FORCE_TSC=1 grpc_gate_run_tsc project
echo ""

echo "--- Vitest: src/features/grpc + src/shared/grpc + src-server/grpc ---"
npx vitest run \
  src/features/grpc \
  src/shared/grpc \
  src-server/grpc \
  src-server/routes/grpc

echo ""
echo "=== gRPC dev loop: PASSED ==="

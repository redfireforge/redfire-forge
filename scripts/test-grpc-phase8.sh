#!/usr/bin/env bash
# scripts/test-grpc-phase8.sh — Full Phase 8 regression (8A→8I)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 8 full regression: 8A → 8I ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Fast mode: running only Phase 8I hardening gate (GRPC_SKIP_REGRESSION=1) ---"
  npm run test:grpc:phase8i
  echo ""
  echo "=== Phase 8 fast lane: PASSED ==="
  exit 0
fi

for phase in a b c d e f g h i; do
  echo "--- Running test:grpc:phase8${phase} ---"
  npm run "test:grpc:phase8${phase}"
  echo ""
done

echo "=== Phase 8 full regression: PASSED ==="

#!/usr/bin/env bash
# scripts/test-grpc-phase7.sh — Full Phase 7 regression (7A→7I)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 7 full regression: 7A → 7I ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Fast mode: running only Phase 7I hardening gate (GRPC_SKIP_REGRESSION=1) ---"
  npm run test:grpc:phase7i
  echo ""
  echo "=== Phase 7 fast lane: PASSED ==="
  exit 0
fi

for phase in a b c d e f g h i; do
  echo "--- Running test:grpc:phase7${phase} ---"
  npm run "test:grpc:phase7${phase}"
  echo ""
done

echo "=== Phase 7 full regression: PASSED ==="

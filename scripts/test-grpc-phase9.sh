#!/usr/bin/env bash
# scripts/test-grpc-phase9.sh — Full Phase 9 regression (9A→9I)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck source=scripts/grpc-phase-gate-lib.sh
source "$(cd "$(dirname "$0")" && pwd)/grpc-phase-gate-lib.sh"

echo "=== Phase 9 full regression: 9A → 9I ==="
echo ""

if grpc_gate_should_skip_regression; then
  echo "--- Fast mode: running only Phase 9I hardening gate (GRPC_SKIP_REGRESSION=1) ---"
  npm run test:grpc:phase9i
  echo ""
  echo "=== Phase 9 fast lane: PASSED ==="
  exit 0
fi

echo "--- Clearing TypeScript build cache ---"
npx tsc -b --clean
echo ""

for phase in a b c d e f g h i; do
  echo "--- Running test:grpc:phase9${phase} ---"
  npm run "test:grpc:phase9${phase}"
  echo ""
done

echo "=== Phase 9 full regression: PASSED ==="

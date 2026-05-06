#!/bin/bash
# CI Smoke Test Script
# Quick validation for CI/CD pipelines - exits non-zero on failure
#
# Usage: ./examples/scripts/ci-smoke-test.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - Tests failed (error rate > 0)
#   2 - Error (file not found, invalid test, etc.)

set -e

echo "=== RedfireForge CI Smoke Test ==="
echo ""

cd "$(dirname "$0")/../.."
mkdir -p results

# Run quick smoke test with failure detection
npx tsx cli/index.ts run examples/cli-basic-test.yaml \
  --concurrency 1 \
  --transactions 5 \
  --timeout 10 \
  --junit results/ci-smoke.xml \
  --fail-on-error \
  -q

echo "✅ Smoke test passed"

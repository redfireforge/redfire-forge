#!/bin/bash
# Run Load Test Script
# Demonstrates high-load testing with configurable parameters
#
# Usage: 
#   ./examples/scripts/run-load-test.sh                    # Default: 5 concurrent, 100 tx
#   ./examples/scripts/run-load-test.sh 10 500             # 10 concurrent, 500 tx
#   ./examples/scripts/run-load-test.sh 20 1000 30         # 20 concurrent, 1000 tx, 30s timeout

set -e

CONCURRENCY="${1:-5}"
ITERATIONS="${2:-100}"
TIMEOUT="${3:-30}"

echo "=== RedfireForge Load Test ==="
echo ""
echo "Configuration:"
echo "  Concurrency:   $CONCURRENCY"
echo "  Iterations:    $ITERATIONS"
echo "  Timeout:       ${TIMEOUT}s"
echo ""

cd "$(dirname "$0")/../.."
mkdir -p results

# Run with error threshold - continue until 50% error rate
npx tsx cli/index.ts run examples/cli-load-profile.yaml \
  --concurrency "$CONCURRENCY" \
  --iterations "$ITERATIONS" \
  --timeout "$TIMEOUT" \
  --error-policy stop-threshold \
  --max-error-rate 50 \
  --output results/load-results.json \
  --junit results/load-results.xml \
  --markdown results/load-results.md

echo ""
echo "=== Load Test Complete ==="
echo "See results/load-results.md for summary"

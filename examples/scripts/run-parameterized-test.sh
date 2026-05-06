#!/bin/bash
# Run Parameterized Test Script
# Demonstrates data-driven testing with tags
#
# Usage: 
#   ./examples/scripts/run-parameterized-test.sh           # All rows
#   ./examples/scripts/run-parameterized-test.sh smoke     # Smoke tests only
#   ./examples/scripts/run-parameterized-test.sh critical  # Critical tests only

set -e

TAGS="${1:-}"

echo "=== RedfireForge Parameterized Test ==="
echo ""

cd "$(dirname "$0")/../.."

# Create results directory
mkdir -p results

if [ -n "$TAGS" ]; then
  echo "Running with tags: $TAGS"
  echo ""
  npx tsx cli/index.ts run examples/cli-parameterized.yaml \
    --tags "$TAGS" \
    --concurrency 2 \
    --transactions 20 \
    --data-rows-summary results/parameterized-rows.json \
    --output results/parameterized-results.json
else
  echo "Running all data rows..."
  echo ""
  npx tsx cli/index.ts run examples/cli-parameterized.yaml \
    --concurrency 2 \
    --transactions 20 \
    --data-rows-summary results/parameterized-rows.json \
    --output results/parameterized-results.json
fi

echo ""
echo "=== Test Complete ==="

#!/bin/bash
# Run Workflow Test Script
# Demonstrates workflow-based performance testing
#
# Usage: 
#   ./examples/scripts/run-workflow-test.sh                      # Default: 10 iterations
#   ./examples/scripts/run-workflow-test.sh 50 5                 # 50 iterations, concurrency 5
#   ./examples/scripts/run-workflow-test.sh 100 10 userId=3      # With variable override

set -e

ITERATIONS="${1:-10}"
CONCURRENCY="${2:-1}"
VARIABLE="${3:-}"

echo "=== RedfireForge Workflow Test ==="
echo ""
echo "Configuration:"
echo "  Iterations:    $ITERATIONS"
echo "  Concurrency:   $CONCURRENCY"
[ -n "$VARIABLE" ] && echo "  Variable:      $VARIABLE"
echo ""

cd "$(dirname "$0")/../.."
mkdir -p results

VAR_OPTION=""
if [ -n "$VARIABLE" ]; then
  VAR_OPTION="--var $VARIABLE"
fi

npx tsx cli/index.ts workflow examples/workflow-cli-parallel.yaml \
  --iterations "$ITERATIONS" \
  --concurrency "$CONCURRENCY" \
  $VAR_OPTION \
  --output results/workflow-results.json \
  --junit results/workflow-results.xml \
  --markdown results/workflow-results.md

echo ""
echo "=== Workflow Test Complete ==="
echo "See results/workflow-results.md for summary"
